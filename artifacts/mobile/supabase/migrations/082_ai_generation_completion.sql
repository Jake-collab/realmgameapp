-- Migration 082 — NVIDIA Quest generation completion
-- This migration is intentionally forward-only.  AI output is untrusted and
-- promotion is an explicit, service-role operation; it never publishes or
-- awards points.

CREATE TABLE IF NOT EXISTS ai_generation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL DEFAULT 'global',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lane)
);

CREATE TABLE IF NOT EXISTS ai_generation_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES ai_generation_config(id) ON DELETE CASCADE,
  lane TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  config JSONB NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lane, version),
  UNIQUE (config_id, version)
);

CREATE TABLE IF NOT EXISTS ai_generation_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane TEXT NOT NULL CHECK (lane IN ('daily','monthly','geo')),
  version INTEGER NOT NULL CHECK (version > 0),
  prompt JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  change_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lane, version)
);

CREATE OR REPLACE FUNCTION ai_generation_prompt_history_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND (
       NEW.lane <> OLD.lane
       OR NEW.version <> OLD.version
       OR NEW.prompt <> OLD.prompt
       OR NEW.changed_by IS DISTINCT FROM OLD.changed_by
       OR NEW.change_reason <> OLD.change_reason
       OR NEW.created_at <> OLD.created_at
     )) THEN
    RAISE EXCEPTION 'AI generation prompt history is immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ai_generation_prompt_versions_immutable
  ON ai_generation_prompt_versions;
CREATE TRIGGER trg_ai_generation_prompt_versions_immutable
  BEFORE UPDATE OR DELETE ON ai_generation_prompt_versions
  FOR EACH ROW EXECUTE FUNCTION ai_generation_prompt_history_guard();

CREATE OR REPLACE FUNCTION ai_generation_config_history_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AI generation configuration history is immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ai_generation_config_versions_immutable
  ON ai_generation_config_versions;
CREATE TRIGGER trg_ai_generation_config_versions_immutable
  BEFORE UPDATE OR DELETE ON ai_generation_config_versions
  FOR EACH ROW EXECUTE FUNCTION ai_generation_config_history_guard();

CREATE OR REPLACE FUNCTION ai_generation_config_version_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.lane <> OLD.lane OR NEW.version <= OLD.version) THEN
    RAISE EXCEPTION 'AI configuration versions must increase and retain their lane';
  END IF;
  INSERT INTO ai_generation_config_versions
    (config_id,lane,version,config,changed_by,changed_at)
  VALUES
    (NEW.id,NEW.lane,NEW.version,NEW.config,NEW.changed_by,NEW.changed_at);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ai_generation_config_snapshot ON ai_generation_config;
CREATE TRIGGER trg_ai_generation_config_snapshot
  AFTER INSERT OR UPDATE ON ai_generation_config
  FOR EACH ROW EXECUTE FUNCTION ai_generation_config_version_snapshot();
