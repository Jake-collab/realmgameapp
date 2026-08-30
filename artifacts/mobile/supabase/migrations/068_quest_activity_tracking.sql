-- Migration 068 — server-authoritative activity tracking for Quest verification
--
-- Activity progress is derived from sequential, quality-checked location samples.
-- Clients never write distance or completion state directly.

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_verification_methods_valid;
ALTER TABLE quests
  ADD CONSTRAINT quests_verification_methods_valid CHECK (
    verification_methods IS NULL
    OR (
      cardinality(verification_methods) > 0
      AND verification_methods <@ ARRAY[
        'camera', 'gps', 'timer', 'integrity_confirmation', 'activity_tracking'
      ]::TEXT[]
    )
  );

ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS required_distance_meters NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS activity_type TEXT;

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_required_distance_valid;
ALTER TABLE quests
  ADD CONSTRAINT quests_required_distance_valid CHECK (
    required_distance_meters IS NULL
    OR required_distance_meters BETWEEN 1 AND 100000
  );

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_activity_type_valid;
ALTER TABLE quests
  ADD CONSTRAINT quests_activity_type_valid CHECK (
    activity_type IS NULL
    OR activity_type IN ('walking', 'running', 'cycling', 'hiking', 'general')
  );

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_activity_tracking_matches_method;
ALTER TABLE quests
  ADD CONSTRAINT quests_activity_tracking_matches_method CHECK (
    verification_methods IS NULL
    OR (
      ('activity_tracking' = ANY(verification_methods)
        AND required_distance_meters BETWEEN 1 AND 100000)
      OR (
        NOT ('activity_tracking' = ANY(verification_methods))
        AND required_distance_meters IS NULL
        AND activity_type IS NULL
      )
    )
  );

ALTER TABLE quest_participations
  ADD COLUMN IF NOT EXISTS activity_distance_meters NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activity_first_sample_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activity_last_sample_at TIMESTAMPTZ;

COMMENT ON COLUMN quests.required_distance_meters IS
  'Server-calculated distance target for activity_tracking verification.';
COMMENT ON COLUMN quests.activity_type IS
  'Optional activity profile used for conservative speed validation.';
COMMENT ON COLUMN quest_participations.activity_distance_meters IS
  'Server-derived accepted activity distance; clients cannot write this value.';

CREATE TABLE IF NOT EXISTS quest_activity_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID NOT NULL REFERENCES quest_participations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_sample_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  accuracy_meters NUMERIC(8, 2) NOT NULL,
  segment_distance_meters NUMERIC(12, 2) NOT NULL DEFAULT 0,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_code TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quest_activity_samples_coordinates_valid CHECK (
    latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
  ),
  CONSTRAINT quest_activity_samples_accuracy_valid CHECK (
    accuracy_meters >= 0 AND accuracy_meters <= 1000
  ),
  CONSTRAINT quest_activity_samples_rejection_valid CHECK (
    (accepted AND rejection_code IS NULL) OR (NOT accepted)
  ),
  CONSTRAINT quest_activity_samples_client_id_valid CHECK (
    length(client_sample_id) BETWEEN 1 AND 160
  ),
  UNIQUE (participation_id, client_sample_id)
);

ALTER TABLE quest_activity_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_activity_samples FORCE ROW LEVEL SECURITY;

-- Raw coordinates are intentionally not readable by the mobile client. The
-- activity RPC is the only client-visible access path.
REVOKE ALL ON TABLE quest_activity_samples FROM anon, authenticated;
GRANT SELECT ON TABLE quest_activity_samples TO service_role;

CREATE INDEX IF NOT EXISTS idx_quest_activity_samples_participation_time
  ON quest_activity_samples (participation_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_quest_activity_samples_recorded_at
  ON quest_activity_samples (recorded_at);

GRANT SELECT (required_distance_meters, activity_type)
  ON quests TO authenticated;

-- Activity progress is server-owned, so the existing safe participation update
-- grant remains unchanged.
REVOKE UPDATE ON quest_activity_samples FROM anon, authenticated;

CREATE OR REPLACE FUNCTION activity_tracking_haversine_meters(
  p_latitude_a NUMERIC,
  p_longitude_a NUMERIC,
  p_latitude_b NUMERIC,
  p_longitude_b NUMERIC
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT 6371008.8 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(p_latitude_b - p_latitude_a) / 2), 2)
    + COS(RADIANS(p_latitude_a)) * COS(RADIANS(p_latitude_b))
      * POWER(SIN(RADIANS(p_longitude_b - p_longitude_a) / 2), 2)
  ));
