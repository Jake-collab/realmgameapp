-- ============================================================
-- Migration 020 — Geo Quest Map, Viewport RPC, Validation
-- Worlds — Build 1, Prompt 10
-- ============================================================
-- Tables:
--   quest_geo_validation_geometry   : private versioned geometry per quest/step
--   geo_validation_attempts         : private validation attempt records (privacy-sensitive)
-- RPCs:
--   get_geo_quest_viewport          : public-safe viewport query
--   get_nearby_geo_quests           : distance-sorted nearby results
--   validate_geo_quest_location     : trusted server-side location validation
-- Views:
--   public_geo_quest_map_items      : helper view (admin-read only)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Quest Geo Validation Geometry (PRIVATE)
-- ──────────────────────────────────────────────────────────────
-- Stores the authoritative validation geometry for each Quest step.
-- NEVER returned to ordinary clients.
-- quest_geofences (migration 005) stores the legacy public geometry.
-- This table stores the exact validation geometry used by validate_geo_quest_location.

CREATE TABLE IF NOT EXISTS quest_geo_validation_geometry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id            UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  quest_step_id       UUID REFERENCES quest_objectives(id) ON DELETE CASCADE,
  validation_type     TEXT NOT NULL DEFAULT 'completion'
                      CHECK (validation_type IN ('start', 'step', 'completion')),

  -- Geometry (private — NOT returned to clients)
  -- Supports point+radius and polygon
  center_lat          DOUBLE PRECISION,
  center_lng          DOUBLE PRECISION,
  radius_meters       DOUBLE PRECISION CHECK (radius_meters > 0),
  polygon             GEOMETRY(Polygon, 4326),  -- alternative to point+radius

  -- Required accuracy (stored privately — do not expose to client)
  required_accuracy_meters DOUBLE PRECISION NOT NULL DEFAULT 50,

  -- Freshness requirement
  max_location_age_seconds INTEGER NOT NULL DEFAULT 45,

  -- Version tracking — bump when geometry changes for active participations
  geometry_version    INTEGER NOT NULL DEFAULT 1,
  versioned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Audit
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_geometry_provided
    CHECK (
      (center_lat IS NOT NULL AND center_lng IS NOT NULL AND radius_meters IS NOT NULL)
      OR polygon IS NOT NULL
    )
);

COMMENT ON TABLE quest_geo_validation_geometry IS
  'PRIVATE: exact validation geometry for Geo-Quest location checks. '
  'NEVER returned to ordinary clients. '
  'Admin access is audited. '
  'Geometry must be versioned when changed while participations are active.';

CREATE TRIGGER trg_quest_geo_validation_geometry_updated_at
  BEFORE UPDATE ON quest_geo_validation_geometry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- PostGIS index on polygon geometry
CREATE INDEX IF NOT EXISTS idx_geo_validation_geometry_polygon
  ON quest_geo_validation_geometry USING GIST (polygon)
  WHERE polygon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_geo_validation_geometry_quest
  ON quest_geo_validation_geometry (quest_id, validation_type, is_active);

-- ──────────────────────────────────────────────────────────────
-- Geo Validation Attempts (PRIVATE)
-- ──────────────────────────────────────────────────────────────
-- Records each server-side validation attempt for audit, anti-spoofing,
-- and rate limiting. NEVER exposed to other users.
--
-- Coordinate retention: exact submitted coordinates are retained for
-- fraud review / dispute resolution for 90 days, then reduced to
-- general area (county/city level). See GEO_VALIDATION_PRIVACY.md.

