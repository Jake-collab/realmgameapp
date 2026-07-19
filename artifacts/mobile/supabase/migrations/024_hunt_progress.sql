-- 024_hunt_progress.sql
-- Hunt Progress RPCs: leaderboard, current-user rank, In Action, Completed history,
-- completion detail, stop history, submission history, point history, other activity.
--
-- Design decisions:
--   * Hunt-only points: aggregates only rows with transaction_type = 'hunt_reward'.
--     Reversals are included (negative amounts) to produce net point totals.
--   * Week boundaries: Monday UTC (ISO week — matches Quest leaderboard convention).
--   * Ranking: DENSE_RANK so ties share a rank (1, 2, 2, 3).
--     Secondary tie-break: earliest qualifying hunt_reward row (MIN created_at).
--   * Privacy: only users with leaderboard_visibility = TRUE appear publicly.
--     Hidden users receive private data via get_my_hunt_rank only.
--   * Account status: only 'active' accounts appear in public rankings.
--   * Dev-seed exclusion: production has no dev-seed rows; Build 1 relies on this.
--   * Proof privacy: reviewer identity and raw review_notes never returned.
--   * Geo privacy: no validation geometry returned — coordinates excluded.
--
-- Scale note: RPC aggregation on points_ledger is correct for Build 1.
-- At > 10 000 DAU consider a periodically refreshed materialized leaderboard.

