-- Migration 022: Hunt Map Query RPCs
-- Adds server-side map viewport and nearby hunt query functions.
-- All RPCs enforce public-only discovery; no private geometry returned.
--
-- Dependencies: migrations 007 (hunts, hunt_stops, hunt_stop_geofences),
--               008 (hunt_participants, hunt_invitations),
--               021 (hunt_occurrences, capacity columns)
--
-- Privacy guarantees:
--   - Only published (status = 'active') hunts appear in map results.
--   - Only public privacy hunts appear in map results (unlisted, invite_only,
--     private are excluded from public discovery).
--   - No validation geometry (hunt_stop_geofences) is returned.
--   - No locked clue content is returned.
--   - No other participants' private data is returned.
--   - Current-user participation state included only when p_user_id is provided.

-- ─── Helper: safe availability state ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_hunt_availability_state(
  p_hunt_status          TEXT,
  p_participation_status TEXT,
  p_invitation_status    TEXT,
  p_is_full              BOOLEAN,
  p_starts_at            TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Participation-based states (highest priority for authenticated user)
  IF p_participation_status = 'active'    THEN RETURN 'active';    END IF;
  IF p_participation_status = 'paused'    THEN RETURN 'active';    END IF; -- still active from user perspective
  IF p_participation_status IN ('accepted', 'ready') THEN RETURN 'ready'; END IF;
  IF p_participation_status = 'completed' THEN RETURN 'completed'; END IF;
  IF p_participation_status = 'invited'   THEN RETURN 'invited';   END IF;

  -- Hunt-level states
  IF p_hunt_status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF p_hunt_status = 'expired'   THEN RETURN 'expired';   END IF;
  IF p_hunt_status = 'paused'    THEN RETURN 'paused';    END IF;

  -- Invitation pending
  IF p_invitation_status = 'pending' THEN RETURN 'invited'; END IF;

  -- Upcoming (starts in the future and not yet joinable)
  IF p_starts_at IS NOT NULL AND p_starts_at > NOW() + INTERVAL '5 minutes' THEN
    RETURN 'upcoming';
  END IF;

  -- Full
  IF p_is_full THEN RETURN 'full'; END IF;

  -- Default: available
  RETURN 'available';
END;
$$;

-- ─── Viewport RPC ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_hunt_map_viewport(
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
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Validate bounds
  IF p_west >= p_east OR p_south >= p_north THEN
    RETURN;
  END IF;
  -- Clamp limit
  p_limit := LEAST(GREATEST(p_limit, 1), 200);

  RETURN QUERY
  WITH user_participation AS (
    -- Current-user participation for each hunt (most recent active record)
    SELECT DISTINCT ON (hp.hunt_id)
      hp.hunt_id,
      hp.id            AS participation_id,
      hp.status        AS part_status
    FROM hunt_participants hp
    WHERE p_user_id IS NOT NULL
      AND hp.user_id = p_user_id
      AND hp.status NOT IN ('declined', 'removed', 'expired')
    ORDER BY hp.hunt_id, hp.created_at DESC
  ),
  user_invitation AS (
    -- Current-user pending invitation
    SELECT DISTINCT ON (hi.hunt_id)
      hi.hunt_id,
      hi.id     AS invitation_id,
      hi.status AS inv_status
    FROM hunt_invitations hi
    WHERE p_user_id IS NOT NULL
      AND hi.invitee_user_id = p_user_id
      AND hi.status = 'pending'
    ORDER BY hi.hunt_id, hi.created_at DESC
  ),
  active_occurrences AS (
    -- Most recent/active occurrence per hunt
    SELECT DISTINCT ON (ho.hunt_id)
      ho.hunt_id,
      ho.id              AS occurrence_id,
      ho.status          AS occ_status,
      ho.starts_at,
      ho.ends_at,
      ho.join_until,
      ho.max_participants,
      ho.participant_count,
      ho.reward_override_points
    FROM hunt_occurrences ho
    WHERE ho.status IN ('scheduled', 'active')
    ORDER BY ho.hunt_id, ho.starts_at ASC
  ),
  stop_stats AS (
    SELECT
      hs.hunt_id,
      COUNT(*) FILTER (WHERE hs.is_required)::INTEGER AS required_count,
      COUNT(*)::INTEGER AS total_count,
      BOOL_OR(hs.completion_method IN ('location', 'image_and_location')) AS requires_location,
      BOOL_OR(hs.completion_method NOT IN ('none', 'manual_confirmation')) AS requires_proof
    FROM hunt_stops hs
    GROUP BY hs.hunt_id
  )
  SELECT
    h.id                                  AS hunt_id,
    ao.occurrence_id,
    h.slug,
    h.title,
    COALESCE(h.summary, '')               AS summary,
    -- Public approximate display coordinate from first stop or hunt-level field
    COALESCE(
      (SELECT hsg.public_lat FROM hunt_stop_geofences hsg
         JOIN hunt_stops hs2 ON hs2.id = hsg.hunt_stop_id
         WHERE hs2.hunt_id = h.id AND hs2.stop_role = 'start'
         ORDER BY hs2.sort_order LIMIT 1),
      0.0
    )::DOUBLE PRECISION                   AS display_lat,
    COALESCE(
      (SELECT hsg.public_lng FROM hunt_stop_geofences hsg
         JOIN hunt_stops hs2 ON hs2.id = hsg.hunt_stop_id
         WHERE hs2.hunt_id = h.id AND hs2.stop_role = 'start'
         ORDER BY hs2.sort_order LIMIT 1),
      0.0
    )::DOUBLE PRECISION                   AS display_lng,
    h.public_meeting_info::TEXT           AS public_location_label,
    NULL::DOUBLE PRECISION                AS distance_meters,  -- computed client-side
    COALESCE(ao.reward_override_points, h.points_reward)      AS points_reward,
    h.estimated_duration_minutes,
    h.difficulty::TEXT,
    h.hunt_type::TEXT,
    h.privacy::TEXT,
    h.participation_mode::TEXT,
    (h.stop_ordering = 'ordered')         AS is_ordered,
    COALESCE(ss.total_count, 0)           AS stop_count,
    NULL::TEXT                            AS thumbnail_url,
    -- Availability state
    public.resolve_hunt_availability_state(
      h.status::TEXT,
      up.part_status::TEXT,
      ui.inv_status::TEXT,
      (ao.max_participants IS NOT NULL
         AND ao.participant_count >= ao.max_participants),
      ao.starts_at
    )                                     AS availability_state,
    up.part_status::TEXT                  AS participation_status,
    up.participation_id,
    ui.invitation_id,
    ui.inv_status::TEXT                   AS invitation_status,
    ao.max_participants,
    COALESCE(ao.participant_count, 0)     AS participant_count,
    (ao.max_participants IS NOT NULL
       AND ao.participant_count >= ao.max_participants) AS is_full,
    ao.starts_at,
    ao.ends_at,
    ao.join_until,
    COALESCE(h.is_featured, FALSE)        AS is_featured,
    COALESCE(ss.requires_proof, FALSE)    AS requires_proof,
    COALESCE(ss.requires_location, FALSE) AS requires_location,
    h.indoor_outdoor::TEXT,
    h.accessibility_note::TEXT            AS accessibility_summary

  FROM hunts h
  LEFT JOIN active_occurrences ao ON ao.hunt_id = h.id
  LEFT JOIN user_participation  up ON up.hunt_id = h.id
  LEFT JOIN user_invitation     ui ON ui.hunt_id = h.id
  LEFT JOIN stop_stats          ss ON ss.hunt_id = h.id
  -- Spatial filter: hunt's start stop must be in the viewport bounding box
  WHERE h.status = 'active'
    AND h.privacy = 'public'
    -- Bounding box filter on public display coordinates
    AND EXISTS (
      SELECT 1
      FROM hunt_stop_geofences hsg
      JOIN hunt_stops hs3 ON hs3.id = hsg.hunt_stop_id
      WHERE hs3.hunt_id = h.id
        AND hsg.public_lat BETWEEN p_south AND p_north
        AND hsg.public_lng BETWEEN p_west  AND p_east
      LIMIT 1
    )
    -- Apply filters
    AND (NOT p_available_now   OR (h.status = 'active' AND (ao.ends_at IS NULL OR ao.ends_at > v_now)))
    AND (NOT p_starting_soon   OR (ao.starts_at IS NOT NULL AND ao.starts_at BETWEEN v_now AND v_now + INTERVAL '24 hours'))
    AND (NOT p_has_space       OR (ao.max_participants IS NULL OR ao.participant_count < ao.max_participants))
    AND (p_participation_mode IS NULL OR h.participation_mode::TEXT = p_participation_mode)
    AND (p_max_duration_minutes IS NULL OR h.estimated_duration_minutes <= p_max_duration_minutes)
    AND (p_indoor_outdoor IS NULL OR h.indoor_outdoor::TEXT = p_indoor_outdoor)
    AND (NOT p_accessible_only OR h.accessibility_note IS NOT NULL)

  ORDER BY h.is_featured DESC NULLS LAST, h.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_hunt_map_viewport FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hunt_map_viewport TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hunt_map_viewport TO anon;

-- ─── Nearby hunts RPC ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_nearby_hunts(
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
  v_now TIMESTAMPTZ := NOW();
BEGIN
  p_limit := LEAST(GREATEST(p_limit, 1), 100);

  RETURN QUERY
  WITH user_participation AS (
    SELECT DISTINCT ON (hp.hunt_id)
      hp.hunt_id,
      hp.id   AS participation_id,
      hp.status AS part_status
    FROM hunt_participants hp
    WHERE p_user_id IS NOT NULL AND hp.user_id = p_user_id
      AND hp.status NOT IN ('declined', 'removed', 'expired')
    ORDER BY hp.hunt_id, hp.created_at DESC
  ),
  user_invitation AS (
    SELECT DISTINCT ON (hi.hunt_id)
      hi.hunt_id,
      hi.id   AS invitation_id,
      hi.status AS inv_status
    FROM hunt_invitations hi
    WHERE p_user_id IS NOT NULL AND hi.invitee_user_id = p_user_id AND hi.status = 'pending'
    ORDER BY hi.hunt_id, hi.created_at DESC
  ),
  active_occurrences AS (
    SELECT DISTINCT ON (ho.hunt_id)
      ho.hunt_id, ho.id AS occurrence_id, ho.status AS occ_status,
      ho.starts_at, ho.ends_at, ho.join_until, ho.max_participants,
      ho.participant_count, ho.reward_override_points
    FROM hunt_occurrences ho
    WHERE ho.status IN ('scheduled', 'active')
    ORDER BY ho.hunt_id, ho.starts_at ASC
  ),
  stop_stats AS (
    SELECT hs.hunt_id,
      COUNT(*)::INTEGER                             AS total_count,
      BOOL_OR(hs.completion_method IN ('location','image_and_location')) AS requires_location,
      BOOL_OR(hs.completion_method NOT IN ('none','manual_confirmation')) AS requires_proof
    FROM hunt_stops hs GROUP BY hs.hunt_id
  ),
  hunt_coords AS (
    SELECT hs4.hunt_id,
      (SELECT hsg2.public_lat FROM hunt_stop_geofences hsg2
         JOIN hunt_stops hstop ON hstop.id = hsg2.hunt_stop_id
         WHERE hstop.hunt_id = hs4.hunt_id AND hstop.stop_role = 'start'
         ORDER BY hstop.sort_order LIMIT 1) AS plat,
      (SELECT hsg2.public_lng FROM hunt_stop_geofences hsg2
         JOIN hunt_stops hstop ON hstop.id = hsg2.hunt_stop_id
         WHERE hstop.hunt_id = hs4.hunt_id AND hstop.stop_role = 'start'
         ORDER BY hstop.sort_order LIMIT 1) AS plng
    FROM (SELECT DISTINCT hunt_id FROM hunt_stops) hs4
  )
  SELECT
    h.id                AS hunt_id,
    ao.occurrence_id,
    h.slug,
    h.title,
    COALESCE(h.summary, '') AS summary,
    COALESCE(hc.plat, 0.0)::DOUBLE PRECISION AS display_lat,
    COALESCE(hc.plng, 0.0)::DOUBLE PRECISION AS display_lng,
    h.public_meeting_info::TEXT AS public_location_label,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND hc.plat IS NOT NULL AND hc.plng IS NOT NULL
      THEN (
        6371000.0 * ACOS(
          COS(RADIANS(p_lat)) * COS(RADIANS(hc.plat)) *
          COS(RADIANS(hc.plng) - RADIANS(p_lng)) +
          SIN(RADIANS(p_lat)) * SIN(RADIANS(hc.plat))
        )
      )
      ELSE NULL
    END::DOUBLE PRECISION AS distance_meters,
    COALESCE(ao.reward_override_points, h.points_reward) AS points_reward,
    h.estimated_duration_minutes,
    h.difficulty::TEXT,
    h.hunt_type::TEXT,
    h.privacy::TEXT,
    h.participation_mode::TEXT,
    (h.stop_ordering = 'ordered') AS is_ordered,
    COALESCE(ss.total_count, 0) AS stop_count,
    NULL::TEXT AS thumbnail_url,
    public.resolve_hunt_availability_state(
      h.status::TEXT, up.part_status::TEXT, ui.inv_status::TEXT,
      (ao.max_participants IS NOT NULL AND ao.participant_count >= ao.max_participants),
      ao.starts_at
    ) AS availability_state,
    up.part_status::TEXT AS participation_status,
    up.participation_id,
    ui.invitation_id,
    ui.inv_status::TEXT AS invitation_status,
    ao.max_participants,
    COALESCE(ao.participant_count, 0) AS participant_count,
    (ao.max_participants IS NOT NULL AND ao.participant_count >= ao.max_participants) AS is_full,
    ao.starts_at, ao.ends_at, ao.join_until,
    COALESCE(h.is_featured, FALSE) AS is_featured,
    COALESCE(ss.requires_proof, FALSE) AS requires_proof,
    COALESCE(ss.requires_location, FALSE) AS requires_location,
    h.indoor_outdoor::TEXT,
    h.accessibility_note::TEXT AS accessibility_summary

  FROM hunts h
  LEFT JOIN active_occurrences ao ON ao.hunt_id = h.id
  LEFT JOIN user_participation  up ON up.hunt_id = h.id
  LEFT JOIN user_invitation     ui ON ui.hunt_id = h.id
  LEFT JOIN stop_stats          ss ON ss.hunt_id = h.id
  LEFT JOIN hunt_coords         hc ON hc.hunt_id = h.id

  WHERE h.status = 'active'
    AND h.privacy = 'public'
    AND (NOT p_available_now   OR (ao.ends_at IS NULL OR ao.ends_at > v_now))
    AND (NOT p_starting_soon   OR (ao.starts_at IS NOT NULL AND ao.starts_at BETWEEN v_now AND v_now + INTERVAL '24 hours'))
    AND (NOT p_has_space       OR (ao.max_participants IS NULL OR ao.participant_count < ao.max_participants))
    AND (p_participation_mode IS NULL OR h.participation_mode::TEXT = p_participation_mode)
    AND (p_max_duration_minutes IS NULL OR h.estimated_duration_minutes <= p_max_duration_minutes)
    AND (NOT p_accessible_only OR h.accessibility_note IS NOT NULL)

  ORDER BY
    CASE p_sort
      WHEN 'nearest'       THEN CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND hc.plat IS NOT NULL
                                  THEN (6371000.0 * ACOS(COS(RADIANS(p_lat))*COS(RADIANS(hc.plat))*COS(RADIANS(hc.plng)-RADIANS(p_lng))+SIN(RADIANS(p_lat))*SIN(RADIANS(hc.plat))))
                                  ELSE 9999999 END
      WHEN 'highest_points' THEN -COALESCE(ao.reward_override_points, h.points_reward)::FLOAT
      WHEN 'shortest'       THEN COALESCE(h.estimated_duration_minutes, 9999)::FLOAT
      WHEN 'starting_soon'  THEN EXTRACT(EPOCH FROM COALESCE(ao.starts_at, NOW() + INTERVAL '365 days'))
      ELSE 0
    END ASC,
    h.is_featured DESC NULLS LAST,
    h.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_nearby_hunts FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_hunts TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_hunts TO anon;

-- ─── Indexes to support viewport and nearby queries ───────────────────────────

-- Index on public coords in geofences (for bbox filtering)
CREATE INDEX IF NOT EXISTS idx_hunt_stop_geofences_public_coords
  ON hunt_stop_geofences (public_lat, public_lng);

-- Index on hunt_stop_geofences.hunt_stop_id + stop_role for viewport join
CREATE INDEX IF NOT EXISTS idx_hunt_stops_hunt_id_role
  ON hunt_stops (hunt_id, stop_role);

-- Index for participation lookups
CREATE INDEX IF NOT EXISTS idx_hunt_participants_user_hunt
  ON hunt_participants (user_id, hunt_id, status, created_at DESC);

-- Index for invitation lookups
CREATE INDEX IF NOT EXISTS idx_hunt_invitations_invitee_pending
  ON hunt_invitations (invitee_user_id, status, hunt_id);

COMMENT ON FUNCTION public.get_hunt_map_viewport IS
  'Returns public Hunt map items within a bounding box. Only published public hunts. No private geometry.';
COMMENT ON FUNCTION public.get_nearby_hunts IS
  'Returns nearby public Hunts sorted by user preference. Only published public hunts.';
