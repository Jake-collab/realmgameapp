-- ============================================================
-- Migration 054 — Restore trusted service-role table privileges
-- Worlds — First Super Admin bootstrap
-- ============================================================
-- A scoped public-schema reset removes explicit table privileges.
-- service_role bypasses RLS, but it still needs PostgreSQL table
-- privileges for the API server's trusted access path.
--
-- Keep backend access limited to application tables that explicitly
-- use RLS. Tables without RLS remain inaccessible unless a later
-- migration grants them intentionally.
-- ============================================================

DO $$
DECLARE
  target_table RECORD;
BEGIN
  FOR target_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',
      target_table.relname
    );
  END LOOP;
END
$$;

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;