-- Migration 065 — method-driven Quest verification
--
-- New Quest definitions can declare one or more trusted verification methods:
-- camera, gps, timer, integrity_confirmation.
--
-- NULL verification_methods is intentionally retained for pre-065 rows. Those
-- rows continue to use the legacy proof contract; new AI/admin writes must
-- provide an explicit method list before publication.

ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS verification_methods TEXT[],
  ADD COLUMN IF NOT EXISTS required_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS verification_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_verification_methods_valid;
ALTER TABLE quests
  ADD CONSTRAINT quests_verification_methods_valid CHECK (
    verification_methods IS NULL
    OR (
      cardinality(verification_methods) > 0
      AND verification_methods <@ ARRAY['camera', 'gps', 'timer', 'integrity_confirmation']::TEXT[]
    )
  );

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_timer_duration_valid;
ALTER TABLE quests
  ADD CONSTRAINT quests_timer_duration_valid CHECK (
    required_duration_minutes IS NULL
    OR required_duration_minutes BETWEEN 1 AND 1440
  );

COMMENT ON COLUMN quests.verification_methods IS
  'Trusted completion requirements. NULL preserves the legacy proof contract for pre-migration rows.';
COMMENT ON COLUMN quests.required_duration_minutes IS
  'Server-authoritative elapsed duration required when verification_methods includes timer.';
COMMENT ON COLUMN quests.verification_config IS
  'Non-secret admin verification metadata. Never store precise GPS validation geometry here.';

ALTER TABLE quest_participations
  ADD COLUMN IF NOT EXISTS verification_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_earliest_completion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS integrity_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN quest_participations.verification_started_at IS
  'Server timestamp captured when the player starts a timer verification.';
COMMENT ON COLUMN quest_participations.verification_earliest_completion_at IS
  'Server-calculated earliest completion timestamp; never derived from the device clock.';
COMMENT ON COLUMN quest_participations.integrity_confirmed_at IS
  'Server timestamp for the player self-attesting that the configured integrity requirement was met.';

-- Client-readable method configuration; precise geometry remains in the existing
-- server-only quest_geo_validation_geometry table.
GRANT SELECT (verification_methods, required_duration_minutes, verification_config)
  ON quests TO authenticated;

-- Protected participation columns are server-owned. The existing broad UPDATE
-- grant from migration 045 is replaced with the complete safe column list.
REVOKE UPDATE ON quest_participations FROM anon, authenticated;
GRANT UPDATE (
  status,
  last_progress_at,
  submitted_at,
  abandoned_at,
  expires_at
) ON quest_participations TO authenticated;

CREATE INDEX IF NOT EXISTS idx_quests_verification_methods
  ON quests USING GIN (verification_methods)
  WHERE verification_methods IS NOT NULL;