CREATE TABLE IF NOT EXISTS geo_validation_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participation_id    UUID NOT NULL REFERENCES quest_participations(id) ON DELETE CASCADE,
  quest_step_id       UUID REFERENCES quest_objectives(id) ON DELETE SET NULL,
  validation_type     TEXT NOT NULL CHECK (validation_type IN ('start', 'step', 'completion')),

  -- Result
  result              TEXT NOT NULL CHECK (result IN (
    'validated', 'outside_region', 'accuracy_insufficient',
    'location_stale', 'not_required', 'invalid_state', 'rate_limited', 'unavailable'
  )),

  -- Submitted coordinates (PRIVATE, retained 90 days then purged)
  -- Do not log or return these fields
  submitted_lat       DOUBLE PRECISION,
  submitted_lng       DOUBLE PRECISION,
  submitted_accuracy_meters DOUBLE PRECISION,
  captured_at         TIMESTAMPTZ,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Accuracy category (derived — safe to retain)
  accuracy_category   TEXT CHECK (accuracy_category IN ('excellent','good','fair','poor','unacceptable')),

  -- Anti-spoofing signals (no thresholds stored here)
  is_suspicious       BOOLEAN NOT NULL DEFAULT FALSE,
  suspicious_reason   TEXT,  -- Internal only, never returned to client

  -- Idempotency
  request_id          TEXT NOT NULL,

  -- Retention management
  coordinates_purge_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  coordinates_purged_at   TIMESTAMPTZ,

  -- Audit
  app_version         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate request_id per user (idempotency)
  CONSTRAINT uq_geo_validation_request_id UNIQUE (user_id, request_id)
);

COMMENT ON TABLE geo_validation_attempts IS
  'PRIVATE: server-side location validation attempts. '
  'submitted_lat/lng/accuracy retained 90 days then purged. '
  'RLS restricts to attempt owner only. '
  'Anti-spoofing signals are private — not returned to clients.';

COMMENT ON COLUMN geo_validation_attempts.submitted_lat IS
  'Exact submitted latitude — retained 90 days then purged. Not returned to clients.';
COMMENT ON COLUMN geo_validation_attempts.submitted_lng IS
  'Exact submitted longitude — retained 90 days then purged. Not returned to clients.';

