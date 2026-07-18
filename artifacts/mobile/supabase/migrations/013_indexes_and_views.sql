-- ============================================================
-- Migration 013 — Indexes, Views, and Leaderboards
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- Performance indexes for all common query patterns.
-- Leaderboard views (no separate table — derived from points_ledger).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles (username);  -- case-insensitive lookup via LOWER() already enforced by trigger

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles (role)
  WHERE role IN ('moderator', 'admin');  -- partial: only elevated roles

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON profiles (account_status)
  WHERE account_status <> 'active';     -- partial: only non-active (for moderation queries)

CREATE INDEX IF NOT EXISTS idx_profiles_last_active
  ON profiles (last_active_at DESC);

-- ──────────────────────────────────────────────────────────────
-- user_interests
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id
  ON user_interests (user_id);

-- ──────────────────────────────────────────────────────────────
-- quests
-- ──────────────────────────────────────────────────────────────

-- Published + available quests (primary mobile query pattern)
CREATE INDEX IF NOT EXISTS idx_quests_published_available
  ON quests (quest_type, available_from, available_until)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_quests_type_status
  ON quests (quest_type, status);

CREATE INDEX IF NOT EXISTS idx_quests_available_from
  ON quests (available_from)
  WHERE status IN ('published', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_quests_available_until
  ON quests (available_until)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_quests_slug
  ON quests (slug);

CREATE INDEX IF NOT EXISTS idx_quests_created_by
  ON quests (created_by);

-- ──────────────────────────────────────────────────────────────
-- quest_locations (geo-quest map retrieval)
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quest_locations_quest_id
  ON quest_locations (quest_id);

-- PostGIS spatial index on geofences (private table — for server-side validation queries)
CREATE INDEX IF NOT EXISTS idx_quest_geofences_point
  ON quest_geofences USING GIST (validation_point);

-- ──────────────────────────────────────────────────────────────
-- quest_participations
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qp_user_id
  ON quest_participations (user_id);

CREATE INDEX IF NOT EXISTS idx_qp_quest_id
  ON quest_participations (quest_id);

CREATE INDEX IF NOT EXISTS idx_qp_user_status
  ON quest_participations (user_id, status);

CREATE INDEX IF NOT EXISTS idx_qp_user_quest
  ON quest_participations (user_id, quest_id);  -- duplicate detection

-- ──────────────────────────────────────────────────────────────
-- hunts
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hunts_status_privacy
  ON hunts (status, privacy)
  WHERE status IN ('ready', 'active', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_hunts_creator
  ON hunts (creator_user_id)
  WHERE creator_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hunts_starts_at
  ON hunts (starts_at)
  WHERE status IN ('ready', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_hunts_slug
  ON hunts (slug);

-- ──────────────────────────────────────────────────────────────
-- hunt_participants
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hp_hunt_id
  ON hunt_participants (hunt_id);

CREATE INDEX IF NOT EXISTS idx_hp_user_id
  ON hunt_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_hp_user_status
  ON hunt_participants (user_id, status);

-- ──────────────────────────────────────────────────────────────
-- hunt_invitations
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hi_invitee
  ON hunt_invitations (invitee_user_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_hi_hunt_id
  ON hunt_invitations (hunt_id);

-- ──────────────────────────────────────────────────────────────
-- hunt_stop_geofences (spatial)
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hunt_stop_geofences_point
  ON hunt_stop_geofences USING GIST (validation_point);

-- ──────────────────────────────────────────────────────────────
-- points_ledger
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pl_user_id
  ON points_ledger (user_id);

CREATE INDEX IF NOT EXISTS idx_pl_user_created
  ON points_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pl_transaction_type
  ON points_ledger (transaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pl_idempotency
  ON points_ledger (idempotency_key);  -- unique constraint already creates this, but explicit

-- ──────────────────────────────────────────────────────────────
-- notifications
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;  -- partial: unread only (the primary mobile query)

CREATE INDEX IF NOT EXISTS idx_notif_user_all
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_expires
  ON notifications (expires_at)
  WHERE expires_at IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- reports
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_status_priority
  ON reports (status, priority, created_at DESC)
  WHERE status IN ('submitted', 'triaged', 'under_review');

CREATE INDEX IF NOT EXISTS idx_reports_reporter
  ON reports (reporter_user_id);

-- ──────────────────────────────────────────────────────────────
-- moderation_cases
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mod_cases_status
  ON moderation_cases (status, created_at DESC)
  WHERE status IN ('open', 'under_review');

CREATE INDEX IF NOT EXISTS idx_mod_cases_entity
  ON moderation_cases (entity_type, entity_id);

-- ──────────────────────────────────────────────────────────────
-- media_assets
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_media_owner
  ON media_assets (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_media_moderation
  ON media_assets (moderation_status)
  WHERE moderation_status IN ('pending', 'scanning', 'manual_review');

CREATE INDEX IF NOT EXISTS idx_media_deleted
  ON media_assets (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- Leaderboard views (derived from points_ledger)
-- No separate leaderboard table — views are the source of truth.
-- ──────────────────────────────────────────────────────────────

-- All-time global leaderboard
CREATE OR REPLACE VIEW leaderboard_global AS
SELECT
  upt.user_id,
  pp.username,
  pp.display_name,
  pp.avatar_path,
  upt.total_points,
  RANK() OVER (ORDER BY upt.total_points DESC) AS rank
FROM user_point_totals upt
JOIN public_profiles pp ON pp.id = upt.user_id
JOIN user_settings us ON us.user_id = upt.user_id
WHERE us.leaderboard_visibility = TRUE
ORDER BY upt.total_points DESC;

COMMENT ON VIEW leaderboard_global IS
  'All-time leaderboard. Respects leaderboard_visibility setting. '
  'Paginate in the application layer; do not SELECT * without LIMIT/OFFSET.';

-- Quest-mode leaderboard (quest rewards only)
CREATE OR REPLACE VIEW leaderboard_quest AS
SELECT
  pl.user_id,
  pp.username,
  pp.display_name,
  pp.avatar_path,
  COALESCE(SUM(pl.amount), 0)::INTEGER AS quest_points,
  RANK() OVER (ORDER BY COALESCE(SUM(pl.amount), 0) DESC) AS rank
FROM points_ledger pl
JOIN public_profiles pp ON pp.id = pl.user_id
JOIN user_settings us ON us.user_id = pl.user_id
WHERE pl.transaction_type = 'quest_reward'
  AND us.leaderboard_visibility = TRUE
GROUP BY pl.user_id, pp.username, pp.display_name, pp.avatar_path
ORDER BY quest_points DESC;

-- Hunt-mode leaderboard (hunt rewards only)
CREATE OR REPLACE VIEW leaderboard_hunt AS
SELECT
  pl.user_id,
  pp.username,
  pp.display_name,
  pp.avatar_path,
  COALESCE(SUM(pl.amount), 0)::INTEGER AS hunt_points,
  RANK() OVER (ORDER BY COALESCE(SUM(pl.amount), 0) DESC) AS rank
FROM points_ledger pl
JOIN public_profiles pp ON pp.id = pl.user_id
JOIN user_settings us ON us.user_id = pl.user_id
WHERE pl.transaction_type = 'hunt_reward'
  AND us.leaderboard_visibility = TRUE
GROUP BY pl.user_id, pp.username, pp.display_name, pp.avatar_path
ORDER BY hunt_points DESC;

-- Rolling 30-day leaderboard (recency-weighted for engagement)
CREATE OR REPLACE VIEW leaderboard_monthly AS
SELECT
  pl.user_id,
  pp.username,
  pp.display_name,
  pp.avatar_path,
  COALESCE(SUM(pl.amount), 0)::INTEGER AS period_points,
  RANK() OVER (ORDER BY COALESCE(SUM(pl.amount), 0) DESC) AS rank
FROM points_ledger pl
JOIN public_profiles pp ON pp.id = pl.user_id
JOIN user_settings us ON us.user_id = pl.user_id
WHERE pl.created_at >= NOW() - INTERVAL '30 days'
  AND us.leaderboard_visibility = TRUE
GROUP BY pl.user_id, pp.username, pp.display_name, pp.avatar_path
ORDER BY period_points DESC;

COMMENT ON VIEW leaderboard_monthly IS
  'Rolling 30-day leaderboard. Friends and local leaderboards are deferred to future prompts.';

-- ──────────────────────────────────────────────────────────────
-- Unread notification count function (used by NotificationBell)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM notifications
  WHERE user_id = p_user_id
    AND read_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- Published quest availability function
CREATE OR REPLACE FUNCTION is_quest_available(p_quest quests)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_quest.status = 'published'
    AND (p_quest.available_from IS NULL OR p_quest.available_from <= NOW())
    AND (p_quest.available_until IS NULL OR p_quest.available_until > NOW())
    AND p_quest.archived_at IS NULL;
$$;

COMMENT ON FUNCTION is_quest_available IS
  'Returns true if the quest should be visible to mobile users. '
  'Used in RLS policy and service-layer availability checks.';
