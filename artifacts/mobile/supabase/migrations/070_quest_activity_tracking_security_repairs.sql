-- Migration 070 — Repair activity sample authorization and spoof resistance
--
-- Keep the applied 068 history immutable. The original implementation becomes
-- an uncallable internal function; a new public RPC authorizes and locks the
-- participation before any duplicate lookup or response.

ALTER FUNCTION record_quest_activity_sample(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ
) RENAME TO record_quest_activity_sample_internal;

REVOKE ALL ON FUNCTION record_quest_activity_sample_internal(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION activity_tracking_thresholds()
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'max_accuracy_meters', 25,
    'max_age_seconds', 300,
    'max_clock_skew_seconds', 5,
    -- Speed rejection must not expand when a caller reports worse accuracy.
    'accuracy_tolerance_multiplier', 0
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
  v_owner_id UUID;
BEGIN
  SELECT user_id
  INTO v_owner_id
  FROM quest_participations
  WHERE id = p_participation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participation not found.';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id OR v_owner_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized activity sample.';
  END IF;

  RETURN record_quest_activity_sample_internal(
    p_participation_id,
    p_user_id,
    p_client_sample_id,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    p_captured_at
  );
END;
$$;

REVOKE ALL ON FUNCTION activity_tracking_thresholds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION record_quest_activity_sample(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_quest_activity_sample(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ
) TO authenticated;