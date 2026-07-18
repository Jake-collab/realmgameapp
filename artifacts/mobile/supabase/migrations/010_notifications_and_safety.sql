-- ============================================================
-- Migration 010 — Notifications, Reports, Blocks
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- notifications  : in-app notification records
-- reports        : user safety reports (flexible entity targets)
-- user_blocks    : block relationships between users
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- notifications
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,          -- structured payload for deep linking / UI rendering
  deep_link   TEXT,           -- worlds://... URL for in-app navigation
  read_at     TIMESTAMPTZ,    -- NULL = unread
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,

  CONSTRAINT title_length CHECK (char_length(title) <= 100),
  CONSTRAINT body_length CHECK (char_length(body) <= 500)
);

COMMENT ON TABLE notifications IS
  'In-app notification records. Owner-only via RLS. '
  'System-created only — users cannot insert arbitrary notifications. '
  'Push notification delivery is out of scope for this prompt.';

COMMENT ON COLUMN notifications.data IS
  'Structured payload for the notification. Example: '
  '{"quest_id": "...", "quest_title": "...", "points": 150}';

-- ──────────────────────────────────────────────────────────────
-- reports  (user safety)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  -- Polymorphic target
  entity_type           reportable_entity NOT NULL,
  entity_id             UUID NOT NULL,
  -- Report content
  reason                TEXT NOT NULL,
  description           TEXT,
  evidence_media_id     UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  -- Moderation workflow
  status                report_status NOT NULL DEFAULT 'submitted',
  priority              report_priority NOT NULL DEFAULT 'medium',
  assigned_moderator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes      TEXT,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reports IS
  'User safety reports against any reportable entity type. '
  'reporter_user_id is NEVER exposed to the reported user. '
  'Moderators and admins access via service_role; '
  'reporters may only read their own report status.';

COMMENT ON COLUMN reports.reporter_user_id IS
  'Reporter identity. Protected by RLS — reported users cannot query this column.';

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- user_blocks
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (blocker_user_id, blocked_user_id),

  -- Prevent self-blocking
  CONSTRAINT no_self_block CHECK (blocker_user_id <> blocked_user_id)
);

COMMENT ON TABLE user_blocks IS
  'Block relationships. Composite PK prevents duplicates. '
  'Blocked users cannot invite each other or view restricted profile content. '
  'Service layer enforces block checks on: invitations, profile views, future social features. '
  'Chat is out of scope.';

-- Helper function: check if user A has blocked user B (or vice versa)
CREATE OR REPLACE FUNCTION are_users_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_user_id = p_user_a AND blocked_user_id = p_user_b)
       OR (blocker_user_id = p_user_b AND blocked_user_id = p_user_a)
  );
$$;

COMMENT ON FUNCTION are_users_blocked IS
  'Returns true if either user has blocked the other. '
  'Used by invitation and profile service logic.';
