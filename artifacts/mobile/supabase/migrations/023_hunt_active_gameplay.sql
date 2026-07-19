-- ============================================================
-- Migration 023 — Hunt Active Gameplay RPCs
-- Worlds — Prompt 13
-- ============================================================
-- Adds server-side operations for the Active Hunt gameplay loop:
--   submit_hunt_stop_proof     — create/update proof submission for a stop
--   validate_hunt_stop_location — server-side location proximity check
--   get_hunt_stop_submission    — safe submission detail for a participant
--   get_hunt_completion_readiness — server-side readiness evaluation
--
-- All functions are SECURITY DEFINER.
-- No private validation geometry is ever returned to clients.
-- No clue content is returned that the participant has not earned.
-- No points are awarded here — only complete_hunt() awards points.
-- ============================================================

-- ─── Helper: assert authenticated ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _assert_authenticated_user()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_uid;
END;
$$;

-- ─── RPC: submit_hunt_stop_proof ─────────────────────────────────────────────
-- Creates or updates a proof submission for a hunt stop progress record.
-- Handles:
--   • First submission → creates new proof_submission record
--   • Resubmission → creates new record linked via previous_submission_id
--   • Prevents duplicate submission while under_review
--   • Links proof_media records for image proof
-- Returns JSONB with success, submissionId, status, userMessage, reasonCode

CREATE OR REPLACE FUNCTION submit_hunt_stop_proof(
  p_participation_id       UUID,
  p_stop_id                UUID,
  p_submission_type        TEXT,        -- 'text' | 'image' | 'image_and_location' | 'text_and_image' | 'location'
  p_text_response          TEXT DEFAULT NULL,
  p_media_ids              UUID[] DEFAULT NULL,
  p_location_lat           DOUBLE PRECISION DEFAULT NULL,
  p_location_lng           DOUBLE PRECISION DEFAULT NULL,
  p_location_accuracy      DOUBLE PRECISION DEFAULT NULL,
  p_previous_submission_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              UUID := _assert_authenticated_user();
  v_participant      RECORD;
  v_progress         RECORD;
  v_existing_sub     RECORD;
  v_submission_id    UUID;
  v_new_status       TEXT;
  v_new_proof_status TEXT := 'submitted';
  v_media_id         UUID;
BEGIN

  -- ── Validate participation ownership ────────────────────────────────────
  SELECT hp.id, hp.hunt_id, hp.occurrence_id, hp.status, hp.user_id
    INTO v_participant
    FROM hunt_participants hp
   WHERE hp.id = p_participation_id
     AND hp.user_id = v_uid
     AND hp.status IN ('active', 'paused');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',    false,
      'reasonCode', 'INVALID_PARTICIPATION',
      'userMessage','You cannot submit proof for this hunt.'
    );
  END IF;

  -- ── Validate stop progress ────────────────────────────────────────────────
  SELECT hsp.id, hsp.status, hsp.proof_submission_id, hsp.attempt_count, hsp.hunt_stop_id
    INTO v_progress
    FROM hunt_stop_progress hsp
   WHERE hsp.hunt_participant_id = p_participation_id
     AND hsp.hunt_stop_id = p_stop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',    false,
      'reasonCode', 'STOP_NOT_FOUND',
      'userMessage','Stop not found in your hunt progress.'
    );
  END IF;

  -- ── Prevent submission if already completed or locked ────────────────────
  IF v_progress.status IN ('completed', 'locked', 'expired') THEN
    RETURN jsonb_build_object(
      'success',    false,
      'reasonCode', 'STOP_ALREADY_COMPLETED',
      'userMessage','This stop has already been completed or is no longer available.'
    );
  END IF;

  -- ── Prevent duplicate submission while under review ────────────────────
  IF v_progress.status = 'under_review' THEN
    RETURN jsonb_build_object(
      'success',    false,
      'reasonCode', 'ALREADY_UNDER_REVIEW',
      'userMessage','Your proof is currently under review. You cannot submit again yet.'
    );
  END IF;

  -- ── Validate resubmission chain ──────────────────────────────────────────
  IF p_previous_submission_id IS NOT NULL THEN
    SELECT id, status INTO v_existing_sub
      FROM proof_submissions
     WHERE id = p_previous_submission_id
       AND user_id = v_uid
       AND hunt_stop_progress_id = v_progress.id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success',    false,
        'reasonCode', 'INVALID_PREVIOUS_SUBMISSION',
        'userMessage','Resubmission reference is invalid.'
      );
    END IF;

    -- Previous must be in a state that allows resubmission
    IF v_existing_sub.status NOT IN ('needs_resubmission', 'rejected') THEN
      RETURN jsonb_build_object(
        'success',    false,
        'reasonCode', 'RESUBMISSION_NOT_ALLOWED',
        'userMessage','The previous submission does not allow resubmission.'
      );
    END IF;
  END IF;

  -- ── Insert new proof_submission record ───────────────────────────────────
  INSERT INTO proof_submissions (
    user_id,
    hunt_stop_progress_id,
    submission_type,
    text_response,
    location_lat,
    location_lng,
    location_accuracy_meters,
    status,
    moderation_status,
    submitted_at,
    previous_submission_id
  ) VALUES (
    v_uid,
    v_progress.id,
    p_submission_type::proof_type,
    p_text_response,
    p_location_lat,
    p_location_lng,
    p_location_accuracy,
    'submitted',
    'pending',
    NOW(),
    p_previous_submission_id
  )
  RETURNING id INTO v_submission_id;

  -- ── Attach media assets ───────────────────────────────────────────────────
  IF p_media_ids IS NOT NULL AND array_length(p_media_ids, 1) > 0 THEN
    DECLARE
      v_idx INT := 1;
    BEGIN
      FOREACH v_media_id IN ARRAY p_media_ids LOOP
        INSERT INTO proof_media (submission_id, media_id, sort_order)
        VALUES (v_submission_id, v_media_id, v_idx)
        ON CONFLICT DO NOTHING;
        v_idx := v_idx + 1;
      END LOOP;
    END;
  END IF;

  -- ── Update stop progress: awaiting_proof / under_review ──────────────────
  -- If submission_type includes only auto-validatable types → awaiting_proof
  -- Otherwise → under_review (requires moderation)
  v_new_status := CASE
    WHEN p_submission_type IN ('location') THEN 'awaiting_proof'  -- location-only auto validates
    ELSE 'under_review'
  END;

  UPDATE hunt_stop_progress
     SET status              = v_new_status,
         proof_submission_id = v_submission_id,
         attempt_count       = attempt_count + 1,
         updated_at          = NOW()
   WHERE id = v_progress.id;

  RETURN jsonb_build_object(
    'success',        true,
    'submissionId',   v_submission_id,
    'stopStatus',     v_new_status,
    'userMessage',    CASE
      WHEN v_new_status = 'under_review'   THEN 'Your proof was submitted for review.'
      WHEN v_new_status = 'awaiting_proof' THEN 'Your submission is being validated.'
      ELSE 'Submitted.'
    END,
    'reasonCode',     NULL
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success',    false,
    'reasonCode', 'SUBMISSION_ERROR',
    'userMessage','Could not submit proof. Please try again.'
  );
