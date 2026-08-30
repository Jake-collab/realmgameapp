-- ============================================================
-- Migration 067 — Restore trusted retention-cleanup table access
-- Worlds — Build 1
-- ============================================================
-- Migration 057 created this RLS-protected worker table and attempted to
-- grant service_role access. The linked project has the table but not the
-- recorded grant, so trusted moderation and retention checks fail at the
-- PostgREST table boundary. Restore the minimum worker/test access without
-- changing the client-facing RLS boundary.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.media_retention_cleanups
TO service_role;