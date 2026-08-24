-- Hunt creator tools
-- All creator writes happen through SECURITY DEFINER functions so clients
-- cannot bypass ownership checks or write private validation geometry directly.

-- Submitted content is append-only so moderation decisions always reference
-- the exact Hunt version that was reviewed.
CREATE TABLE IF NOT EXISTS hunt_submitted_versions (
  hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  cover_media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (hunt_id, version_no)
);

CREATE TABLE IF NOT EXISTS hunt_submission_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id UUID NOT NULL,
  version_no INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason TEXT,
  decided_by UUID NOT NULL REFERENCES profiles(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (hunt_id, version_no) REFERENCES hunt_submitted_versions(hunt_id, version_no)
);

CREATE OR REPLACE FUNCTION prevent_hunt_submission_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'submitted_hunt_versions_are_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_hunt_submitted_versions_immutable ON hunt_submitted_versions;
CREATE TRIGGER trg_hunt_submitted_versions_immutable
  BEFORE UPDATE OR DELETE ON hunt_submitted_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_hunt_submission_mutation();

CREATE OR REPLACE FUNCTION prevent_hunt_submission_decision_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'hunt_submission_decisions_are_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_hunt_submission_decisions_immutable ON hunt_submission_decisions;
CREATE TRIGGER trg_hunt_submission_decisions_immutable
  BEFORE UPDATE OR DELETE ON hunt_submission_decisions
  FOR EACH ROW EXECUTE FUNCTION prevent_hunt_submission_decision_mutation();

