-- Migration 078: configurable Hunt world mechanics
--
-- Advanced mechanics are opt-in. Existing Hunts retain ALWAYS_VISIBLE,
-- fog-disabled, non-persistent behavior unless explicitly configured.
-- Hidden exact validation geometry remains server-only.

ALTER TABLE public.hunts
  ADD COLUMN IF NOT EXISTS advanced_config JSONB NOT NULL DEFAULT jsonb_build_object(
    'defaultRevealMode', 'ALWAYS_VISIBLE',
    'defaultRevealRadiusMeters', 250,
    'fogOfWarEnabled', false,
    'persistentExploration', false,
    'trailEnabled', false
  );

ALTER TABLE public.hunt_stops
  ADD COLUMN IF NOT EXISTS creator_key TEXT,
  ADD COLUMN IF NOT EXISTS zone_key TEXT,
  ADD COLUMN IF NOT EXISTS reveal_mode TEXT NOT NULL DEFAULT 'ALWAYS_VISIBLE',
  ADD COLUMN IF NOT EXISTS reveal_radius_meters INTEGER NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS reveal_after_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS admin_revealed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.hunt_stops
  DROP CONSTRAINT IF EXISTS hunt_stop_reveal_mode_valid;
ALTER TABLE public.hunt_stops
  ADD CONSTRAINT hunt_stop_reveal_mode_valid CHECK (
    reveal_mode IN (
      'ALWAYS_VISIBLE', 'PROXIMITY_REVEAL', 'PREREQUISITE_REVEAL',
      'HUNT_START_REVEAL', 'ZONE_REVEAL', 'CLUE_ONLY', 'MANUAL_ADMIN_REVEAL'
    )
  );
ALTER TABLE public.hunt_stops
  DROP CONSTRAINT IF EXISTS hunt_stop_reveal_radius_valid;
ALTER TABLE public.hunt_stops
  ADD CONSTRAINT hunt_stop_reveal_radius_valid CHECK (
    reveal_radius_meters BETWEEN 25 AND 5000
  );

-- Older deployments used the single geofence row for both display and
-- validation. Keep the explicit flag available for the existing secure
-- validation query while defaulting the canonical row to validation-only.
ALTER TABLE public.hunt_stop_geofences
  ADD COLUMN IF NOT EXISTS is_validation_zone BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.hunt_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id UUID NOT NULL REFERENCES public.hunts(id) ON DELETE CASCADE,
  zone_key TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  prerequisite_zone_keys TEXT[] NOT NULL DEFAULT '{}',
  public_center_lat DOUBLE PRECISION,
  public_center_lng DOUBLE PRECISION,
  public_radius_meters INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hunt_id, zone_key),
  CHECK (char_length(trim(zone_key)) BETWEEN 1 AND 80),
  CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  CHECK (public_radius_meters BETWEEN 25 AND 10000),
  CHECK (public_center_lat IS NULL OR public_center_lat BETWEEN -90 AND 90),
  CHECK (public_center_lng IS NULL OR public_center_lng BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS public.hunt_stop_dependencies (
  hunt_stop_id UUID NOT NULL REFERENCES public.hunt_stops(id) ON DELETE CASCADE,
  prerequisite_stop_id UUID NOT NULL REFERENCES public.hunt_stops(id) ON DELETE CASCADE,
  required_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hunt_stop_id, prerequisite_stop_id),
  CHECK (hunt_stop_id <> prerequisite_stop_id),
  CHECK (required_count = 1)
);

