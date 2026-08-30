-- Migration 058 — Allow trusted worker queue-health reads.
--
-- The scheduler claim/completion RPCs are SECURITY DEFINER, but the worker's
-- queueHealth() diagnostic intentionally reads these tables through PostgREST.
-- Keep this grant limited to the three queue tables and the trusted role.

GRANT SELECT ON TABLE
  notification_events,
  scheduled_notifications,
  notification_deliveries
TO service_role;