END;
$$;

REVOKE ALL ON FUNCTION submit_hunt_stop_proof FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_hunt_stop_proof TO authenticated;

COMMENT ON FUNCTION submit_hunt_stop_proof IS
  'SECURITY DEFINER — Submit proof for a hunt stop. Validates ownership and stop state. '
  'Creates a proof_submission record linked to hunt_stop_progress. '
  'Handles resubmission chain via previous_submission_id. '
  'No private geometry is accepted or returned.';

-- ─── RPC: validate_hunt_stop_location ────────────────────────────────────────
-- Server-side proximity check for location-based stop validation.
-- Uses the stop''s geofence from hunt_stop_geofences.
-- Client submits coordinates; server computes whether within radius.
-- Never returns geofence coordinates or radius to the client.

CREATE OR REPLACE FUNCTION validate_hunt_stop_location(
  p_participation_id    UUID,
  p_stop_id             UUID,
  p_latitude            DOUBLE PRECISION,
  p_longitude           DOUBLE PRECISION,
  p_accuracy_meters     DOUBLE PRECISION DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := _assert_authenticated_user();
  v_participant  RECORD;
  v_progress     RECORD;
  v_geofence     RECORD;
  v_distance_m   DOUBLE PRECISION;
  v_max_accuracy DOUBLE PRECISION := 100; -- reject readings worse than 100m
  v_min_age_secs INT               := 120; -- reject readings older than 2 min (enforced client-side)
BEGIN

  -- ── Auth + participation ──────────────────────────────────────────────────
  SELECT hp.id, hp.status
    INTO v_participant
    FROM hunt_participants hp
   WHERE hp.id = p_participation_id
     AND hp.user_id = v_uid
     AND hp.status IN ('active', 'paused');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',    false,
      'validated',  false,
      'reasonCode', 'INVALID_PARTICIPATION',
      'userMessage','Cannot validate location for this hunt.'
    );
  END IF;

  -- ── Stop progress ─────────────────────────────────────────────────────────
  SELECT hsp.id, hsp.status
    INTO v_progress
    FROM hunt_stop_progress hsp
   WHERE hsp.hunt_participant_id = p_participation_id
     AND hsp.hunt_stop_id = p_stop_id
     AND hsp.status NOT IN ('completed', 'locked', 'expired');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',    false,
      'validated',  false,
      'reasonCode', 'STOP_UNAVAILABLE',
      'userMessage','This stop is not available for validation.'
    );
  END IF;

  -- ── Accuracy check ────────────────────────────────────────────────────────
  IF p_accuracy_meters > v_max_accuracy THEN
    RETURN jsonb_build_object(
      'success',    false,
      'validated',  false,
      'reasonCode', 'POOR_ACCURACY',
      'userMessage','Your location signal is not accurate enough yet. Move to an open area and try again.'
    );
  END IF;

  -- ── Load geofence (validation geometry — never returned to client) ────────
  SELECT hsg.lat, hsg.lng, hsg.radius_meters
    INTO v_geofence
    FROM hunt_stop_geofences hsg
   WHERE hsg.hunt_stop_id = p_stop_id
     AND hsg.is_validation_zone = true
   LIMIT 1;

  IF NOT FOUND THEN
    -- No geofence: location validation not configured for this stop → pass
    -- Update stop progress to record arrival
    UPDATE hunt_stop_progress
       SET status     = CASE WHEN status = 'available' THEN 'in_progress' ELSE status END,
           updated_at = NOW()
     WHERE id = v_progress.id;

    RETURN jsonb_build_object(
      'success',    true,
      'validated',  true,
      'reasonCode', NULL,
      'userMessage','Location verified.'
    );
  END IF;

  -- ── Haversine distance calculation ────────────────────────────────────────
  v_distance_m := (
    6371000 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(v_geofence.lat)) * cos(radians(p_latitude)) *
        cos(radians(p_longitude) - radians(v_geofence.lng)) +
        sin(radians(v_geofence.lat)) * sin(radians(p_latitude))
      ))
    )
  );

  -- ── Proximity check ───────────────────────────────────────────────────────
  IF v_distance_m > v_geofence.radius_meters THEN
    -- Outside boundary — do NOT reveal the radius to the client
    RETURN jsonb_build_object(
      'success',    false,
      'validated',  false,
      'reasonCode', 'OUTSIDE_REQUIRED_AREA',
      'userMessage','You are not in the required area yet.'
    );
  END IF;

  -- ── Location validated — update stop progress ─────────────────────────────
  UPDATE hunt_stop_progress
     SET status     = CASE WHEN status IN ('available', 'in_progress') THEN 'in_progress' ELSE status END,
         updated_at = NOW()
   WHERE id = v_progress.id;

  RETURN jsonb_build_object(
    'success',    true,
    'validated',  true,
    'reasonCode', NULL,
    'userMessage','Location verified.'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success',    false,
    'validated',  false,
    'reasonCode', 'VALIDATION_ERROR',
    'userMessage','Location validation temporarily unavailable. Please try again.'
  );
