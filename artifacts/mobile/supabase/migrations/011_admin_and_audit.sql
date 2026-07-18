-- ============================================================
-- Migration 011 — Admin Operations and Audit Logs
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- moderation_cases  : content moderation records
-- audit_logs        : append-only administrative action history
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- moderation_cases
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS moderation_cases (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic entity
  entity_type             TEXT NOT NULL,
    -- user_profile | quest | hunt | custom_game | proof | media | hunt_stop
  entity_id               UUID NOT NULL,
  status                  moderation_case_status NOT NULL DEFAULT 'open',
  -- Automated provider (future — not connected in this prompt)
  automated_provider      TEXT,       -- aws_rekognition | openai_moderation | etc.
  automated_result        JSONB,      -- raw provider response snapshot
  risk_categories         TEXT[],     -- e.g. ['adult', 'violence', 'spam']
  risk_score              NUMERIC(5,4), -- 0.0000 – 1.0000
  -- Human review
  moderator_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  moderator_notes         TEXT,
  decision                TEXT,
    -- no_action | warning | content_removed | account_restricted | account_suspended
  decision_reason         TEXT,
  -- Appeal architecture (future)
  appeal_submitted_at     TIMESTAMPTZ,
  appeal_resolved_at      TIMESTAMPTZ,
  appeal_outcome          TEXT,       -- upheld | overturned
  -- Source report (if triggered by a user report)
  source_report_id        UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entity_type_valid CHECK (entity_type IN (
    'user_profile', 'quest', 'hunt', 'custom_game', 'proof', 'media', 'hunt_stop'
  )),
  CONSTRAINT decision_valid CHECK (decision IS NULL OR decision IN (
    'no_action', 'warning', 'content_removed', 'account_restricted', 'account_suspended'
  ))
);

COMMENT ON TABLE moderation_cases IS
  'Content and user moderation records. Third-party automated providers are '
  'architecture-ready but not connected in this prompt. '
  'appeal fields are reserved for future appeal workflow.';

COMMENT ON COLUMN moderation_cases.automated_result IS
  'Raw snapshot of the automated moderation provider response. '
  'Do NOT store full proof files or sensitive content here.';

CREATE TRIGGER trg_moderation_cases_updated_at
  BEFORE UPDATE ON moderation_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- audit_logs  (append-only)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- NULL for system-generated events
  actor_role      user_role,
  action          TEXT NOT NULL,
    -- e.g. role_changed, account_suspended, quest_published, points_adjusted
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  before_snapshot JSONB,
    -- MUST NOT contain secrets, passwords, proof file URLs, or PII beyond identifiers
  after_snapshot  JSONB,
  metadata        JSONB,
    -- e.g. {"ip": "...", "request_id": "..."} — only when available server-side
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS
  'Append-only administrative action history. '
  'No ordinary user may SELECT rows. Authorized staff have read-only access. '
  'Trusted backend inserts only (service_role). '
  'Do NOT store secrets, passwords, full proof files, or tokens here.';

COMMENT ON COLUMN audit_logs.before_snapshot IS
  'Previous state snapshot. Include only identifying fields and changed values. '
  'Never include credentials, session tokens, or full proof media URLs.';

COMMENT ON COLUMN audit_logs.action IS
  'Audited action categories: role_changed | account_suspended | account_restricted | '
  'quest_published | quest_rejected | hunt_published | proof_approved | proof_rejected | '
  'points_adjusted | content_removed | moderation_decision';

-- Prevent anyone from mutating audit records
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are immutable and append-only.';
END;
$$;

CREATE TRIGGER trg_no_audit_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER trg_no_audit_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- Convenience function for inserting audit log entries (server-side use)
CREATE OR REPLACE FUNCTION log_admin_action(
  p_actor_id    UUID,
  p_actor_role  user_role,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_before      JSONB DEFAULT NULL,
  p_after       JSONB DEFAULT NULL,
  p_metadata    JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id,
                          before_snapshot, after_snapshot, metadata)
  VALUES (p_actor_id, p_actor_role, p_action, p_entity_type, p_entity_id,
          p_before, p_after, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION log_admin_action IS
  'SECURITY DEFINER. Call from server-side code only. '
  'Validate inputs before calling. Restrict EXECUTE to service_role.';

REVOKE ALL ON FUNCTION log_admin_action FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_admin_action TO service_role;