-- Start a timer using the database clock. Repeated calls are idempotent and
-- return the original server timestamps.
CREATE OR REPLACE FUNCTION start_quest_verification_timer(
  p_participation_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation quest_participations%ROWTYPE;
  v_quest quests%ROWTYPE;
  v_started_at TIMESTAMPTZ;
  v_earliest TIMESTAMPTZ;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch.';
  END IF;

  SELECT * INTO v_participation
  FROM quest_participations
  WHERE id = p_participation_id
  FOR UPDATE;

  IF NOT FOUND OR v_participation.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Participation not found or unauthorized.';
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = v_participation.quest_id;
  IF NOT FOUND OR NOT ('timer' = ANY(COALESCE(v_quest.verification_methods, ARRAY[]::TEXT[]))) THEN
    RAISE EXCEPTION 'This Quest does not require a timer.';
  END IF;

  IF v_participation.status IN ('completed', 'rejected', 'abandoned', 'expired') THEN
    RAISE EXCEPTION 'Cannot start verification in state %.', v_participation.status;
  END IF;

  v_started_at := COALESCE(v_participation.verification_started_at, NOW());
  v_earliest := COALESCE(
    v_participation.verification_earliest_completion_at,
    v_started_at + make_interval(mins => COALESCE(v_quest.required_duration_minutes, 0))
  );

  UPDATE quest_participations
  SET verification_started_at = v_started_at,
      verification_earliest_completion_at = v_earliest,
      updated_at = NOW()
  WHERE id = p_participation_id;

  RETURN json_build_object(
    'participation_id', p_participation_id,
    'verification_started_at', v_started_at,
    'verification_earliest_completion_at', v_earliest
  );
END;
$$;

CREATE OR REPLACE FUNCTION confirm_quest_integrity(
  p_participation_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation quest_participations%ROWTYPE;
  v_quest quests%ROWTYPE;
  v_confirmed_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch.';
  END IF;

  SELECT * INTO v_participation
  FROM quest_participations
  WHERE id = p_participation_id
  FOR UPDATE;

  IF NOT FOUND OR v_participation.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Participation not found or unauthorized.';
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = v_participation.quest_id;
  IF NOT FOUND OR NOT ('integrity_confirmation' = ANY(COALESCE(v_quest.verification_methods, ARRAY[]::TEXT[]))) THEN
    RAISE EXCEPTION 'This Quest does not require an integrity confirmation.';
  END IF;

  IF v_participation.status IN ('completed', 'rejected', 'abandoned', 'expired') THEN
    RAISE EXCEPTION 'Cannot confirm verification in state %.', v_participation.status;
  END IF;

  IF 'timer' = ANY(COALESCE(v_quest.verification_methods, ARRAY[]::TEXT[]))
     AND (
       v_participation.verification_earliest_completion_at IS NULL
       OR v_participation.verification_earliest_completion_at > NOW()
     ) THEN
    RAISE EXCEPTION 'The timer requirement has not elapsed.';
  END IF;

  v_confirmed_at := COALESCE(v_participation.integrity_confirmed_at, NOW());
  UPDATE quest_participations
  SET integrity_confirmed_at = v_confirmed_at,
      updated_at = NOW()
  WHERE id = p_participation_id;

  RETURN json_build_object(
    'participation_id', p_participation_id,
    'integrity_confirmed_at', v_confirmed_at
  );
END;
$$;

-- Replace the original atomic completion function with method checks. Legacy
-- rows (verification_methods IS NULL) retain the exact pre-065 behavior.
CREATE OR REPLACE FUNCTION complete_quest(
  p_participation_id UUID,
  p_user_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation quest_participations%ROWTYPE;
  v_quest quests%ROWTYPE;
  v_points INTEGER;
  v_completed_at TIMESTAMPTZ;
  v_ledger_id UUID;
  v_methods TEXT[];
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch.';
  END IF;

  SELECT * INTO v_participation
  FROM quest_participations
  WHERE id = p_participation_id
  FOR UPDATE;

  IF NOT FOUND OR v_participation.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Participation not found or unauthorized.';
  END IF;

  IF v_participation.status = 'completed' THEN
    RETURN json_build_object(
      'awarded_points', v_participation.reward_snapshot_points,
      'completed_at', v_participation.completed_at,
      'was_already_completed', TRUE
    );
  END IF;

  IF v_participation.status NOT IN ('in_progress', 'started', 'under_review') THEN
    RAISE EXCEPTION 'Participation % is in state %; cannot complete.', p_participation_id, v_participation.status;
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = v_participation.quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found for participation %', p_participation_id;
  END IF;

  v_methods := v_quest.verification_methods;
  IF v_methods IS NOT NULL THEN
    IF 'timer' = ANY(v_methods) AND (
      v_participation.verification_earliest_completion_at IS NULL
      OR v_participation.verification_earliest_completion_at > NOW()
    ) THEN
      RAISE EXCEPTION 'Timer requirement has not elapsed.';
    END IF;

    IF 'integrity_confirmation' = ANY(v_methods)
       AND v_participation.integrity_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'Integrity confirmation is required.';
    END IF;

    IF 'camera' = ANY(v_methods) AND NOT EXISTS (
      SELECT 1
      FROM proof_submissions ps
      JOIN proof_media pm ON pm.submission_id = ps.id
      WHERE ps.quest_participation_id = p_participation_id
        AND ps.submission_type IN ('photo', 'video')
        AND (
          ps.status = 'approved'
          OR ps.moderation_status = 'approved'
        )
    ) THEN
      RAISE EXCEPTION 'Approved camera proof is required.';
    END IF;

    IF 'gps' = ANY(v_methods) AND NOT EXISTS (
      SELECT 1
      FROM geo_validation_attempts gva
      WHERE gva.participation_id = p_participation_id
        AND gva.validation_type = 'completion'
        AND gva.result = 'validated'
        AND NOT gva.is_suspicious
    ) THEN
      RAISE EXCEPTION 'Validated GPS proof is required.';
    END IF;
  END IF;

  v_points := COALESCE(v_participation.reward_snapshot_points, v_quest.points_reward);
  IF v_points IS NULL OR v_points <= 0 THEN
    RAISE EXCEPTION 'Invalid reward amount for participation %', p_participation_id;
  END IF;

  v_completed_at := NOW();
  UPDATE quest_participations SET
    status = 'completed',
    completed_at = v_completed_at,
    awarded_points = v_points,
    updated_at = v_completed_at
  WHERE id = p_participation_id;

  INSERT INTO points_ledger (
    user_id, amount, transaction_type, source_type, source_id,
    quest_participation_id, reason, idempotency_key
  ) VALUES (
    p_user_id, v_points, 'quest_reward', 'quest', v_quest.id,
    p_participation_id, 'Quest completed: ' || v_quest.title, p_idempotency_key
  ) ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_ledger_id;

  RETURN json_build_object(
    'awarded_points', v_points,
    'completed_at', v_completed_at,
    'ledger_id', v_ledger_id,
    'was_already_completed', FALSE
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'awarded_points', v_participation.reward_snapshot_points,
      'completed_at', v_participation.completed_at,
      'was_already_completed', TRUE
    );
END;
$$;

REVOKE ALL ON FUNCTION start_quest_verification_timer(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_quest_verification_timer(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION confirm_quest_integrity(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_quest_integrity(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION complete_quest(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_quest(UUID, UUID, TEXT) TO authenticated;