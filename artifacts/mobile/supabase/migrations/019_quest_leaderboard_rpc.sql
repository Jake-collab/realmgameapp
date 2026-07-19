-- 019_quest_leaderboard_rpc.sql
-- Quest leaderboard RPC with period support, privacy enforcement, and current-user rank.
--
-- Design decisions:
--   * Quest-only points: aggregates only rows with quest_participation_id IS NOT NULL.
--     This correctly nets out reversals (negative amounts) and handles future
--     non-quest transaction types without mixing them in.
--   * Week boundaries: Monday UTC (ISO week standard).
--   * Ranking: DENSE_RANK to avoid gaps (1, 2, 2, 3, ...).
--     Tie-breaking: earlier qualifying completion via MIN(created_at) for determinism.
--   * Privacy: only users with leaderboard_visibility = TRUE appear publicly.
--     Hidden users receive a private personal summary via get_my_quest_rank.
--   * Account status: only 'active' accounts appear in public rankings.
--   * Suspended / deactivated accounts are excluded server-side.
--   * Development seed transactions: must be excluded in production by setting
--     is_dev_seed = TRUE on seed rows (future enhancement). For Build 1, rely on
--     production having no seed transactions.
--
-- Scale note: RPC aggregation is correct for Build 1. At >10,000 daily active users,
-- replace with a periodically refreshed materialized leaderboard snapshot.

