-- Harden Hunt Drop collection sessions against direct RPC calls.
-- A collection session is valid only for the approved placement/version that
-- existed when it was issued. Both issue and collect paths must enforce this;
-- UI search-zone filtering is never an authorization boundary.

ALTER TABLE hunt_drop_collection_sessions
  ADD COLUMN IF NOT EXISTS location_version INTEGER;

UPDATE hunt_drop_collection_sessions session
SET location_version = stop.location_version
FROM hunt_stops stop
WHERE stop.id = session.hunt_stop_id
  AND session.location_version IS NULL;

ALTER TABLE hunt_drop_collection_sessions
  ALTER COLUMN location_version SET NOT NULL;

CREATE OR REPLACE FUNCTION issue_hunt_drop_collection_session(
  p_participation_id UUID,
  p_stop_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_meters DOUBLE PRECISION
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_participant RECORD;
  v_geo RECORD;
  v_session hunt_drop_collection_sessions;
BEGIN
  SELECT hp.*, hs.hunt_id, hs.placement_status, hs.drop_available_from,
    hs.drop_available_until, hs.location_version
  INTO v_participant
  FROM hunt_participants hp
  JOIN hunt_stops hs ON hs.id = p_stop_id
  WHERE hp.id = p_participation_id
    AND hp.user_id = auth.uid()
    AND hp.status = 'active'
    AND hs.hunt_id = hp.hunt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'INVALID_PARTICIPATION');
  END IF;

  IF v_participant.placement_status IS DISTINCT FROM 'PASS'
    OR (v_participant.drop_available_from IS NOT NULL AND v_participant.drop_available_from > NOW())
    OR (v_participant.drop_available_until IS NOT NULL AND v_participant.drop_available_until < NOW()) THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'DROP_UNAVAILABLE');
  END IF;

  IF p_accuracy_meters IS NULL OR p_accuracy_meters > 50 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reasonCode', 'POOR_ACCURACY',
      'userMessage', 'Move to an open area and try again.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM hunt_stop_progress
    WHERE hunt_participant_id = p_participation_id
      AND hunt_stop_id = p_stop_id
      AND status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'DROP_UNAVAILABLE');
  END IF;

  SELECT * INTO v_geo
  FROM hunt_stop_geofences
  WHERE hunt_stop_id = p_stop_id;

  IF NOT FOUND
    OR v_geo.validation_point IS NULL
    OR NOT ST_DWithin(
      v_geo.validation_point,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY,
      v_geo.collection_radius_meters
    ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reasonCode', 'OUTSIDE_REQUIRED_AREA',
      'userMessage', 'Get closer to the Drop and try again.'
    );
  END IF;

  INSERT INTO hunt_drop_collection_sessions(
    user_id,
    hunt_id,
    hunt_participant_id,
    hunt_stop_id,
    required_collection_radius_meters,
    location_version
  )
  VALUES(
    auth.uid(),
    v_participant.hunt_id,
    p_participation_id,
    p_stop_id,
    v_geo.collection_radius_meters,
    v_participant.location_version
  )
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'success', true,
    'sessionId', v_session.id,
    'expiresAt', v_session.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION collect_hunt_drop(
  p_session_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_meters DOUBLE PRECISION
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session RECORD;
  v_geo RECORD;
  v_stop RECORD;
  v_collection hunt_drop_collections;
BEGIN
  SELECT * INTO v_session
  FROM hunt_drop_collection_sessions
  WHERE id = p_session_id
    AND user_id = auth.uid()
    AND consumed_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reasonCode', 'SESSION_EXPIRED',
      'userMessage', 'Start Search again to collect this Drop.'
    );
  END IF;

  IF p_accuracy_meters IS NULL OR p_accuracy_meters > 50 THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'POOR_ACCURACY');
  END IF;

  SELECT * INTO v_stop
  FROM hunt_stops
  WHERE id = v_session.hunt_stop_id
  FOR SHARE;

  IF NOT FOUND
    OR v_stop.placement_status IS DISTINCT FROM 'PASS'
    OR (v_stop.drop_available_from IS NOT NULL AND v_stop.drop_available_from > NOW())
    OR (v_stop.drop_available_until IS NOT NULL AND v_stop.drop_available_until < NOW())
    OR v_stop.location_version IS DISTINCT FROM v_session.location_version
    OR NOT EXISTS (
      SELECT 1
      FROM hunt_participants hp
      JOIN hunt_stop_progress progress
        ON progress.hunt_participant_id = hp.id
      WHERE hp.id = v_session.hunt_participant_id
        AND hp.user_id = auth.uid()
        AND hp.hunt_id = v_session.hunt_id
        AND hp.status = 'active'
        AND progress.hunt_stop_id = v_session.hunt_stop_id
        AND progress.status = 'in_progress'
    ) THEN
    -- A stale or disallowed session must never become valid again if the
    -- placement is later changed back or the availability window reopens.
    UPDATE hunt_drop_collection_sessions
    SET consumed_at = NOW()
    WHERE id = v_session.id;
    RETURN jsonb_build_object('success', false, 'reasonCode', 'DROP_UNAVAILABLE');
  END IF;

  SELECT * INTO v_geo
  FROM hunt_stop_geofences
  WHERE hunt_stop_id = v_session.hunt_stop_id;

  IF NOT FOUND
    OR v_geo.validation_point IS NULL
    OR NOT ST_DWithin(
      v_geo.validation_point,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY,
      v_session.required_collection_radius_meters
    ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reasonCode', 'OUTSIDE_REQUIRED_AREA',
      'userMessage', 'You moved out of range. Get closer and search again.'
    );
  END IF;

  INSERT INTO hunt_drop_collections(
    hunt_participant_id,
    hunt_stop_id,
    collection_session_id,
    location_version
  )
  VALUES(
    v_session.hunt_participant_id,
    v_session.hunt_stop_id,
    v_session.id,
    v_session.location_version
  )
  ON CONFLICT(hunt_participant_id, hunt_stop_id) DO NOTHING
  RETURNING * INTO v_collection;

  IF v_collection.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reasonCode', 'ALREADY_COLLECTED',
      'userMessage', 'You already collected this Drop.'
    );
  END IF;

  UPDATE hunt_drop_collection_sessions
  SET consumed_at = NOW()
  WHERE id = v_session.id;

  UPDATE hunt_stop_progress
  SET status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE hunt_participant_id = v_session.hunt_participant_id
    AND hunt_stop_id = v_session.hunt_stop_id;

  INSERT INTO hunt_point_ledger(
    user_id,
    hunt_id,
    hunt_participant_id,
    hunt_stop_id,
    collection_id,
    amount,
    event_type,
    idempotency_key,
    reason
  )
  VALUES(
    v_session.user_id,
    v_session.hunt_id,
    v_session.hunt_participant_id,
    v_session.hunt_stop_id,
    v_collection.id,
    v_stop.final_hunt_points,
    'HUNT_DROP_COLLECTION',
    'hunt_drop_collection:' || v_collection.id,
    'Hunt Drop collected'
  )
  ON CONFLICT(idempotency_key) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'collectionId', v_collection.id,
    'awardedPoints', v_stop.final_hunt_points
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_hunt_drop_search_zones(
  p_participation_id UUID
) RETURNS TABLE (
  drop_id UUID,
  hunt_id UUID,
  drop_type TEXT,
  search_lat DOUBLE PRECISION,
  search_lng DOUBLE PRECISION,
  search_radius_meters INTEGER,
  clue_reveal_radius_meters INTEGER,
  collection_radius_meters INTEGER,
  clue_state TEXT,
  collection_state TEXT,
  title TEXT,
  points INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hs.id, hp.hunt_id, hs.drop_type, g.public_search_lat, g.public_search_lng,
    g.public_search_radius_meters, g.clue_reveal_radius_meters, g.collection_radius_meters,
    CASE WHEN hsp.status = 'not_started' THEN 'locked' ELSE 'available' END,
    CASE WHEN c.id IS NOT NULL THEN 'COLLECTED'
         WHEN hsp.status = 'not_started' THEN 'CLUE_LOCKED'
         ELSE 'SEARCHING' END,
    hs.title, hs.final_hunt_points
  FROM hunt_participants hp
  JOIN hunt_stop_progress hsp ON hsp.hunt_participant_id = hp.id
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  JOIN hunt_stop_geofences g ON g.hunt_stop_id = hs.id
  LEFT JOIN hunt_drop_collections c
    ON c.hunt_participant_id = hp.id
    AND c.hunt_stop_id = hs.id
  WHERE hp.id = p_participation_id
    AND hp.user_id = auth.uid()
    AND hp.status IN ('active', 'paused')
    AND hs.placement_status = 'PASS'
    AND (hs.drop_available_from IS NULL OR hs.drop_available_from <= NOW())
    AND (hs.drop_available_until IS NULL OR hs.drop_available_until >= NOW())
    AND g.public_search_lat IS NOT NULL
    AND g.public_search_lng IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION issue_hunt_drop_collection_session(
  UUID,
  UUID,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION
) FROM PUBLIC;
REVOKE ALL ON FUNCTION collect_hunt_drop(
  UUID,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION
) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_hunt_drop_search_zones(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_hunt_drop_collection_session(
  UUID,
  UUID,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION
) TO authenticated;
GRANT EXECUTE ON FUNCTION collect_hunt_drop(
  UUID,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION
) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hunt_drop_search_zones(UUID) TO authenticated;