CREATE TABLE IF NOT EXISTS public.hunt_participant_exploration_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_participation_id UUID NOT NULL REFERENCES public.hunt_participants(id) ON DELETE CASCADE,
  cell_key TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hunt_participation_id, cell_key),
  CHECK (center_lat BETWEEN -90 AND 90),
  CHECK (center_lng BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_hunt_zones_hunt_order
  ON public.hunt_zones (hunt_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_hunt_stop_dependencies_prerequisite
  ON public.hunt_stop_dependencies (prerequisite_stop_id);
CREATE INDEX IF NOT EXISTS idx_hunt_exploration_participant
  ON public.hunt_participant_exploration_cells (hunt_participation_id, discovered_at);

ALTER TABLE public.hunt_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_stop_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_participant_exploration_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_zones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_stop_dependencies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_participant_exploration_cells FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hunt_participant_exploration_cells FROM anon, authenticated;
GRANT SELECT ON TABLE public.hunt_participant_exploration_cells TO service_role;

CREATE OR REPLACE FUNCTION public.assert_hunt_dependency_graph_acyclic(p_hunt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE walk(start_stop, current_stop, path, cycle) AS (
      SELECT d.hunt_stop_id, d.prerequisite_stop_id,
             ARRAY[d.hunt_stop_id, d.prerequisite_stop_id]::UUID[], FALSE
      FROM hunt_stop_dependencies d
      JOIN hunt_stops s ON s.id = d.hunt_stop_id
      WHERE s.hunt_id = p_hunt_id
      UNION ALL
      SELECT w.start_stop, d.prerequisite_stop_id,
             w.path || d.prerequisite_stop_id,
             d.prerequisite_stop_id = ANY(w.path)
      FROM walk w
      JOIN hunt_stop_dependencies d ON d.hunt_stop_id = w.current_stop
      WHERE NOT w.cycle
    )
    SELECT 1 FROM walk WHERE cycle
  ) THEN
    RAISE EXCEPTION 'hunt_objective_dependency_cycle';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_advanced_hunt_config(p_hunt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config JSONB;
  v_zone RECORD;
BEGIN
  SELECT advanced_config INTO v_config FROM hunts WHERE id = p_hunt_id;
  IF COALESCE(v_config->>'defaultRevealMode', 'ALWAYS_VISIBLE') NOT IN (
    'ALWAYS_VISIBLE', 'PROXIMITY_REVEAL', 'PREREQUISITE_REVEAL',
    'HUNT_START_REVEAL', 'ZONE_REVEAL', 'CLUE_ONLY', 'MANUAL_ADMIN_REVEAL'
  ) THEN
    RAISE EXCEPTION 'invalid_default_reveal_mode';
  END IF;
  IF COALESCE((v_config->>'defaultRevealRadiusMeters')::INTEGER, 250) NOT BETWEEN 25 AND 5000 THEN
    RAISE EXCEPTION 'invalid_default_reveal_radius';
  END IF;
  FOR v_zone IN SELECT * FROM hunt_zones WHERE hunt_id = p_hunt_id LOOP
    IF EXISTS (
      SELECT 1
      FROM unnest(v_zone.prerequisite_zone_keys) AS dependency
      WHERE dependency = v_zone.zone_key
         OR NOT EXISTS (
           SELECT 1 FROM hunt_zones z
           WHERE z.hunt_id = p_hunt_id AND z.zone_key = dependency
         )
    ) THEN
      RAISE EXCEPTION 'invalid_zone_dependency';
    END IF;
  END LOOP;
  PERFORM assert_hunt_dependency_graph_acyclic(p_hunt_id);
END;
$$;

-- Called after the existing creator stop replacement. It persists all advanced
-- configuration through the same draft RPCs and keeps creator-local stable keys
-- separate from database UUIDs.
CREATE OR REPLACE FUNCTION public.apply_advanced_hunt_config(
  p_hunt_id UUID,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone JSONB;
BEGIN
  UPDATE hunts
  SET advanced_config = jsonb_build_object(
    'defaultRevealMode', COALESCE(p_payload->>'defaultRevealMode', 'ALWAYS_VISIBLE'),
    'defaultRevealRadiusMeters', COALESCE((p_payload->>'defaultRevealRadiusMeters')::INTEGER, 250),
    'fogOfWarEnabled', COALESCE((p_payload->>'fogOfWarEnabled')::BOOLEAN, FALSE),
    'persistentExploration', COALESCE((p_payload->>'persistentExploration')::BOOLEAN, FALSE),
    'trailEnabled', COALESCE((p_payload->>'trailEnabled')::BOOLEAN, FALSE)
  )
  WHERE id = p_hunt_id;

  DELETE FROM hunt_zones WHERE hunt_id = p_hunt_id;
  FOR v_zone IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'zones', '[]'::JSONB)) LOOP
    INSERT INTO hunt_zones (
      hunt_id, zone_key, name, sort_order, is_required,
      prerequisite_zone_keys, public_center_lat, public_center_lng, public_radius_meters
    )
    VALUES (
      p_hunt_id,
      LEFT(TRIM(COALESCE(v_zone->>'key', 'zone')), 80),
      LEFT(TRIM(COALESCE(v_zone->>'name', 'Zone')), 120),
      COALESCE((v_zone->>'sortOrder')::INTEGER, 0),
      COALESCE((v_zone->>'required')::BOOLEAN, TRUE),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_zone->'prerequisiteZoneKeys', '[]'::JSONB))),
      NULLIF(v_zone->>'publicCenterLat', '')::DOUBLE PRECISION,
      NULLIF(v_zone->>'publicCenterLng', '')::DOUBLE PRECISION,
      COALESCE((v_zone->>'publicRadiusMeters')::INTEGER, 500)
    );
  END LOOP;

  -- Match by the stable creator array key or by the server UUID for existing
  -- stops. No client-supplied coordinates are copied into validation fields.
  UPDATE hunt_stops s
  SET creator_key = incoming.value->>'id',
      zone_key = NULLIF(incoming.value->>'zoneKey', ''),
      reveal_mode = COALESCE(incoming.value->>'revealMode', h.advanced_config->>'defaultRevealMode', 'ALWAYS_VISIBLE'),
      reveal_radius_meters = LEAST(5000, GREATEST(25, COALESCE((incoming.value->>'revealRadiusMeters')::INTEGER, (h.advanced_config->>'defaultRevealRadiusMeters')::INTEGER, 250))),
      reveal_after_seconds = NULLIF(incoming.value->>'revealAfterSeconds', '')::INTEGER,
      admin_revealed = COALESCE((incoming.value->>'adminRevealed')::BOOLEAN, FALSE)
  FROM hunts h,
       jsonb_array_elements(COALESCE(p_payload->'stops', '[]'::JSONB)) WITH ORDINALITY AS incoming(value, position)
  WHERE s.hunt_id = p_hunt_id
    AND h.id = p_hunt_id
    AND s.sort_order = incoming.position - 1;

  DELETE FROM hunt_stop_dependencies d
  USING hunt_stops s
  WHERE s.id = d.hunt_stop_id AND s.hunt_id = p_hunt_id;

  INSERT INTO hunt_stop_dependencies (hunt_stop_id, prerequisite_stop_id)
  SELECT dependent.id, prerequisite.id
  FROM jsonb_array_elements(COALESCE(p_payload->'stops', '[]'::JSONB)) WITH ORDINALITY AS incoming(value, position)
  JOIN hunt_stops dependent ON dependent.hunt_id = p_hunt_id AND dependent.sort_order = incoming.position - 1
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(incoming.value->'prerequisiteStopIds', '[]'::JSONB)) AS dependency(key)
  JOIN hunt_stops prerequisite ON prerequisite.hunt_id = p_hunt_id AND prerequisite.creator_key = dependency.key
  WHERE dependent.id <> prerequisite.id
  ON CONFLICT DO NOTHING;

  PERFORM validate_advanced_hunt_config(p_hunt_id);