$$;

CREATE OR REPLACE FUNCTION activity_tracking_max_speed_mps(p_activity_type TEXT)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE p_activity_type
    WHEN 'walking' THEN 3.5
    WHEN 'running' THEN 12
    WHEN 'cycling' THEN 22
    WHEN 'hiking' THEN 5
    ELSE 30
  END;
$$;

-- Keep the quality gate values in one server-owned function so a policy change
-- cannot update one branch of the sampler and miss another.
CREATE OR REPLACE FUNCTION activity_tracking_thresholds()
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'max_accuracy_meters', 100,
    'max_age_seconds', 300,
    'max_clock_skew_seconds', 30,
    'accuracy_tolerance_multiplier', 2
  );
$$;

CREATE OR REPLACE FUNCTION record_quest_activity_sample(
  p_participation_id UUID,
  p_user_id UUID,
  p_client_sample_id TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_accuracy_meters NUMERIC,
  p_captured_at TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation quest_participations%ROWTYPE;
  v_quest quests%ROWTYPE;
  v_previous quest_activity_samples%ROWTYPE;
  v_existing quest_activity_samples%ROWTYPE;
  v_distance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
  v_max_distance NUMERIC;
  v_rejection_code TEXT;
  v_accepted BOOLEAN := TRUE;
  v_total NUMERIC;
  v_thresholds JSONB := activity_tracking_thresholds();
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch.';
  END IF;

  IF p_client_sample_id IS NULL OR length(trim(p_client_sample_id)) = 0
     OR length(p_client_sample_id) > 160 THEN
    RAISE EXCEPTION 'A valid activity sample id is required.';
  END IF;

  SELECT * INTO v_existing
  FROM quest_activity_samples
  WHERE participation_id = p_participation_id
    AND client_sample_id = p_client_sample_id;

  IF FOUND THEN
    SELECT activity_distance_meters INTO v_total
    FROM quest_participations
    WHERE id = p_participation_id;
    RETURN json_build_object(
      'accepted', v_existing.accepted,
      'rejection_code', v_existing.rejection_code,
      'segment_distance_meters', v_existing.segment_distance_meters,
      'total_distance_meters', COALESCE(v_total, 0),
      'was_duplicate', TRUE
    );
  END IF;

  SELECT * INTO v_participation
  FROM quest_participations
  WHERE id = p_participation_id
  FOR UPDATE;

  IF NOT FOUND OR v_participation.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Participation not found or unauthorized.';
  END IF;

  -- Re-check after taking the participation lock so concurrent retries of the
  -- same client sample return the original decision instead of colliding on
  -- the unique idempotency constraint.
  SELECT * INTO v_existing
  FROM quest_activity_samples
  WHERE participation_id = p_participation_id
    AND client_sample_id = p_client_sample_id;
  IF FOUND THEN
    RETURN json_build_object(
      'accepted', v_existing.accepted,
      'rejection_code', v_existing.rejection_code,
      'segment_distance_meters', v_existing.segment_distance_meters,
      'total_distance_meters', COALESCE(v_participation.activity_distance_meters, 0),
      'was_duplicate', TRUE
    );
  END IF;

  SELECT * INTO v_quest FROM quests WHERE id = v_participation.quest_id;
  IF NOT FOUND OR NOT ('activity_tracking' = ANY(
    COALESCE(v_quest.verification_methods, ARRAY[]::TEXT[])
  )) THEN
    RAISE EXCEPTION 'This Quest does not require activity tracking.';
  END IF;

  -- Samples are accepted only while gameplay is active. awaiting_proof and all
  -- terminal states stop recording on the server even if a watcher lingers.
  IF v_participation.status NOT IN ('started', 'in_progress') THEN
    v_accepted := FALSE;
    v_rejection_code := 'participation_not_active';
  ELSIF p_captured_at IS NULL
     OR p_captured_at < v_participation.started_at
     OR p_captured_at > NOW() + (
       (v_thresholds->>'max_clock_skew_seconds')::INTEGER * INTERVAL '1 second'
     ) THEN
    v_accepted := FALSE;
    v_rejection_code := 'timestamp_out_of_window';
  ELSIF p_captured_at < NOW() - (
    (v_thresholds->>'max_age_seconds')::INTEGER * INTERVAL '1 second'
  ) THEN
    v_accepted := FALSE;
    v_rejection_code := 'stale_sample';
  ELSIF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180 THEN
    v_accepted := FALSE;
    v_rejection_code := 'invalid_coordinates';
  ELSIF p_accuracy_meters IS NULL OR p_accuracy_meters <= 0
     OR p_accuracy_meters > (v_thresholds->>'max_accuracy_meters')::NUMERIC THEN
    v_accepted := FALSE;
    v_rejection_code := 'insufficient_accuracy';
  END IF;

  IF v_accepted THEN
    SELECT * INTO v_previous
    FROM quest_activity_samples
    WHERE participation_id = p_participation_id
      AND accepted
    ORDER BY captured_at DESC
    LIMIT 1;

    IF FOUND THEN
      IF p_captured_at <= v_previous.captured_at THEN
        v_accepted := FALSE;
        v_rejection_code := 'out_of_order';
      ELSE
        v_elapsed_seconds := EXTRACT(EPOCH FROM (p_captured_at - v_previous.captured_at));
        v_distance := activity_tracking_haversine_meters(
          v_previous.latitude, v_previous.longitude, p_latitude, p_longitude
        );
        IF v_distance < 0.25
           AND p_captured_at = v_previous.captured_at THEN
          v_accepted := FALSE;
          v_rejection_code := 'duplicate_sample';
        ELSE
          v_max_distance := activity_tracking_max_speed_mps(v_quest.activity_type)
            * v_elapsed_seconds
            + (p_accuracy_meters + v_previous.accuracy_meters)
              * (v_thresholds->>'accuracy_tolerance_multiplier')::NUMERIC;
          IF v_distance > v_max_distance THEN
            v_accepted := FALSE;
            v_rejection_code := 'unrealistic_speed';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO quest_activity_samples (
    participation_id, user_id, client_sample_id, captured_at, latitude,
    longitude, accuracy_meters, segment_distance_meters, accepted, rejection_code
  ) VALUES (
    p_participation_id, p_user_id, p_client_sample_id, p_captured_at, p_latitude,
    p_longitude, p_accuracy_meters, CASE WHEN v_accepted THEN v_distance ELSE 0 END,
    v_accepted, v_rejection_code
  );

  IF v_accepted THEN
    UPDATE quest_participations
    SET activity_distance_meters = COALESCE(activity_distance_meters, 0) + v_distance,
        activity_first_sample_at = COALESCE(activity_first_sample_at, p_captured_at),
        activity_last_sample_at = p_captured_at,
        last_progress_at = NOW(),
        updated_at = NOW()
    WHERE id = p_participation_id
    RETURNING activity_distance_meters INTO v_total;
  ELSE
    v_total := COALESCE(v_participation.activity_distance_meters, 0);
  END IF;

  RETURN json_build_object(
    'accepted', v_accepted,
    'rejection_code', v_rejection_code,
    'segment_distance_meters', CASE WHEN v_accepted THEN v_distance ELSE 0 END,
    'total_distance_meters', COALESCE(v_total, 0),
    'was_duplicate', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION record_quest_activity_sample(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_quest_activity_sample(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ
) TO authenticated;

REVOKE ALL ON FUNCTION activity_tracking_haversine_meters(NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION activity_tracking_max_speed_mps(TEXT) FROM PUBLIC;

-- Add activity satisfaction to the already-atomic completion function without
-- replacing the audited camera/GPS/timer implementation from migration 066.
DO $repair_complete_quest_activity$
DECLARE
  v_definition TEXT;
  v_repaired TEXT;
  v_marker TEXT := '  IF ''camera'' = ANY(v_methods) AND NOT EXISTS (';
  v_check TEXT := $activity_check$
  IF 'activity_tracking' = ANY(v_methods)
     AND (
       v_quest.required_distance_meters IS NULL
       OR COALESCE(v_participation.activity_distance_meters, 0)
         < v_quest.required_distance_meters
     ) THEN
    RAISE EXCEPTION 'Activity distance requirement has not been met.';
  END IF;

$activity_check$;
BEGIN
  SELECT pg_get_functiondef('complete_quest(uuid,uuid,text)'::regprocedure)
  INTO v_definition;
  v_repaired := replace(v_definition, v_marker, v_check || v_marker);
  IF v_repaired = v_definition THEN
    RAISE EXCEPTION 'complete_quest definition did not contain the expected verification marker.';
  END IF;
  EXECUTE v_repaired;
END;
$repair_complete_quest_activity$;

REVOKE ALL ON FUNCTION complete_quest(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_quest(UUID, UUID, TEXT) TO authenticated;