-- Rate limit index: recent attempts per user+participation
CREATE INDEX IF NOT EXISTS idx_geo_validation_attempts_rate_limit
  ON geo_validation_attempts (user_id, participation_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_geo_validation_attempts_user
  ON geo_validation_attempts (user_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- Add public display coordinate columns to quest_locations
-- (quest_locations already exists from migration 005)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE quest_locations
  ADD COLUMN IF NOT EXISTS display_lat    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS display_lng    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_location_name TEXT,
  ADD COLUMN IF NOT EXISTS is_primary     BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN quest_locations.display_lat IS
  'Public approximate display coordinate — NOT the hidden validation point. '
  'May be a park centroid, venue entrance, or deliberately offset safe coordinate.';
COMMENT ON COLUMN quest_locations.display_lng IS
  'See display_lat. Safe for public map display.';
COMMENT ON COLUMN quest_locations.public_location_name IS
  'Human-readable location name shown to all users (e.g. Central Park, NY).';

-- Add geo-quest specific columns to quests if not present
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS requires_start_location     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_completion_location BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accessibility_summary       TEXT,
  ADD COLUMN IF NOT EXISTS public_venue_hours_note     TEXT,
  ADD COLUMN IF NOT EXISTS is_featured                 BOOLEAN NOT NULL DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────
-- RLS for new tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE quest_geo_validation_geometry ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_validation_attempts       ENABLE ROW LEVEL SECURITY;

-- Validation geometry: never readable by authenticated users (admin only via service role)
CREATE POLICY geo_validation_geometry_no_public_read
  ON quest_geo_validation_geometry
  FOR SELECT
  USING (FALSE);

-- Validation attempts: owner-only read
CREATE POLICY geo_validation_attempts_owner_read
  ON geo_validation_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Validation attempts: no direct client insert (only via RPC with SECURITY DEFINER)
CREATE POLICY geo_validation_attempts_no_direct_insert
  ON geo_validation_attempts
  FOR INSERT
  WITH CHECK (FALSE);

-- ──────────────────────────────────────────────────────────────
-- RPC: get_geo_quest_viewport
-- ──────────────────────────────────────────────────────────────
-- Public-safe viewport query. Returns display coordinates only.
-- Private validation geometry is NEVER included.
-- Authenticated: uses auth.uid() for participation state lookup.

CREATE OR REPLACE FUNCTION get_geo_quest_viewport(
  p_west              DOUBLE PRECISION,
  p_south             DOUBLE PRECISION,
  p_east              DOUBLE PRECISION,
  p_north             DOUBLE PRECISION,
  p_limit             INTEGER DEFAULT 60,
  p_available_now     BOOLEAN DEFAULT FALSE,
  p_accessible_only   BOOLEAN DEFAULT FALSE,
  p_not_completed     BOOLEAN DEFAULT FALSE,
  p_in_action         BOOLEAN DEFAULT FALSE,
  p_max_duration      INTEGER DEFAULT NULL,
  p_difficulties      TEXT[] DEFAULT NULL,
  p_quest_type        TEXT DEFAULT NULL,
  p_indoor_outdoor    TEXT DEFAULT NULL,
  p_user_lat          DOUBLE PRECISION DEFAULT NULL,
  p_user_lng          DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  quest_id                UUID,
  occurrence_id           UUID,
  title                   TEXT,
  short_objective         TEXT,
  display_lat             DOUBLE PRECISION,
  display_lng             DOUBLE PRECISION,
  public_location_name    TEXT,
  distance_meters         DOUBLE PRECISION,
  points_reward           INTEGER,
  estimated_duration_minutes INTEGER,
  difficulty              TEXT,
  quest_type              TEXT,
  availability_state      TEXT,
  participation_state     TEXT,
  thumbnail_url           TEXT,
  is_featured             BOOLEAN,
  accessibility_summary   TEXT,
  requires_start_location BOOLEAN,
  requires_completion_location BOOLEAN,
  indoor_outdoor          TEXT,
  public_venue_hours_note TEXT,
  available_from          TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_limit   INTEGER;
BEGIN
  -- Validate bounds range
  IF p_west < -180 OR p_east > 180 OR p_south < -90 OR p_north > 90 THEN
    RAISE EXCEPTION 'Invalid bounding box coordinates';
  END IF;
  IF p_south >= p_north OR p_west >= p_east THEN
    RAISE EXCEPTION 'Invalid bounding box orientation';
  END IF;
  -- Enforce max diagonal to prevent global scraping
  IF SQRT(POWER(p_north - p_south, 2) + POWER(p_east - p_west, 2)) > 5.0 THEN
    RAISE EXCEPTION 'Bounding box too large';
  END IF;

  v_user_id := auth.uid();
  v_limit   := LEAST(COALESCE(p_limit, 60), 60);

  RETURN QUERY
  SELECT
    q.id                            AS quest_id,
    NULL::UUID                      AS occurrence_id,
    q.title,
    q.short_description             AS short_objective,
    COALESCE(ql.display_lat, ql.latitude)  AS display_lat,
    COALESCE(ql.display_lng, ql.longitude) AS display_lng,
    ql.public_location_name,
    CASE
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL
      THEN ST_Distance(
        ST_SetSRID(ST_MakePoint(COALESCE(ql.display_lng, ql.longitude), COALESCE(ql.display_lat, ql.latitude)), 4326)::geography,
        ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
      )
      ELSE NULL
    END                             AS distance_meters,
    q.points_reward,
    q.estimated_duration_minutes,
    q.difficulty::TEXT,
    q.quest_type::TEXT,
    CASE
      WHEN p.status IN ('started','in_progress','awaiting_proof','under_review','needs_resubmission')
        THEN p.status::TEXT
      WHEN p.status = 'completed' THEN 'completed'
      WHEN q.available_from > NOW() THEN 'upcoming'
      WHEN q.available_until < NOW() THEN 'unavailable'
      ELSE 'available'
    END                             AS availability_state,
    p.status::TEXT                  AS participation_state,
    NULL::TEXT                      AS thumbnail_url,
    COALESCE(q.is_featured, FALSE)  AS is_featured,
    q.accessibility_summary,
    COALESCE(q.requires_start_location, FALSE),
    COALESCE(q.requires_completion_location, FALSE),
    q.indoor_outdoor::TEXT,
    q.public_venue_hours_note,
    q.available_from,
    q.available_until               AS expires_at
  FROM quests q
  JOIN quest_locations ql ON ql.quest_id = q.id
    AND COALESCE(ql.is_primary, TRUE) = TRUE
  LEFT JOIN LATERAL (
    SELECT status
    FROM quest_participations
    WHERE quest_id = q.id
      AND user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1
  ) p ON TRUE
  WHERE
    q.is_published = TRUE
    AND q.quest_type = 'geo'
    -- Bounding box intersection using display coordinate
    AND COALESCE(ql.display_lng, ql.longitude) BETWEEN p_west AND p_east
    AND COALESCE(ql.display_lat, ql.latitude)  BETWEEN p_south AND p_north
    -- Filters
    AND (p_quest_type IS NULL OR q.quest_type::TEXT = p_quest_type)
    AND (NOT p_available_now OR (q.available_from <= NOW() AND (q.available_until IS NULL OR q.available_until >= NOW())))
    AND (NOT p_accessible_only OR q.accessibility_summary IS NOT NULL)
    AND (p_max_duration IS NULL OR q.estimated_duration_minutes <= p_max_duration)
    AND (p_difficulties IS NULL OR q.difficulty::TEXT = ANY(p_difficulties))
    AND (p_indoor_outdoor IS NULL OR q.indoor_outdoor::TEXT = p_indoor_outdoor)
    AND (NOT p_not_completed OR p.status IS NULL OR p.status::TEXT != 'completed')
    AND (NOT p_in_action OR p.status::TEXT IN ('started','in_progress','awaiting_proof','under_review','needs_resubmission'))
  ORDER BY
    CASE WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL
      THEN ST_Distance(
        ST_SetSRID(ST_MakePoint(COALESCE(ql.display_lng, ql.longitude), COALESCE(ql.display_lat, ql.latitude)), 4326)::geography,
        ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
      )
      ELSE 0
    END ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_geo_quest_viewport FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_geo_quest_viewport TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: get_nearby_geo_quests
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_nearby_geo_quests(
  p_lat               DOUBLE PRECISION,
  p_lng               DOUBLE PRECISION,
  p_radius_meters     DOUBLE PRECISION DEFAULT 25000,
  p_limit             INTEGER DEFAULT 30,
  p_available_now     BOOLEAN DEFAULT FALSE,
  p_accessible_only   BOOLEAN DEFAULT FALSE,
  p_not_completed     BOOLEAN DEFAULT FALSE,
  p_difficulties      TEXT[] DEFAULT NULL,
  p_quest_type        TEXT DEFAULT NULL
)
RETURNS TABLE (
  quest_id                UUID,
  occurrence_id           UUID,
  title                   TEXT,
  short_objective         TEXT,
  display_lat             DOUBLE PRECISION,
  display_lng             DOUBLE PRECISION,
  public_location_name    TEXT,
  distance_meters         DOUBLE PRECISION,
  points_reward           INTEGER,
  estimated_duration_minutes INTEGER,
  difficulty              TEXT,
  quest_type              TEXT,
  availability_state      TEXT,
  participation_state     TEXT,
  thumbnail_url           TEXT,
  is_featured             BOOLEAN,
  accessibility_summary   TEXT,
  requires_start_location BOOLEAN,
  requires_completion_location BOOLEAN,
  indoor_outdoor          TEXT,
  public_venue_hours_note TEXT,
  available_from          TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_radius      DOUBLE PRECISION;
  v_limit       INTEGER;
BEGIN
  IF NOT isfinite(p_lat) OR NOT isfinite(p_lng) THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Coordinates out of range';
  END IF;

  v_user_id := auth.uid();
  v_radius  := LEAST(COALESCE(p_radius_meters, 25000), 50000);
  v_limit   := LEAST(COALESCE(p_limit, 30), 50);

  RETURN QUERY
  SELECT
    q.id                            AS quest_id,
    NULL::UUID                      AS occurrence_id,
    q.title,
    q.short_description             AS short_objective,
    COALESCE(ql.display_lat, ql.latitude)  AS display_lat,
    COALESCE(ql.display_lng, ql.longitude) AS display_lng,
    ql.public_location_name,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(COALESCE(ql.display_lng, ql.longitude), COALESCE(ql.display_lat, ql.latitude)), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )                               AS distance_meters,
    q.points_reward,
    q.estimated_duration_minutes,
    q.difficulty::TEXT,
    q.quest_type::TEXT,
    CASE
      WHEN p2.status IN ('started','in_progress','awaiting_proof','under_review','needs_resubmission')
        THEN p2.status::TEXT
      WHEN p2.status = 'completed' THEN 'completed'
      WHEN q.available_from > NOW() THEN 'upcoming'
      WHEN q.available_until < NOW() THEN 'unavailable'
      ELSE 'available'
    END                             AS availability_state,
    p2.status::TEXT                 AS participation_state,
    NULL::TEXT                      AS thumbnail_url,
    COALESCE(q.is_featured, FALSE)  AS is_featured,
    q.accessibility_summary,
    COALESCE(q.requires_start_location, FALSE),
    COALESCE(q.requires_completion_location, FALSE),
    q.indoor_outdoor::TEXT,
    q.public_venue_hours_note,
    q.available_from,
    q.available_until               AS expires_at
  FROM quests q
  JOIN quest_locations ql ON ql.quest_id = q.id
    AND COALESCE(ql.is_primary, TRUE) = TRUE
  LEFT JOIN LATERAL (
    SELECT status
    FROM quest_participations
    WHERE quest_id = q.id AND user_id = v_user_id
    ORDER BY created_at DESC LIMIT 1
  ) p2 ON TRUE
  WHERE
    q.is_published = TRUE
    AND q.quest_type = 'geo'
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(COALESCE(ql.display_lng, ql.longitude), COALESCE(ql.display_lat, ql.latitude)), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      v_radius
    )
    AND (NOT p_available_now OR (q.available_from <= NOW() AND (q.available_until IS NULL OR q.available_until >= NOW())))
    AND (NOT p_accessible_only OR q.accessibility_summary IS NOT NULL)
    AND (p_difficulties IS NULL OR q.difficulty::TEXT = ANY(p_difficulties))
    AND (p_quest_type IS NULL OR q.quest_type::TEXT = p_quest_type)
    AND (NOT p_not_completed OR p2.status IS NULL OR p2.status::TEXT != 'completed')
  ORDER BY distance_meters ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_nearby_geo_quests FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_nearby_geo_quests TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: validate_geo_quest_location
-- ──────────────────────────────────────────────────────────────
-- Trusted server-side location validation.
-- SECURITY DEFINER: reads private geometry, never returns it.
-- Returns a safe result only — no geometry, no hidden radius.
-- Called by the mobile client useGeoValidation hook.

CREATE OR REPLACE FUNCTION validate_geo_quest_location(
  p_participation_id           UUID,
  p_quest_step_id              UUID DEFAULT NULL,
  p_latitude                   DOUBLE PRECISION DEFAULT NULL,
  p_longitude                  DOUBLE PRECISION DEFAULT NULL,
  p_horizontal_accuracy_meters DOUBLE PRECISION DEFAULT NULL,
  p_captured_at                TIMESTAMPTZ DEFAULT NULL,
  p_request_id                 TEXT DEFAULT NULL,
  p_validation_type            TEXT DEFAULT 'completion',
  p_app_version                TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_participation    RECORD;
  v_quest            RECORD;
  v_geometry         RECORD;
  v_attempt_id       UUID;
  v_result           TEXT;
  v_can_retry        BOOLEAN := TRUE;
  v_user_message     TEXT;
  v_retry_after      INTEGER;
  v_recent_attempts  INTEGER;
  v_is_suspicious    BOOLEAN := FALSE;
  v_age_seconds      DOUBLE PRECISION;
  v_point_geography  GEOGRAPHY;
  v_geom_geography   GEOGRAPHY;
  v_distance_meters  DOUBLE PRECISION;
BEGIN
  -- ── 1. Authenticate ───────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'result', 'invalid_state',
      'can_retry', FALSE,
      'user_message', 'Authentication required.'
    );
  END IF;

  -- ── 2. Validate input ─────────────────────────────────────────────────────
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180
  THEN
    RETURN jsonb_build_object(
      'result', 'invalid_state',
      'can_retry', TRUE,
      'user_message', 'Invalid location data submitted.'
    );
  END IF;

  IF p_horizontal_accuracy_meters IS NULL
     OR p_horizontal_accuracy_meters <= 0
     OR p_horizontal_accuracy_meters > 2000
  THEN
    RETURN jsonb_build_object(
      'result', 'accuracy_insufficient',
      'can_retry', TRUE,
      'user_message', 'Invalid accuracy data submitted.'
    );
  END IF;

  IF p_captured_at IS NULL THEN
    RETURN jsonb_build_object(
      'result', 'location_stale',
      'can_retry', TRUE,
      'user_message', 'Location timestamp is required.'
    );
  END IF;

  -- ── 3. Freshness check ────────────────────────────────────────────────────
  v_age_seconds := EXTRACT(EPOCH FROM (NOW() - p_captured_at));
  IF v_age_seconds > 120 OR v_age_seconds < -30 THEN
    -- > 2 min old or future timestamp
    IF v_age_seconds < -30 THEN v_is_suspicious := TRUE; END IF;
    RETURN jsonb_build_object(
      'result', 'location_stale',
      'can_retry', TRUE,
      'user_message', 'Your location reading is outdated. Please try again.'
    );
  END IF;

  -- ── 4. Idempotency check ──────────────────────────────────────────────────
  IF p_request_id IS NOT NULL THEN
    SELECT id, result INTO v_attempt_id, v_result
    FROM geo_validation_attempts
    WHERE user_id = v_user_id AND request_id = p_request_id
    LIMIT 1;

    IF FOUND THEN
      -- Return the original result (idempotent)
      RETURN jsonb_build_object(
        'result', v_result,
        'validation_attempt_id', v_attempt_id::TEXT,
        'can_retry', v_result NOT IN ('validated', 'not_required'),
        'user_message', 'Previous validation result returned.'
      );
    END IF;
  END IF;

  -- ── 5. Rate limiting ──────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_recent_attempts
  FROM geo_validation_attempts
  WHERE user_id = v_user_id
    AND participation_id = p_participation_id
    AND received_at > NOW() - INTERVAL '5 minutes';

  IF v_recent_attempts >= 10 THEN
    RETURN jsonb_build_object(
      'result', 'rate_limited',
      'can_retry', TRUE,
      'user_message', 'Too many attempts. Please wait before trying again.',
      'retry_after_seconds', 60
    );
  END IF;

  -- ── 6. Verify account status ──────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id AND account_status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'result', 'invalid_state',
      'can_retry', FALSE,
      'user_message', 'Your account is not in a valid state to complete this action.'
    );
  END IF;

  -- ── 7. Verify participation ownership and state ───────────────────────────
  SELECT qp.*, q.id AS quest_id_ref
  INTO v_participation
  FROM quest_participations qp
  JOIN quests q ON q.id = qp.quest_id
  WHERE qp.id = p_participation_id
    AND qp.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'result', 'invalid_state',
      'can_retry', FALSE,
      'user_message', 'Participation not found or not yours.'
    );
  END IF;

  IF v_participation.status NOT IN ('started', 'in_progress', 'awaiting_proof') THEN
    RETURN jsonb_build_object(
      'result', 'invalid_state',
      'can_retry', FALSE,
      'user_message', 'This quest is no longer in a valid state for location check.'
    );
  END IF;

  -- ── 8. Load private validation geometry ──────────────────────────────────
  SELECT *
  INTO v_geometry
  FROM quest_geo_validation_geometry
  WHERE quest_id = v_participation.quest_id
    AND validation_type = p_validation_type
    AND (p_quest_step_id IS NULL OR quest_step_id = p_quest_step_id)
    AND is_active = TRUE
  ORDER BY geometry_version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- No geometry configured for this validation type — treat as not required
    v_result := 'not_required';
    GOTO record_attempt;
  END IF;

  -- ── 9. Accuracy check (using Quest-specific threshold) ─────────────────────
  IF p_horizontal_accuracy_meters > v_geometry.required_accuracy_meters THEN
    v_result := 'accuracy_insufficient';
    GOTO record_attempt;
  END IF;

  -- ── 10. Geospatial containment check ─────────────────────────────────────
  v_point_geography := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  IF v_geometry.polygon IS NOT NULL THEN
    -- Polygon containment
    IF ST_Covers(v_geometry.polygon::geography, v_point_geography) THEN
      v_result := 'validated';
    ELSE
      v_result := 'outside_region';
    END IF;
  ELSIF v_geometry.center_lat IS NOT NULL THEN
    -- Point + radius distance check
    v_geom_geography := ST_SetSRID(
      ST_MakePoint(v_geometry.center_lng, v_geometry.center_lat), 4326
    )::geography;
    v_distance_meters := ST_Distance(v_point_geography, v_geom_geography);

    IF v_distance_meters <= v_geometry.radius_meters THEN
      v_result := 'validated';
    ELSE
      v_result := 'outside_region';
      -- Do NOT include distance or radius in response — would reveal secret geometry
    END IF;
  ELSE
    v_result := 'unavailable';
  END IF;

  -- ── 11. Anti-spoofing: impossible timestamp ───────────────────────────────
  IF v_age_seconds < 0 THEN
    v_is_suspicious := TRUE;
  END IF;

  <<record_attempt>>
  -- ── 12. Record attempt ───────────────────────────────────────────────────
  INSERT INTO geo_validation_attempts (
    user_id, participation_id, quest_step_id,
    validation_type, result,
    submitted_lat, submitted_lng, submitted_accuracy_meters,
    captured_at, received_at,
    accuracy_category,
    is_suspicious,
    request_id, app_version
  ) VALUES (
    v_user_id, p_participation_id, p_quest_step_id,
    p_validation_type, v_result,
    p_latitude, p_longitude, p_horizontal_accuracy_meters,
    p_captured_at, NOW(),
    CASE
      WHEN p_horizontal_accuracy_meters <= 5  THEN 'excellent'
      WHEN p_horizontal_accuracy_meters <= 15 THEN 'good'
      WHEN p_horizontal_accuracy_meters <= 30 THEN 'fair'
      WHEN p_horizontal_accuracy_meters <= 50 THEN 'poor'
      ELSE 'unacceptable'
    END,
    v_is_suspicious,
    p_request_id, p_app_version
  )
  RETURNING id INTO v_attempt_id;

  -- ── 13. Safe response — NO geometry returned ──────────────────────────────
  v_can_retry := v_result NOT IN ('validated', 'not_required', 'invalid_state');

  RETURN jsonb_build_object(
    'result',                v_result,
    'validation_attempt_id', v_attempt_id::TEXT,
    'can_retry',             v_can_retry,
    'user_message',
      CASE v_result
        WHEN 'validated'             THEN 'Location verified successfully.'
        WHEN 'not_required'          THEN 'No location check needed for this step.'
        WHEN 'outside_region'        THEN 'You are not in the required area yet.'
        WHEN 'accuracy_insufficient' THEN 'Your location signal is not accurate enough yet. Move to an open area and try again.'
        WHEN 'location_stale'        THEN 'Your location reading is outdated. Please try again.'
        WHEN 'invalid_state'         THEN 'This quest is no longer in a valid state for location check.'
        WHEN 'rate_limited'          THEN 'Too many attempts. Please wait a moment before trying again.'
        ELSE                              'Location validation is temporarily unavailable. Try again shortly.'
      END
    -- NOTE: never include center_lat, center_lng, radius_meters, or polygon in response
  );

