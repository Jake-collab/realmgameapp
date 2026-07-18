-- Migration 016 — Legal Acceptances
-- Records user acceptance of Terms of Service and Privacy Policy.
-- Append-only: do not UPDATE or DELETE rows. Issue new records for version upgrades.
--
-- Current document versions are placeholders until legal text is finalized.
--   terms_v1_draft   — draft Terms of Service, not final
--   privacy_v1_draft — draft Privacy Policy, not final
-- These must be updated and re-versioned before the app goes to production.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type     TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy')),
  document_version  TEXT NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_ip         INET,                   -- optional; set by server if available
  user_agent        TEXT,                   -- optional; set by client for audit
  UNIQUE (user_id, document_type, document_version)
);

-- Immutability enforcement
CREATE OR REPLACE FUNCTION prevent_legal_acceptance_modification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'legal_acceptances rows are append-only and cannot be modified or deleted.';
END;
$$;

CREATE TRIGGER trg_no_legal_acceptance_update
  BEFORE UPDATE ON legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION prevent_legal_acceptance_modification();

CREATE TRIGGER trg_no_legal_acceptance_delete
  BEFORE DELETE ON legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION prevent_legal_acceptance_modification();

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_id
  ON legal_acceptances(user_id);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_type
  ON legal_acceptances(user_id, document_type);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can insert their own acceptance records
CREATE POLICY "legal_acceptances_insert_own"
  ON legal_acceptances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own records
CREATE POLICY "legal_acceptances_select_own"
  ON legal_acceptances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No UPDATE or DELETE policies (enforced by triggers above)

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE legal_acceptances IS
  'Append-only record of user acceptance of Terms of Service and Privacy Policy. '
  'Current versions (terms_v1_draft, privacy_v1_draft) are placeholders. '
  'When final legal text is approved, increment to terms_v1 and privacy_v1 and '
  'present updated documents to existing users.';

COMMENT ON COLUMN legal_acceptances.document_version IS
  'Versioned identifier for the document. Placeholder: terms_v1_draft, privacy_v1_draft.';