ALTER TABLE hunt_submitted_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_submission_decisions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION assert_hunt_creator_eligible()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND account_status = 'active') THEN
    RAISE EXCEPTION 'creator_account_unavailable';
  END IF;
  IF (SELECT COUNT(*) FROM hunts WHERE creator_user_id = v_user_id AND status IN ('draft', 'rejected', 'pending_review')) >= 10 THEN
    RAISE EXCEPTION 'draft_limit_reached';
  END IF;
  IF (SELECT COUNT(*) FROM hunts WHERE creator_user_id = v_user_id AND created_at > NOW() - INTERVAL '1 hour') >= 5 THEN
    RAISE EXCEPTION 'creation_rate_limited';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION validate_creator_hunt_payload(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stop JSONB;
  v_method TEXT;
  v_starts_at TIMESTAMPTZ := NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ := NULLIF(p_payload->>'endsAt', '')::TIMESTAMPTZ;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_radius INTEGER;
  v_validation_radius INTEGER;
BEGIN
  IF char_length(TRIM(COALESCE(p_payload->>'title', ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF char_length(TRIM(COALESCE(p_payload->>'summary', ''))) < 10 THEN RAISE EXCEPTION 'summary_required'; END IF;
  IF COALESCE(jsonb_array_length(p_payload->'stops'), 0) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid_stop_count'; END IF;
  IF COALESCE((p_payload->>'pointsReward')::INTEGER, 0) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_points_reward'; END IF;
  IF COALESCE((p_payload->>'estimatedDurationMinutes')::INTEGER, 0) NOT BETWEEN 5 AND 1440 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  IF NULLIF(p_payload->>'maxParticipants', '') IS NOT NULL AND (p_payload->>'maxParticipants')::INTEGER NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_max_participants'; END IF;
  IF v_starts_at IS NOT NULL AND v_starts_at <= NOW() THEN RAISE EXCEPTION 'start_time_must_be_future'; END IF;
  IF v_ends_at IS NOT NULL AND (v_starts_at IS NULL OR v_ends_at <= v_starts_at) THEN RAISE EXCEPTION 'invalid_schedule'; END IF;
  IF p_payload->>'startModel' = 'scheduled' AND v_starts_at IS NULL THEN RAISE EXCEPTION 'scheduled_start_required'; END IF;

  FOR v_stop IN SELECT value FROM jsonb_array_elements(p_payload->'stops') LOOP
    IF char_length(TRIM(COALESCE(v_stop->>'title', ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'invalid_stop_title'; END IF;
    IF char_length(TRIM(COALESCE(v_stop->>'clueText', ''))) < 3 THEN RAISE EXCEPTION 'clue_required'; END IF;
    v_method := COALESCE(v_stop->>'completionMethod', 'none');
    IF v_method NOT IN ('none', 'text', 'photo', 'location', 'photo_and_location') THEN RAISE EXCEPTION 'unsupported_proof_method'; END IF;
    v_radius := COALESCE((v_stop->>'publicRadius')::INTEGER, 500);
    v_validation_radius := COALESCE((v_stop->>'validationRadius')::INTEGER, 30);
    IF v_radius NOT BETWEEN 50 AND 5000 OR v_validation_radius NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'invalid_stop_radius'; END IF;
    IF v_method IN ('location', 'photo_and_location') THEN
      v_lat := NULLIF(v_stop->>'publicLat', '')::DOUBLE PRECISION;
      v_lng := NULLIF(v_stop->>'publicLng', '')::DOUBLE PRECISION;
      IF v_lat IS NULL OR v_lng IS NULL OR v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'location_required_for_stop';
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION replace_creator_hunt_stops(
  p_hunt_id UUID,
  p_stops JSONB,
  p_ordering TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stop JSONB;
  v_stop_id UUID;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_position BIGINT;
BEGIN
  -- Keep IDs for unchanged draft stops so editing/reordering never breaks
  -- draft references. Only stops omitted from the submitted draft are removed.
  DELETE FROM hunt_stops s
  WHERE s.hunt_id = p_hunt_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_stops, '[]'::jsonb)) incoming
      WHERE incoming->>'id' = s.id::TEXT
    );

  FOR v_stop, v_position IN
    SELECT value, ordinality FROM jsonb_array_elements(COALESCE(p_stops, '[]'::jsonb)) WITH ORDINALITY
  LOOP
    v_lat := NULLIF(v_stop->>'publicLat', '')::DOUBLE PRECISION;
    v_lng := NULLIF(v_stop->>'publicLng', '')::DOUBLE PRECISION;
    SELECT id INTO v_stop_id
    FROM hunt_stops
    WHERE id = NULLIF(v_stop->>'id', '')::UUID AND hunt_id = p_hunt_id;

    INSERT INTO hunt_stops (
      id, hunt_id, sort_order, title, description, is_ordered, is_required,
      is_hidden, stop_role, estimated_radius_meters, completion_method, proof_required
    ) VALUES (
      COALESCE(v_stop_id, gen_random_uuid()),
      p_hunt_id,
      v_position - 1,
      LEFT(COALESCE(v_stop->>'title', 'Untitled stop'), 120),
      NULLIF(v_stop->>'description', ''),
      p_ordering = 'ordered',
      COALESCE((v_stop->>'isRequired')::BOOLEAN, TRUE),
      TRUE,
      CASE
        WHEN v_position = 1 THEN 'start'
        WHEN v_position = jsonb_array_length(COALESCE(p_stops, '[]'::jsonb)) THEN 'final'
        ELSE 'waypoint'
      END,
      COALESCE((v_stop->>'publicRadius')::INTEGER, 500),
      CASE COALESCE(v_stop->>'completionMethod', 'none')
        WHEN 'photo_and_location' THEN 'image_and_location'
        WHEN 'photo' THEN 'image'
        WHEN 'location' THEN 'location'
        WHEN 'text' THEN 'text'
        ELSE 'manual_confirmation'
      END,
      COALESCE(v_stop->>'completionMethod', 'none') <> 'none'
    )
    ON CONFLICT (id) DO UPDATE SET
      sort_order = EXCLUDED.sort_order,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      is_ordered = EXCLUDED.is_ordered,
      is_required = EXCLUDED.is_required,
      is_hidden = EXCLUDED.is_hidden,
      stop_role = EXCLUDED.stop_role,
      estimated_radius_meters = EXCLUDED.estimated_radius_meters,
      completion_method = EXCLUDED.completion_method,
      proof_required = EXCLUDED.proof_required
    WHERE hunt_stops.hunt_id = p_hunt_id
    RETURNING id INTO v_stop_id;

    UPDATE hunt_clues
    SET clue_text = NULLIF(v_stop->>'clueText', ''),
        hint_text = NULLIF(v_stop->>'hintText', '')
    WHERE hunt_stop_id = v_stop_id AND sort_order = 0;
    IF NOT FOUND THEN
      INSERT INTO hunt_clues (hunt_stop_id, sort_order, clue_text, hint_text)
      VALUES (v_stop_id, 0, NULLIF(v_stop->>'clueText', ''), NULLIF(v_stop->>'hintText', ''));
    END IF;

    DELETE FROM hunt_stop_geofences WHERE hunt_stop_id = v_stop_id;
    INSERT INTO hunt_stop_geofences (
      hunt_stop_id, public_lat, public_lng, public_radius_meters,
      validation_point, validation_radius_meters
    ) VALUES (
      v_stop_id,
      v_lat,
      v_lng,
      COALESCE((v_stop->>'publicRadius')::INTEGER, 500),
      CASE WHEN v_lat IS NOT NULL AND v_lng IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::GEOGRAPHY
        ELSE NULL
      END,
      COALESCE((v_stop->>'validationRadius')::INTEGER, 30)
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION creator_hunt_response(p_hunt_id UUID)
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', h.id,
    'title', h.title,
    'summary', h.summary,
    'description', h.description,
    'difficulty', h.difficulty,
    'pointsReward', h.points_reward,
    'estimatedDurationMinutes', h.estimated_duration_minutes,
    'stopOrdering', h.stop_ordering,
    'participationMode', h.participation_mode,
    'startModel', h.start_model,
    'startsAt', h.starts_at,
    'endsAt', h.ends_at,
    'privacy', h.privacy,
    'maxParticipants', h.max_participants,
    'publicMeetingInfo', h.public_meeting_info,
    'safetyNote', COALESCE(h.safety_note, ''),
    'accessibilityNote', COALESCE(h.accessibility_note, ''),
    'coverMediaId', h.cover_media_id,
    'status', h.status,
    'updatedAt', h.updated_at,
    'stops', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', COALESCE(s.description, ''),
        'clueText', COALESCE(c.clue_text, ''),
        'hintText', COALESCE(c.hint_text, ''),
        'completionMethod', CASE s.completion_method
          WHEN 'image_and_location' THEN 'photo_and_location'
          WHEN 'image' THEN 'photo'
          WHEN 'location' THEN 'location'
          WHEN 'text' THEN 'text'
          ELSE 'none'
        END,
        'isRequired', s.is_required,
        'publicLat', g.public_lat,
        'publicLng', g.public_lng,
        'publicRadius', COALESCE(g.public_radius_meters, 500),
        'validationRadius', COALESCE(g.validation_radius_meters, 30)
      ) ORDER BY s.sort_order)
      FROM hunt_stops s
      LEFT JOIN hunt_clues c ON c.hunt_stop_id = s.id AND c.is_active
      LEFT JOIN hunt_stop_geofences g ON g.hunt_stop_id = s.id
      WHERE s.hunt_id = h.id
    ), '[]'::jsonb)
  )
  FROM hunts h
  WHERE h.id = p_hunt_id AND h.creator_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION create_hunt_draft(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hunt_id UUID;
  v_slug TEXT;
  v_title TEXT := LEFT(TRIM(COALESCE(NULLIF(p_payload->>'title', ''), 'Untitled Hunt')), 120);
BEGIN
  PERFORM assert_hunt_creator_eligible();
  IF NULLIF(p_payload->>'coverMediaId', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM media_assets
      WHERE id = (p_payload->>'coverMediaId')::UUID
        AND owner_user_id = auth.uid()
        AND bucket = 'custom-game-media'
        AND media_type = 'image'
    ) THEN RAISE EXCEPTION 'invalid_cover_media'; END IF;

  v_slug := lower(regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8);

  INSERT INTO hunts (
    slug, title, summary, description, hunt_type, status, creator_user_id,
    privacy, join_policy, points_reward, estimated_duration_minutes,
    difficulty, max_participants, starts_at, ends_at, registration_deadline,
    public_meeting_info, safety_note, accessibility_note, cover_media_id,
    stop_ordering, participation_mode, start_model
  ) VALUES (
    v_slug, v_title, LEFT(COALESCE(p_payload->>'summary', ''), 240),
    COALESCE(p_payload->>'description', ''), 'custom', 'draft', auth.uid(),
    COALESCE((p_payload->>'privacy')::hunt_privacy, 'public'),
    CASE WHEN COALESCE(p_payload->>'privacy', 'public') = 'invite_only'
      THEN 'invite_only'::hunt_join_policy ELSE 'open'::hunt_join_policy END,
    GREATEST(1, COALESCE((p_payload->>'pointsReward')::INTEGER, 100)),
    NULLIF((p_payload->>'estimatedDurationMinutes')::INTEGER, 0),
    COALESCE((p_payload->>'difficulty')::difficulty, 'medium'),
    NULLIF((p_payload->>'maxParticipants')::INTEGER, 0),
    NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    NULLIF(p_payload->>'endsAt', '')::TIMESTAMPTZ,
    NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    NULLIF(p_payload->>'publicMeetingInfo', ''),
    NULLIF(p_payload->>'safetyNote', ''),
    NULLIF(p_payload->>'accessibilityNote', ''),
    NULLIF(p_payload->>'coverMediaId', '')::UUID,
    COALESCE(p_payload->>'stopOrdering', 'ordered'),
    COALESCE((p_payload->>'participationMode')::participation_mode, 'solo'),
    COALESCE((p_payload->>'startModel')::hunt_start_model, 'individual')
  ) RETURNING id INTO v_hunt_id;

  PERFORM replace_creator_hunt_stops(v_hunt_id, p_payload->'stops', COALESCE(p_payload->>'stopOrdering', 'ordered'));
  RETURN creator_hunt_response(v_hunt_id);
END;
$$;

CREATE OR REPLACE FUNCTION update_hunt_draft(p_hunt_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM hunts WHERE id = p_hunt_id AND creator_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM hunts WHERE id = p_hunt_id AND status <> 'draft') THEN
    RAISE EXCEPTION 'only_drafts_can_be_edited';
  END IF;
  IF NULLIF(p_payload->>'coverMediaId', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM media_assets
      WHERE id = (p_payload->>'coverMediaId')::UUID
        AND owner_user_id = auth.uid()
        AND bucket = 'custom-game-media'
        AND media_type = 'image'
    ) THEN RAISE EXCEPTION 'invalid_cover_media'; END IF;

  UPDATE hunts SET
    title = LEFT(TRIM(COALESCE(p_payload->>'title', title)), 120),
    summary = LEFT(COALESCE(p_payload->>'summary', summary), 240),
    description = COALESCE(p_payload->>'description', description),
    privacy = COALESCE((p_payload->>'privacy')::hunt_privacy, privacy),
    join_policy = CASE WHEN COALESCE(p_payload->>'privacy', privacy::TEXT) = 'invite_only'
      THEN 'invite_only'::hunt_join_policy ELSE 'open'::hunt_join_policy END,
    points_reward = GREATEST(1, COALESCE((p_payload->>'pointsReward')::INTEGER, points_reward)),
    estimated_duration_minutes = NULLIF((p_payload->>'estimatedDurationMinutes')::INTEGER, 0),
    difficulty = COALESCE((p_payload->>'difficulty')::difficulty, difficulty),
    max_participants = NULLIF((p_payload->>'maxParticipants')::INTEGER, 0),
    starts_at = NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    ends_at = NULLIF(p_payload->>'endsAt', '')::TIMESTAMPTZ,
    registration_deadline = NULLIF(p_payload->>'startsAt', '')::TIMESTAMPTZ,
    public_meeting_info = NULLIF(p_payload->>'publicMeetingInfo', ''),
    safety_note = NULLIF(p_payload->>'safetyNote', ''),
    accessibility_note = NULLIF(p_payload->>'accessibilityNote', ''),
    cover_media_id = NULLIF(p_payload->>'coverMediaId', '')::UUID,
    stop_ordering = COALESCE(p_payload->>'stopOrdering', stop_ordering::TEXT),
    participation_mode = COALESCE((p_payload->>'participationMode')::participation_mode, participation_mode),
    start_model = COALESCE((p_payload->>'startModel')::hunt_start_model, start_model)
  WHERE id = p_hunt_id;

  PERFORM replace_creator_hunt_stops(p_hunt_id, p_payload->'stops', COALESCE(p_payload->>'stopOrdering', 'ordered'));
  RETURN creator_hunt_response(p_hunt_id);
END;
$$;

CREATE OR REPLACE FUNCTION publish_hunt(p_hunt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hunt hunts%ROWTYPE;
BEGIN
  SELECT * INTO v_hunt FROM hunts WHERE id = p_hunt_id AND creator_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF v_hunt.status <> 'draft' THEN RAISE EXCEPTION 'only_drafts_can_be_submitted'; END IF;
  PERFORM validate_creator_hunt_payload(creator_hunt_response(p_hunt_id));
  INSERT INTO hunt_submitted_versions (hunt_id, version_no, content_snapshot, cover_media_id, submitted_by)
  VALUES (p_hunt_id, v_hunt.version, creator_hunt_response(p_hunt_id), v_hunt.cover_media_id, auth.uid());
  UPDATE hunts SET status = 'pending_review' WHERE id = p_hunt_id;
  INSERT INTO moderation_cases (entity_type, entity_id)
  SELECT 'hunt', p_hunt_id
  WHERE NOT EXISTS (SELECT 1 FROM moderation_cases WHERE entity_type = 'hunt' AND entity_id = p_hunt_id AND status = 'open');
  RETURN jsonb_build_object('hunt_id', p_hunt_id, 'status', 'pending_review', 'occurrence_id', NULL);
END;
$$;

-- Moderator-only approval is deliberately separate from creator submission.
-- It is the sole path that makes a custom Hunt joinable and creates an occurrence.
CREATE OR REPLACE FUNCTION approve_creator_hunt(p_hunt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hunt hunts%ROWTYPE;
  v_occurrence_id UUID;
  v_status hunt_status;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'moderator_role_required'; END IF;
  SELECT * INTO v_hunt FROM hunts WHERE id = p_hunt_id AND status = 'pending_review' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'hunt_not_awaiting_review'; END IF;
  v_status := CASE WHEN v_hunt.starts_at IS NOT NULL AND v_hunt.starts_at > NOW()
    THEN 'scheduled'::hunt_status ELSE 'active'::hunt_status END;
  UPDATE hunts SET status = v_status, published_at = NOW() WHERE id = p_hunt_id;
  INSERT INTO hunt_occurrences (
    hunt_id, occurrence_key, status, starts_at, ends_at, join_until,
    start_until, complete_until, max_participants, min_participants,
    start_model, public_meeting_info
  ) VALUES (
    p_hunt_id, 'hunt:' || v_hunt.slug || ':' || COALESCE(to_char(v_hunt.starts_at, 'YYYY-MM-DD'), 'open'),
    v_status, v_hunt.starts_at, v_hunt.ends_at, v_hunt.starts_at,
    v_hunt.starts_at, v_hunt.ends_at, v_hunt.max_participants, v_hunt.min_participants,
    v_hunt.start_model, v_hunt.public_meeting_info
  )
  ON CONFLICT (hunt_id, occurrence_key) DO UPDATE SET status = EXCLUDED.status
  RETURNING id INTO v_occurrence_id;
  INSERT INTO hunt_submission_decisions (hunt_id, version_no, decision, decided_by)
  VALUES (p_hunt_id, v_hunt.version, 'approved', auth.uid());
  UPDATE moderation_cases SET status = 'closed', moderator_id = auth.uid(), decision = 'no_action'
  WHERE entity_type = 'hunt' AND entity_id = p_hunt_id AND status = 'open';
  RETURN jsonb_build_object('hunt_id', p_hunt_id, 'status', v_status, 'occurrence_id', v_occurrence_id);
END;
$$;

-- A rejected submission is retained in hunt_submitted_versions. Starting a
-- revision makes a new mutable draft version instead of rewriting it.
CREATE OR REPLACE FUNCTION begin_hunt_revision(p_hunt_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hunts SET status = 'draft', version = version + 1
  WHERE id = p_hunt_id AND creator_user_id = auth.uid() AND status = 'rejected';
  IF NOT FOUND THEN RAISE EXCEPTION 'only_rejected_hunts_can_be_revised'; END IF;
  RETURN p_hunt_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_creator_hunt(p_hunt_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_version INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin') AND account_status = 'active') THEN
    RAISE EXCEPTION 'moderator_role_required';
  END IF;
  SELECT version INTO v_version FROM hunts WHERE id = p_hunt_id AND status = 'pending_review' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'hunt_not_awaiting_review'; END IF;
  UPDATE hunts SET status = 'rejected' WHERE id = p_hunt_id;
  INSERT INTO hunt_submission_decisions (hunt_id, version_no, decision, reason, decided_by)
  VALUES (p_hunt_id, v_version, 'rejected', NULLIF(p_reason, ''), auth.uid());
  UPDATE moderation_cases SET status = 'closed', moderator_id = auth.uid(), decision = 'content_removed', decision_reason = NULLIF(p_reason, '')
  WHERE entity_type = 'hunt' AND entity_id = p_hunt_id AND status = 'open';
END;
$$;

CREATE OR REPLACE FUNCTION get_creator_hunts()
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', h.id, 'title', h.title, 'summary', h.summary, 'status', h.status,
    'privacy', h.privacy, 'pointsReward', h.points_reward,
    'stopCount', (SELECT COUNT(*) FROM hunt_stops s WHERE s.hunt_id = h.id),
    'startsAt', h.starts_at, 'updatedAt', h.updated_at,
    'occurrenceId', (SELECT o.id FROM hunt_occurrences o WHERE o.hunt_id = h.id ORDER BY o.created_at DESC LIMIT 1)
  ) ORDER BY h.updated_at DESC), '[]'::jsonb)
  FROM hunts h WHERE h.creator_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_creator_hunt(p_hunt_id UUID)
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT creator_hunt_response(p_hunt_id)
  WHERE EXISTS (
    SELECT 1 FROM hunts WHERE id = p_hunt_id AND creator_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION set_hunt_cover_media(p_hunt_id UUID, p_media_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM media_assets
    WHERE id = p_media_id
      AND owner_user_id = auth.uid()
      AND bucket = 'custom-game-media'
      AND media_type = 'image'
      AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'invalid_cover_media'; END IF;
  UPDATE hunts SET cover_media_id = p_media_id
  WHERE id = p_hunt_id AND creator_user_id = auth.uid() AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'only_drafts_can_be_edited'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION archive_hunt(p_hunt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hunts SET status = 'archived', archived_at = NOW()
  WHERE id = p_hunt_id AND creator_user_id = auth.uid() AND status IN ('draft', 'pending_review', 'ready', 'scheduled', 'active', 'paused');
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE hunt_invitations SET status = 'expired'
  WHERE hunt_id = p_hunt_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION delete_hunt(p_hunt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM hunts WHERE id = p_hunt_id AND creator_user_id = auth.uid() AND status IN ('draft', 'rejected', 'archived');
  IF NOT FOUND THEN RAISE EXCEPTION 'only_archived_or_draft_hunts_can_be_deleted'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION invite_friend_to_hunt(
  p_hunt_id UUID,
  p_occurrence_id UUID,
  p_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitee_id UUID;
  v_eligibility JSONB;
BEGIN
  SELECT id INTO v_invitee_id FROM profiles WHERE lower(username) = lower(trim(p_username));
  IF v_invitee_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'userMessage', 'That friend is unavailable.');
  END IF;
  v_eligibility := get_hunt_invitation_eligibility(lower(trim(p_username)), p_hunt_id, p_occurrence_id);
  IF NOT COALESCE((v_eligibility->>'eligible')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'reasonCode', COALESCE(v_eligibility->>'code', 'NOT_AUTHORIZED'),
      'userMessage', 'This friend cannot be invited to this Hunt.'
    );
  END IF;
  RETURN invite_to_hunt(p_hunt_id, v_invitee_id, p_occurrence_id, NULL);
END;
$$;

-- Correct the earlier social eligibility implementation to use current Hunt
-- tables and column names. The mobile selector calls this before inviting.
CREATE OR REPLACE FUNCTION get_hunt_invitation_eligibility(
  p_target_username TEXT,
  p_hunt_id UUID,
  p_occurrence_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_target UUID;
  v_capacity INTEGER;
  v_count INTEGER;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM hunts h
    JOIN hunt_occurrences o ON o.id = p_occurrence_id AND o.hunt_id = h.id
    WHERE h.id = p_hunt_id
      AND h.creator_user_id = v_viewer
      AND h.status IN ('scheduled', 'active')
      AND o.status IN ('scheduled', 'active')
      AND (o.ends_at IS NULL OR o.ends_at > NOW())
  ) THEN
    RETURN jsonb_build_object('eligible', FALSE, 'code', 'hunt_not_inviteable');
  END IF;
  SELECT id INTO v_target FROM profiles WHERE username = lower(trim(p_target_username)) AND account_status = 'active';
  IF v_target IS NULL THEN RETURN jsonb_build_object('eligible', FALSE, 'code', 'target_unavailable'); END IF;
  IF NOT are_friends(v_viewer, v_target) THEN RETURN jsonb_build_object('eligible', FALSE, 'code', 'not_friends'); END IF;
  IF are_users_blocked(v_viewer, v_target) THEN RETURN jsonb_build_object('eligible', FALSE, 'code', 'blocked'); END IF;
  IF COALESCE((SELECT allow_hunt_invitations_from = 'nobody' FROM social_privacy_settings WHERE user_id = v_target), FALSE) THEN
    RETURN jsonb_build_object('eligible', FALSE, 'code', 'invitations_disabled');
  END IF;
  IF EXISTS (SELECT 1 FROM hunt_invitations WHERE hunt_id = p_hunt_id AND invitee_user_id = v_target AND status = 'pending') THEN
    RETURN jsonb_build_object('eligible', FALSE, 'code', 'already_invited');
  END IF;
  IF EXISTS (SELECT 1 FROM hunt_participants WHERE hunt_id = p_hunt_id AND user_id = v_target AND status IN ('accepted', 'ready', 'active', 'paused', 'completed')) THEN
    RETURN jsonb_build_object('eligible', FALSE, 'code', 'already_participating');
  END IF;
  SELECT max_participants INTO v_capacity FROM hunt_occurrences WHERE id = p_occurrence_id AND hunt_id = p_hunt_id;
  IF v_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM hunt_participants WHERE hunt_id = p_hunt_id AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');
    IF v_count >= v_capacity THEN RETURN jsonb_build_object('eligible', FALSE, 'code', 'hunt_full'); END IF;
  END IF;
  RETURN jsonb_build_object('eligible', TRUE, 'code', 'eligible');
END;
$$;

REVOKE ALL ON FUNCTION replace_creator_hunt_stops(UUID, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION assert_hunt_creator_eligible() FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_creator_hunt_payload(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION creator_hunt_response(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_hunt_draft(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_hunt_draft(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION publish_hunt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_creator_hunt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_creator_hunt(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION begin_hunt_revision(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_creator_hunts() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_creator_hunt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_hunt_cover_media(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION archive_hunt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_hunt(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION invite_friend_to_hunt(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_hunt_draft(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_hunt_draft(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_hunt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_creator_hunt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_creator_hunt(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION begin_hunt_revision(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_creator_hunts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_creator_hunt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_hunt_cover_media(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_hunt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_hunt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_friend_to_hunt(UUID, UUID, TEXT) TO authenticated;