END;
$$;

-- The original creator function cast every incoming id to UUID. New local
-- drafts use stable local keys until the first save, so resolve existing rows
-- by either server UUID or creator_key and never cast untrusted text to UUID.
CREATE OR REPLACE FUNCTION public.replace_creator_hunt_stops(
  p_hunt_id UUID,
  p_stops JSONB,
  p_ordering TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stop JSONB;
  v_stop_id UUID;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_position BIGINT;
BEGIN
  DELETE FROM hunt_stops s
  WHERE s.hunt_id = p_hunt_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_stops, '[]'::JSONB)) incoming
      WHERE incoming->>'id' = s.id::TEXT OR incoming->>'id' = s.creator_key
    );

  FOR v_stop, v_position IN
    SELECT value, ordinality
    FROM jsonb_array_elements(COALESCE(p_stops, '[]'::JSONB)) WITH ORDINALITY
  LOOP
    v_lat := NULLIF(v_stop->>'publicLat', '')::DOUBLE PRECISION;
    v_lng := NULLIF(v_stop->>'publicLng', '')::DOUBLE PRECISION;
    SELECT id INTO v_stop_id
    FROM hunt_stops
    WHERE hunt_id = p_hunt_id
      AND (id::TEXT = v_stop->>'id' OR creator_key = v_stop->>'id')
    LIMIT 1;

    INSERT INTO hunt_stops (
      id, hunt_id, creator_key, sort_order, title, description,
      is_ordered, is_required, is_hidden, stop_role, estimated_radius_meters,
      completion_method, proof_required, zone_key, reveal_mode,
      reveal_radius_meters, reveal_after_seconds, admin_revealed
    )
    VALUES (
      COALESCE(v_stop_id, gen_random_uuid()),
      p_hunt_id,
      v_stop->>'id',
      v_position - 1,
      LEFT(COALESCE(v_stop->>'title', 'Untitled stop'), 120),
      NULLIF(v_stop->>'description', ''),
      p_ordering = 'ordered',
      COALESCE((v_stop->>'isRequired')::BOOLEAN, TRUE),
      TRUE,
      CASE
        WHEN v_position = 1 THEN 'start'
        WHEN v_position = jsonb_array_length(COALESCE(p_stops, '[]'::JSONB)) THEN 'final'
        ELSE 'waypoint'
      END,
      COALESCE((v_stop->>'publicRadius')::INTEGER, 500),
      CASE COALESCE(v_stop->>'completionMethod', 'none')
        WHEN 'photo_and_location' THEN 'image_and_location'
        WHEN 'photo' THEN 'image'
        WHEN 'location' THEN 'location'
        WHEN 'text' THEN 'text'
        ELSE 'manual_confirmation'
      END,
      COALESCE(v_stop->>'completionMethod', 'none') <> 'none',
      NULLIF(v_stop->>'zoneKey', ''),
      COALESCE(v_stop->>'revealMode', 'ALWAYS_VISIBLE'),
      LEAST(5000, GREATEST(25, COALESCE((v_stop->>'revealRadiusMeters')::INTEGER, 250))),
      NULLIF(v_stop->>'revealAfterSeconds', '')::INTEGER,
      COALESCE((v_stop->>'adminRevealed')::BOOLEAN, FALSE)
    )
    ON CONFLICT (id) DO UPDATE SET
      creator_key = EXCLUDED.creator_key,
      sort_order = EXCLUDED.sort_order,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      is_ordered = EXCLUDED.is_ordered,
      is_required = EXCLUDED.is_required,
      is_hidden = EXCLUDED.is_hidden,
      stop_role = EXCLUDED.stop_role,
      estimated_radius_meters = EXCLUDED.estimated_radius_meters,
      completion_method = EXCLUDED.completion_method,
      proof_required = EXCLUDED.proof_required,
      zone_key = EXCLUDED.zone_key,
      reveal_mode = EXCLUDED.reveal_mode,
      reveal_radius_meters = EXCLUDED.reveal_radius_meters,
      reveal_after_seconds = EXCLUDED.reveal_after_seconds,
      admin_revealed = EXCLUDED.admin_revealed
    WHERE hunt_stops.hunt_id = p_hunt_id
    RETURNING id INTO v_stop_id;

    DELETE FROM hunt_clues WHERE hunt_stop_id = v_stop_id AND sort_order = 0;
    INSERT INTO hunt_clues (hunt_stop_id, sort_order, clue_text, hint_text)
    VALUES (v_stop_id, 0, NULLIF(v_stop->>'clueText', ''), NULLIF(v_stop->>'hintText', ''));

    DELETE FROM hunt_stop_geofences WHERE hunt_stop_id = v_stop_id;
    INSERT INTO hunt_stop_geofences (
      hunt_stop_id, public_lat, public_lng, public_radius_meters,
      validation_point, validation_radius_meters, is_validation_zone
    )
    VALUES (
      v_stop_id, v_lat, v_lng,
      COALESCE((v_stop->>'publicRadius')::INTEGER, 500),
      CASE WHEN v_lat IS NOT NULL AND v_lng IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::GEOGRAPHY
        ELSE NULL END,
      COALESCE((v_stop->>'validationRadius')::INTEGER, 30),
      TRUE
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_hunt_response(p_hunt_id UUID)
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', h.id,
    'title', h.title,
    'summary', h.summary,
    'description', h.description,
    'difficulty', h.difficulty,
    'pointsReward', h.points_reward,
    'estimatedDurationMinutes', h.estimated_duration_minutes,
    'stopOrdering', h.stop_ordering,
    'participationMode', h.participation_mode,
    'startModel', h.start_model,
    'startsAt', h.starts_at,
    'endsAt', h.ends_at,
    'privacy', h.privacy,
    'maxParticipants', h.max_participants,
    'publicMeetingInfo', h.public_meeting_info,
    'safetyNote', COALESCE(h.safety_note, ''),
    'accessibilityNote', COALESCE(h.accessibility_note, ''),
    'coverMediaId', h.cover_media_id,
    'status', h.status,
    'updatedAt', h.updated_at,
    'defaultRevealMode', COALESCE(h.advanced_config->>'defaultRevealMode', 'ALWAYS_VISIBLE'),
    'defaultRevealRadiusMeters', COALESCE((h.advanced_config->>'defaultRevealRadiusMeters')::INTEGER, 250),
    'fogOfWarEnabled', COALESCE((h.advanced_config->>'fogOfWarEnabled')::BOOLEAN, FALSE),
    'persistentExploration', COALESCE((h.advanced_config->>'persistentExploration')::BOOLEAN, FALSE),
    'trailEnabled', COALESCE((h.advanced_config->>'trailEnabled')::BOOLEAN, FALSE),
    'zones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', z.zone_key, 'name', z.name, 'sortOrder', z.sort_order,
        'required', z.is_required, 'prerequisiteZoneKeys', z.prerequisite_zone_keys,
        'publicCenterLat', z.public_center_lat, 'publicCenterLng', z.public_center_lng,
        'publicRadiusMeters', z.public_radius_meters
      ) ORDER BY z.sort_order)
      FROM hunt_zones z WHERE z.hunt_id = h.id
    ), '[]'::JSONB),
    'stops', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'description', COALESCE(s.description, ''),
        'clueText', COALESCE(c.clue_text, ''), 'hintText', COALESCE(c.hint_text, ''),
        'completionMethod', CASE s.completion_method
          WHEN 'image_and_location' THEN 'photo_and_location'
          WHEN 'image' THEN 'photo'
          WHEN 'location' THEN 'location'
          WHEN 'text' THEN 'text'
          ELSE 'none'
        END,
        'isRequired', s.is_required,
        'publicLat', g.public_lat, 'publicLng', g.public_lng,
        'publicRadius', COALESCE(g.public_radius_meters, 500),
        'validationRadius', COALESCE(g.validation_radius_meters, 30),
        'revealMode', s.reveal_mode,
        'revealRadiusMeters', s.reveal_radius_meters,
        'revealAfterSeconds', s.reveal_after_seconds,
        'zoneKey', s.zone_key,
        'prerequisiteStopIds', COALESCE((
          SELECT jsonb_agg(dep.creator_key)
          FROM hunt_stop_dependencies d
          JOIN hunt_stops dep ON dep.id = d.prerequisite_stop_id
          WHERE d.hunt_stop_id = s.id
        ), '[]'::JSONB)
      ) ORDER BY s.sort_order)
      FROM hunt_stops s
      LEFT JOIN hunt_clues c ON c.hunt_stop_id = s.id AND c.is_active
      LEFT JOIN hunt_stop_geofences g ON g.hunt_stop_id = s.id
      WHERE s.hunt_id = h.id
    ), '[]'::JSONB)
  )
  FROM hunts h
  WHERE h.id = p_hunt_id AND h.creator_user_id = auth.uid();
