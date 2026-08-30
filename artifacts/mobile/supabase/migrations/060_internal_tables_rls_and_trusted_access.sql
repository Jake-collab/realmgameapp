-- ============================================================
-- Migration 060 — Internal queue and moderation table RLS
-- Worlds — Build 1
-- ============================================================
-- These tables contain worker queues, moderation/integrity evidence, and
-- internal policy configuration. They are not client-facing data.
--
-- RLS is enabled with no anon/authenticated policies. Trusted server access
-- is granted explicitly below, with append-only privileges for immutable
-- moderation/integrity records.
-- ============================================================

ALTER TABLE enforcement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_risk_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  enforcement_events,
  integrity_policy_versions,
  integrity_risk_snapshots,
  moderation_policy_versions,
  notification_deliveries,
  notification_events,
  scheduled_notifications
FROM PUBLIC, anon, authenticated;

-- The worker reads queue state directly for health diagnostics. Queue
-- mutations remain behind service_role-only SECURITY DEFINER RPCs.
GRANT SELECT ON TABLE
  notification_deliveries,
  notification_events,
  scheduled_notifications
TO service_role;

-- Moderation and integrity records are internal and append-only. Policy
-- versions are read by trusted policy evaluation and inserted by trusted
-- administrative workflows; historical records are not mutable by REST.
GRANT INSERT ON TABLE enforcement_events TO service_role;
GRANT SELECT, INSERT ON TABLE integrity_policy_versions TO service_role;
GRANT SELECT, INSERT ON TABLE integrity_risk_snapshots TO service_role;
GRANT SELECT, INSERT ON TABLE moderation_policy_versions TO service_role;