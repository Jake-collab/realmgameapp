-- Migration 073 — Restore trusted revenue worker access
--
-- Revenue tables were created after the project's earlier service-role grant
-- loop. RLS bypass alone does not provide PostgreSQL table privileges, so the
-- trusted API and provider-event workers need explicit access.

GRANT ALL ON TABLE
  membership_plans,
  membership_entitlements,
  membership_entitlement_events,
  revenue_allowance_periods,
  revenue_allowance_consumptions,
  drop_credit_packs,
  drop_credit_ledger,
  drop_creation_consumptions,
  hunt_drop_commerce,
  collectibles,
  hunt_drop_finds,
  find_badges,
  collectible_ownership,
  marketplace_orders,
  marketplace_transaction_events,
  seller_profiles,
  seller_balance_ledger,
  revenue_configuration,
  revenue_audit_events,
  revenue_external_events,
  revenue_configuration_history,
  revenue_allowance_catalog,
  paid_collectible_fee_acknowledgements
TO service_role;