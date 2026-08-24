-- Forward enforcement for creator-configured proof requirements.
-- Client completion signals are never sufficient for proof or location stops.
ALTER TABLE hunt_stop_progress
  ADD COLUMN IF NOT EXISTS server_location_validated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION validate_hunt_stop_location(
  p_participation_id UUID,
  p_stop_id UUID,
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
  v_progress RECORD;
  v_geofence RECORD;
BEGIN
  IF v_uid IS NULL OR p_accuracy_meters IS NULL OR p_accuracy_meters > 100 THEN
    RETURN jsonb_build_object('success', false, 'validated', false, 'reasonCode', 'POOR_ACCURACY');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM hunt_participants
    WHERE id = p_participation_id AND user_id = v_uid AND status IN ('active', 'paused')
  ) THEN
    RETURN jsonb_build_object('success', false, 'validated', false, 'reasonCode', 'INVALID_PARTICIPATION');
  END IF;
  SELECT hsp.id, hsp.status INTO v_progress
  FROM hunt_stop_progress hsp
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  WHERE hsp.hunt_participant_id = p_participation_id
    AND hsp.hunt_stop_id = p_stop_id
    AND hs.completion_method IN ('location', 'image_and_location')
    AND hsp.status NOT IN ('completed', 'locked', 'expired');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'validated', false, 'reasonCode', 'STOP_UNAVAILABLE');
  END IF;
  SELECT validation_point, validation_radius_meters, minimum_accuracy_meters INTO v_geofence
  FROM hunt_stop_geofences WHERE hunt_stop_id = p_stop_id LIMIT 1;
  IF NOT FOUND OR v_geofence.validation_point IS NULL THEN
    RETURN jsonb_build_object('success', false, 'validated', false, 'reasonCode', 'LOCATION_NOT_CONFIGURED');
  END IF;
  IF p_accuracy_meters > COALESCE(v_geofence.minimum_accuracy_meters, 100)
    OR NOT ST_DWithin(
      v_geofence.validation_point,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY,
      v_geofence.validation_radius_meters
    ) THEN
    RETURN jsonb_build_object('success', false, 'validated', false, 'reasonCode', 'OUTSIDE_REQUIRED_AREA');
  END IF;
  UPDATE hunt_stop_progress
  SET status = CASE WHEN status = 'available' THEN 'in_progress' ELSE status END,
      server_location_validated_at = NOW(),
      updated_at = NOW()
  WHERE id = v_progress.id;
  RETURN jsonb_build_object('success', true, 'validated', true, 'reasonCode', NULL, 'userMessage', 'Location verified.');
END;
$$;