$$;

-- Keep the original creator lifecycle but persist advanced config immediately
-- after its existing secure stop replacement.
CREATE OR REPLACE FUNCTION public.create_hunt_draft(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hunt_id UUID;
  v_slug TEXT;
  v_title TEXT := LEFT(TRIM(COALESCE(NULLIF(p_payload->>'title', ''), 'Untitled Hunt')), 120);
BEGIN
  PERFORM assert_hunt_creator_eligible();
  IF NULLIF(p_payload->>'coverMediaId', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM media_assets
      WHERE id = (p_payload->>'coverMediaId')::UUID
        AND owner_user_id = auth.uid()
        AND bucket = 'custom-game-media'
        AND media_type = 'image'
    ) THEN
    RAISE EXCEPTION 'invalid_cover_media';
  END IF;
  v_slug := lower(regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8);
  INSERT INTO hunts (
    slug, title, summary, description, hunt_type, status, creator_user_id,
    privacy, join_policy, points_reward, estimated_duration_minutes,
    difficulty, max_participants, starts_at, ends_at, registration_deadline,
    public_meeting_info, safety_note, accessibility_note, cover_media_id,
    stop_ordering, participation_mode, start_model
  ) VALUES (
    v_slug, v_title, LEFT(COALESCE(p_payload->>'summary', ''), 240),
    COALESCE(p_payload->>'description', ''), 'custom', 'draft', auth.uid(),
    COALESCE((p_payload->>'privacy')::hunt_privacy, 'public'),
    CASE WHEN COALESCE(p_payload->>'privacy', 'public') = 'invite_only' THEN 'invite_only'::hunt_join_policy ELSE 'open'::hunt_join_policy END,
    GREATEST(1, COALESCE((p_payload->>'pointsReward')::INTEGER, 100)),
    NULLIF((p_payload->>'estimatedDurationMinutes')::INTEGER, 0),
    COALESCE((p_payload->>'difficulty')::difficulty, 'medium'),
    NULLIF((p_payload->>'maxParticipants')::INTEGER, 0),
    NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    NULLIF(p_payload->>'endsAt', '')::TIMESTAMPTZ,
    NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    NULLIF(p_payload->>'publicMeetingInfo', ''),
    NULLIF(p_payload->>'safetyNote', ''),
    NULLIF(p_payload->>'accessibilityNote', ''),
    NULLIF(p_payload->>'coverMediaId', '')::UUID,
    COALESCE(p_payload->>'stopOrdering', 'ordered'),
    COALESCE((p_payload->>'participationMode')::participation_mode, 'solo'),
    COALESCE((p_payload->>'startModel')::hunt_start_model, 'individual')
  ) RETURNING id INTO v_hunt_id;
  PERFORM replace_creator_hunt_stops(v_hunt_id, p_payload->'stops', COALESCE(p_payload->>'stopOrdering', 'ordered'));
  PERFORM apply_advanced_hunt_config(v_hunt_id, p_payload);
  RETURN creator_hunt_response(v_hunt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_hunt_draft(p_hunt_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM hunts WHERE id = p_hunt_id AND creator_user_id = auth.uid() AND status = 'draft'
  ) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NULLIF(p_payload->>'coverMediaId', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM media_assets
      WHERE id = (p_payload->>'coverMediaId')::UUID
        AND owner_user_id = auth.uid()
        AND bucket = 'custom-game-media'
        AND media_type = 'image'
    ) THEN
    RAISE EXCEPTION 'invalid_cover_media';
  END IF;
  UPDATE hunts SET
    title = LEFT(TRIM(COALESCE(p_payload->>'title', title)), 120),
    summary = LEFT(COALESCE(p_payload->>'summary', summary), 240),
    description = COALESCE(p_payload->>'description', description),
    privacy = COALESCE((p_payload->>'privacy')::hunt_privacy, privacy),
    join_policy = CASE WHEN COALESCE(p_payload->>'privacy', privacy::TEXT) = 'invite_only' THEN 'invite_only'::hunt_join_policy ELSE 'open'::hunt_join_policy END,
    points_reward = GREATEST(1, COALESCE((p_payload->>'pointsReward')::INTEGER, points_reward)),
    estimated_duration_minutes = NULLIF((p_payload->>'estimatedDurationMinutes')::INTEGER, 0),
    difficulty = COALESCE((p_payload->>'difficulty')::difficulty, difficulty),
    max_participants = NULLIF((p_payload->>'maxParticipants')::INTEGER, 0),
    starts_at = NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    ends_at = NULLIF(p_payload->>'endsAt', '')::TIMESTAMPTZ,
    registration_deadline = NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    public_meeting_info = NULLIF(p_payload->>'publicMeetingInfo', ''),
    safety_note = NULLIF(p_payload->>'safetyNote', ''),
    accessibility_note = NULLIF(p_payload->>'accessibilityNote', ''),
    cover_media_id = NULLIF(p_payload->>'coverMediaId', '')::UUID,
    stop_ordering = COALESCE(p_payload->>'stopOrdering', stop_ordering::TEXT),
    participation_mode = COALESCE((p_payload->>'participationMode')::participation_mode, participation_mode),
    start_model = COALESCE((p_payload->>'startModel')::hunt_start_model, start_model)
  WHERE id = p_hunt_id;
  PERFORM replace_creator_hunt_stops(p_hunt_id, p_payload->'stops', COALESCE(p_payload->>'stopOrdering', 'ordered'));
  PERFORM apply_advanced_hunt_config(p_hunt_id, p_payload);
  RETURN creator_hunt_response(p_hunt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_hunt(p_hunt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hunt hunts%ROWTYPE;
BEGIN
  SELECT * INTO v_hunt FROM hunts WHERE id = p_hunt_id AND creator_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_hunt.status <> 'draft' THEN RAISE EXCEPTION 'only_drafts_can_be_submitted'; END IF;
  PERFORM validate_creator_hunt_payload(creator_hunt_response(p_hunt_id));
  PERFORM validate_advanced_hunt_config(p_hunt_id);
  PERFORM assert_creator_hunt_sweep_evidence(p_hunt_id, v_hunt.version);
  INSERT INTO hunt_submitted_versions(hunt_id, version_no, content_snapshot, cover_media_id, submitted_by)
  VALUES(p_hunt_id, v_hunt.version, creator_hunt_response(p_hunt_id), v_hunt.cover_media_id, auth.uid());
  UPDATE hunts SET status = 'pending_review' WHERE id = p_hunt_id;
  INSERT INTO moderation_cases(entity_type, entity_id)
  SELECT 'hunt', p_hunt_id
  WHERE NOT EXISTS (SELECT 1 FROM moderation_cases WHERE entity_type = 'hunt' AND entity_id = p_hunt_id AND status = 'open');
  RETURN jsonb_build_object('hunt_id', p_hunt_id, 'status', 'pending_review', 'occurrence_id', NULL);
END;
$$;

-- Re-evaluate reveal rules on every authorized active-state read. The only
-- coordinates exposed later are public display coordinates for rows with a
-- participant-owned revealed_at timestamp.
CREATE OR REPLACE FUNCTION public.refresh_hunt_reveals(p_participation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_stop RECORD;
  v_zone_unlocked BOOLEAN;
  v_dependencies_done BOOLEAN;
  v_eligible BOOLEAN;
BEGIN
  SELECT hp.*, h.advanced_config
  INTO v_participant
  FROM hunt_participants hp
  JOIN hunts h ON h.id = hp.hunt_id
  WHERE hp.id = p_participation_id
    AND hp.user_id = auth.uid()
    AND hp.status IN ('active', 'paused');
  IF NOT FOUND THEN RETURN; END IF;

  FOR v_stop IN
    SELECT s.*, p.status AS progress_status, p.revealed_at
    FROM hunt_stops s
    JOIN hunt_stop_progress p ON p.hunt_stop_id = s.id AND p.hunt_participant_id = p_participation_id
    WHERE s.hunt_id = v_participant.hunt_id
  LOOP
    SELECT NOT EXISTS (
      SELECT 1 FROM hunt_zones z
      WHERE z.hunt_id = v_participant.hunt_id
        AND z.zone_key = v_stop.zone_key
        AND EXISTS (
          SELECT 1
          FROM unnest(z.prerequisite_zone_keys) prereq
          WHERE NOT EXISTS (
            SELECT 1
            FROM hunt_stops zs
            JOIN hunt_stop_progress zp ON zp.hunt_stop_id = zs.id AND zp.hunt_participant_id = p_participation_id
            WHERE zs.hunt_id = v_participant.hunt_id AND zs.zone_key = prereq
            GROUP BY zs.zone_key
            HAVING COUNT(*) FILTER (WHERE zs.is_required AND zp.status = 'completed')
                   >= COUNT(*) FILTER (WHERE zs.is_required)
          )
        )
    ) INTO v_zone_unlocked;

    SELECT NOT EXISTS (
      SELECT 1
      FROM hunt_stop_dependencies d
      JOIN hunt_stop_progress dp ON dp.hunt_stop_id = d.prerequisite_stop_id
        AND dp.hunt_participant_id = p_participation_id
      WHERE d.hunt_stop_id = v_stop.id AND dp.status <> 'completed'
    ) INTO v_dependencies_done;

    v_eligible := CASE v_stop.reveal_mode
      WHEN 'ALWAYS_VISIBLE' THEN TRUE
      WHEN 'HUNT_START_REVEAL' THEN v_participant.started_at IS NOT NULL
      WHEN 'PREREQUISITE_REVEAL' THEN v_dependencies_done
      WHEN 'ZONE_REVEAL' THEN v_zone_unlocked
      WHEN 'CLUE_ONLY' THEN TRUE
      WHEN 'MANUAL_ADMIN_REVEAL' THEN v_stop.admin_revealed
      ELSE v_stop.revealed_at IS NOT NULL
    END;
    IF v_eligible
       AND v_stop.reveal_after_seconds IS NOT NULL
       AND v_participant.started_at IS NOT NULL
       AND v_participant.started_at + make_interval(secs => v_stop.reveal_after_seconds) > NOW() THEN
      v_eligible := FALSE;
    END IF;

    IF v_eligible AND v_stop.revealed_at IS NULL THEN
      UPDATE hunt_stop_progress
      SET revealed_at = NOW(),
          unlocked_at = COALESCE(unlocked_at, NOW()),
          status = CASE WHEN status = 'not_started' THEN 'available' ELSE status END,
          updated_at = NOW()
      WHERE hunt_participant_id = p_participation_id
        AND hunt_stop_id = v_stop.id
        AND status NOT IN ('completed', 'expired');
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_hunt_exploration_sample(
  p_participation_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_meters DOUBLE PRECISION DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_hunt_id UUID;
  v_config JSONB;
  v_started_at TIMESTAMPTZ;
  v_cell_lat DOUBLE PRECISION;
  v_cell_lng DOUBLE PRECISION;
  v_cell_key TEXT;
BEGIN
  IF v_uid IS NULL OR p_accuracy_meters IS NULL OR p_accuracy_meters > 150
     OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'INVALID_LOCATION');
  END IF;
  SELECT hp.hunt_id, hp.started_at, h.advanced_config INTO v_hunt_id, v_started_at, v_config
  FROM hunt_participants hp JOIN hunts h ON h.id = hp.hunt_id
  WHERE hp.id = p_participation_id AND hp.user_id = v_uid AND hp.status IN ('active', 'paused');
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'INVALID_PARTICIPATION'); END IF;

  -- A 2-decimal grid is roughly kilometre-scale and is intentionally much
  -- coarser than a GPS trail. It is enough to reconstruct exploration.
  v_cell_lat := round(p_latitude::numeric, 2);
  v_cell_lng := round(p_longitude::numeric, 2);
  v_cell_key := v_cell_lat::TEXT || ':' || v_cell_lng::TEXT;
  IF COALESCE((v_config->>'fogOfWarEnabled')::BOOLEAN, FALSE)
     AND COALESCE((v_config->>'persistentExploration')::BOOLEAN, FALSE) THEN
    INSERT INTO hunt_participant_exploration_cells (
      hunt_participation_id, cell_key, center_lat, center_lng
    ) VALUES (p_participation_id, v_cell_key, v_cell_lat, v_cell_lng)
    ON CONFLICT (hunt_participation_id, cell_key) DO NOTHING;
  END IF;

  -- Proximity reveal uses public display geometry for discovery only. It does
  -- not change the server-side validation geometry used by completion.
  UPDATE hunt_stop_progress progress
  SET revealed_at = NOW(),
      unlocked_at = COALESCE(unlocked_at, NOW()),
      status = CASE WHEN progress.status = 'not_started' THEN 'available' ELSE progress.status END,
      updated_at = NOW()
  FROM hunt_stops stop
  JOIN hunt_stop_geofences display ON display.hunt_stop_id = stop.id
  WHERE progress.hunt_participant_id = p_participation_id
    AND progress.hunt_stop_id = stop.id
    AND progress.revealed_at IS NULL
    AND stop.reveal_mode = 'PROXIMITY_REVEAL'
    AND (
      stop.reveal_after_seconds IS NULL
      OR v_started_at IS NULL
      OR v_started_at + make_interval(secs => stop.reveal_after_seconds) <= NOW()
    )
    AND display.public_lat IS NOT NULL AND display.public_lng IS NOT NULL
    AND (
      6371000 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(display.public_lat)) * cos(radians(p_latitude)) *
        cos(radians(p_longitude) - radians(display.public_lng)) +
        sin(radians(display.public_lat)) * sin(radians(p_latitude))
      )))
    ) <= stop.reveal_radius_meters;

  PERFORM refresh_hunt_reveals(p_participation_id);
  RETURN jsonb_build_object('success', true, 'cellKey', v_cell_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_hunt_exploration_state(p_participation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hunt_id UUID; v_config JSONB;
BEGIN
  SELECT hp.hunt_id, h.advanced_config INTO v_hunt_id, v_config
  FROM hunt_participants hp JOIN hunts h ON h.id = hp.hunt_id
  WHERE hp.id = p_participation_id AND hp.user_id = auth.uid() AND hp.status IN ('active', 'paused');
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'advancedConfig', v_config,
    'exploredCells', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cellKey', cell_key, 'latitude', center_lat, 'longitude', center_lng, 'discoveredAt', discovered_at
      ) ORDER BY discovered_at)
      FROM hunt_participant_exploration_cells
      WHERE hunt_participation_id = p_participation_id
    ), '[]'::JSONB),
    'zones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', z.zone_key, 'name', z.name, 'sortOrder', z.sort_order,
        'status', CASE
          WHEN COUNT(*) FILTER (WHERE s.is_required AND p.status = 'completed')
               >= COUNT(*) FILTER (WHERE s.is_required) AND COUNT(*) FILTER (WHERE s.is_required) > 0
            THEN 'completed'
          WHEN EXISTS (
            SELECT 1
            FROM unnest(z.prerequisite_zone_keys) prereq
            WHERE NOT EXISTS (
              SELECT 1
              FROM hunt_stops prerequisite_stop
              JOIN hunt_stop_progress prerequisite_progress
                ON prerequisite_progress.hunt_stop_id = prerequisite_stop.id
               AND prerequisite_progress.hunt_participant_id = p_participation_id
              WHERE prerequisite_stop.hunt_id = v_hunt_id
                AND prerequisite_stop.zone_key = prereq
                AND prerequisite_stop.is_required
              GROUP BY prerequisite_stop.zone_key
              HAVING COUNT(*) FILTER (WHERE prerequisite_progress.status = 'completed')
                     >= COUNT(*)
            )
          ) THEN 'locked'
          ELSE 'available'
        END,
        'completed', COUNT(*) FILTER (WHERE s.is_required AND p.status = 'completed'),
        'required', COUNT(*) FILTER (WHERE s.is_required),
        'percent', CASE WHEN COUNT(*) FILTER (WHERE s.is_required) > 0
          THEN ROUND(100.0 * COUNT(*) FILTER (WHERE s.is_required AND p.status = 'completed')
            / COUNT(*) FILTER (WHERE s.is_required)) ELSE NULL END
      ) ORDER BY z.sort_order)
      FROM hunt_zones z
      LEFT JOIN hunt_stops s ON s.hunt_id = z.hunt_id AND s.zone_key = z.zone_key
      LEFT JOIN hunt_stop_progress p ON p.hunt_stop_id = s.id AND p.hunt_participant_id = p_participation_id
      WHERE z.hunt_id = v_hunt_id
      GROUP BY z.zone_key, z.name, z.sort_order, z.prerequisite_zone_keys
    ), '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reveal_hunt_stop(
  p_hunt_id UUID,
  p_stop_id UUID,
  p_revealed BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'moderator_role_required';
  END IF;
  UPDATE hunt_stops
  SET admin_revealed = p_revealed
  WHERE id = p_stop_id AND hunt_id = p_hunt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'hunt_stop_not_found'; END IF;
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, payload)
  VALUES (
    CASE WHEN p_revealed THEN 'hunt_stop_admin_revealed' ELSE 'hunt_stop_admin_hidden' END,
    p_hunt_id, auth.uid(), jsonb_build_object('stopId', p_stop_id)
  );
  RETURN jsonb_build_object('success', TRUE, 'stopId', p_stop_id, 'revealed', p_revealed);
