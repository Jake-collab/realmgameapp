-- Migration 076: Hunt map RPC security hardening
--
-- This migration intentionally adds secure wrapper RPCs instead of rewriting
-- migration 022. Mobile callers use these wrappers so existing migrations
-- remain immutable and rollback/audit history stays intact.
--
-- Guarantees:
--   - user context always comes from auth.uid()
--   - a caller cannot supply another user's UUID
--   - viewport bounds are finite, ordered, WGS-84 valid, and capped
--   - nearby coordinates are either both absent or valid WGS-84 coordinates
--   - no private geometry is returned

CREATE OR REPLACE FUNCTION public.hunt_map_bounds_are_safe(
  p_west  DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east  DOUBLE PRECISION,
  p_north DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_west IS NOT NULL
    AND p_south IS NOT NULL
    AND p_east IS NOT NULL
    AND p_north IS NOT NULL
    AND p_west BETWEEN -180 AND 180
    AND p_east BETWEEN -180 AND 180
    AND p_south BETWEEN -90 AND 90
    AND p_north BETWEEN -90 AND 90
    AND p_west < p_east
    AND p_south < p_north
    AND SQRT(POWER(p_north - p_south, 2) + POWER(p_east - p_west, 2)) <= 5.0;
$$;

REVOKE ALL ON FUNCTION public.hunt_map_bounds_are_safe FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hunt_map_bounds_are_safe TO authenticated;

CREATE OR REPLACE FUNCTION public.get_hunt_map_viewport_secure(
  p_west                 DOUBLE PRECISION,
  p_south                DOUBLE PRECISION,
  p_east                 DOUBLE PRECISION,
  p_north                DOUBLE PRECISION,
  p_user_id              UUID DEFAULT NULL,
  p_limit                INTEGER DEFAULT 60,
  p_available_now        BOOLEAN DEFAULT FALSE,
  p_starting_soon        BOOLEAN DEFAULT FALSE,
  p_has_space            BOOLEAN DEFAULT FALSE,
  p_participation_mode   TEXT DEFAULT NULL,
  p_max_duration_minutes INTEGER DEFAULT NULL,
  p_indoor_outdoor       TEXT DEFAULT NULL,
  p_accessible_only      BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  hunt_id                UUID,
  occurrence_id          UUID,
  slug                   TEXT,
  title                  TEXT,
  summary                TEXT,
  display_lat            DOUBLE PRECISION,
  display_lng            DOUBLE PRECISION,
  public_location_label  TEXT,
  distance_meters        DOUBLE PRECISION,
  points_reward          INTEGER,
  estimated_duration_minutes INTEGER,
  difficulty             TEXT,
  hunt_type              TEXT,
  privacy                TEXT,
  participation_mode     TEXT,
  is_ordered             BOOLEAN,
  stop_count             INTEGER,
  thumbnail_url          TEXT,
  availability_state     TEXT,
  participation_status   TEXT,
  participation_id       UUID,
  invitation_id          UUID,
  invitation_status      TEXT,
  max_participants       INTEGER,
  participant_count      INTEGER,
  is_full                BOOLEAN,
  starts_at              TIMESTAMPTZ,
  ends_at                TIMESTAMPTZ,
  join_until             TIMESTAMPTZ,
  is_featured            BOOLEAN,
  requires_proof         BOOLEAN,
  requires_location      BOOLEAN,
  indoor_outdoor         TEXT,
  accessibility_summary  TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- A supplied ID is accepted only when it matches the authenticated subject.
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_user_id THEN
    RETURN;
  END IF;

  IF NOT public.hunt_map_bounds_are_safe(p_west, p_south, p_east, p_north) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.get_hunt_map_viewport(
    p_west                 := p_west,
    p_south                := p_south,
    p_east                 := p_east,
    p_north                := p_north,
    p_user_id              := v_user_id,
    p_limit                := p_limit,
    p_available_now        := p_available_now,
    p_starting_soon        := p_starting_soon,
    p_has_space            := p_has_space,
    p_participation_mode   := p_participation_mode,
    p_max_duration_minutes := p_max_duration_minutes,
    p_indoor_outdoor       := p_indoor_outdoor,
    p_accessible_only      := p_accessible_only
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_hunt_map_viewport_secure FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hunt_map_viewport_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hunt_map_viewport_secure TO anon;

CREATE OR REPLACE FUNCTION public.get_nearby_hunts_secure(
  p_lat                  DOUBLE PRECISION DEFAULT NULL,
  p_lng                  DOUBLE PRECISION DEFAULT NULL,
  p_user_id              UUID DEFAULT NULL,
  p_sort                 TEXT DEFAULT 'nearest',
  p_limit                INTEGER DEFAULT 20,
  p_available_now        BOOLEAN DEFAULT FALSE,
  p_starting_soon        BOOLEAN DEFAULT FALSE,
  p_has_space            BOOLEAN DEFAULT FALSE,
  p_participation_mode   TEXT DEFAULT NULL,
  p_max_duration_minutes INTEGER DEFAULT NULL,
  p_accessible_only      BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  hunt_id                UUID,
  occurrence_id          UUID,
  slug                   TEXT,
  title                  TEXT,
  summary                TEXT,
  display_lat            DOUBLE PRECISION,
  display_lng            DOUBLE PRECISION,
  public_location_label  TEXT,
  distance_meters        DOUBLE PRECISION,
  points_reward          INTEGER,
  estimated_duration_minutes INTEGER,
  difficulty             TEXT,
  hunt_type              TEXT,
  privacy                TEXT,
  participation_mode     TEXT,
  is_ordered             BOOLEAN,
  stop_count             INTEGER,
  thumbnail_url          TEXT,
  availability_state     TEXT,
  participation_status   TEXT,
  participation_id       UUID,
  invitation_id          UUID,
  invitation_status      TEXT,
  max_participants       INTEGER,
  participant_count      INTEGER,
  is_full                BOOLEAN,
  starts_at              TIMESTAMPTZ,
  ends_at                TIMESTAMPTZ,
  join_until             TIMESTAMPTZ,
  is_featured            BOOLEAN,
  requires_proof         BOOLEAN,
  requires_location      BOOLEAN,
  indoor_outdoor         TEXT,
  accessibility_summary  TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_user_id THEN
    RETURN;
  END IF;

  IF (p_lat IS NULL) <> (p_lng IS NULL) THEN
    RETURN;
  END IF;

  IF p_lat IS NOT NULL AND (
    p_lat NOT BETWEEN -90 AND 90 OR
    p_lng NOT BETWEEN -180 AND 180
  ) THEN
    RETURN;
  END IF;

  IF p_sort IS NULL OR p_sort NOT IN (
    'nearest', 'highest_points', 'shortest', 'starting_soon'
  ) THEN
    p_sort := 'nearest';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.get_nearby_hunts(
    p_lat                  := p_lat,
    p_lng                  := p_lng,
    p_user_id              := v_user_id,
    p_sort                 := p_sort,
    p_limit                := p_limit,
    p_available_now        := p_available_now,
    p_starting_soon        := p_starting_soon,
    p_has_space            := p_has_space,
    p_participation_mode   := p_participation_mode,
    p_max_duration_minutes := p_max_duration_minutes,
    p_accessible_only      := p_accessible_only
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_nearby_hunts_secure FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_hunts_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_hunts_secure TO anon;

COMMENT ON FUNCTION public.get_hunt_map_viewport_secure IS
  'Security wrapper for Hunt map viewport queries: binds user context to auth.uid and rejects unsafe bounds.';

COMMENT ON FUNCTION public.get_nearby_hunts_secure IS
  'Security wrapper for nearby Hunt queries: binds user context to auth.uid and rejects invalid coordinates.';