-- ─── Quest leaderboard RPC ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_quest_leaderboard(
  p_period     TEXT    DEFAULT 'all_time',  -- 'week' | 'month' | 'all_time'
  p_limit      INT     DEFAULT 50,
  p_offset     INT     DEFAULT 0
)
RETURNS TABLE (
  rank             BIGINT,
  user_id          UUID,
  display_name     TEXT,
  username         TEXT,
  avatar_path      TEXT,
  points           BIGINT,
  is_current_user  BOOLEAN,
  is_anonymous     BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user UUID      := auth.uid();
  v_period_start TIMESTAMPTZ;
BEGIN
  -- Period boundary calculation (UTC)
  IF p_period = 'week' THEN
    v_period_start := date_trunc('week', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSIF p_period = 'month' THEN
    v_period_start := date_trunc('month', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSE
    v_period_start := NULL;  -- all_time: no start boundary
  END IF;

  -- Validate limit (max 100 per page)
  IF p_limit > 100 THEN
    p_limit := 100;
  END IF;

  RETURN QUERY
  WITH qualifying AS (
    -- Net quest points per user (includes reversals because reversals have negative amounts)
    SELECT
      pl.user_id,
      SUM(pl.amount)         AS total_points,
      MIN(pl.created_at)     AS earliest_qualifying_at
    FROM points_ledger pl
    WHERE
      pl.quest_participation_id IS NOT NULL
      AND (v_period_start IS NULL OR pl.created_at >= v_period_start)
    GROUP BY pl.user_id
    HAVING SUM(pl.amount) > 0  -- only users with net positive points
  ),
  visible AS (
    SELECT
      q.user_id,
      q.total_points,
      q.earliest_qualifying_at,
      pp.display_name,
      pp.username,
      pp.avatar_path
    FROM qualifying q
    INNER JOIN profiles pp           ON pp.id = q.user_id
    INNER JOIN user_settings us      ON us.user_id = q.user_id
    WHERE
      pp.account_status = 'active'
      AND COALESCE(us.leaderboard_visibility, TRUE) = TRUE
  ),
  ranked AS (
    SELECT
      DENSE_RANK() OVER (
        ORDER BY total_points DESC, earliest_qualifying_at ASC
      )                        AS r,
      user_id,
      total_points,
      display_name,
      username,
      avatar_path
    FROM visible
  )
  SELECT
    r.r::BIGINT                       AS rank,
    r.user_id::UUID                   AS user_id,
    r.display_name::TEXT              AS display_name,
    r.username::TEXT                  AS username,
    r.avatar_path::TEXT               AS avatar_path,
    r.total_points::BIGINT            AS points,
    (r.user_id = v_current_user)      AS is_current_user,
    FALSE                             AS is_anonymous
  FROM ranked r
  ORDER BY r.r ASC, r.user_id ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quest_leaderboard(TEXT, INT, INT) TO authenticated;

-- ─── Current-user rank RPC ────────────────────────────────────────────────────
-- Returns private personal rank summary for the current user.
-- Hidden users (leaderboard_visibility = FALSE) receive their own personal points
-- but no public rank — they are not placed in the public ranking.

CREATE OR REPLACE FUNCTION get_my_quest_rank(
  p_period TEXT DEFAULT 'all_time'
)
RETURNS TABLE (
  qualifies          BOOLEAN,
  rank               BIGINT,
  points             BIGINT,
  total_ranked_users BIGINT,
  period             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user UUID        := auth.uid();
  v_period_start TIMESTAMPTZ;
  v_my_points    BIGINT      := 0;
  v_my_rank      BIGINT;
  v_total        BIGINT      := 0;
  v_is_visible   BOOLEAN;
BEGIN
  IF p_period = 'week' THEN
    v_period_start := date_trunc('week', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSIF p_period = 'month' THEN
    v_period_start := date_trunc('month', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSE
    v_period_start := NULL;
  END IF;

  -- User's own qualifying points (always available regardless of visibility setting)
  SELECT COALESCE(SUM(pl.amount), 0)
  INTO v_my_points
  FROM points_ledger pl
  WHERE
    pl.user_id = v_current_user
    AND pl.quest_participation_id IS NOT NULL
    AND (v_period_start IS NULL OR pl.created_at >= v_period_start);

  -- Check if user is publicly visible
  SELECT COALESCE(us.leaderboard_visibility, TRUE)
  INTO v_is_visible
  FROM user_settings us
  WHERE us.user_id = v_current_user;

  -- Total publicly visible ranked users
  SELECT COUNT(DISTINCT sub.user_id)
  INTO v_total
  FROM (
    SELECT pl2.user_id, SUM(pl2.amount) AS pts
    FROM points_ledger pl2
    INNER JOIN user_settings us2  ON us2.user_id  = pl2.user_id
    INNER JOIN profiles pp2       ON pp2.id        = pl2.user_id
    WHERE
      pl2.quest_participation_id IS NOT NULL
      AND (v_period_start IS NULL OR pl2.created_at >= v_period_start)
      AND pp2.account_status = 'active'
      AND COALESCE(us2.leaderboard_visibility, TRUE) = TRUE
    GROUP BY pl2.user_id
    HAVING SUM(pl2.amount) > 0
  ) sub;

  -- Rank: only calculated when user is visible and has qualifying points
  IF v_my_points > 0 AND COALESCE(v_is_visible, TRUE) THEN
    SELECT COUNT(*) + 1
    INTO v_my_rank
    FROM (
      SELECT pl3.user_id, SUM(pl3.amount) AS pts
      FROM points_ledger pl3
      INNER JOIN user_settings us3  ON us3.user_id  = pl3.user_id
      INNER JOIN profiles pp3       ON pp3.id        = pl3.user_id
      WHERE
        pl3.quest_participation_id IS NOT NULL
        AND (v_period_start IS NULL OR pl3.created_at >= v_period_start)
        AND pp3.account_status = 'active'
        AND COALESCE(us3.leaderboard_visibility, TRUE) = TRUE
        AND pl3.user_id != v_current_user
      GROUP BY pl3.user_id
      HAVING SUM(pl3.amount) > v_my_points
    ) higher;
  ELSE
    v_my_rank := NULL;
  END IF;

  RETURN QUERY SELECT
    (v_my_points > 0)  AS qualifies,
    v_my_rank          AS rank,
    v_my_points        AS points,
    v_total            AS total_ranked_users,
    p_period           AS period;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_quest_rank(TEXT) TO authenticated;

-- ─── Supporting indexes ────────────────────────────────────────────────────────

-- Leaderboard aggregation: filter by quest_participation_id, aggregate by user
CREATE INDEX IF NOT EXISTS idx_points_ledger_quest_leaderboard
  ON points_ledger (user_id, created_at)
  WHERE quest_participation_id IS NOT NULL;

-- Period-based queries
CREATE INDEX IF NOT EXISTS idx_points_ledger_quest_created
  ON points_ledger (created_at)
  WHERE quest_participation_id IS NOT NULL;

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION get_quest_leaderboard IS
  'Returns paginated public Quest leaderboard for a given period. '
  'Only active accounts with leaderboard_visibility=TRUE appear. '
  'Uses DENSE_RANK with earliest-qualifying-at tie-breaking. '
  'Week = ISO week starting Monday UTC. Month = calendar month UTC.';

COMMENT ON FUNCTION get_my_quest_rank IS
  'Returns the current user''s private Quest rank summary. '
  'Hidden users (leaderboard_visibility=FALSE) receive their personal points '
  'but rank = NULL since they are excluded from public ranking.';
