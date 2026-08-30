-- Migration 069 — Minimize retained Quest activity location evidence
--
-- Derived participation distance remains available for completion/audit, while
-- exact raw samples from terminal participations are removed after a bounded
-- retention window by the existing trusted maintenance worker.

CREATE OR REPLACE FUNCTION purge_expired_quest_activity_samples(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  IF p_retention_days IS NULL OR p_retention_days < 0 OR p_retention_days > 3650 THEN
    RAISE EXCEPTION 'activity sample retention must be between 0 and 3650 days';
  END IF;

  DELETE FROM quest_activity_samples samples
  USING quest_participations participations
  WHERE participations.id = samples.participation_id
    AND participations.status IN ('completed', 'abandoned', 'expired')
    AND samples.recorded_at <= NOW() - make_interval(days => p_retention_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION run_scheduled_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation INTEGER;
  v_coordinates INTEGER;
  v_participations INTEGER;
  v_activity_samples INTEGER;
  v_sessions JSONB;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted worker required';
  END IF;
  v_invitation := expire_hunt_invitations();
  v_coordinates := purge_expired_validation_coordinates();
  v_participations := expire_quest_participations();
  v_sessions := purge_expired_ephemeral_sessions();
  v_activity_samples := purge_expired_quest_activity_samples(30);
  RETURN jsonb_build_object(
    'invitations_expired', v_invitation,
    'coordinates_purged', v_coordinates,
    'quest_participations_expired', v_participations,
    'ephemeral_sessions', v_sessions,
    'quest_activity_samples_purged', v_activity_samples
  );
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_quest_activity_samples(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_quest_activity_samples(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION run_scheduled_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION run_scheduled_maintenance() TO service_role;