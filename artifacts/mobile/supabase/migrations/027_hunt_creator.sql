-- Worlds — Prompt 17: creator drafts and immutable review snapshots
-- Draft content is private JSON owned by one creator. Sensitive fields such as
-- exact validation geometry and riddle answers are never returned by public Hunt queries.

CREATE TABLE IF NOT EXISTS hunt_creator_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_review', 'changes_requested', 'approved',
    'scheduled', 'published', 'paused', 'rejected', 'archived'
  )),
  creation_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_snapshot JSONB,
  review_summary TEXT,
  submitted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_hunt_creator_drafts_owner_status
  ON hunt_creator_drafts(owner_user_id, status, updated_at DESC);

ALTER TABLE hunt_creator_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY hunt_creator_drafts_owner_read ON hunt_creator_drafts
  FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY hunt_creator_drafts_owner_insert ON hunt_creator_drafts
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY hunt_creator_drafts_owner_update ON hunt_creator_drafts
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION create_hunt_draft(p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r hunt_creator_drafts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) < 8
    THEN RAISE EXCEPTION 'invalid_idempotency_key'; END IF;
  SELECT * INTO r FROM hunt_creator_drafts
    WHERE owner_user_id = auth.uid() AND idempotency_key = p_idempotency_key;
  IF r.id IS NULL THEN
    INSERT INTO hunt_creator_drafts(owner_user_id, idempotency_key, payload)
    VALUES (auth.uid(), p_idempotency_key, jsonb_build_object(
      'title','', 'summary','', 'description','', 'privacy','private',
      'participationMode','solo', 'stopOrdering','ordered', 'difficulty','medium',
      'estimatedDurationMinutes',30, 'maxParticipants',10, 'pointsRequested',50,
      'stops','[]'::jsonb, 'intendedInviteeIds','[]'::jsonb,
      'safetyAcknowledged',false, 'publicAccessConfirmed',false
    )) RETURNING * INTO r;
  END IF;
  RETURN jsonb_build_object('id',r.id,'ownerUserId',r.owner_user_id,'status',r.status,
    'creationVersion',r.creation_version,'revision',r.revision,'payload',r.payload,
    'reviewSummary',r.review_summary,'updatedAt',r.updated_at);
END $$;

CREATE OR REPLACE FUNCTION get_hunt_creator_draft(p_draft_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r hunt_creator_drafts;
BEGIN
  SELECT * INTO r FROM hunt_creator_drafts
    WHERE id = p_draft_id AND owner_user_id = auth.uid();
  IF r.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',r.id,'ownerUserId',r.owner_user_id,'status',r.status,
    'creationVersion',r.creation_version,'revision',r.revision,'payload',r.payload,
    'reviewSummary',r.review_summary,'updatedAt',r.updated_at,'submittedAt',r.submitted_at);
END $$;

