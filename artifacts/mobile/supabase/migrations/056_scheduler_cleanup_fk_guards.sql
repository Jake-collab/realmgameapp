-- Migration 056 — Make ephemeral-session cleanup resilient to retained evidence.
-- Expired sessions referenced by a proof, collection, or placement record are
-- protected by their existing foreign keys and must remain available.

CREATE OR REPLACE FUNCTION purge_expired_ephemeral_sessions()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_verification INTEGER;
  v_collection INTEGER;
  v_placement INTEGER;
  v_sweep INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted worker required'; END IF;

  DELETE FROM quest_proof_verification_sessions s
  WHERE s.consumed_at IS NULL
    AND s.expires_at <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM proof_submissions p WHERE p.verification_session_id = s.id
    );
  GET DIAGNOSTICS v_verification = ROW_COUNT;

  DELETE FROM hunt_drop_collection_sessions s
  WHERE s.consumed_at IS NULL
    AND s.expires_at <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM hunt_drop_collections c WHERE c.collection_session_id = s.id
    );
  GET DIAGNOSTICS v_collection = ROW_COUNT;

  DELETE FROM hunt_placement_sessions s
  WHERE s.consumed_at IS NULL
    AND s.expires_at <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM hunt_drop_placements p WHERE p.placement_session_id = s.id
    );
  GET DIAGNOSTICS v_placement = ROW_COUNT;

  DELETE FROM hunt_creator_stop_sweep_sessions s
  WHERE s.consumed_at IS NULL
    AND s.expires_at <= NOW();
  GET DIAGNOSTICS v_sweep = ROW_COUNT;

  RETURN jsonb_build_object(
    'verification', v_verification,
    'collection', v_collection,
    'placement', v_placement,
    'creator_sweep', v_sweep
  );
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_ephemeral_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_ephemeral_sessions() TO service_role;