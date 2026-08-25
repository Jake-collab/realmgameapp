-- Prompt 26: Canonical Hunt Drop, collection, placement, and safety boundary.
-- hunt_stops remains the one canonical Drop entity; this migration extends it
-- instead of introducing a competing hunt_drops table.

ALTER TABLE hunt_stops
  ADD COLUMN IF NOT EXISTS drop_type TEXT NOT NULL DEFAULT 'STANDARD'
    CHECK (drop_type IN ('STANDARD', 'CLUE', 'RIDDLE')),
  ADD COLUMN IF NOT EXISTS placement_method TEXT NOT NULL DEFAULT 'VERIFIED_IN_PERSON'
    CHECK (placement_method IN ('VERIFIED_IN_PERSON', 'REMOTE_ADMIN_REVIEW')),
  ADD COLUMN IF NOT EXISTS base_hunt_points INTEGER NOT NULL DEFAULT 50
    CHECK (base_hunt_points >= 0 AND base_hunt_points <= 200),
  ADD COLUMN IF NOT EXISTS final_hunt_points INTEGER NOT NULL DEFAULT 50
    CHECK (final_hunt_points >= 0 AND final_hunt_points <= 200),
  ADD COLUMN IF NOT EXISTS reward_category TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS reward_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS public_image_media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drop_available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS drop_available_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS placement_status TEXT NOT NULL DEFAULT 'REVIEW'
    CHECK (placement_status IN ('PASS', 'REVIEW', 'REJECT')),
  ADD COLUMN IF NOT EXISTS placement_policy_version TEXT,
  ADD COLUMN IF NOT EXISTS location_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE hunt_stop_geofences
  ADD COLUMN IF NOT EXISTS public_search_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_search_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_search_radius_meters INTEGER NOT NULL DEFAULT 350
    CHECK (public_search_radius_meters BETWEEN 200 AND 500),
  ADD COLUMN IF NOT EXISTS clue_reveal_radius_meters INTEGER
    CHECK (clue_reveal_radius_meters IS NULL OR clue_reveal_radius_meters BETWEEN 250 AND 1000),
  ADD COLUMN IF NOT EXISTS collection_radius_meters INTEGER NOT NULL DEFAULT 25
    CHECK (collection_radius_meters BETWEEN 10 AND 50);

-- A public search center is intentionally independent from the private target.
-- Existing stops get a broad, stable center only where an approximate location
-- was already stored; new content must set this explicitly during moderation.
UPDATE hunt_stop_geofences
SET public_search_lat = COALESCE(public_search_lat, public_lat),
    public_search_lng = COALESCE(public_search_lng, public_lng)
WHERE public_search_lat IS NULL OR public_search_lng IS NULL;

CREATE TABLE IF NOT EXISTS hunt_drop_riddle_answers (
  hunt_stop_id UUID PRIMARY KEY REFERENCES hunt_stops(id) ON DELETE CASCADE,
  normalized_answer TEXT NOT NULL,
  case_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  punctuation_insensitive BOOLEAN NOT NULL DEFAULT TRUE,
  manual_review_on_failure BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunt_drop_riddle_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_participant_id UUID NOT NULL REFERENCES hunt_participants(id) ON DELETE CASCADE,
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  was_correct BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_hunt_drop_riddle_attempt_rate
  ON hunt_drop_riddle_attempts(hunt_participant_id, hunt_stop_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS hunt_drop_collection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  hunt_participant_id UUID NOT NULL REFERENCES hunt_participants(id) ON DELETE CASCADE,
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  nonce UUID NOT NULL DEFAULT gen_random_uuid(),
  required_collection_radius_meters INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  consumed_at TIMESTAMPTZ,
  UNIQUE (id, nonce)
);

CREATE TABLE IF NOT EXISTS hunt_drop_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_participant_id UUID NOT NULL REFERENCES hunt_participants(id) ON DELETE RESTRICT,
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE RESTRICT,
  collection_session_id UUID NOT NULL REFERENCES hunt_drop_collection_sessions(id) ON DELETE RESTRICT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (hunt_participant_id, hunt_stop_id),
  UNIQUE (collection_session_id)
);