CREATE OR REPLACE FUNCTION update_hunt_draft(
  p_draft_id UUID, p_payload JSONB, p_expected_revision INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r hunt_creator_drafts;
BEGIN
  UPDATE hunt_creator_drafts SET payload = p_payload, revision = revision + 1,
    updated_at = NOW()
    WHERE id = p_draft_id AND owner_user_id = auth.uid()
      AND status IN ('draft','changes_requested') AND revision = p_expected_revision
    RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'draft_changed_or_unavailable'; END IF;
  RETURN jsonb_build_object('id',r.id,'ownerUserId',r.owner_user_id,'status',r.status,
    'creationVersion',r.creation_version,'revision',r.revision,'payload',r.payload,
    'reviewSummary',r.review_summary,'updatedAt',r.updated_at);
END $$;

CREATE OR REPLACE FUNCTION validate_hunt_draft(p_draft_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p JSONB; issues JSONB := '[]'::jsonb; stop JSONB; required_count INTEGER;
BEGIN
  SELECT payload INTO p FROM hunt_creator_drafts
    WHERE id=p_draft_id AND owner_user_id=auth.uid();
  IF p IS NULL THEN RETURN jsonb_build_object('valid',false,'issues',
    jsonb_build_array(jsonb_build_object('step','details','code','unavailable',
      'message','This draft is no longer available.'))); END IF;
  IF length(trim(COALESCE(p->>'title',''))) < 3 THEN
    issues := issues || jsonb_build_array(jsonb_build_object('step','details','code','title_required','message','Add a title of at least 3 characters.'));
  END IF;
  IF length(trim(COALESCE(p->>'summary',''))) < 10 THEN
    issues := issues || jsonb_build_array(jsonb_build_object('step','details','code','summary_required','message','Add a short summary so players know what to expect.'));
  END IF;
  IF length(trim(COALESCE(p->>'description',''))) < 20 THEN
    issues := issues || jsonb_build_array(jsonb_build_object('step','details','code','description_required','message','Add a little more detail about the adventure.'));
  END IF;
  SELECT count(*) INTO required_count FROM jsonb_array_elements(COALESCE(p->'stops','[]'::jsonb)) s
    WHERE COALESCE((s->>'required')::boolean,true);
  IF required_count < 1 THEN
    issues := issues || jsonb_build_array(jsonb_build_object('step','stops','code','required_stop','message','Add at least one required stop.'));
  END IF;
  IF COALESCE((p->>'maxParticipants')::integer,0) < 1 THEN
    issues := issues || jsonb_build_array(jsonb_build_object('step','privacy','code','capacity','message','Choose a participant limit.'));
  END IF;
  IF COALESCE((p->>'safetyAcknowledged')::boolean,false) = false THEN
    issues := issues || jsonb_build_array(jsonb_build_object('step','review','code','safety','message','Confirm that this Hunt is safe and does not require trespassing.'));
  END IF;
  RETURN jsonb_build_object('valid',jsonb_array_length(issues)=0,'issues',issues);
END $$;

CREATE OR REPLACE FUNCTION submit_hunt_for_review(p_draft_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r hunt_creator_drafts; validation JSONB;
BEGIN
  validation := validate_hunt_draft(p_draft_id);
  IF COALESCE((validation->>'valid')::boolean,false) = false THEN
    RETURN jsonb_build_object('success',false,'validation',validation);
  END IF;
  UPDATE hunt_creator_drafts SET status='pending_review',
    submitted_snapshot=payload, submitted_at=NOW(), updated_at=NOW()
    WHERE id=p_draft_id AND owner_user_id=auth.uid()
      AND status IN ('draft','changes_requested')
    RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'draft_not_submittable'; END IF;
  RETURN jsonb_build_object('success',true,'id',r.id,'status',r.status,
    'revision',r.revision,'submittedAt',r.submitted_at);
END $$;

CREATE OR REPLACE FUNCTION get_creator_hunts()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',id,'ownerUserId',owner_user_id,'status',status,'creationVersion',creation_version,
    'revision',revision,'payload',payload,'reviewSummary',review_summary,
    'updatedAt',updated_at,'submittedAt',submitted_at
  ) ORDER BY updated_at DESC),'[]'::jsonb)
  FROM hunt_creator_drafts WHERE owner_user_id=auth.uid() AND status <> 'archived';
$$;

CREATE OR REPLACE FUNCTION archive_hunt_draft(p_draft_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected_rows INTEGER;
BEGIN
  UPDATE hunt_creator_drafts SET status='archived', archived_at=NOW(), updated_at=NOW()
    WHERE id=p_draft_id AND owner_user_id=auth.uid()
      AND status IN ('draft','changes_requested','rejected');
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN jsonb_build_object('success',affected_rows > 0);
END $$;

CREATE OR REPLACE FUNCTION duplicate_hunt_to_draft(p_source_id UUID, p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE source_row hunt_creator_drafts; new_row hunt_creator_drafts;
BEGIN
  SELECT * INTO source_row FROM hunt_creator_drafts WHERE id=p_source_id AND owner_user_id=auth.uid();
  IF source_row.id IS NULL THEN RAISE EXCEPTION 'hunt_unavailable'; END IF;
  INSERT INTO hunt_creator_drafts(owner_user_id,idempotency_key,payload)
    VALUES(auth.uid(),p_idempotency_key,jsonb_set(source_row.payload,'{title}',
      to_jsonb(COALESCE(source_row.payload->>'title','Hunt') || ' Copy')))
    ON CONFLICT (owner_user_id,idempotency_key) DO UPDATE SET updated_at=NOW()
    RETURNING * INTO new_row;
  RETURN jsonb_build_object('id',new_row.id,'ownerUserId',new_row.owner_user_id,'status',new_row.status,
    'creationVersion',new_row.creation_version,'revision',new_row.revision,'payload',new_row.payload,
    'updatedAt',new_row.updated_at);
END $$;

GRANT EXECUTE ON FUNCTION create_hunt_draft(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hunt_creator_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_hunt_draft(UUID,JSONB,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_hunt_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_hunt_for_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_creator_hunts() TO authenticated;
GRANT EXECUTE ON FUNCTION archive_hunt_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION duplicate_hunt_to_draft(UUID,TEXT) TO authenticated;