END;
$$;

-- Replace the original stable map-location function with a refresh + safe
-- projection. CLUE_ONLY reveals a clue but deliberately has no map marker.
CREATE OR REPLACE FUNCTION public.get_active_hunt_stop_locations(p_participation_id UUID)
RETURNS TABLE (
  stop_id UUID,
  public_lat DOUBLE PRECISION,
  public_lng DOUBLE PRECISION,
  public_radius DOUBLE PRECISION,
  stop_title TEXT,
  stop_role TEXT,
  progress_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_hunt_reveals(p_participation_id);
  RETURN QUERY
  SELECT DISTINCT ON (hs.id)
    hs.id, hsg.public_lat, hsg.public_lng, hsg.public_radius_meters,
    hs.title, hs.stop_role::TEXT, hsp.status::TEXT
  FROM hunt_participants hp
  JOIN hunt_stop_progress hsp ON hsp.hunt_participant_id = hp.id
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  JOIN hunt_stop_geofences hsg ON hsg.hunt_stop_id = hs.id
  WHERE hp.id = p_participation_id
    AND hp.user_id = auth.uid()
    AND hp.status IN ('active', 'paused')
    AND hsp.revealed_at IS NOT NULL
    AND hs.reveal_mode <> 'CLUE_ONLY'
    AND hsg.public_lat IS NOT NULL AND hsg.public_lng IS NOT NULL
  ORDER BY hs.id, hsg.is_validation_zone DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.record_hunt_exploration_sample(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_hunt_exploration_sample(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
REVOKE ALL ON FUNCTION public.get_hunt_exploration_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hunt_exploration_state(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_reveal_hunt_stop(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reveal_hunt_stop(UUID, UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.get_active_hunt_stop_locations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_hunt_stop_locations(UUID) TO authenticated;