CREATE TABLE IF NOT EXISTS hunt_point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE RESTRICT,
  hunt_participant_id UUID NOT NULL REFERENCES hunt_participants(id) ON DELETE RESTRICT,
  hunt_stop_id UUID REFERENCES hunt_stops(id) ON DELETE RESTRICT,
  collection_id UUID REFERENCES hunt_drop_collections(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('HUNT_DROP_COLLECTION', 'HUNT_COMPLETION', 'HUNT_REVERSAL', 'HUNT_QUARANTINE', 'HUNT_QUARANTINE_RELEASE', 'ADMIN_ADJUSTMENT')),
  state TEXT NOT NULL DEFAULT 'valid' CHECK (state IN ('valid', 'quarantined', 'reversed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hunt_point_ledger_leaderboard
  ON hunt_point_ledger(user_id, created_at DESC) WHERE state = 'valid';

CREATE TABLE IF NOT EXISTS hunt_placement_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  nonce UUID NOT NULL DEFAULT gen_random_uuid(),
  initial_latitude DOUBLE PRECISION,
  initial_longitude DOUBLE PRECISION,
  final_latitude DOUBLE PRECISION,
  final_longitude DOUBLE PRECISION,
  gps_accuracy_meters DOUBLE PRECISION,
  motion_coverage_degrees DOUBLE PRECISION,
  scan_media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  consumed_at TIMESTAMPTZ,
  CHECK (initial_latitude IS NULL OR initial_latitude BETWEEN -90 AND 90),
  CHECK (initial_longitude IS NULL OR initial_longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS hunt_drop_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  placement_session_id UUID REFERENCES hunt_placement_sessions(id) ON DELETE RESTRICT,
  placement_method TEXT NOT NULL CHECK (placement_method IN ('VERIFIED_IN_PERSON', 'REMOTE_ADMIN_REVIEW')),
  decision TEXT NOT NULL CHECK (decision IN ('PASS', 'REVIEW', 'REJECT')),
  policy_version TEXT NOT NULL,
  map_context JSONB NOT NULL DEFAULT '{}'::JSONB,
  vision_summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  safety_signals JSONB NOT NULL DEFAULT '[]'::JSONB,
  creator_declaration JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunt_drop_relocation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','approved','declined','resolved')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hunt_drop_safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('unsafe_access','private_property','roadway','restricted_area','hazard','moved_or_missing','other')),
  detail TEXT CHECK (char_length(detail) <= 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE hunt_drop_riddle_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_riddle_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_collection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_placement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_relocation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_safety_reports ENABLE ROW LEVEL SECURITY;

-- All sensitive Drop evidence is available through tightly scoped functions only.
CREATE OR REPLACE FUNCTION issue_hunt_drop_collection_session(
  p_participation_id UUID,
  p_stop_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_meters DOUBLE PRECISION
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_participant RECORD; v_geo RECORD; v_session hunt_drop_collection_sessions;
BEGIN
  SELECT hp.*, hs.hunt_id INTO v_participant
  FROM hunt_participants hp JOIN hunt_stops hs ON hs.id = p_stop_id
  WHERE hp.id = p_participation_id AND hp.user_id = auth.uid()
    AND hp.status = 'active' AND hs.hunt_id = hp.hunt_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reasonCode','INVALID_PARTICIPATION'); END IF;
  IF p_accuracy_meters IS NULL OR p_accuracy_meters > 50 THEN
    RETURN jsonb_build_object('success',false,'reasonCode','POOR_ACCURACY','userMessage','Move to an open area and try again.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM hunt_stop_progress
    WHERE hunt_participant_id=p_participation_id AND hunt_stop_id=p_stop_id
      AND status = 'in_progress'
  ) THEN RETURN jsonb_build_object('success',false,'reasonCode','DROP_UNAVAILABLE'); END IF;
  SELECT * INTO v_geo FROM hunt_stop_geofences WHERE hunt_stop_id=p_stop_id;
  IF NOT FOUND OR v_geo.validation_point IS NULL
    OR NOT ST_DWithin(v_geo.validation_point, ST_SetSRID(ST_MakePoint(p_longitude,p_latitude),4326)::GEOGRAPHY, v_geo.collection_radius_meters)
  THEN RETURN jsonb_build_object('success',false,'reasonCode','OUTSIDE_REQUIRED_AREA','userMessage','Get closer to the Drop and try again.'); END IF;
  INSERT INTO hunt_drop_collection_sessions(user_id,hunt_id,hunt_participant_id,hunt_stop_id,required_collection_radius_meters)
  VALUES(auth.uid(),v_participant.hunt_id,p_participation_id,p_stop_id,v_geo.collection_radius_meters)
  RETURNING * INTO v_session;
  RETURN jsonb_build_object('success',true,'sessionId',v_session.id,'expiresAt',v_session.expires_at);
END $$;

CREATE OR REPLACE FUNCTION collect_hunt_drop(
  p_session_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_meters DOUBLE PRECISION
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session RECORD; v_geo RECORD; v_stop RECORD; v_collection hunt_drop_collections;
BEGIN
  SELECT * INTO v_session FROM hunt_drop_collection_sessions
  WHERE id=p_session_id AND user_id=auth.uid() AND consumed_at IS NULL AND expires_at>NOW()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reasonCode','SESSION_EXPIRED','userMessage','Start Search again to collect this Drop.'); END IF;
  IF p_accuracy_meters IS NULL OR p_accuracy_meters > 50 THEN RETURN jsonb_build_object('success',false,'reasonCode','POOR_ACCURACY'); END IF;
  SELECT * INTO v_geo FROM hunt_stop_geofences WHERE hunt_stop_id=v_session.hunt_stop_id;
  SELECT * INTO v_stop FROM hunt_stops WHERE id=v_session.hunt_stop_id;
  IF v_geo.validation_point IS NULL OR NOT ST_DWithin(v_geo.validation_point, ST_SetSRID(ST_MakePoint(p_longitude,p_latitude),4326)::GEOGRAPHY, v_session.required_collection_radius_meters) THEN
    RETURN jsonb_build_object('success',false,'reasonCode','OUTSIDE_REQUIRED_AREA','userMessage','You moved out of range. Get closer and search again.');
  END IF;
  INSERT INTO hunt_drop_collections(hunt_participant_id,hunt_stop_id,collection_session_id,location_version)
  VALUES(v_session.hunt_participant_id,v_session.hunt_stop_id,v_session.id,v_stop.location_version)
  ON CONFLICT(hunt_participant_id,hunt_stop_id) DO NOTHING RETURNING * INTO v_collection;
  IF v_collection.id IS NULL THEN RETURN jsonb_build_object('success',false,'reasonCode','ALREADY_COLLECTED','userMessage','You already collected this Drop.'); END IF;
  UPDATE hunt_drop_collection_sessions SET consumed_at=NOW() WHERE id=v_session.id;
  UPDATE hunt_stop_progress SET status='completed', completed_at=NOW(), updated_at=NOW()
  WHERE hunt_participant_id=v_session.hunt_participant_id AND hunt_stop_id=v_session.hunt_stop_id;
  INSERT INTO hunt_point_ledger(user_id,hunt_id,hunt_participant_id,hunt_stop_id,collection_id,amount,event_type,idempotency_key,reason)
  VALUES(v_session.user_id,v_session.hunt_id,v_session.hunt_participant_id,v_session.hunt_stop_id,v_collection.id,v_stop.final_hunt_points,
    'HUNT_DROP_COLLECTION','hunt_drop_collection:'||v_collection.id,'Hunt Drop collected')
  ON CONFLICT(idempotency_key) DO NOTHING;
  RETURN jsonb_build_object('success',true,'collectionId',v_collection.id,'awardedPoints',v_stop.final_hunt_points);
END $$;

CREATE OR REPLACE FUNCTION submit_hunt_drop_riddle_answer(
  p_participation_id UUID,
  p_stop_id UUID,
  p_answer TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_answer RECORD; v_attempts INTEGER; v_normalized TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hunt_participants hp JOIN hunt_stop_progress hsp ON hsp.hunt_participant_id=hp.id
    WHERE hp.id=p_participation_id AND hp.user_id=auth.uid() AND hp.status='active'
      AND hsp.hunt_stop_id=p_stop_id AND hsp.status = 'in_progress'
  ) THEN RETURN jsonb_build_object('success',false,'reasonCode','DROP_UNAVAILABLE'); END IF;
  SELECT * INTO v_answer FROM hunt_drop_riddle_answers WHERE hunt_stop_id=p_stop_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reasonCode','RIDDLE_NOT_CONFIGURED'); END IF;
  SELECT COUNT(*) INTO v_attempts FROM hunt_drop_riddle_attempts
  WHERE hunt_participant_id=p_participation_id AND hunt_stop_id=p_stop_id AND attempted_at > NOW()-INTERVAL '15 minutes';
  IF v_attempts >= 5 THEN RETURN jsonb_build_object('success',false,'reasonCode','RATE_LIMITED','userMessage','Try again in a few minutes.'); END IF;
  v_normalized := lower(regexp_replace(trim(COALESCE(p_answer,'')), '[^a-z0-9]+', '', 'g'));
  INSERT INTO hunt_drop_riddle_attempts(hunt_participant_id,hunt_stop_id,was_correct)
  VALUES(p_participation_id,p_stop_id,v_normalized=lower(regexp_replace(v_answer.normalized_answer, '[^a-z0-9]+', '', 'g')));
  IF v_normalized=lower(regexp_replace(v_answer.normalized_answer, '[^a-z0-9]+', '', 'g')) THEN
    UPDATE hunt_stop_progress SET status='in_progress', updated_at=NOW()
    WHERE hunt_participant_id=p_participation_id AND hunt_stop_id=p_stop_id;
    RETURN jsonb_build_object('success',true,'correct',true,'userMessage','Correct. Search for the Drop.');
  END IF;
  RETURN jsonb_build_object('success',true,'correct',false,'userMessage','That is not the answer. Look for another clue.');
END $$;

CREATE OR REPLACE FUNCTION get_hunt_drop_search_zones(
  p_participation_id UUID
) RETURNS TABLE (
  drop_id UUID, hunt_id UUID, drop_type TEXT, search_lat DOUBLE PRECISION, search_lng DOUBLE PRECISION,
  search_radius_meters INTEGER, clue_reveal_radius_meters INTEGER, collection_radius_meters INTEGER,
  clue_state TEXT, collection_state TEXT, title TEXT, points INTEGER
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
  JOIN hunt_stop_progress hsp ON hsp.hunt_participant_id=hp.id
  JOIN hunt_stops hs ON hs.id=hsp.hunt_stop_id
  JOIN hunt_stop_geofences g ON g.hunt_stop_id=hs.id
  LEFT JOIN hunt_drop_collections c ON c.hunt_participant_id=hp.id AND c.hunt_stop_id=hs.id
  WHERE hp.id=p_participation_id AND hp.user_id=auth.uid()
    AND hp.status IN ('active','paused') AND hs.placement_status='PASS'
    AND g.public_search_lat IS NOT NULL AND g.public_search_lng IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION issue_hunt_drop_collection_session(UUID,UUID,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION collect_hunt_drop(UUID,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_hunt_drop_riddle_answer(UUID,UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_hunt_drop_search_zones(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_hunt_drop_collection_session(UUID,UUID,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION collect_hunt_drop(UUID,DOUBLE PRECISION,DOUBLE PRECISION,DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_hunt_drop_riddle_answer(UUID,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hunt_drop_search_zones(UUID) TO authenticated;

COMMENT ON TABLE hunt_drop_collections IS 'Server-authoritative Digital Drop collections. No client write access.';
COMMENT ON TABLE hunt_placement_sessions IS 'Private, short-lived live-placement evidence. Gallery uploads do not qualify.';
COMMENT ON TABLE hunt_drop_placements IS 'Versioned placement policy outcomes. PASS is not a legal guarantee.';
COMMENT ON TABLE hunt_drop_relocation_requests IS 'Staff-audited requests to move a Drop; active participants remain on their location version.';
COMMENT ON TABLE hunt_drop_safety_reports IS 'Safety reports are separate from proof or image moderation decisions.';