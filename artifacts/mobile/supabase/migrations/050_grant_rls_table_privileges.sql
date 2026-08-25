-- ============================================================
-- Migration 050 — Grant client table privileges behind RLS
-- Worlds — Build 1
-- ============================================================
-- Supabase enforces access in two layers:
--   1. PostgreSQL table privileges decide whether a role can
--      attempt an operation.
--   2. RLS policies decide which rows and changes are permitted.
--
-- Fresh projects normally receive these privileges through the
-- default public-schema setup. This explicit migration makes the
-- contract portable after a scoped schema reset as well.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  target_table RECORD;
BEGIN
  -- Do not grant client roles access to backend-only or system
  -- tables. Tables must explicitly have RLS enabled to qualify.
  FOR target_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated',
      target_table.relname
    );
  END LOOP;
END;
$$;