-- ─── Hunt leaderboard RPC ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_leaderboard(
  p_period     TEXT  DEFAULT 'all_time',  -- 'week' | 'month' | 'all_time'
  p_limit      INT   DEFAULT 50,
  p_offset     INT   DEFAULT 0
)
RETURNS TABLE (
  rank             BIGINT,
  user_id          UUID,
  display_name     TEXT,
  username         TEXT,
  avatar_path      TEXT,
  points           BIGINT,
  hunts_completed  BIGINT,
  is_current_user  BOOLEAN,
  is_anonymous     BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user UUID         := auth.uid();
  v_period_start TIMESTAMPTZ;
BEGIN
  -- Period boundary (Monday UTC for weeks, 1st UTC for months)
  IF p_period = 'week' THEN
    v_period_start := date_trunc('week', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSIF p_period = 'month' THEN
    v_period_start := date_trunc('month', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSE
    v_period_start := NULL;  -- all_time
  END IF;

  -- Clamp page size (max 100)
  IF p_limit > 100 THEN
    p_limit := 100;
  END IF;

  RETURN QUERY
  WITH qualifying AS (
    -- Net Hunt points per user (hunt_reward + any reversals)
    SELECT
      pl.user_id,
      SUM(pl.amount)        AS total_points,
      MIN(pl.created_at)    AS earliest_qualifying_at,
      COUNT(DISTINCT pl.reference_id) AS hunts_rewarded
    FROM points_ledger pl
    WHERE
      pl.transaction_type = 'hunt_reward'
      AND (v_period_start IS NULL OR pl.created_at >= v_period_start)
    GROUP BY pl.user_id
    HAVING SUM(pl.amount) > 0
  ),
  visible AS (
    -- Public entries: active account, leaderboard visibility on
    SELECT
      q.user_id,
      q.total_points,
      q.earliest_qualifying_at,
      q.hunts_rewarded,
      pp.display_name,
      pp.username,
      pp.avatar_path,
      COALESCE(pp.is_anonymous_on_leaderboard, FALSE)  AS is_anon
    FROM qualifying q
    JOIN profiles pp ON pp.id = q.user_id
    WHERE
      pp.account_status = 'active'
      AND pp.leaderboard_visibility = TRUE
  ),
  ranked AS (
    SELECT
      DENSE_RANK() OVER (
        ORDER BY v.total_points DESC, v.earliest_qualifying_at ASC
      )                        AS rank,
      v.user_id,
      v.display_name,
      v.username,
      v.avatar_path,
      v.total_points,
      v.hunts_rewarded,
      v.is_anon,
      (v.user_id = v_current_user) AS is_current_user
    FROM visible v
  )
  SELECT
    r.rank,
    CASE WHEN r.is_anon THEN NULL ELSE r.user_id  END AS user_id,
    CASE WHEN r.is_anon THEN 'Anonymous Explorer'  ELSE r.display_name END AS display_name,
    CASE WHEN r.is_anon THEN NULL ELSE r.username  END AS username,
    CASE WHEN r.is_anon THEN NULL ELSE r.avatar_path END AS avatar_path,
    r.total_points                                       AS points,
    r.hunts_rewarded                                     AS hunts_completed,
    r.is_current_user,
    r.is_anon                                            AS is_anonymous
  FROM ranked r
  ORDER BY r.rank ASC, r.is_current_user DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_leaderboard FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_leaderboard TO authenticated;

COMMENT ON FUNCTION get_hunt_leaderboard IS
  'Returns paginated Hunt leaderboard entries. '
  'Hunt-only point transactions (hunt_reward). Excludes hidden and suspended users. '
  'Anonymous users return no identity fields. Period: week/month/all_time.';

-- ─── My Hunt rank RPC ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_hunt_rank(
  p_period TEXT DEFAULT 'all_time'
)
RETURNS TABLE (
  qualifies          BOOLEAN,
  rank               BIGINT,
  points             BIGINT,
  total_ranked_users BIGINT,
  visibility_mode    TEXT,
  no_rank_reason     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID         := auth.uid();
  v_period_start TIMESTAMPTZ;
  v_user_points  BIGINT       := 0;
  v_user_rank    BIGINT;
  v_total_ranked BIGINT       := 0;
  v_qualifies    BOOLEAN      := FALSE;
  v_visibility   TEXT         := 'visible';
  v_no_reason    TEXT         := NULL;
  v_profile      RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, 0::BIGINT, 0::BIGINT, 'hidden'::TEXT, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  -- Period boundary
  IF p_period = 'week' THEN
    v_period_start := date_trunc('week', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSIF p_period = 'month' THEN
    v_period_start := date_trunc('month', now() AT TIME ZONE 'UTC')::TIMESTAMPTZ;
  ELSE
    v_period_start := NULL;
  END IF;

  -- Get user visibility setting
  SELECT account_status,
         leaderboard_visibility,
         COALESCE(is_anonymous_on_leaderboard, FALSE) AS is_anon
    INTO v_profile
    FROM profiles
   WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, 0::BIGINT, 0::BIGINT, 'hidden'::TEXT, 'Profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_profile.leaderboard_visibility = FALSE THEN
    v_visibility := 'hidden';
  ELSIF v_profile.is_anon THEN
    v_visibility := 'anonymous';
  ELSE
    v_visibility := 'visible';
  END IF;

  -- Compute net hunt points for current user
  SELECT COALESCE(SUM(pl.amount), 0)
    INTO v_user_points
    FROM points_ledger pl
   WHERE pl.user_id = v_user_id
     AND pl.transaction_type = 'hunt_reward'
     AND (v_period_start IS NULL OR pl.created_at >= v_period_start);

  v_qualifies := v_user_points > 0;

  -- Count total publicly ranked users
  SELECT COUNT(*)
    INTO v_total_ranked
    FROM (
      SELECT pl2.user_id
        FROM points_ledger pl2
        JOIN profiles pp2 ON pp2.id = pl2.user_id
       WHERE pl2.transaction_type = 'hunt_reward'
         AND (v_period_start IS NULL OR pl2.created_at >= v_period_start)
         AND pp2.account_status = 'active'
         AND pp2.leaderboard_visibility = TRUE
       GROUP BY pl2.user_id
      HAVING SUM(pl2.amount) > 0
    ) ranked_users;

  -- Compute user's rank (among visible users only, if they are visible)
  IF v_qualifies AND v_visibility IN ('visible', 'anonymous') THEN
    SELECT COUNT(*) + 1
      INTO v_user_rank
      FROM (
        SELECT pl3.user_id
          FROM points_ledger pl3
          JOIN profiles pp3 ON pp3.id = pl3.user_id
         WHERE pl3.transaction_type = 'hunt_reward'
           AND (v_period_start IS NULL OR pl3.created_at >= v_period_start)
           AND pp3.account_status = 'active'
           AND pp3.leaderboard_visibility = TRUE
           AND pl3.user_id <> v_user_id
         GROUP BY pl3.user_id
        HAVING SUM(pl3.amount) > v_user_points
      ) better_users;
  ELSE
    v_user_rank := NULL;
    IF NOT v_qualifies THEN
      v_no_reason := 'No qualifying Hunt points for this period.';
    ELSIF v_visibility = 'hidden' THEN
      v_no_reason := 'Leaderboard visibility is disabled in your profile settings.';
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_qualifies,
    v_user_rank,
    v_user_points,
    v_total_ranked,
    v_visibility,
    v_no_reason;
END;
$$;

REVOKE ALL ON FUNCTION get_my_hunt_rank FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_hunt_rank TO authenticated;

COMMENT ON FUNCTION get_my_hunt_rank IS
  'Returns the current user''s Hunt leaderboard rank and qualifying points. '
  'Always returns private point totals even for hidden users. '
  'rank is NULL for hidden users and users with zero qualifying points.';

-- ─── Hunt In Action RPC ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_in_action(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  participation_id    UUID,
  hunt_id             UUID,
  hunt_title          TEXT,
  occurrence_id       UUID,
  status              TEXT,
  started_at          TIMESTAMPTZ,
  completion_deadline TIMESTAMPTZ,
  awarded_points      INT,
  reward_snapshot     JSONB,
  stops_completed     BIGINT,
  stops_required      BIGINT,
  -- Stop-level proof info (for the most-recent pending/needs-resubmission stop)
  pending_stop_id     UUID,
  pending_stop_title  TEXT,
  pending_stop_status TEXT,
  safe_review_note    TEXT,
  last_submitted_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate the requesting user is the owner
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH participant_rows AS (
    SELECT
      hp.id            AS participation_id,
      hp.hunt_id,
      hp.occurrence_id,
      hp.status,
      hp.started_at,
      hp.completion_deadline,
      hp.awarded_points,
      hp.reward_snapshot,
      h.title          AS hunt_title
    FROM hunt_participants hp
    JOIN hunts h ON h.id = hp.hunt_id
   WHERE hp.user_id = p_user_id
     AND hp.status IN ('active', 'paused')
  ),
  stop_counts AS (
    SELECT
      hsp.hunt_participant_id,
      COUNT(*) FILTER (WHERE hs.is_required = TRUE AND hsp.status = 'completed') AS stops_completed,
      COUNT(*) FILTER (WHERE hs.is_required = TRUE)                              AS stops_required
    FROM hunt_stop_progress hsp
    JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
   WHERE hsp.hunt_participant_id IN (SELECT participation_id FROM participant_rows)
   GROUP BY hsp.hunt_participant_id
  ),
  pending_stops AS (
    -- Most urgent pending stop per participant
    SELECT DISTINCT ON (hsp.hunt_participant_id)
      hsp.hunt_participant_id,
      hsp.hunt_stop_id   AS pending_stop_id,
      hs.title           AS pending_stop_title,
      hsp.status         AS pending_stop_status,
      ps.review_explanation AS safe_review_note,
      ps.submitted_at    AS last_submitted_at
    FROM hunt_stop_progress hsp
    JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
    LEFT JOIN LATERAL (
      SELECT review_explanation, submitted_at
        FROM proof_submissions
       WHERE hunt_stop_progress_id = hsp.id
       ORDER BY submitted_at DESC
       LIMIT 1
    ) ps ON TRUE
   WHERE hsp.hunt_participant_id IN (SELECT participation_id FROM participant_rows)
     AND hsp.status IN ('awaiting_proof', 'under_review', 'needs_resubmission', 'rejected', 'in_progress')
   ORDER BY hsp.hunt_participant_id,
     CASE hsp.status
       WHEN 'needs_resubmission' THEN 1
       WHEN 'awaiting_proof'     THEN 2
       WHEN 'in_progress'        THEN 3
       WHEN 'under_review'       THEN 4
       WHEN 'rejected'           THEN 5
       ELSE 6
     END
  )
  SELECT
    pr.participation_id,
    pr.hunt_id,
    pr.hunt_title,
    pr.occurrence_id,
    pr.status::TEXT,
    pr.started_at,
    pr.completion_deadline,
    pr.awarded_points,
    pr.reward_snapshot,
    COALESCE(sc.stops_completed, 0),
    COALESCE(sc.stops_required, 0),
    ps.pending_stop_id,
    ps.pending_stop_title,
    ps.pending_stop_status::TEXT,
    -- Only return safe review note (review_explanation is user-safe text, not raw notes)
    ps.safe_review_note,
    ps.last_submitted_at
  FROM participant_rows pr
  LEFT JOIN stop_counts sc ON sc.hunt_participant_id = pr.participation_id
  LEFT JOIN pending_stops ps ON ps.hunt_participant_id = pr.participation_id
  ORDER BY
    CASE pr.status
      WHEN 'active' THEN 1
      WHEN 'paused' THEN 2
      ELSE 3
    END,
    pr.started_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_in_action FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_in_action TO authenticated;

-- ─── Hunt completed history RPC ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_completed(
  p_user_id    UUID    DEFAULT auth.uid(),
  p_limit      INT     DEFAULT 20,
  p_offset     INT     DEFAULT 0,
  p_sort_order TEXT    DEFAULT 'newest',   -- 'newest' | 'oldest' | 'highest_points' | 'most_stops'
  p_mode_filter TEXT   DEFAULT 'all'       -- 'all' | 'solo' | 'group' | 'ordered' | 'unordered'
)
RETURNS TABLE (
  participation_id   UUID,
  hunt_id            UUID,
  hunt_title         TEXT,
  occurrence_id      UUID,
  completed_at       TIMESTAMPTZ,
  awarded_points     INT,
  reward_snapshot    JSONB,
  stops_completed    BIGINT,
  optional_completed BIGINT,
  stops_required     BIGINT,
  is_group           BOOLEAN,
  stop_ordering      TEXT,
  occurrence_label   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_limit > 100 THEN p_limit := 100; END IF;

  RETURN QUERY
  WITH completions AS (
    SELECT
      hp.id           AS participation_id,
      hp.hunt_id,
      h.title         AS hunt_title,
      hp.occurrence_id,
      hp.completed_at,
      hp.awarded_points,
      hp.reward_snapshot,
      h.participation_mode,
      h.stop_ordering,
      ho.label        AS occurrence_label
    FROM hunt_participants hp
    JOIN hunts h ON h.id = hp.hunt_id
    LEFT JOIN hunt_occurrences ho ON ho.id = hp.occurrence_id
   WHERE hp.user_id = p_user_id
     AND hp.status = 'completed'
     AND hp.completed_at IS NOT NULL
     AND (
       p_mode_filter = 'all'
       OR (p_mode_filter = 'solo'      AND h.participation_mode IN ('solo', 'open'))
       OR (p_mode_filter = 'group'     AND h.participation_mode IN ('group', 'team'))
       OR (p_mode_filter = 'ordered'   AND h.stop_ordering = 'ordered')
       OR (p_mode_filter = 'unordered' AND h.stop_ordering = 'unordered')
     )
  ),
  stop_counts AS (
    SELECT
      hsp.hunt_participant_id,
      COUNT(*) FILTER (WHERE hs.is_required AND hsp.status = 'completed') AS req_done,
      COUNT(*) FILTER (WHERE NOT hs.is_required AND hsp.status = 'completed') AS opt_done,
      COUNT(*) FILTER (WHERE hs.is_required)  AS req_total
    FROM hunt_stop_progress hsp
    JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
   WHERE hsp.hunt_participant_id IN (SELECT participation_id FROM completions)
   GROUP BY hsp.hunt_participant_id
  )
  SELECT
    c.participation_id,
    c.hunt_id,
    c.hunt_title,
    c.occurrence_id,
    c.completed_at,
    c.awarded_points,
    c.reward_snapshot,
    COALESCE(sc.req_done,  0),
    COALESCE(sc.opt_done,  0),
    COALESCE(sc.req_total, 0),
    c.participation_mode IN ('group', 'team')   AS is_group,
    c.stop_ordering,
    c.occurrence_label
  FROM completions c
  LEFT JOIN stop_counts sc ON sc.hunt_participant_id = c.participation_id
  ORDER BY
    CASE p_sort_order
      WHEN 'oldest'        THEN EXTRACT(EPOCH FROM c.completed_at)
      WHEN 'highest_points' THEN -COALESCE(c.awarded_points, 0)
      WHEN 'most_stops'    THEN -COALESCE(sc.req_done, 0)
      ELSE -EXTRACT(EPOCH FROM c.completed_at)   -- newest default
    END
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_completed FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_completed TO authenticated;

-- ─── Hunt completion detail RPC ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_completion_detail(
  p_participation_id UUID,
  p_user_id          UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  participation_id   UUID,
  hunt_id            UUID,
  hunt_title         TEXT,
  hunt_summary       TEXT,
  occurrence_id      UUID,
  occurrence_label   TEXT,
  completed_at       TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  awarded_points     INT,
  reward_snapshot    JSONB,
  has_reversal       BOOLEAN,
  is_group           BOOLEAN,
  participation_mode TEXT,
  stop_ordering      TEXT,
  stops_required     BIGINT,
  stops_completed    BIGINT,
  optional_completed BIGINT,
  group_member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    hp.id,
    hp.hunt_id,
    h.title,
    h.summary,
    hp.occurrence_id,
    ho.label,
    hp.completed_at,
    hp.started_at,
    hp.awarded_points,
    hp.reward_snapshot,
    EXISTS(
      SELECT 1 FROM points_ledger pl
       WHERE pl.reference_id = hp.id::TEXT
         AND pl.transaction_type = 'reversal'
    )                                AS has_reversal,
    h.participation_mode IN ('group', 'team') AS is_group,
    h.participation_mode::TEXT,
    h.stop_ordering::TEXT,
    (SELECT COUNT(*) FROM hunt_stops hs WHERE hs.hunt_id = h.id AND hs.is_required) AS stops_required,
    (SELECT COUNT(*) FROM hunt_stop_progress hsp2
       JOIN hunt_stops hs2 ON hs2.id = hsp2.hunt_stop_id
      WHERE hsp2.hunt_participant_id = hp.id
        AND hs2.is_required AND hsp2.status = 'completed')    AS stops_completed,
    (SELECT COUNT(*) FROM hunt_stop_progress hsp3
       JOIN hunt_stops hs3 ON hs3.id = hsp3.hunt_stop_id
      WHERE hsp3.hunt_participant_id = hp.id
        AND NOT hs3.is_required AND hsp3.status = 'completed') AS optional_completed,
    (SELECT COUNT(*) FROM hunt_participants hp2
      WHERE hp2.hunt_id = hp.hunt_id
        AND hp2.occurrence_id IS NOT DISTINCT FROM hp.occurrence_id
        AND hp2.status IN ('active', 'completed', 'paused'))   AS group_member_count
  FROM hunt_participants hp
  JOIN hunts h ON h.id = hp.hunt_id
  LEFT JOIN hunt_occurrences ho ON ho.id = hp.occurrence_id
  WHERE hp.id = p_participation_id
    AND hp.user_id = p_user_id
    AND hp.status = 'completed';
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_completion_detail FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_completion_detail TO authenticated;

-- ─── Hunt stop history RPC ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_stop_history(
  p_participation_id UUID,
  p_user_id          UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  stop_progress_id   UUID,
  hunt_stop_id       UUID,
  stop_title         TEXT,
  stop_number        INT,
  is_required        BOOLEAN,
  stop_status        TEXT,
  completion_method  TEXT,
  completed_at       TIMESTAMPTZ,
  -- Proof summary (never exposes coordinates or raw notes)
  proof_status       TEXT,
  proof_type         TEXT,
  has_text_response  BOOLEAN,
  has_image          BOOLEAN,
  location_verified  BOOLEAN,
  proof_approved_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM hunt_participants
     WHERE id = p_participation_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    hsp.id                    AS stop_progress_id,
    hsp.hunt_stop_id,
    hs.title                  AS stop_title,
    hs.stop_number,
    hs.is_required,
    hsp.status::TEXT          AS stop_status,
    hs.completion_method::TEXT,
    hsp.completed_at,
    -- Latest proof summary (safe fields only — no coordinates, no review_notes)
    ps.status::TEXT           AS proof_status,
    ps.submission_type::TEXT  AS proof_type,
    (ps.text_response IS NOT NULL AND ps.text_response <> '') AS has_text_response,
    -- Infer image from submission_type; avoid returning media IDs or paths
    (ps.submission_type IN ('image', 'text_and_image', 'image_and_location')) AS has_image,
    (ps.location_validated = TRUE) AS location_verified,
    ps.approved_at            AS proof_approved_at
  FROM hunt_stop_progress hsp
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  LEFT JOIN LATERAL (
    SELECT status, submission_type, text_response, location_validated, approved_at
      FROM proof_submissions
     WHERE hunt_stop_progress_id = hsp.id
     ORDER BY submitted_at DESC
     LIMIT 1
  ) ps ON TRUE
  WHERE hsp.hunt_participant_id = p_participation_id
    AND hsp.status <> 'locked'   -- never expose locked clues via history
  ORDER BY hs.stop_number ASC NULLS LAST, hsp.completed_at ASC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_stop_history FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_stop_history TO authenticated;

-- ─── Hunt submission history RPC ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_submission_history(
  p_participation_id UUID,
  p_user_id          UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  submission_id           UUID,
  stop_progress_id        UUID,
  hunt_stop_id            UUID,
  stop_title              TEXT,
  submission_number       INT,
  status                  TEXT,
  submitted_at            TIMESTAMPTZ,
  submission_type         TEXT,
  has_text_response       BOOLEAN,
  has_image               BOOLEAN,
  location_verified       BOOLEAN,
  -- Safe review explanation — NOT raw review_notes, NOT reviewer_id
  safe_review_explanation TEXT,
  is_latest               BOOLEAN,
  previous_submission_id  UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM hunt_participants
     WHERE id = p_participation_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH submissions_for_participation AS (
    SELECT
      ps.id,
      ps.hunt_stop_progress_id,
      ps.status,
      ps.submitted_at,
      ps.submission_type,
      ps.text_response,
      ps.location_validated,
      ps.review_explanation,   -- user-safe field (not raw review_notes)
      ps.previous_submission_id,
      hs.id     AS hunt_stop_id,
      hs.title  AS stop_title,
      ROW_NUMBER() OVER (
        PARTITION BY ps.hunt_stop_progress_id
        ORDER BY ps.submitted_at ASC
      )         AS sub_num,
      RANK() OVER (
        PARTITION BY ps.hunt_stop_progress_id
        ORDER BY ps.submitted_at DESC
      ) = 1     AS is_latest_in_stop
    FROM proof_submissions ps
    JOIN hunt_stop_progress hsp ON hsp.id = ps.hunt_stop_progress_id
    JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
   WHERE hsp.hunt_participant_id = p_participation_id
     AND ps.user_id = p_user_id
   ORDER BY ps.submitted_at ASC
  )
  SELECT
    s.id                  AS submission_id,
    s.hunt_stop_progress_id AS stop_progress_id,
    s.hunt_stop_id,
    s.stop_title,
    s.sub_num::INT        AS submission_number,
    s.status::TEXT,
    s.submitted_at,
    s.submission_type::TEXT,
    (s.text_response IS NOT NULL AND s.text_response <> '') AS has_text_response,
    (s.submission_type IN ('image', 'text_and_image', 'image_and_location')) AS has_image,
    COALESCE(s.location_validated, FALSE) AS location_verified,
    s.review_explanation  AS safe_review_explanation,  -- user-safe; no raw notes
    s.is_latest_in_stop   AS is_latest,
    s.previous_submission_id
  FROM submissions_for_participation s
  ORDER BY s.hunt_stop_id, s.submitted_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_submission_history FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_submission_history TO authenticated;

-- ─── Hunt point history RPC ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_point_history(
  p_user_id  UUID  DEFAULT auth.uid(),
  p_limit    INT   DEFAULT 20,
  p_offset   INT   DEFAULT 0
)
RETURNS TABLE (
  ledger_id            UUID,
  amount               INT,
  transaction_type     TEXT,
  display_label        TEXT,
  hunt_participation_id UUID,
  hunt_title           TEXT,
  created_at           TIMESTAMPTZ,
  is_reversed          BOOLEAN,
  is_reversal          BOOLEAN,
  reversed_ledger_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_limit > 100 THEN p_limit := 100; END IF;

  RETURN QUERY
  WITH hunt_ledger AS (
    SELECT
      pl.id,
      pl.amount,
      pl.transaction_type,
      pl.reference_id,
      pl.reversed_transaction_id,
      pl.created_at
    FROM points_ledger pl
    WHERE pl.user_id = p_user_id
      AND pl.transaction_type IN ('hunt_reward', 'reversal', 'admin_adjustment')
      -- For reversals, only include those referencing a hunt_reward
      AND (
        pl.transaction_type = 'hunt_reward'
        OR pl.transaction_type = 'admin_adjustment'
        OR (pl.transaction_type = 'reversal'
            AND EXISTS (
              SELECT 1 FROM points_ledger orig
               WHERE orig.id::TEXT = pl.reversed_transaction_id::TEXT
                 AND orig.transaction_type = 'hunt_reward'
            ))
      )
    ORDER BY pl.created_at DESC
    LIMIT p_limit + 1  -- fetch extra for hasMore
    OFFSET p_offset
  ),
  with_titles AS (
    SELECT
      hl.*,
      h.title AS hunt_title,
      hp.id   AS hunt_participation_id
    FROM hunt_ledger hl
    LEFT JOIN hunt_participants hp ON hp.id::TEXT = hl.reference_id
    LEFT JOIN hunts h ON h.id = hp.hunt_id
  )
  SELECT
    wt.id                      AS ledger_id,
    wt.amount::INT,
    wt.transaction_type::TEXT,
    CASE wt.transaction_type
      WHEN 'hunt_reward'      THEN 'Hunt completion reward'
      WHEN 'reversal'         THEN 'Hunt reward adjustment'
      WHEN 'admin_adjustment' THEN 'Administrative adjustment'
      ELSE wt.transaction_type
    END                        AS display_label,
    wt.hunt_participation_id,
    wt.hunt_title,
    wt.created_at,
    EXISTS(
      SELECT 1 FROM points_ledger rev
       WHERE rev.reversed_transaction_id::TEXT = wt.id::TEXT
         AND rev.transaction_type = 'reversal'
    )                          AS is_reversed,
    (wt.transaction_type = 'reversal') AS is_reversal,
    wt.reversed_transaction_id AS reversed_ledger_id
  FROM with_titles wt
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_point_history FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_point_history TO authenticated;

-- ─── Hunt other activity RPC ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_other_activity(
  p_user_id  UUID  DEFAULT auth.uid(),
  p_limit    INT   DEFAULT 20,
  p_offset   INT   DEFAULT 0
)
RETURNS TABLE (
  participation_id   UUID,
  hunt_id            UUID,
  hunt_title         TEXT,
  status             TEXT,
  joined_at          TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  finalized_at       TIMESTAMPTZ,
  stops_completed    BIGINT,
  stops_required     BIGINT,
  awarded_points     INT,
  -- Safe explanation — no internal removal reasons
  safe_status_note   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_limit > 100 THEN p_limit := 100; END IF;

  RETURN QUERY
  WITH other AS (
    SELECT
      hp.id             AS participation_id,
      hp.hunt_id,
      h.title           AS hunt_title,
      hp.status::TEXT,
      hp.joined_at,
      hp.started_at,
      COALESCE(hp.removed_at, hp.completed_at, hp.started_at, hp.joined_at) AS finalized_at,
      hp.awarded_points
    FROM hunt_participants hp
    JOIN hunts h ON h.id = hp.hunt_id
   WHERE hp.user_id = p_user_id
     AND hp.status IN ('withdrawn', 'removed', 'cancelled', 'expired')
  )
  SELECT
    o.participation_id,
    o.hunt_id,
    o.hunt_title,
    o.status,
    o.joined_at,
    o.started_at,
    o.finalized_at,
    COALESCE((
      SELECT COUNT(*)
        FROM hunt_stop_progress hsp
        JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
       WHERE hsp.hunt_participant_id = o.participation_id
         AND hs.is_required AND hsp.status = 'completed'
    ), 0) AS stops_completed,
    COALESCE((
      SELECT COUNT(*)
        FROM hunt_stops hs2
       WHERE hs2.hunt_id = o.hunt_id AND hs2.is_required
    ), 0) AS stops_required,
    COALESCE(o.awarded_points, 0),
    -- Safe, user-facing explanation (no internal removal reasons)
    CASE o.status
      WHEN 'withdrawn' THEN 'You withdrew from this Hunt.'
      WHEN 'removed'   THEN 'Your participation in this Hunt ended.'
      WHEN 'cancelled' THEN 'This Hunt was cancelled.'
      WHEN 'expired'   THEN 'This Hunt participation expired.'
      ELSE 'Participation ended.'
    END AS safe_status_note
  FROM other o
  ORDER BY o.finalized_at DESC NULLS LAST
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_other_activity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_other_activity TO authenticated;

-- ─── Hunt progress summary RPC ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_progress_summary(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  total_hunt_points    BIGINT,
  hunts_completed      BIGINT,
  active_hunts         BIGINT,
  ready_hunts          BIGINT,
  proof_under_review   BIGINT,
  stops_resubmission   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(pl.amount)
        FROM points_ledger pl
       WHERE pl.user_id = p_user_id
         AND pl.transaction_type = 'hunt_reward'
    ), 0)::BIGINT AS total_hunt_points,

    (SELECT COUNT(*) FROM hunt_participants
      WHERE user_id = p_user_id AND status = 'completed')::BIGINT AS hunts_completed,

    (SELECT COUNT(*) FROM hunt_participants
      WHERE user_id = p_user_id AND status IN ('active', 'paused'))::BIGINT AS active_hunts,

    (SELECT COUNT(*) FROM hunt_participants
      WHERE user_id = p_user_id AND status = 'ready')::BIGINT AS ready_hunts,

    (SELECT COUNT(*) FROM hunt_stop_progress hsp
      JOIN hunt_participants hp ON hp.id = hsp.hunt_participant_id
      WHERE hp.user_id = p_user_id AND hsp.status = 'under_review')::BIGINT AS proof_under_review,

    (SELECT COUNT(*) FROM hunt_stop_progress hsp2
      JOIN hunt_participants hp2 ON hp2.id = hsp2.hunt_participant_id
      WHERE hp2.user_id = p_user_id AND hsp2.status = 'needs_resubmission')::BIGINT AS stops_resubmission;
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_progress_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_progress_summary TO authenticated;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Leaderboard aggregation on points_ledger
CREATE INDEX IF NOT EXISTS idx_points_ledger_hunt_reward
  ON points_ledger (user_id, transaction_type, created_at)
  WHERE transaction_type = 'hunt_reward';

-- Hunt participant status + user for In Action and other activity queries
CREATE INDEX IF NOT EXISTS idx_hunt_participants_user_status_completed
  ON hunt_participants (user_id, status, completed_at DESC NULLS LAST);

-- Stop history per participant
CREATE INDEX IF NOT EXISTS idx_hunt_stop_progress_participant_completed
  ON hunt_stop_progress (hunt_participant_id, status, completed_at DESC NULLS LAST);

-- Proof submissions by hunt stop progress for submission history
CREATE INDEX IF NOT EXISTS idx_proof_submissions_stop_progress_submitted
  ON proof_submissions (hunt_stop_progress_id, submitted_at DESC)
  WHERE hunt_stop_progress_id IS NOT NULL;

COMMENT ON FUNCTION get_hunt_leaderboard IS
  'Paginated Hunt leaderboard. Hunt-only points. Privacy-enforced. No geo data.';
COMMENT ON FUNCTION get_my_hunt_rank IS
  'Private Hunt rank for the authenticated user. Always returns own point total.';
COMMENT ON FUNCTION get_hunt_in_action IS
  'Active/paused Hunt participations with pending stop info. Owner-only.';
COMMENT ON FUNCTION get_hunt_completed IS
  'Paginated completed Hunt history with stop counts. Owner-only.';
COMMENT ON FUNCTION get_hunt_completion_detail IS
  'Full completion detail for one Hunt participation. No locked clues.';
COMMENT ON FUNCTION get_hunt_stop_history IS
  'Stop-by-stop completion history. No locked clue content. No geo coords.';
COMMENT ON FUNCTION get_hunt_submission_history IS
  'Proof submission history organized by stop. Safe fields only.';
COMMENT ON FUNCTION get_hunt_point_history IS
  'Hunt-related point ledger entries. Hunt_reward + reversals only.';
COMMENT ON FUNCTION get_hunt_other_activity IS
  'Withdrawn/removed/cancelled/expired Hunt participations. Safe notes only.';
COMMENT ON FUNCTION get_hunt_progress_summary IS
  'Compact Hunt progress counters for the current user.';