END;
$$;

REVOKE ALL ON FUNCTION validate_hunt_stop_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_hunt_stop_location TO authenticated;

COMMENT ON FUNCTION validate_hunt_stop_location IS
  'SECURITY DEFINER — Server-side proximity validation for hunt stop geofences. '
  'Never returns validation coordinates, radius, or polygon to the client. '
  'Client submits coordinates; server computes proximity and returns safe result.';

-- ─── RPC: get_hunt_stop_submission ───────────────────────────────────────────
-- Returns the current (most recent) proof submission for a hunt stop.
-- Safe subset only — no reviewer identity, no internal moderation scores.
-- Returns NULL if no submission exists.

CREATE OR REPLACE FUNCTION get_hunt_stop_submission(
  p_participation_id UUID,
  p_stop_id          UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := _assert_authenticated_user();
  v_progress RECORD;
  v_sub      RECORD;
  v_media    JSONB;
BEGIN

  -- Validate ownership
  SELECT hsp.id, hsp.proof_submission_id
    INTO v_progress
    FROM hunt_stop_progress hsp
    JOIN hunt_participants hp ON hp.id = hsp.hunt_participant_id
   WHERE hsp.hunt_participant_id = p_participation_id
     AND hsp.hunt_stop_id = p_stop_id
     AND hp.user_id = v_uid;

  IF NOT FOUND OR v_progress.proof_submission_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Load submission (only owner's own row)
  SELECT
    ps.id,
    ps.submission_type,
    ps.text_response,
    ps.status,
    ps.moderation_status,
    -- Safe review explanation only — never raw reviewer comment or risk score
    CASE
      WHEN ps.status = 'needs_resubmission' AND ps.review_notes IS NOT NULL
        THEN ps.review_notes  -- user-facing explanation set by reviewer
      ELSE NULL
    END AS review_explanation,
    ps.submitted_at,
    ps.reviewed_at,
    ps.previous_submission_id,
    ps.location_lat IS NOT NULL AS location_verified,
    ps.attempt_count_shadow  -- placeholder; actual is on stop progress
    INTO v_sub
    FROM proof_submissions ps
   WHERE ps.id = v_progress.proof_submission_id
     AND ps.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Load associated media (signed URLs via media_assets)
  SELECT jsonb_agg(
    jsonb_build_object(
      'mediaId',   pm.media_id,
      'sortOrder', pm.sort_order
      -- Actual signed URLs are fetched separately to avoid embedding secrets in RPC
    ) ORDER BY pm.sort_order
  )
  INTO v_media
  FROM proof_media pm
  WHERE pm.submission_id = v_sub.id;

  RETURN jsonb_build_object(
    'submissionId',       v_sub.id,
    'submissionType',     v_sub.submission_type,
    'textResponse',       v_sub.text_response,
    'status',             v_sub.status,
    'moderationStatus',   v_sub.moderation_status,
    'reviewExplanation',  v_sub.review_explanation,
    'submittedAt',        v_sub.submitted_at,
    'reviewedAt',         v_sub.reviewed_at,
    'previousSubmissionId', v_sub.previous_submission_id,
    'locationVerified',   v_sub.location_verified,
    'mediaItems',         COALESCE(v_media, '[]'::jsonb)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_stop_submission FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_stop_submission TO authenticated;

COMMENT ON FUNCTION get_hunt_stop_submission IS
  'SECURITY DEFINER — Returns safe submission detail for a participant''s own stop. '
  'Never exposes reviewer identity, raw moderation output, or internal risk scores. '
  'Media signed URLs are not embedded — fetched separately via storage service.';

-- ─── RPC: get_hunt_completion_readiness ──────────────────────────────────────
-- Server-side readiness check. Returns whether all required stops are completed
-- and proof is resolved. More authoritative than client evaluation.

CREATE OR REPLACE FUNCTION get_hunt_completion_readiness(
  p_participation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := _assert_authenticated_user();
  v_participant  RECORD;
  v_hunt         RECORD;
  v_now          TIMESTAMPTZ := NOW();
  v_stops        JSONB;
  v_missing_count INT := 0;
  v_pending_count INT := 0;
  v_rejected_count INT := 0;
  v_total_required INT := 0;
  v_completed_required INT := 0;
BEGIN

  SELECT hp.id, hp.hunt_id, hp.occurrence_id, hp.status, hp.reward_snapshot
    INTO v_participant
    FROM hunt_participants hp
   WHERE hp.id = p_participation_id
     AND hp.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'isReady',   false,
      'state',     'invalid_state',
      'userMessage','Participation not found.'
    );
  END IF;

  IF v_participant.status = 'completed' THEN
    RETURN jsonb_build_object(
      'isReady',   false,
      'state',     'already_completed',
      'userMessage','You have already completed this hunt.'
    );
  END IF;

  IF v_participant.status NOT IN ('active', 'paused') THEN
    RETURN jsonb_build_object(
      'isReady',   false,
      'state',     'invalid_state',
      'userMessage','Hunt cannot be completed in its current state.'
    );
  END IF;

  -- Check deadline from reward snapshot
  IF (v_participant.reward_snapshot->>'completionDeadline') IS NOT NULL THEN
    IF v_now > (v_participant.reward_snapshot->>'completionDeadline')::TIMESTAMPTZ THEN
      RETURN jsonb_build_object(
        'isReady',   false,
        'state',     'expired',
        'userMessage','The completion deadline has passed.'
      );
    END IF;
  END IF;

  -- Count required stop statuses
  SELECT
    COUNT(*) FILTER (WHERE hs.is_required)                        AS total_req,
    COUNT(*) FILTER (WHERE hs.is_required AND hsp.status = 'completed') AS completed_req,
    COUNT(*) FILTER (WHERE hs.is_required AND hsp.status NOT IN ('completed','awaiting_proof','under_review','needs_resubmission')) AS missing,
    COUNT(*) FILTER (WHERE hs.is_required AND hsp.status IN ('awaiting_proof','under_review','needs_resubmission')) AS pending,
    COUNT(*) FILTER (WHERE hs.is_required AND hsp.status = 'rejected') AS rejected
  INTO v_total_required, v_completed_required, v_missing_count, v_pending_count, v_rejected_count
  FROM hunt_stop_progress hsp
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  WHERE hsp.hunt_participant_id = p_participation_id;

  IF v_rejected_count > 0 THEN
    RETURN jsonb_build_object(
      'isReady',       false,
      'state',         'proof_rejected',
      'totalRequired', v_total_required,
      'completed',     v_completed_required,
      'userMessage',   'One or more required stop proofs were rejected. Resubmission required.'
    );
  END IF;

  IF v_pending_count > 0 THEN
    RETURN jsonb_build_object(
      'isReady',       false,
      'state',         'proof_pending',
      'totalRequired', v_total_required,
      'completed',     v_completed_required,
      'userMessage',   'Waiting for proof review on required stops.'
    );
  END IF;

  IF v_missing_count > 0 THEN
    RETURN jsonb_build_object(
      'isReady',       false,
      'state',         'missing_required_stop',
      'totalRequired', v_total_required,
      'completed',     v_completed_required,
      'userMessage',   'Complete all required stops to finish the hunt.'
    );
  END IF;

  RETURN jsonb_build_object(
    'isReady',       true,
    'state',         'ready',
    'totalRequired', v_total_required,
    'completed',     v_completed_required,
    'userMessage',   'All required stops completed. Ready to finish!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'isReady',   false,
    'state',     'invalid_state',
    'userMessage','Could not evaluate readiness. Please try again.'
  );
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_completion_readiness FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_completion_readiness TO authenticated;

COMMENT ON FUNCTION get_hunt_completion_readiness IS
  'SECURITY DEFINER — Server-side completion readiness evaluation. '
  'More authoritative than client-side check. Used before showing Complete Hunt button. '
  'Never returns private stop data or clue content.';

-- ─── Indexes for Active Hunt performance ─────────────────────────────────────

-- Stop progress lookup by participant + stop (used by validate/submit functions)
CREATE INDEX IF NOT EXISTS idx_hunt_stop_progress_participant_stop
  ON hunt_stop_progress(hunt_participant_id, hunt_stop_id);

-- Stop progress lookup by participant + status (used by readiness evaluator)
CREATE INDEX IF NOT EXISTS idx_hunt_stop_progress_participant_status
  ON hunt_stop_progress(hunt_participant_id, status);

-- Proof submissions by user + stop progress (used by get_hunt_stop_submission)
CREATE INDEX IF NOT EXISTS idx_proof_submissions_hunt_stop_progress
  ON proof_submissions(hunt_stop_progress_id)
  WHERE hunt_stop_progress_id IS NOT NULL;

-- ─── Safe column for review_notes ────────────────────────────────────────────
-- Ensure review_notes is available on proof_submissions (added in 006, verified here)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_submissions' AND column_name = 'review_notes'
  ) THEN
    ALTER TABLE proof_submissions ADD COLUMN review_notes TEXT;
  END IF;
END;
$$;

-- ─── Grant RLS permissions ────────────────────────────────────────────────────

-- Participants can view their own submissions (RLS enforced by policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proof_submissions' AND policyname = 'proof_submissions_owner_read'
  ) THEN
    CREATE POLICY proof_submissions_owner_read ON proof_submissions
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END;
$$;

COMMENT ON COLUMN proof_submissions.review_notes IS
  'User-safe explanation shown for needs_resubmission or rejected status. '
  'Set by reviewer. Never contains internal moderation scores or rule details.';
