-- ============================================================
-- Migration 028 — Moderation and Integrity Hardening
-- Worlds — Build 1, Prompt 20
-- ============================================================
-- Extends the existing media, proof, reports, moderation-case, and audit
-- architecture. Provider payloads and risk details remain staff-only.

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS moderation_provider TEXT,
  ADD COLUMN IF NOT EXISTS moderation_model TEXT,
  ADD COLUMN IF NOT EXISTS moderation_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_categories JSONB,
  ADD COLUMN IF NOT EXISTS moderation_policy_version TEXT,
  ADD COLUMN IF NOT EXISTS moderation_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS moderation_reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE proof_submissions
  ADD COLUMN IF NOT EXISTS moderation_provider TEXT,
  ADD COLUMN IF NOT EXISTS moderation_model TEXT,
  ADD COLUMN IF NOT EXISTS moderation_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_categories JSONB,
  ADD COLUMN IF NOT EXISTS moderation_policy_version TEXT,
  ADD COLUMN IF NOT EXISTS moderation_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS integrity_risk_snapshot_id UUID;

ALTER TABLE moderation_cases
  ADD COLUMN IF NOT EXISTS moderation_policy_version TEXT,
  ADD COLUMN IF NOT EXISTS moderation_decision TEXT,
  ADD COLUMN IF NOT EXISTS moderation_user_visible_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_internal_reason TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_cases_idempotency
  ON moderation_cases (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS moderation_policy_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version           TEXT NOT NULL UNIQUE,
  effective_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  configuration     JSONB NOT NULL,
  change_reason     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrity_policy_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version           TEXT NOT NULL UNIQUE,
  effective_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  configuration     JSONB NOT NULL,
  change_reason     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrity_risk_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type           TEXT NOT NULL,
  entity_id             UUID NOT NULL,
  policy_version        TEXT NOT NULL,
  score                 INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  risk_band             TEXT NOT NULL CHECK (risk_band IN ('low', 'elevated', 'medium', 'high', 'critical')),
  signal_ids            TEXT[] NOT NULL DEFAULT '{}',
  recommended_action    TEXT NOT NULL,
  requires_review       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enforcement_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type           TEXT NOT NULL,
  entity_id             UUID,
  action                TEXT NOT NULL,
  user_visible_reason   TEXT NOT NULL,
  eligible_for_appeal  BOOLEAN NOT NULL DEFAULT FALSE,
  appeal_status         TEXT NOT NULL DEFAULT 'not_started',
  created_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrity_snapshots_entity
  ON integrity_risk_snapshots (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_events_user
  ON enforcement_events (user_id, created_at DESC);

COMMENT ON COLUMN media_assets.content_hash IS
  'Server-computed hash for idempotency and duplicate signals; never expose publicly.';
COMMENT ON COLUMN proof_submissions.moderation_review_required IS
  'Safety review state is separate from proof_submissions.status, which represents proof validity.';
COMMENT ON TABLE integrity_risk_snapshots IS
  'Immutable risk snapshots. Future policy changes must not rewrite historical scores.';