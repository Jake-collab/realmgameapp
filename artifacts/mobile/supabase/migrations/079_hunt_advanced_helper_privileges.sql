-- Migration 079: close public execution on advanced Hunt helper functions
--
-- Migration 078 introduced SECURITY DEFINER helpers that are only intended to
-- be called by the creator lifecycle and participant-authorized wrapper RPCs.
-- PostgreSQL grants EXECUTE to PUBLIC by default when a function is created.
-- Keep these helpers callable by their definer-owned functions, but not
-- directly by anonymous or authenticated clients.

REVOKE ALL ON FUNCTION public.assert_hunt_dependency_graph_acyclic(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_advanced_hunt_config(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_advanced_hunt_config(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_creator_hunt_stops(UUID, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_hunt_reveals(UUID)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.apply_advanced_hunt_config(UUID, JSONB) IS
  'Internal creator lifecycle helper. Direct client execution is prohibited; use secure creator RPCs.';

COMMENT ON FUNCTION public.refresh_hunt_reveals(UUID) IS
  'Internal participant reveal helper. Direct client execution is prohibited; use authorized Hunt state RPCs.';