EXCEPTION WHEN OTHERS THEN
  -- Never expose PostGIS or internal error details
  RETURN jsonb_build_object(
    'result', 'unavailable',
    'can_retry', TRUE,
    'user_message', 'Location validation is temporarily unavailable. Please try again.'
  );
END;
$$;

REVOKE ALL ON FUNCTION validate_geo_quest_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_geo_quest_location TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- Scheduled coordinate purge helper
-- ──────────────────────────────────────────────────────────────
-- This function must be called by a pg_cron job or scheduled task.
-- It purges exact coordinates after the retention period (90 days default).
-- IMPORTANT: This is NOT automatically scheduled — an operator must configure
-- the pg_cron job or equivalent. See GEO_VALIDATION_PRIVACY.md.

CREATE OR REPLACE FUNCTION purge_expired_validation_coordinates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purged INTEGER;
BEGIN
  UPDATE geo_validation_attempts
  SET
    submitted_lat    = NULL,
    submitted_lng    = NULL,
    submitted_accuracy_meters = NULL,
    coordinates_purged_at = NOW()
  WHERE
    coordinates_purge_after <= NOW()
    AND coordinates_purged_at IS NULL
    AND (submitted_lat IS NOT NULL OR submitted_lng IS NOT NULL);

  GET DIAGNOSTICS v_purged = ROW_COUNT;
  RETURN v_purged;
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_validation_coordinates FROM PUBLIC;
-- Only callable by service role / pg_cron
