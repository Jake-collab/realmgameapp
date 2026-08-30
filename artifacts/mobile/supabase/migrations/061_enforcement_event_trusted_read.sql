-- ============================================================
-- Migration 061 — Trusted enforcement-event reads
-- Worlds — Build 1
-- ============================================================
-- Enforcement events remain append-only for trusted REST access. The
-- previous RLS migration granted the write needed by trusted enforcement
-- workflows; this adds the minimum read privilege required by trusted
-- moderation/admin inspection.
-- ============================================================

GRANT SELECT ON TABLE enforcement_events TO service_role;