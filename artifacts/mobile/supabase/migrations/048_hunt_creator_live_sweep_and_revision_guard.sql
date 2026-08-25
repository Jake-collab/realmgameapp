-- Live creator safety sweeps are camera evidence, not a QR/code assertion.
-- A session is issued before capture and is bound to the stop and Hunt version.
CREATE TABLE IF NOT EXISTS hunt_creator_stop_sweep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  hunt_version INTEGER NOT NULL,
  creator_user_id UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunt_creator_stop_sweep_evidence (
  hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  hunt_version INTEGER NOT NULL,
  media_id UUID NOT NULL REFERENCES media_assets(id),
  captured_by UUID NOT NULL REFERENCES profiles(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hunt_id, hunt_stop_id, hunt_version)
);

ALTER TABLE hunt_creator_stop_sweep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_creator_stop_sweep_evidence ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION begin_creator_stop_sweep(
  p_hunt_id UUID,
  p_stop_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hunt RECORD; v_session hunt_creator_stop_sweep_sessions;
BEGIN
  SELECT * INTO v_hunt FROM hunts
  WHERE id = p_hunt_id AND creator_user_id = auth.uid() AND status = 'draft'
  FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM hunt_stops WHERE id = p_stop_id AND hunt_id = p_hunt_id) THEN
    RETURN jsonb_build_object('success', false, 'userMessage', 'This draft stop is unavailable for a safety sweep.');
  END IF;
  INSERT INTO hunt_creator_stop_sweep_sessions(hunt_id,hunt_stop_id,hunt_version,creator_user_id)
  VALUES(p_hunt_id,p_stop_id,v_hunt.version,auth.uid()) RETURNING * INTO v_session;
  RETURN jsonb_build_object('success',true,'sessionId',v_session.id,'expiresAt',v_session.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION record_creator_stop_sweep(
  p_session_id UUID,
  p_media_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session hunt_creator_stop_sweep_sessions;
BEGIN
  SELECT * INTO v_session FROM hunt_creator_stop_sweep_sessions
  WHERE id = p_session_id AND creator_user_id = auth.uid()
    AND consumed_at IS NULL AND expires_at > NOW()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'userMessage','This live sweep expired. Capture it again from the camera.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM media_assets
    WHERE id = p_media_id AND owner_user_id = auth.uid()
      AND bucket = 'custom-game-media' AND media_type = 'image'
      AND purpose = 'hunt_creator_sweep'
  ) THEN
    RETURN jsonb_build_object('success',false,'userMessage','Only a newly captured sweep image can be used.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM hunts WHERE id = v_session.hunt_id AND status = 'draft'
      AND version = v_session.hunt_version AND creator_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success',false,'userMessage','The draft version changed. Capture a new sweep for the current version.');
  END IF;
  INSERT INTO hunt_creator_stop_sweep_evidence(hunt_id,hunt_stop_id,hunt_version,media_id,captured_by)
  VALUES(v_session.hunt_id,v_session.hunt_stop_id,v_session.hunt_version,p_media_id,auth.uid())
  ON CONFLICT(hunt_id,hunt_stop_id,hunt_version)
  DO UPDATE SET media_id=EXCLUDED.media_id,captured_by=EXCLUDED.captured_by,captured_at=NOW();
  UPDATE hunt_creator_stop_sweep_sessions SET consumed_at=NOW() WHERE id=p_session_id;
  RETURN jsonb_build_object('success',true,'mediaId',p_media_id);
END;
$$;

-- Submitted versions must retain proof configuration and the matching camera
-- evidence. This closes the gap between a draft edit and player visibility.
CREATE OR REPLACE FUNCTION assert_creator_hunt_sweep_evidence(p_hunt_id UUID, p_version INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hunt_stops s
    WHERE s.hunt_id=p_hunt_id AND s.proof_required
      AND NOT EXISTS (
        SELECT 1 FROM hunt_creator_stop_sweep_evidence e
        WHERE e.hunt_id=s.hunt_id AND e.hunt_stop_id=s.id AND e.hunt_version=p_version
      )
  ) THEN RAISE EXCEPTION 'live_camera_sweep_required_for_proof_stop'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION publish_hunt(p_hunt_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hunt hunts%ROWTYPE;
BEGIN
  SELECT * INTO v_hunt FROM hunts WHERE id=p_hunt_id AND creator_user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_hunt.status <> 'draft' THEN RAISE EXCEPTION 'only_drafts_can_be_submitted'; END IF;
  PERFORM validate_creator_hunt_payload(creator_hunt_response(p_hunt_id));
  PERFORM assert_creator_hunt_sweep_evidence(p_hunt_id, v_hunt.version);
  INSERT INTO hunt_submitted_versions(hunt_id,version_no,content_snapshot,cover_media_id,submitted_by)
  VALUES(p_hunt_id,v_hunt.version,creator_hunt_response(p_hunt_id),v_hunt.cover_media_id,auth.uid());
  UPDATE hunts SET status='pending_review' WHERE id=p_hunt_id;
  INSERT INTO moderation_cases(entity_type,entity_id)
  SELECT 'hunt',p_hunt_id WHERE NOT EXISTS (SELECT 1 FROM moderation_cases WHERE entity_type='hunt' AND entity_id=p_hunt_id AND status='open');
  RETURN jsonb_build_object('hunt_id',p_hunt_id,'status','pending_review','occurrence_id',NULL);
END;
$$;

REVOKE ALL ON FUNCTION begin_creator_stop_sweep(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_creator_stop_sweep(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION begin_creator_stop_sweep(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_creator_stop_sweep(UUID,UUID) TO authenticated;