REVOKE ALL ON FUNCTION ai_generation_config_history_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION ai_generation_config_version_snapshot() FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ai_quest_generation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_request_id UUID REFERENCES ai_generation_requests(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  lane TEXT NOT NULL DEFAULT 'global',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  provider TEXT,
  model TEXT,
  config_version INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  input_digest TEXT,
  output_digest TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_scheduler_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL CHECK (job_type IN ('quest_generation','quest_promotion')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','leased','succeeded','failed','cancelled')),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error_code TEXT,
  last_error_message TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_generation_config_versions IS
  'Immutable, auditable global/lane AI configuration history.';
COMMENT ON TABLE ai_quest_generation_attempts IS
  'Durable attempt metadata only; no prompts, raw responses, credentials, or tokens.';
COMMENT ON TABLE ai_scheduler_jobs IS
  'Durable idempotent scheduler state with leases and bounded retries.';

ALTER TABLE ai_generation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_quest_generation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scheduler_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ai_generation_config, ai_generation_config_versions,
  ai_generation_prompt_versions, ai_quest_generation_attempts, ai_scheduler_jobs
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON ai_generation_config, ai_generation_config_versions,
  ai_generation_prompt_versions, ai_quest_generation_attempts, ai_scheduler_jobs
  TO service_role;

CREATE OR REPLACE FUNCTION promote_ai_quest_draft(
  p_content_id UUID,
  p_admin_id UUID,
  p_geo_context JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c ai_generated_content%ROWTYPE;
  d JSONB;
  o JSONB;
  qid UUID;
  oid UUID;
  geo JSONB;
  allowed TEXT[] := ARRAY[
    'title','summary','description','quest_type','difficulty',
    'estimated_duration_minutes','recommended_points','category',
    'interest_bubble_ids','objectives','verification_methods',
    'required_duration_minutes','required_distance_meters','activity_type',
    'proof_type','proof_instructions','safety_notes','accessibility_notes',
    'location_requirement','reasoning_metadata'
  ];
  objective_allowed TEXT[] := ARRAY[
    'sort_order','title','instructions','is_required','is_optional',
    'proof_type','location_requirement_type','completion_rule'
  ];
  methods TEXT[];
  objective JSONB;
  interest_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_admin_id
      AND role IN ('admin','moderator') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'Promotion requires an active administrator'; END IF;

  SELECT * INTO c FROM ai_generated_content WHERE id = p_content_id FOR UPDATE;
  IF NOT FOUND OR c.content_type <> 'quest' OR c.approval_status <> 'approved'
     OR c.published_quest_id IS NOT NULL THEN
    IF c.published_quest_id IS NOT NULL THEN RETURN c.published_quest_id; END IF;
    RAISE EXCEPTION 'Only an approved, unlinked quest draft can be promoted';
  END IF;
  d := c.output_draft;
   IF EXISTS (SELECT 1 FROM jsonb_object_keys(d) AS key_name
             WHERE NOT (key_name = ANY(allowed)))
     OR NOT (d ?& ARRAY['title','summary','description','quest_type',
                         'difficulty','recommended_points','objectives'])
  THEN RAISE EXCEPTION 'Generated quest contains unsupported or missing fields'; END IF;
  IF jsonb_typeof(d->'objectives') <> 'array'
     OR jsonb_array_length(d->'objectives') = 0
  THEN RAISE EXCEPTION 'Quest must contain objectives'; END IF;

   methods := ARRAY(SELECT jsonb_array_elements_text(COALESCE(d->'verification_methods','[]'::jsonb)));
   IF cardinality(methods) = 0 OR NOT (methods <@ ARRAY[
     'camera','gps','timer','integrity_confirmation','activity_tracking'
   ])
    THEN RAISE EXCEPTION 'Unsupported verification method'; END IF;
  IF (d->>'quest_type') NOT IN ('daily','monthly','geo')
     OR (d->>'difficulty') NOT IN ('very_easy','easy','medium','hard','epic')
     OR (d->>'indoor_outdoor') IS NOT NULL
        AND (d->>'indoor_outdoor') NOT IN ('indoor','outdoor','both')
  THEN RAISE EXCEPTION 'Invalid generated quest enum'; END IF;
   IF (d->>'recommended_points')::INTEGER <= 0 THEN RAISE EXCEPTION 'Points must be positive'; END IF;
  IF c.suggested_points IS NOT NULL
      AND c.suggested_points <> (d->>'recommended_points')::INTEGER
    THEN RAISE EXCEPTION 'Generated points do not match the reviewed canonical points'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM point_reward_guidelines g
    WHERE g.activity_type = 'quest' AND g.is_active
      AND g.difficulty = (d->>'difficulty')::difficulty
      AND (d->>'recommended_points')::INTEGER BETWEEN g.suggested_min_points AND g.suggested_max_points
  ) THEN RAISE EXCEPTION 'Points are outside the canonical active guideline'; END IF;
  IF (d->>'quest_type') = 'geo' AND p_geo_context IS NULL
    THEN RAISE EXCEPTION 'Geo quests require explicit administrator geo context'; END IF;
  IF (d->>'quest_type') <> 'geo' AND p_geo_context IS NOT NULL
    THEN RAISE EXCEPTION 'Geo context is only valid for geo quests'; END IF;
  IF p_geo_context IS NOT NULL AND EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_geo_context) k
    WHERE NOT (k = ANY(ARRAY['display_name','public_lat','public_lng',
      'public_radius_meters','address_hint','validation_lat','validation_lng',
      'validation_radius_meters']))
  ) THEN RAISE EXCEPTION 'Unsupported geo context field'; END IF;
  IF p_geo_context IS NOT NULL AND (
    (p_geo_context ? 'public_lat' AND ((p_geo_context->>'public_lat')::DOUBLE PRECISION NOT BETWEEN -90 AND 90))
    OR (p_geo_context ? 'public_lng' AND ((p_geo_context->>'public_lng')::DOUBLE PRECISION NOT BETWEEN -180 AND 180))
    OR (p_geo_context ? 'validation_lat' AND ((p_geo_context->>'validation_lat')::DOUBLE PRECISION NOT BETWEEN -90 AND 90))
    OR (p_geo_context ? 'validation_lng' AND ((p_geo_context->>'validation_lng')::DOUBLE PRECISION NOT BETWEEN -180 AND 180))
  ) THEN RAISE EXCEPTION 'Geo context coordinates are out of range'; END IF;

  INSERT INTO quests (
     slug,title,summary,description,quest_type,status,difficulty,
    estimated_duration_minutes,points_reward,indoor_outdoor,accessibility_notes,
    safety_notes,proof_type,location_requirement_type,created_by,approved_by,
    source_type,ai_generation_id,is_repeatable,repeat_cooldown_hours,
     verification_methods,required_duration_minutes,required_distance_meters,
     activity_type,verification_config
  ) VALUES (
     lower(regexp_replace(trim(d->>'title'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(p_content_id::TEXT, 1, 8),
     d->>'title',d->>'summary',d->>'description',
    (d->>'quest_type')::quest_type,'draft',(d->>'difficulty')::difficulty,
     NULLIF(d->>'estimated_duration_minutes','')::INTEGER,(d->>'recommended_points')::INTEGER,
    COALESCE((d->>'indoor_outdoor')::indoor_outdoor,'both'::indoor_outdoor),
     COALESCE((SELECT string_agg(value, E'\n') FROM jsonb_array_elements_text(COALESCE(d->'accessibility_notes','[]'::jsonb))), ''),
     COALESCE((SELECT string_agg(value, E'\n') FROM jsonb_array_elements_text(COALESCE(d->'safety_notes','[]'::jsonb))), ''),
     COALESCE((d->>'proof_type')::proof_type,'none'::proof_type),
     CASE d->>'location_requirement'
       WHEN 'approximate' THEN 'approximate'::location_requirement_type
       WHEN 'precise' THEN 'precise'::location_requirement_type
       ELSE 'none'::location_requirement_type
     END,
    p_admin_id,p_admin_id,'ai',p_content_id,COALESCE((d->>'is_repeatable')::BOOLEAN,FALSE),
     NULL,methods,
    NULLIF(d->>'required_duration_minutes','')::INTEGER,
     NULLIF(d->>'required_distance_meters','')::NUMERIC,
     NULLIF(d->>'activity_type',''),
     jsonb_build_object(
       'proof_instructions', COALESCE(d->>'proof_instructions',''),
       'category', COALESCE(d->>'category',''),
       'activity_type', d->>'activity_type',
       'required_distance_meters', d->>'required_distance_meters'
     )
  ) RETURNING id INTO qid;

  FOR o IN SELECT value FROM jsonb_array_elements(d->'objectives') LOOP
     objective := CASE WHEN jsonb_typeof(o) = 'string'
       THEN jsonb_build_object('title', left(o #>> '{}', 120), 'instructions', o #>> '{}')
       ELSE o END;
     IF EXISTS (SELECT 1 FROM jsonb_object_keys(objective) AS key_name
               WHERE NOT (key_name = ANY(objective_allowed)))
       OR NOT (objective ?& ARRAY['title','instructions']) THEN
      RAISE EXCEPTION 'Invalid objective fields'; END IF;
    INSERT INTO quest_objectives
      (quest_id,sort_order,title,instructions,is_required,is_optional,proof_type,
       location_requirement_type,completion_rule)
     VALUES (qid,COALESCE((objective->>'sort_order')::INTEGER,0),objective->>'title',objective->>'instructions',
       COALESCE((objective->>'is_required')::BOOLEAN,TRUE),COALESCE((objective->>'is_optional')::BOOLEAN,FALSE),
       COALESCE((objective->>'proof_type')::proof_type,'none'::proof_type),
       COALESCE((objective->>'location_requirement_type')::location_requirement_type,'none'::location_requirement_type),
       COALESCE(objective->>'completion_rule','manual')) RETURNING id INTO oid;
  END LOOP;

   IF jsonb_typeof(d->'interest_bubble_ids') = 'array' THEN
     FOR interest_id IN SELECT value::UUID FROM jsonb_array_elements_text(d->'interest_bubble_ids') LOOP
       IF EXISTS (SELECT 1 FROM interests WHERE id = interest_id) THEN
         INSERT INTO quest_interest_tags (quest_id,interest_id,targeting_mode)
         VALUES (qid,interest_id,'PREFER_COMBINATION')
         ON CONFLICT (quest_id,interest_id) DO NOTHING;
       END IF;
     END LOOP;
   END IF;

  geo := p_geo_context;
  IF geo IS NOT NULL THEN
    INSERT INTO quest_locations (quest_id,display_name,public_lat,public_lng,public_radius_meters,address_hint)
      VALUES (qid,geo->>'display_name',(geo->>'public_lat')::DOUBLE PRECISION,
        (geo->>'public_lng')::DOUBLE PRECISION,COALESCE((geo->>'public_radius_meters')::INTEGER,500),
        geo->>'address_hint');
    IF geo ? 'validation_lat' AND geo ? 'validation_lng' THEN
      INSERT INTO quest_geofences (quest_id,validation_point,validation_radius_meters)
        VALUES (qid,ST_SetSRID(ST_MakePoint((geo->>'validation_lng')::DOUBLE PRECISION,
          (geo->>'validation_lat')::DOUBLE PRECISION),4326)::geography,
          COALESCE((geo->>'validation_radius_meters')::INTEGER,50));
    END IF;
  END IF;
  UPDATE ai_generated_content SET published_quest_id=qid, reviewer_id=p_admin_id,
    reviewed_at=COALESCE(reviewed_at,now()) WHERE id=p_content_id;
  RETURN qid;
END $$;

REVOKE ALL ON FUNCTION promote_ai_quest_draft(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION promote_ai_quest_draft(UUID, UUID, JSONB) TO service_role;