CREATE OR REPLACE FUNCTION complete_hunt_stop(
  p_participation_id UUID,
  p_stop_id UUID,
  p_validation_method TEXT DEFAULT 'manual_confirmation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_participant RECORD;
  v_progress RECORD;
  v_stop RECORD;
  v_proof RECORD;
  v_next_stop_id UUID;
  v_all_done BOOLEAN;
  v_has_media BOOLEAN;
  v_is_moderator BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_uid AND role IN ('moderator', 'admin') AND account_status = 'active'
  ) INTO v_is_moderator;
  SELECT * INTO v_participant FROM hunt_participants
  WHERE id = p_participation_id
    AND status = 'active'
    AND (user_id = v_uid OR v_is_moderator);
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'NOT_AUTHORIZED'); END IF;
  SELECT * INTO v_stop FROM hunt_stops WHERE id = p_stop_id AND hunt_id = v_participant.hunt_id;
  SELECT * INTO v_progress FROM hunt_stop_progress
  WHERE hunt_participant_id = p_participation_id AND hunt_stop_id = p_stop_id;
  IF NOT FOUND OR v_stop.id IS NULL OR v_progress.status IN ('not_started', 'locked', 'expired') THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'STOP_UNAVAILABLE');
  END IF;
  IF v_progress.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'stopId', p_stop_id, 'newStatus', 'completed', 'huntCompletionReady', false);
  END IF;
  IF p_validation_method <> v_stop.completion_method THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'PROOF_METHOD_REQUIRED',
      'userMessage', 'Complete this stop with its configured proof method.');
  END IF;
  IF v_stop.completion_method IN ('text', 'image', 'image_and_location') THEN
    SELECT ps.id, ps.status, ps.submission_type, ps.text_response INTO v_proof
    FROM proof_submissions ps
    WHERE ps.id = v_progress.proof_submission_id
      AND ps.user_id = v_participant.user_id;
    IF NOT FOUND OR v_proof.status <> 'approved' OR v_proof.submission_type::TEXT <> v_stop.completion_method THEN
      RETURN jsonb_build_object('success', false, 'reasonCode', 'PROOF_APPROVAL_REQUIRED');
    END IF;
    IF v_stop.completion_method = 'text' AND char_length(TRIM(COALESCE(v_proof.text_response, ''))) = 0 THEN
      RETURN jsonb_build_object('success', false, 'reasonCode', 'PROOF_CONTENT_REQUIRED');
    END IF;
    IF v_stop.completion_method IN ('image', 'image_and_location') THEN
      SELECT EXISTS (SELECT 1 FROM proof_media WHERE submission_id = v_proof.id) INTO v_has_media;
      IF NOT v_has_media THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'PROOF_MEDIA_REQUIRED'); END IF;
    END IF;
  END IF;
  IF v_stop.completion_method IN ('location', 'image_and_location')
    AND v_progress.server_location_validated_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'LOCATION_VALIDATION_REQUIRED');
  END IF;
  UPDATE hunt_stop_progress
  SET status = 'completed', completed_at = NOW(), validation_method = p_validation_method,
      attempt_count = attempt_count + 1
  WHERE id = v_progress.id;
  IF (SELECT stop_ordering FROM hunts WHERE id = v_participant.hunt_id) = 'ordered' THEN
    SELECT id INTO v_next_stop_id FROM hunt_stops
    WHERE hunt_id = v_participant.hunt_id AND sort_order > v_stop.sort_order AND is_required = true
    ORDER BY sort_order LIMIT 1;
    IF v_next_stop_id IS NOT NULL THEN
      INSERT INTO hunt_stop_progress (hunt_participant_id, hunt_stop_id, status, unlocked_at)
      VALUES (p_participation_id, v_next_stop_id, 'available', NOW())
      ON CONFLICT (hunt_participant_id, hunt_stop_id)
      DO UPDATE SET status = 'available', unlocked_at = NOW();
    END IF;
  END IF;
  SELECT NOT EXISTS (
    SELECT 1 FROM hunt_stops hs JOIN hunt_stop_progress hsp
      ON hsp.hunt_stop_id = hs.id AND hsp.hunt_participant_id = p_participation_id
    WHERE hs.hunt_id = v_participant.hunt_id AND hs.is_required AND hsp.status <> 'completed'
  ) INTO v_all_done;
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, stop_id, payload)
  VALUES ('stop_completed', v_participant.hunt_id, v_uid, p_participation_id, p_stop_id,
    jsonb_build_object('validationMethod', p_validation_method));
  RETURN jsonb_build_object('success', true, 'stopId', p_stop_id, 'newStatus', 'completed',
    'nextStopId', v_next_stop_id, 'huntCompletionReady', v_all_done, 'reasonCode', NULL);
END;
$$;

-- Proof review is the sole trusted bridge from a reviewed submission to a
-- completed proof stop. It cannot approve an image+location stop before the
-- separate geofence RPC has recorded its server-side validation.
CREATE OR REPLACE FUNCTION approve_hunt_stop_proof(p_submission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_submission RECORD;
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_uid AND role IN ('moderator', 'admin') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'moderator_role_required'; END IF;
  SELECT ps.id, ps.status, hsp.hunt_participant_id, hsp.hunt_stop_id,
         hsp.server_location_validated_at, hs.completion_method
  INTO v_submission
  FROM proof_submissions ps
  JOIN hunt_stop_progress hsp ON hsp.id = ps.hunt_stop_progress_id
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  WHERE ps.id = p_submission_id
  FOR UPDATE OF ps, hsp;
  IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found'; END IF;
  IF v_submission.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'proof_not_reviewable';
  END IF;
  IF v_submission.completion_method = 'image_and_location'
    AND v_submission.server_location_validated_at IS NULL THEN
    RAISE EXCEPTION 'location_validation_required';
  END IF;
  UPDATE proof_submissions
  SET status = 'approved', moderation_status = 'approved',
      reviewed_at = NOW(), reviewer_id = v_uid
  WHERE id = p_submission_id;
  v_result := complete_hunt_stop(
    v_submission.hunt_participant_id,
    v_submission.hunt_stop_id,
    v_submission.completion_method
  );
  IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'approved_proof_could_not_complete_stop';
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION validate_hunt_stop_location(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_hunt_stop_location(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
REVOKE ALL ON FUNCTION complete_hunt_stop(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_hunt_stop(UUID, UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION approve_hunt_stop_proof(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_hunt_stop_proof(UUID) TO authenticated;