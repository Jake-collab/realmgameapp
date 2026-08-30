-- Migration 071 — Provider-neutral membership, allowances, Drops, and collectibles
-- Worlds — Stage 2 revenue core
--
-- This migration deliberately extends the canonical hunt_stops model. It does
-- not create a hunt_drops table, change Quest/Hunt point ledgers, or bypass the
-- existing location/session verification in collect_hunt_drop.

CREATE TABLE IF NOT EXISTS membership_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  billing_cadence TEXT NOT NULL CHECK (billing_cadence IN ('free', 'monthly', 'yearly')),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO membership_plans (code, name, billing_cadence, price_minor, currency)
VALUES
  ('free', 'Free', 'free', 0, 'USD'),
  ('worlds_monthly', 'Worlds Membership', 'monthly', 499, 'USD'),
  ('worlds_yearly', 'Worlds Membership', 'yearly', 4499, 'USD')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  billing_cadence = EXCLUDED.billing_cadence,
  price_minor = EXCLUDED.price_minor,
  currency = EXCLUDED.currency,
  is_active = TRUE;

CREATE TABLE IF NOT EXISTS membership_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
  plan_code TEXT NOT NULL REFERENCES membership_plans(code),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'paused')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  provider_name TEXT,
  provider_entitlement_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS membership_entitlement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID REFERENCES membership_entitlements(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('granted', 'upgraded', 'downgraded', 'renewed', 'canceled', 'expired', 'paused', 'resumed', 'reversed')),
  from_plan_code TEXT,
  to_plan_code TEXT REFERENCES membership_plans(code),
  provider_name TEXT,
  provider_event_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS revenue_allowance_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  allowance_kind TEXT NOT NULL CHECK (allowance_kind IN ('quest_monthly', 'quest_geo_weekly', 'quest_personalized_daily', 'hunt_drop_creation_weekly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  allowance_limit INTEGER NOT NULL CHECK (allowance_limit >= 0),
  consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed >= 0 AND consumed <= allowance_limit),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, allowance_kind, period_start)
);

CREATE TABLE IF NOT EXISTS revenue_allowance_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  period_id UUID NOT NULL REFERENCES revenue_allowance_periods(id) ON DELETE RESTRICT,
  allowance_kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drop_credit_packs (
  code TEXT PRIMARY KEY,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_minor INTEGER NOT NULL CHECK (price_minor > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO drop_credit_packs (code, credits, price_minor, currency)
VALUES
  ('drop_credits_5', 5, 199, 'USD'),
  ('drop_credits_15', 15, 499, 'USD'),
  ('drop_credits_35', 35, 999, 'USD')
ON CONFLICT (code) DO UPDATE SET
  credits = EXCLUDED.credits,
  price_minor = EXCLUDED.price_minor,
  currency = EXCLUDED.currency,
  is_active = TRUE;

CREATE TABLE IF NOT EXISTS drop_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('grant', 'consume', 'reversal', 'admin_adjustment')),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_name TEXT,
  provider_event_id TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drop_creation_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('included_weekly', 'extra_credit')),
  period_id UUID REFERENCES revenue_allowance_periods(id) ON DELETE RESTRICT,
  credit_ledger_id UUID REFERENCES drop_credit_ledger(id) ON DELETE RESTRICT,
  created_hunt_id UUID REFERENCES hunts(id) ON DELETE RESTRICT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunt_drop_commerce (
  hunt_stop_id UUID PRIMARY KEY REFERENCES hunt_stops(id) ON DELETE RESTRICT,
  find_limit INTEGER CHECK (find_limit IS NULL OR find_limit > 0),
  find_count INTEGER NOT NULL DEFAULT 0 CHECK (find_count >= 0),
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  collectible_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collectibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id UUID NOT NULL UNIQUE REFERENCES hunt_stops(id) ON DELETE RESTRICT,
  creator_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT,
  image_media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
  acquired_count INTEGER NOT NULL DEFAULT 0 CHECK (acquired_count >= 0),
  rarity TEXT NOT NULL CHECK (rarity IN ('UNIQUE', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON')),
  sale_status TEXT NOT NULL DEFAULT 'active' CHECK (sale_status IN ('draft', 'active', 'sold_out', 'deactivated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (quantity IS NULL OR acquired_count <= quantity),
  CHECK (price_minor = 0 OR price_minor >= 100)
);

ALTER TABLE hunt_drop_commerce
  DROP CONSTRAINT IF EXISTS hunt_drop_commerce_collectible_id_fkey;
ALTER TABLE hunt_drop_commerce
  ADD CONSTRAINT hunt_drop_commerce_collectible_id_fkey
  FOREIGN KEY (collectible_id) REFERENCES collectibles(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS hunt_drop_finds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  hunt_drop_collection_id UUID NOT NULL UNIQUE REFERENCES hunt_drop_collections(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hunt_stop_id, user_id)
);

CREATE TABLE IF NOT EXISTS find_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  hunt_stop_id UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE RESTRICT,
  find_id UUID NOT NULL UNIQUE REFERENCES hunt_drop_finds(id) ON DELETE RESTRICT,
  drop_title_snapshot TEXT NOT NULL,
  creator_name_snapshot TEXT,
  collectible_name_snapshot TEXT,
  rarity_snapshot TEXT CHECK (rarity_snapshot IS NULL OR rarity_snapshot IN ('UNIQUE', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON')),
  found_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, hunt_stop_id)
);

CREATE TABLE IF NOT EXISTS collectible_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collectible_id UUID NOT NULL REFERENCES collectibles(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  acquisition_type TEXT NOT NULL CHECK (acquisition_type IN ('free_claim', 'purchase')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'refunded', 'reversed')),
  order_id UUID,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (collectible_id, user_id)
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  seller_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  collectible_id UUID NOT NULL REFERENCES collectibles(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  gross_minor INTEGER NOT NULL CHECK (gross_minor > 0),
  platform_fee_minor INTEGER NOT NULL CHECK (platform_fee_minor >= 0),
  intended_seller_share_minor INTEGER NOT NULL CHECK (intended_seller_share_minor >= 0),
  processing_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (processing_fee_minor >= 0),
  app_store_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (app_store_fee_minor >= 0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  seller_payable_minor INTEGER NOT NULL DEFAULT 0 CHECK (seller_payable_minor >= 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'finalized', 'refunded', 'partially_refunded', 'charged_back', 'reversed', 'failed')),
  provider_name TEXT,
  provider_transaction_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  CHECK (platform_fee_minor + intended_seller_share_minor = gross_minor)
);

ALTER TABLE collectible_ownership
  DROP CONSTRAINT IF EXISTS collectible_ownership_order_id_fkey;
ALTER TABLE collectible_ownership
  ADD CONSTRAINT collectible_ownership_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES marketplace_orders(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS marketplace_transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('intent_created', 'finalized', 'refund', 'partial_refund', 'chargeback', 'dispute', 'reversal', 'payout')),
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  provider_name TEXT,
  provider_event_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE RESTRICT,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started', 'pending', 'verified', 'restricted', 'disabled')),
  provider_name TEXT,
  provider_account_id TEXT,
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_balance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  event_type TEXT NOT NULL CHECK (event_type IN ('sale', 'refund', 'chargeback', 'payout', 'adjustment')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_configuration (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO revenue_configuration (key, value)
VALUES
  ('platform_fee_percent', '{"basis_points":3000}'::JSONB),
  ('paid_collectible_price_limits', '{"minimum_minor":100,"maximum_minor":100000}'::JSONB),
  ('collectible_rarity_thresholds', '{"UNIQUE":1,"LEGENDARY":5,"EPIC":20,"RARE":50,"UNCOMMON":100}'::JSONB)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS revenue_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subject_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  event_type TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_allowance_owner_period
  ON revenue_allowance_periods(user_id, allowance_kind, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_drop_credit_ledger_owner
  ON drop_credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hunt_drop_commerce_active
  ON hunt_drop_commerce(hunt_stop_id, find_count, deactivated_at);
CREATE INDEX IF NOT EXISTS idx_find_badges_owner
  ON find_badges(user_id, found_at DESC);
CREATE INDEX IF NOT EXISTS idx_collectible_ownership_owner
  ON collectible_ownership(user_id, acquired_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_reconciliation
  ON marketplace_orders(provider_name, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_provider_transaction_once
  ON marketplace_orders(provider_name, provider_transaction_id)
  WHERE provider_name IS NOT NULL AND provider_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_provider_event_once
  ON marketplace_transaction_events(provider_name, provider_event_id)
  WHERE provider_name IS NOT NULL AND provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_revenue_audit_subject
  ON revenue_audit_events(subject_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION revenue_prevent_history_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'immutable_revenue_history';
END;
$$;

DROP TRIGGER IF EXISTS trg_drop_credit_ledger_immutable ON drop_credit_ledger;
CREATE TRIGGER trg_drop_credit_ledger_immutable
  BEFORE UPDATE OR DELETE ON drop_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_membership_events_immutable ON membership_entitlement_events;
CREATE TRIGGER trg_membership_events_immutable
  BEFORE UPDATE OR DELETE ON membership_entitlement_events
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_find_badges_immutable ON find_badges;
CREATE TRIGGER trg_find_badges_immutable
  BEFORE UPDATE OR DELETE ON find_badges
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_finds_immutable ON hunt_drop_finds;
CREATE TRIGGER trg_finds_immutable
  BEFORE UPDATE OR DELETE ON hunt_drop_finds
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_marketplace_events_immutable ON marketplace_transaction_events;
CREATE TRIGGER trg_marketplace_events_immutable
  BEFORE UPDATE OR DELETE ON marketplace_transaction_events
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_seller_ledger_immutable ON seller_balance_ledger;
CREATE TRIGGER trg_seller_ledger_immutable
  BEFORE UPDATE OR DELETE ON seller_balance_ledger
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_revenue_audit_immutable ON revenue_audit_events;
CREATE TRIGGER trg_revenue_audit_immutable
  BEFORE UPDATE OR DELETE ON revenue_audit_events
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_entitlement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_allowance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_allowance_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_creation_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_commerce ENABLE ROW LEVEL SECURITY;
ALTER TABLE collectibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_finds ENABLE ROW LEVEL SECURITY;
ALTER TABLE find_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE collectible_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_transaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_balance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE membership_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE membership_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE membership_entitlement_events FORCE ROW LEVEL SECURITY;
ALTER TABLE revenue_allowance_periods FORCE ROW LEVEL SECURITY;
ALTER TABLE revenue_allowance_consumptions FORCE ROW LEVEL SECURITY;
ALTER TABLE drop_credit_packs FORCE ROW LEVEL SECURITY;
ALTER TABLE drop_credit_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE drop_creation_consumptions FORCE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_commerce FORCE ROW LEVEL SECURITY;
ALTER TABLE collectibles FORCE ROW LEVEL SECURITY;
ALTER TABLE hunt_drop_finds FORCE ROW LEVEL SECURITY;
ALTER TABLE find_badges FORCE ROW LEVEL SECURITY;
ALTER TABLE collectible_ownership FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace_transaction_events FORCE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE seller_balance_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE revenue_configuration FORCE ROW LEVEL SECURITY;
ALTER TABLE revenue_audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  membership_plans, membership_entitlements, membership_entitlement_events,
  revenue_allowance_periods, revenue_allowance_consumptions, drop_credit_packs,
  drop_credit_ledger, drop_creation_consumptions, hunt_drop_commerce, collectibles,
  hunt_drop_finds, find_badges, collectible_ownership, marketplace_orders,
  marketplace_transaction_events, seller_profiles, seller_balance_ledger,
  revenue_configuration, revenue_audit_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON membership_plans, drop_credit_packs TO authenticated;
GRANT SELECT ON membership_entitlements, revenue_allowance_periods, drop_credit_ledger,
  membership_entitlement_events, revenue_allowance_consumptions, drop_creation_consumptions,
  find_badges, collectible_ownership, marketplace_orders, seller_profiles, seller_balance_ledger
TO authenticated;

CREATE POLICY membership_plans_catalog_read ON membership_plans
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY drop_credit_packs_catalog_read ON drop_credit_packs
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY membership_entitlements_owner_read ON membership_entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY membership_events_owner_read ON membership_entitlement_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY allowance_owner_read ON revenue_allowance_periods
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY allowance_consumption_owner_read ON revenue_allowance_consumptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY credits_owner_read ON drop_credit_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY drop_creation_owner_read ON drop_creation_consumptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY find_badges_owner_read ON find_badges
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ownership_owner_read ON collectible_ownership
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY orders_buyer_owner_read ON marketplace_orders
  FOR SELECT TO authenticated USING (buyer_user_id = auth.uid());
CREATE POLICY seller_owner_read ON seller_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY seller_ledger_owner_read ON seller_balance_ledger
  FOR SELECT TO authenticated USING (seller_user_id = auth.uid());

CREATE OR REPLACE FUNCTION revenue_plan_for_user(p_user_id UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT e.plan_code
    FROM membership_entitlements e
    WHERE e.user_id = p_user_id
      AND e.status = 'active'
      AND (e.ends_at IS NULL OR e.ends_at > NOW())
    ORDER BY e.updated_at DESC
    LIMIT 1
  ), 'free');
$$;

CREATE OR REPLACE FUNCTION revenue_allowance_limit(p_plan_code TEXT, p_kind TEXT)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN p_kind = 'quest_monthly' AND p_plan_code = 'free' THEN 10
    WHEN p_kind = 'quest_monthly' THEN 50
    WHEN p_kind = 'quest_geo_weekly' AND p_plan_code = 'free' THEN 1
    WHEN p_kind = 'quest_geo_weekly' THEN 2
    WHEN p_kind = 'quest_personalized_daily' AND p_plan_code = 'free' THEN 1
    WHEN p_kind = 'quest_personalized_daily' THEN 1
    WHEN p_kind = 'hunt_drop_creation_weekly' AND p_plan_code = 'free' THEN 2
    WHEN p_kind = 'hunt_drop_creation_weekly' THEN 5
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION revenue_period_bounds(p_kind TEXT, p_plan_code TEXT)
RETURNS TABLE (period_start TIMESTAMPTZ, period_end TIMESTAMPTZ)
LANGUAGE SQL STABLE AS $$
  SELECT
    CASE
      WHEN p_kind IN ('quest_geo_weekly', 'hunt_drop_creation_weekly')
        OR (p_kind = 'quest_personalized_daily' AND p_plan_code = 'free')
        THEN date_trunc('week', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      WHEN p_kind = 'quest_monthly'
        THEN date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      WHEN p_kind = 'quest_personalized_daily'
        THEN date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    END,
    CASE
      WHEN p_kind IN ('quest_geo_weekly', 'hunt_drop_creation_weekly')
        OR (p_kind = 'quest_personalized_daily' AND p_plan_code = 'free')
        THEN (date_trunc('week', NOW() AT TIME ZONE 'UTC') + INTERVAL '7 days') AT TIME ZONE 'UTC'
      WHEN p_kind = 'quest_monthly'
        THEN (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC'
      WHEN p_kind = 'quest_personalized_daily'
        THEN (date_trunc('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day') AT TIME ZONE 'UTC'
    END;
$$;

CREATE OR REPLACE FUNCTION revenue_ensure_period(p_user_id UUID, p_kind TEXT)
RETURNS revenue_allowance_periods
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bounds RECORD;
  v_period revenue_allowance_periods;
  v_plan_code TEXT;
BEGIN
  IF p_kind NOT IN ('quest_monthly', 'quest_geo_weekly', 'quest_personalized_daily', 'hunt_drop_creation_weekly') THEN
    RAISE EXCEPTION 'invalid_allowance_kind';
  END IF;
  v_plan_code := revenue_plan_for_user(p_user_id);
  SELECT * INTO v_bounds FROM revenue_period_bounds(p_kind, v_plan_code);
  INSERT INTO revenue_allowance_periods (user_id, allowance_kind, period_start, period_end, allowance_limit)
  VALUES (p_user_id, p_kind, v_bounds.period_start, v_bounds.period_end,
    revenue_allowance_limit(v_plan_code, p_kind))
  ON CONFLICT (user_id, allowance_kind, period_start)
  -- Upgrades raise the current ceiling. Downgrades never erase or invalidate
  -- usage; the lower ceiling begins when the next server-owned period resolves.
  DO UPDATE SET allowance_limit = GREATEST(revenue_allowance_periods.allowance_limit, EXCLUDED.allowance_limit)
  RETURNING * INTO v_period;
  RETURN v_period;
END;
$$;

CREATE OR REPLACE FUNCTION apply_membership_entitlement(
  p_user_id UUID, p_plan_code TEXT, p_status TEXT, p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ, p_idempotency_key TEXT, p_provider_name TEXT DEFAULT NULL,
  p_provider_entitlement_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_previous membership_entitlements; v_entitlement membership_entitlements;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'trusted_revenue_actor_required'; END IF;
  IF p_plan_code NOT IN ('worlds_monthly', 'worlds_yearly') OR p_status NOT IN ('active', 'canceled', 'expired', 'paused') THEN
    RAISE EXCEPTION 'invalid_membership_entitlement';
  END IF;
  IF EXISTS (SELECT 1 FROM membership_entitlement_events WHERE idempotency_key = p_idempotency_key) THEN
    SELECT * INTO v_entitlement FROM membership_entitlements WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true, 'entitlementId', v_entitlement.id);
  END IF;
  SELECT * INTO v_previous FROM membership_entitlements WHERE user_id = p_user_id FOR UPDATE;
  INSERT INTO membership_entitlements (user_id, plan_code, status, starts_at, ends_at, provider_name, provider_entitlement_id)
  VALUES (p_user_id, p_plan_code, p_status, p_starts_at, p_ends_at, p_provider_name, p_provider_entitlement_id)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code, status = EXCLUDED.status, starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at, provider_name = EXCLUDED.provider_name,
    provider_entitlement_id = EXCLUDED.provider_entitlement_id, updated_at = NOW()
  RETURNING * INTO v_entitlement;
  INSERT INTO membership_entitlement_events (
    entitlement_id, user_id, event_type, from_plan_code, to_plan_code,
    provider_name, idempotency_key
  ) VALUES (
    v_entitlement.id, p_user_id,
    CASE WHEN p_status = 'active' AND v_previous.id IS NULL THEN 'granted'
         WHEN p_status = 'active' AND v_previous.status <> 'active' THEN 'resumed'
         WHEN p_status = 'canceled' THEN 'canceled'
         WHEN p_status = 'expired' THEN 'expired'
         WHEN p_status = 'paused' THEN 'paused'
         WHEN v_previous.plan_code IS DISTINCT FROM p_plan_code THEN 'upgraded'
         ELSE 'renewed' END,
    v_previous.plan_code, p_plan_code, p_provider_name, p_idempotency_key
  );
  INSERT INTO revenue_audit_events (actor_user_id, subject_user_id, entity_type, entity_id, event_type, idempotency_key, details)
  VALUES (auth.uid(), p_user_id, 'membership_entitlement', v_entitlement.id, p_status, 'audit:' || p_idempotency_key,
    jsonb_build_object('planCode', p_plan_code));
  RETURN jsonb_build_object('success', true, 'alreadyApplied', false, 'entitlementId', v_entitlement.id);
END;
$$;

CREATE OR REPLACE FUNCTION get_my_revenue_summary()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_plan TEXT;
  v_member RECORD;
  v_allowances JSONB := '[]'::JSONB;
  v_credits INTEGER;
  v_kind TEXT;
  v_period revenue_allowance_periods;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_plan := revenue_plan_for_user(v_user_id);
  SELECT * INTO v_member FROM membership_plans WHERE code = v_plan;
  FOR v_kind IN SELECT unnest(ARRAY['quest_monthly', 'quest_geo_weekly', 'quest_personalized_daily', 'hunt_drop_creation_weekly']) LOOP
    v_period := revenue_ensure_period(v_user_id, v_kind);
    v_allowances := v_allowances || jsonb_build_array(jsonb_build_object(
      'kind', v_kind, 'periodStart', v_period.period_start, 'periodEnd', v_period.period_end,
      'limit', v_period.allowance_limit, 'used', v_period.consumed,
      'remaining', GREATEST(0, v_period.allowance_limit - v_period.consumed)
    ));
  END LOOP;
  SELECT COALESCE(SUM(quantity_delta), 0) INTO v_credits FROM drop_credit_ledger WHERE user_id = v_user_id;
  RETURN jsonb_build_object(
    'planCode', v_plan, 'planName', v_member.name, 'membershipPriceMinor', v_member.price_minor,
    'membershipCurrency', v_member.currency, 'allowances', v_allowances,
    'extraDropCredits', GREATEST(0, v_credits),
    'statistics', jsonb_build_object(
      'dropsFound', (SELECT COUNT(*) FROM hunt_drop_finds WHERE user_id = v_user_id),
      'findBadgesEarned', (SELECT COUNT(*) FROM find_badges WHERE user_id = v_user_id),
      'collectiblesAcquired', (SELECT COUNT(*) FROM collectible_ownership WHERE user_id = v_user_id AND status = 'active'),
      'dropsCreated', (SELECT COUNT(*) FROM drop_creation_consumptions WHERE user_id = v_user_id AND created_hunt_id IS NOT NULL)
    ),
    'findBadges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', badge.id, 'dropTitle', badge.drop_title_snapshot,
        'creatorName', badge.creator_name_snapshot, 'collectibleName', badge.collectible_name_snapshot,
        'rarity', badge.rarity_snapshot, 'foundAt', badge.found_at,
        'collectibleId', collectible.id, 'saleStatus', collectible.sale_status,
        'priceMinor', collectible.price_minor, 'currency', collectible.currency,
        'ownershipStatus', owned.status
      ) ORDER BY badge.found_at DESC)
      FROM (SELECT * FROM find_badges WHERE user_id = v_user_id ORDER BY found_at DESC LIMIT 20) badge
      LEFT JOIN collectibles collectible ON collectible.hunt_stop_id = badge.hunt_stop_id
      LEFT JOIN collectible_ownership owned
        ON owned.collectible_id = collectible.id AND owned.user_id = v_user_id AND owned.status = 'active'
    ), '[]'::JSONB),
    'collection', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ownershipId', owned.id, 'collectibleId', collectible.id, 'name', collectible.name,
        'rarity', collectible.rarity, 'creatorName', COALESCE(creator.display_name, creator.username),
        'acquisitionType', owned.acquisition_type, 'status', owned.status, 'acquiredAt', owned.acquired_at
      ) ORDER BY owned.acquired_at DESC)
      FROM collectible_ownership owned
      JOIN collectibles collectible ON collectible.id = owned.collectible_id
      LEFT JOIN profiles creator ON creator.id = collectible.creator_user_id
      WHERE owned.user_id = v_user_id
      LIMIT 20
    ), '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION consume_quest_allowance(p_kind TEXT, p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_period revenue_allowance_periods;
  v_existing revenue_allowance_consumptions;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;
  SELECT * INTO v_existing FROM revenue_allowance_consumptions WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id;
  IF FOUND THEN RETURN jsonb_build_object('success', true, 'alreadyConsumed', true, 'kind', p_kind); END IF;
  v_period := revenue_ensure_period(v_user_id, p_kind);
  SELECT * INTO v_period FROM revenue_allowance_periods WHERE id = v_period.id FOR UPDATE;
  IF v_period.consumed >= v_period.allowance_limit THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'ALLOWANCE_EXHAUSTED', 'kind', p_kind);
  END IF;
  UPDATE revenue_allowance_periods SET consumed = consumed + 1 WHERE id = v_period.id;
  INSERT INTO revenue_allowance_consumptions (user_id, period_id, allowance_kind, idempotency_key)
  VALUES (v_user_id, v_period.id, p_kind, p_idempotency_key);
  INSERT INTO revenue_audit_events (actor_user_id, subject_user_id, entity_type, entity_id, event_type, idempotency_key, details)
  VALUES (v_user_id, v_user_id, 'allowance', v_period.id, 'consumed', p_idempotency_key, jsonb_build_object('kind', p_kind));
  RETURN jsonb_build_object('success', true, 'alreadyConsumed', false, 'kind', p_kind,
    'remaining', v_period.allowance_limit - v_period.consumed - 1);
END;
$$;

CREATE OR REPLACE FUNCTION enforce_quest_allowance_on_participation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind TEXT; v_result JSONB;
BEGIN
  -- Trusted fixtures and administrative repairs are not consumer allowance
  -- consumption. Authenticated player inserts remain server-metered.
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT CASE q.quest_type::TEXT
    WHEN 'monthly' THEN 'quest_monthly'
    WHEN 'geo' THEN 'quest_geo_weekly'
    WHEN 'daily' THEN 'quest_personalized_daily'
  END INTO v_kind
  FROM quests q WHERE q.id = NEW.quest_id;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'invalid_quest_allowance_kind'; END IF;
  v_result := consume_quest_allowance(v_kind, 'quest-start:' || NEW.id);
  IF COALESCE((v_result->>'success')::BOOLEAN, FALSE) = FALSE THEN
    RAISE EXCEPTION 'quest_allowance_exhausted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_quest_allowance ON quest_participations;
CREATE TRIGGER trg_enforce_quest_allowance
  BEFORE INSERT ON quest_participations
  FOR EACH ROW EXECUTE FUNCTION enforce_quest_allowance_on_participation();

CREATE OR REPLACE FUNCTION consume_drop_creation_allowance(p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_period revenue_allowance_periods;
  v_credit_balance INTEGER;
  v_credit drop_credit_ledger;
  v_existing drop_creation_consumptions;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;
  SELECT * INTO v_existing FROM drop_creation_consumptions WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id;
  IF FOUND THEN RETURN jsonb_build_object('success', true, 'alreadyConsumed', true, 'source', v_existing.source, 'result', v_existing.result); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 0));
  v_period := revenue_ensure_period(v_user_id, 'hunt_drop_creation_weekly');
  SELECT * INTO v_period FROM revenue_allowance_periods WHERE id = v_period.id FOR UPDATE;
  IF v_period.consumed < v_period.allowance_limit THEN
    UPDATE revenue_allowance_periods SET consumed = consumed + 1 WHERE id = v_period.id;
    INSERT INTO drop_creation_consumptions (user_id, idempotency_key, source, period_id)
    VALUES (v_user_id, p_idempotency_key, 'included_weekly', v_period.id);
    RETURN jsonb_build_object('success', true, 'alreadyConsumed', false, 'source', 'included_weekly',
      'remainingIncluded', v_period.allowance_limit - v_period.consumed - 1);
  END IF;
  SELECT COALESCE(SUM(quantity_delta), 0) INTO v_credit_balance
  FROM drop_credit_ledger WHERE user_id = v_user_id;
  IF v_credit_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'DROP_ALLOWANCE_EXHAUSTED',
      'userMessage', 'Your included Drops and Extra Drop Credits are used up.');
  END IF;
  INSERT INTO drop_credit_ledger (user_id, quantity_delta, event_type, idempotency_key, reason)
  VALUES (v_user_id, -1, 'consume', 'drop-consume:' || p_idempotency_key, 'Extra Drop creation')
  RETURNING * INTO v_credit;
  INSERT INTO drop_creation_consumptions (user_id, idempotency_key, source, credit_ledger_id)
  VALUES (v_user_id, p_idempotency_key, 'extra_credit', v_credit.id);
  RETURN jsonb_build_object('success', true, 'alreadyConsumed', false, 'source', 'extra_credit',
    'remainingCredits', v_credit_balance - 1);
END;
$$;

CREATE OR REPLACE FUNCTION grant_extra_drop_credits(
  p_user_id UUID, p_quantity INTEGER, p_idempotency_key TEXT,
  p_provider_name TEXT DEFAULT NULL, p_provider_event_id TEXT DEFAULT NULL, p_reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry drop_credit_ledger;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'trusted_revenue_actor_required'; END IF;
  IF p_user_id IS NULL OR p_quantity <= 0 OR char_length(COALESCE(p_idempotency_key, '')) < 8 THEN
    RAISE EXCEPTION 'invalid_credit_grant';
  END IF;
  INSERT INTO drop_credit_ledger (user_id, quantity_delta, event_type, idempotency_key, provider_name, provider_event_id, reason)
  VALUES (p_user_id, p_quantity, 'grant', p_idempotency_key, p_provider_name, p_provider_event_id, p_reason)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO v_entry;
  IF v_entry.id IS NULL THEN
    SELECT * INTO v_entry FROM drop_credit_ledger WHERE idempotency_key = p_idempotency_key;
  END IF;
  INSERT INTO revenue_audit_events (actor_user_id, subject_user_id, entity_type, entity_id, event_type, idempotency_key, details)
  VALUES (auth.uid(), p_user_id, 'drop_credit', v_entry.id, 'granted', p_idempotency_key, jsonb_build_object('quantity', p_quantity));
  RETURN jsonb_build_object('success', true, 'ledgerId', v_entry.id, 'quantity', v_entry.quantity_delta);
END;
$$;

CREATE OR REPLACE FUNCTION create_hunt_draft_with_allowance(p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_consumption JSONB;
  v_result JSONB;
  v_existing drop_creation_consumptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_existing FROM drop_creation_consumptions
  WHERE user_id = auth.uid() AND idempotency_key = p_idempotency_key;
  IF FOUND AND v_existing.result IS NOT NULL THEN RETURN v_existing.result; END IF;
  v_consumption := consume_drop_creation_allowance(p_idempotency_key);
  IF COALESCE((v_consumption->>'success')::BOOLEAN, FALSE) = FALSE THEN RETURN v_consumption; END IF;
  v_result := create_hunt_draft('{}'::JSONB);
  UPDATE drop_creation_consumptions SET created_hunt_id = (v_result->>'id')::UUID, result = v_result
  WHERE user_id = auth.uid() AND idempotency_key = p_idempotency_key;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION create_hunt_draft_with_allowance(p_payload JSONB, p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_consumption JSONB; v_result JSONB; v_existing drop_creation_consumptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_existing FROM drop_creation_consumptions
  WHERE user_id = auth.uid() AND idempotency_key = p_idempotency_key;
  IF FOUND AND v_existing.result IS NOT NULL THEN RETURN v_existing.result; END IF;
  v_consumption := consume_drop_creation_allowance(p_idempotency_key);
  IF COALESCE((v_consumption->>'success')::BOOLEAN, FALSE) = FALSE THEN RETURN v_consumption; END IF;
  v_result := create_hunt_draft(COALESCE(p_payload, '{}'::JSONB));
  UPDATE drop_creation_consumptions SET created_hunt_id = (v_result->>'id')::UUID, result = v_result
  WHERE user_id = auth.uid() AND idempotency_key = p_idempotency_key;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION configure_hunt_drop_commerce(
  p_stop_id UUID, p_find_limit INTEGER, p_collectible_name TEXT DEFAULT NULL,
  p_collectible_description TEXT DEFAULT NULL, p_image_media_id UUID DEFAULT NULL,
  p_price_minor INTEGER DEFAULT NULL, p_currency TEXT DEFAULT 'USD', p_quantity INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stop hunt_stops;
  v_collectible collectibles;
  v_rarity TEXT;
  v_price_limits JSONB;
  v_rarity_thresholds JSONB;
  v_min_price INTEGER;
  v_max_price INTEGER;
BEGIN
  SELECT s.* INTO v_stop FROM hunt_stops s JOIN hunts h ON h.id = s.hunt_id
  WHERE s.id = p_stop_id AND h.creator_user_id = auth.uid() AND h.status = 'draft' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_find_limit IS NOT NULL AND p_find_limit <= 0 THEN RAISE EXCEPTION 'invalid_find_limit'; END IF;
  IF p_collectible_name IS NOT NULL THEN
    SELECT value INTO v_price_limits FROM revenue_configuration
    WHERE key = 'paid_collectible_price_limits' FOR SHARE;
    SELECT value INTO v_rarity_thresholds FROM revenue_configuration
    WHERE key = 'collectible_rarity_thresholds' FOR SHARE;
    v_min_price := COALESCE((v_price_limits->>'minimum_minor')::INTEGER, 100);
    v_max_price := COALESCE((v_price_limits->>'maximum_minor')::INTEGER, 100000);
    IF p_price_minor IS NULL OR p_price_minor < 0
       OR (p_price_minor > 0 AND (p_price_minor < v_min_price OR p_price_minor > v_max_price)) THEN
      RAISE EXCEPTION 'invalid_collectible_price';
    END IF;
    IF p_quantity IS NOT NULL AND p_quantity <= 0 THEN RAISE EXCEPTION 'invalid_collectible_quantity'; END IF;
    v_rarity := CASE
      WHEN p_quantity <= COALESCE((v_rarity_thresholds->>'UNIQUE')::INTEGER, 1) THEN 'UNIQUE'
      WHEN p_quantity <= COALESCE((v_rarity_thresholds->>'LEGENDARY')::INTEGER, 5) THEN 'LEGENDARY'
      WHEN p_quantity <= COALESCE((v_rarity_thresholds->>'EPIC')::INTEGER, 20) THEN 'EPIC'
      WHEN p_quantity <= COALESCE((v_rarity_thresholds->>'RARE')::INTEGER, 50) THEN 'RARE'
      WHEN p_quantity <= COALESCE((v_rarity_thresholds->>'UNCOMMON')::INTEGER, 100) THEN 'UNCOMMON'
      ELSE 'COMMON'
    END;
    INSERT INTO seller_profiles (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
    INSERT INTO collectibles (hunt_stop_id, creator_user_id, name, description, image_media_id, price_minor, currency, quantity, rarity, sale_status)
    VALUES (p_stop_id, auth.uid(), LEFT(TRIM(p_collectible_name), 120), p_collectible_description, p_image_media_id,
      p_price_minor, p_currency, p_quantity, v_rarity,
      CASE WHEN p_price_minor = 0 OR EXISTS (
        SELECT 1 FROM seller_profiles WHERE user_id = auth.uid() AND onboarding_status = 'verified'
      ) THEN 'active' ELSE 'draft' END)
    ON CONFLICT (hunt_stop_id) DO UPDATE SET
      name = EXCLUDED.name, description = EXCLUDED.description, image_media_id = EXCLUDED.image_media_id,
      price_minor = EXCLUDED.price_minor, currency = EXCLUDED.currency, quantity = EXCLUDED.quantity,
      rarity = EXCLUDED.rarity, sale_status = EXCLUDED.sale_status, updated_at = NOW()
    RETURNING * INTO v_collectible;
  ELSE
    UPDATE collectibles SET sale_status = 'deactivated', updated_at = NOW() WHERE hunt_stop_id = p_stop_id;
  END IF;
  INSERT INTO hunt_drop_commerce (hunt_stop_id, find_limit, collectible_id)
  VALUES (p_stop_id, p_find_limit, v_collectible.id)
  ON CONFLICT (hunt_stop_id) DO UPDATE SET find_limit = EXCLUDED.find_limit,
    collectible_id = EXCLUDED.collectible_id, updated_at = NOW();
  RETURN jsonb_build_object('success', true, 'stopId', p_stop_id, 'findLimit', p_find_limit,
    'collectibleId', v_collectible.id, 'warning', 'When the find limit is exhausted, this Drop will disappear from active Hunt discovery.');
END;
$$;

CREATE OR REPLACE FUNCTION deactivate_hunt_drop(p_stop_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hunt_stops s JOIN hunts h ON h.id = s.hunt_id
    WHERE s.id = p_stop_id AND h.creator_user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  INSERT INTO hunt_drop_commerce (hunt_stop_id, deactivated_at, deactivation_reason)
  VALUES (p_stop_id, NOW(), p_reason)
  ON CONFLICT (hunt_stop_id) DO UPDATE SET deactivated_at = NOW(), deactivation_reason = EXCLUDED.deactivation_reason, updated_at = NOW();
  UPDATE collectibles SET sale_status = 'deactivated', updated_at = NOW() WHERE hunt_stop_id = p_stop_id;
  INSERT INTO revenue_audit_events (actor_user_id, entity_type, entity_id, event_type, details)
  VALUES (auth.uid(), 'hunt_drop', p_stop_id, 'deactivated', jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true, 'deactivated', true);
END;
$$;

CREATE OR REPLACE FUNCTION record_drop_find_from_collection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_stop hunt_stops;
  v_commerce hunt_drop_commerce;
  v_collectible collectibles;
  v_creator_name TEXT;
  v_find hunt_drop_finds;
BEGIN
  SELECT hp.user_id INTO v_user_id FROM hunt_participants hp WHERE hp.id = NEW.hunt_participant_id;
  SELECT * INTO v_stop FROM hunt_stops WHERE id = NEW.hunt_stop_id;
  INSERT INTO hunt_drop_commerce (hunt_stop_id) VALUES (NEW.hunt_stop_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_commerce FROM hunt_drop_commerce WHERE hunt_stop_id = NEW.hunt_stop_id FOR UPDATE;
  IF v_commerce.deactivated_at IS NOT NULL OR
    (v_commerce.find_limit IS NOT NULL AND v_commerce.find_count >= v_commerce.find_limit) THEN
    RAISE EXCEPTION 'drop_find_limit_exhausted';
  END IF;
  SELECT * INTO v_collectible FROM collectibles WHERE id = v_commerce.collectible_id;
  SELECT COALESCE(p.display_name, p.username) INTO v_creator_name
  FROM profiles p
  WHERE p.id = (SELECT creator_user_id FROM hunts WHERE id = v_stop.hunt_id);
  INSERT INTO hunt_drop_finds (hunt_stop_id, user_id, hunt_drop_collection_id, idempotency_key)
  VALUES (NEW.hunt_stop_id, v_user_id, NEW.id, 'find:' || NEW.id)
  ON CONFLICT (hunt_stop_id, user_id) DO NOTHING
  RETURNING * INTO v_find;
  IF v_find.id IS NOT NULL THEN
    UPDATE hunt_drop_commerce SET find_count = find_count + 1, updated_at = NOW()
    WHERE hunt_stop_id = NEW.hunt_stop_id;
    INSERT INTO find_badges (user_id, hunt_stop_id, find_id, drop_title_snapshot, creator_name_snapshot,
      collectible_name_snapshot, rarity_snapshot, found_at)
    VALUES (v_user_id, NEW.hunt_stop_id, v_find.id, v_stop.title, v_creator_name,
      v_collectible.name, v_collectible.rarity, NEW.collected_at)
    ON CONFLICT (user_id, hunt_stop_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_drop_find_from_collection ON hunt_drop_collections;
CREATE TRIGGER trg_record_drop_find_from_collection
  AFTER INSERT ON hunt_drop_collections
  FOR EACH ROW EXECUTE FUNCTION record_drop_find_from_collection();

-- Existing verified collections become finds and badges without altering their
-- Hunt points or verification records.
INSERT INTO hunt_drop_finds (hunt_stop_id, user_id, hunt_drop_collection_id, idempotency_key, found_at)
SELECT c.hunt_stop_id, hp.user_id, c.id, 'find:' || c.id, c.collected_at
FROM hunt_drop_collections c
JOIN hunt_participants hp ON hp.id = c.hunt_participant_id
ON CONFLICT DO NOTHING;

INSERT INTO find_badges (
  user_id, hunt_stop_id, find_id, drop_title_snapshot, creator_name_snapshot,
  collectible_name_snapshot, rarity_snapshot, found_at
)
SELECT f.user_id, f.hunt_stop_id, f.id, s.title, COALESCE(p.display_name, p.username),
  collectible.name, collectible.rarity, f.found_at
FROM hunt_drop_finds f
JOIN hunt_stops s ON s.id = f.hunt_stop_id
JOIN hunts h ON h.id = s.hunt_id
LEFT JOIN profiles p ON p.id = h.creator_user_id
LEFT JOIN collectibles collectible ON collectible.hunt_stop_id = s.id
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION claim_free_collectible(p_find_badge_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_badge find_badges;
  v_collectible collectibles;
  v_ownership collectible_ownership;
BEGIN
  SELECT * INTO v_badge FROM find_badges WHERE id = p_find_badge_id AND user_id = auth.uid() FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'BADGE_NOT_FOUND'); END IF;
  SELECT c.* INTO v_collectible FROM collectibles c WHERE c.hunt_stop_id = v_badge.hunt_stop_id FOR UPDATE;
  IF NOT FOUND OR v_collectible.price_minor <> 0 THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'NOT_FREE'); END IF;
  IF v_collectible.sale_status IN ('deactivated', 'sold_out')
    OR (v_collectible.quantity IS NOT NULL AND v_collectible.acquired_count >= v_collectible.quantity) THEN
    UPDATE collectibles SET sale_status = 'sold_out' WHERE id = v_collectible.id AND sale_status <> 'deactivated';
    RETURN jsonb_build_object('success', false, 'reasonCode', 'SOLD_OUT');
  END IF;
  INSERT INTO collectible_ownership (collectible_id, user_id, acquisition_type)
  VALUES (v_collectible.id, auth.uid(), 'free_claim')
  ON CONFLICT (collectible_id, user_id) DO NOTHING
  RETURNING * INTO v_ownership;
  IF v_ownership.id IS NULL THEN RETURN jsonb_build_object('success', true, 'alreadyOwned', true, 'collectibleId', v_collectible.id); END IF;
  UPDATE collectibles SET acquired_count = acquired_count + 1,
    sale_status = CASE WHEN quantity IS NOT NULL AND acquired_count + 1 >= quantity THEN 'sold_out' ELSE sale_status END
  WHERE id = v_collectible.id;
  RETURN jsonb_build_object('success', true, 'alreadyOwned', false, 'ownershipId', v_ownership.id, 'collectibleId', v_collectible.id);
END;
$$;

CREATE OR REPLACE FUNCTION create_collectible_purchase_intent(p_find_badge_id UUID, p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_badge find_badges;
  v_collectible collectibles;
  v_order marketplace_orders;
  v_fee_config JSONB;
  v_fee_bps INTEGER;
  v_fee_minor INTEGER;
BEGIN
  SELECT * INTO v_badge FROM find_badges WHERE id = p_find_badge_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'BADGE_NOT_FOUND'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::TEXT || ':' || v_badge.hunt_stop_id::TEXT, 0));
  SELECT * INTO v_collectible FROM collectibles WHERE hunt_stop_id = v_badge.hunt_stop_id FOR UPDATE;
  IF NOT FOUND OR v_collectible.price_minor < 100 THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'NOT_PAID'); END IF;
  IF v_collectible.sale_status <> 'active' OR (v_collectible.quantity IS NOT NULL AND v_collectible.acquired_count >= v_collectible.quantity) THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'SOLD_OUT');
  END IF;
  IF EXISTS (SELECT 1 FROM collectible_ownership WHERE user_id = auth.uid() AND collectible_id = v_collectible.id AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'ALREADY_OWNED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM seller_profiles WHERE user_id = v_collectible.creator_user_id AND onboarding_status = 'verified'
  ) THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'SELLER_UNAVAILABLE'); END IF;
  SELECT value INTO v_fee_config FROM revenue_configuration
  WHERE key = 'platform_fee_percent' FOR SHARE;
  v_fee_bps := COALESCE((v_fee_config->>'basis_points')::INTEGER, 3000);
  IF v_fee_bps < 0 OR v_fee_bps > 10000 THEN RAISE EXCEPTION 'invalid_platform_fee_configuration'; END IF;
  v_fee_minor := (v_collectible.price_minor * v_fee_bps) / 10000;
  INSERT INTO marketplace_orders (buyer_user_id, seller_user_id, collectible_id, currency, gross_minor,
    platform_fee_minor, intended_seller_share_minor, seller_payable_minor, idempotency_key)
  VALUES (auth.uid(), v_collectible.creator_user_id, v_collectible.id, v_collectible.currency, v_collectible.price_minor,
    v_fee_minor, v_collectible.price_minor - v_fee_minor,
    v_collectible.price_minor - v_fee_minor, p_idempotency_key)
  ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING * INTO v_order;
  INSERT INTO marketplace_transaction_events (order_id, event_type, amount_minor, idempotency_key)
  VALUES (v_order.id, 'intent_created', v_order.gross_minor, 'intent:' || p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'orderId', v_order.id, 'state', v_order.state,
    'grossMinor', v_order.gross_minor, 'currency', v_order.currency);
END;
$$;

CREATE OR REPLACE FUNCTION finalize_collectible_purchase(
  p_order_id UUID, p_provider_name TEXT, p_provider_transaction_id TEXT, p_provider_event_id TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order marketplace_orders;
  v_collectible collectibles;
  v_ownership collectible_ownership;
  v_existing_event marketplace_transaction_events;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'trusted_revenue_actor_required'; END IF;
  IF p_provider_name IS NULL OR p_provider_event_id IS NULL OR p_provider_transaction_id IS NULL THEN
    RAISE EXCEPTION 'provider_confirmation_required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_provider_name || ':' || p_provider_event_id, 0));
  SELECT * INTO v_existing_event FROM marketplace_transaction_events
  WHERE provider_name = p_provider_name AND provider_event_id = p_provider_event_id;
  IF FOUND THEN
    IF v_existing_event.order_id <> p_order_id OR v_existing_event.event_type <> 'finalized' THEN
      RAISE EXCEPTION 'provider_event_reuse';
    END IF;
    RETURN jsonb_build_object('success', true, 'alreadyFinalized', true, 'orderId', p_order_id);
  END IF;
  SELECT * INTO v_order FROM marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'ORDER_NOT_FOUND'); END IF;
  IF v_order.state = 'finalized' THEN RETURN jsonb_build_object('success', true, 'alreadyFinalized', true, 'orderId', v_order.id); END IF;
  SELECT * INTO v_collectible FROM collectibles WHERE id = v_order.collectible_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM seller_profiles WHERE user_id = v_order.seller_user_id AND onboarding_status = 'verified'
  ) THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'SELLER_UNAVAILABLE'); END IF;
  IF v_collectible.sale_status <> 'active' OR (v_collectible.quantity IS NOT NULL AND v_collectible.acquired_count >= v_collectible.quantity) THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'SOLD_OUT');
  END IF;
  INSERT INTO marketplace_transaction_events (order_id, event_type, amount_minor, provider_name, provider_event_id, idempotency_key)
  VALUES (v_order.id, 'finalized', v_order.gross_minor, p_provider_name, p_provider_event_id, 'finalize:' || p_provider_name || ':' || p_provider_event_id);
  INSERT INTO collectible_ownership (collectible_id, user_id, acquisition_type, status, order_id)
  VALUES (v_collectible.id, v_order.buyer_user_id, 'purchase', 'active', v_order.id)
  ON CONFLICT (collectible_id, user_id) DO NOTHING
  RETURNING * INTO v_ownership;
  IF v_ownership.id IS NULL THEN
    UPDATE marketplace_orders SET state = 'failed', provider_name = p_provider_name,
      provider_transaction_id = p_provider_transaction_id, finalized_at = NOW()
    WHERE id = v_order.id;
    RETURN jsonb_build_object('success', false, 'reasonCode', 'DUPLICATE_REQUIRES_REFUND', 'orderId', v_order.id);
  END IF;
  UPDATE collectibles SET acquired_count = acquired_count + 1,
    sale_status = CASE WHEN quantity IS NOT NULL AND acquired_count + 1 >= quantity THEN 'sold_out' ELSE sale_status END
  WHERE id = v_collectible.id;
  UPDATE marketplace_orders SET state = 'finalized', provider_name = p_provider_name,
    provider_transaction_id = p_provider_transaction_id, finalized_at = NOW() WHERE id = v_order.id;
  INSERT INTO seller_balance_ledger (seller_user_id, order_id, amount_minor, currency, event_type, idempotency_key)
  VALUES (v_order.seller_user_id, v_order.id, v_order.seller_payable_minor, v_order.currency, 'sale', 'seller-sale:' || v_order.id)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true, 'orderId', v_order.id, 'ownershipId', v_ownership.id);
END;
$$;

CREATE OR REPLACE FUNCTION reverse_collectible_purchase(
  p_order_id UUID, p_event_type TEXT, p_provider_event_id TEXT, p_amount_minor INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order marketplace_orders;
  v_ownership collectible_ownership;
  v_amount INTEGER;
  v_existing_event marketplace_transaction_events;
  v_normalized_event TEXT;
  v_provider_name TEXT;
  v_prior_refunded INTEGER;
  v_total_refunded INTEGER;
  v_prior_seller_reversed INTEGER;
  v_seller_reversal INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'trusted_revenue_actor_required'; END IF;
  IF p_event_type NOT IN ('refund', 'chargeback', 'reversal') OR p_provider_event_id IS NULL THEN
    RAISE EXCEPTION 'invalid_reversal_event';
  END IF;
  SELECT * INTO v_order FROM marketplace_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reasonCode', 'ORDER_NOT_FOUND'); END IF;
  IF v_order.state NOT IN ('finalized', 'partially_refunded') THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'ORDER_NOT_REVERSIBLE');
  END IF;
  v_provider_name := COALESCE(v_order.provider_name, 'internal');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_provider_name || ':' || p_provider_event_id, 0));
  SELECT * INTO v_existing_event FROM marketplace_transaction_events
  WHERE provider_name = v_provider_name AND provider_event_id = p_provider_event_id;
  IF FOUND THEN
    IF v_existing_event.order_id <> p_order_id THEN RAISE EXCEPTION 'provider_event_reuse'; END IF;
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true, 'orderId', p_order_id);
  END IF;
  v_amount := COALESCE(p_amount_minor, v_order.gross_minor);
  SELECT COALESCE(SUM(amount_minor), 0) INTO v_prior_refunded
  FROM marketplace_transaction_events
  WHERE order_id = v_order.id AND event_type IN ('refund', 'partial_refund', 'chargeback', 'reversal');
  v_total_refunded := v_prior_refunded + v_amount;
  IF v_amount <= 0 OR v_total_refunded > v_order.gross_minor THEN RAISE EXCEPTION 'invalid_reversal_amount'; END IF;
  v_normalized_event := CASE
    WHEN p_event_type IN ('chargeback', 'reversal') THEN p_event_type
    WHEN v_amount < v_order.gross_minor THEN 'partial_refund' ELSE 'refund' END;
  INSERT INTO marketplace_transaction_events (
    order_id, event_type, amount_minor, provider_name, provider_event_id, idempotency_key
  ) VALUES (
    v_order.id, v_normalized_event, v_amount, v_provider_name, p_provider_event_id,
    'reverse:' || v_provider_name || ':' || p_provider_event_id
  );
  UPDATE marketplace_orders SET state = CASE
    WHEN p_event_type = 'chargeback' THEN 'charged_back'
    WHEN p_event_type = 'reversal' THEN 'reversed'
    WHEN v_total_refunded < gross_minor THEN 'partially_refunded'
    ELSE 'refunded' END
  WHERE id = v_order.id;
  UPDATE collectible_ownership SET status = 'refunded', revoked_at = NOW()
  WHERE order_id = v_order.id AND status = 'active' AND v_total_refunded >= v_order.gross_minor
  RETURNING * INTO v_ownership;
  SELECT COALESCE(-SUM(amount_minor), 0) INTO v_prior_seller_reversed
  FROM seller_balance_ledger
  WHERE order_id = v_order.id AND event_type = 'refund' AND amount_minor < 0;
  v_seller_reversal := GREATEST(0,
    FLOOR((v_order.seller_payable_minor::NUMERIC * v_total_refunded) / NULLIF(v_order.gross_minor, 0))::INTEGER
    - v_prior_seller_reversed);
  INSERT INTO seller_balance_ledger (seller_user_id, order_id, amount_minor, currency, event_type, idempotency_key)
  VALUES (v_order.seller_user_id, v_order.id, -v_seller_reversal, v_order.currency, 'refund', 'seller-refund:' || p_provider_event_id)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true, 'orderId', v_order.id, 'ownershipRevoked', v_ownership.id IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION assert_revenue_admin(p_actor_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' OR NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_actor_user_id AND role IN ('admin', 'super_admin') AND account_status = 'active'
  ) THEN RAISE EXCEPTION 'trusted_revenue_admin_required'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_revenue_configuration(
  p_actor_user_id UUID, p_key TEXT, p_value JSONB, p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_previous JSONB;
BEGIN
  PERFORM assert_revenue_admin(p_actor_user_id);
  IF EXISTS (SELECT 1 FROM revenue_audit_events WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true);
  END IF;
  IF p_key NOT IN ('platform_fee_percent', 'paid_collectible_price_limits', 'collectible_rarity_thresholds') THEN
    RAISE EXCEPTION 'revenue_configuration_key_not_allowed';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT value INTO v_previous FROM revenue_configuration WHERE key = p_key FOR UPDATE;
  INSERT INTO revenue_configuration (key, value, effective_at, updated_by)
  VALUES (p_key, p_value, NOW(), p_actor_user_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, effective_at = NOW(), updated_by = EXCLUDED.updated_by;
  INSERT INTO revenue_audit_events (actor_user_id, entity_type, entity_id, event_type, idempotency_key, details)
  VALUES (p_actor_user_id, 'revenue_configuration', NULL, 'updated', p_idempotency_key,
    jsonb_build_object('key', p_key, 'previous', v_previous, 'next', p_value, 'reason', trim(p_reason)));
  RETURN jsonb_build_object('success', true, 'alreadyApplied', false, 'key', p_key);
END;
$$;

CREATE OR REPLACE FUNCTION admin_deactivate_hunt_drop(
  p_actor_user_id UUID, p_stop_id UUID, p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_revenue_admin(p_actor_user_id);
  IF EXISTS (SELECT 1 FROM revenue_audit_events WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true);
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM hunt_stops WHERE id = p_stop_id FOR UPDATE) THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'DROP_NOT_FOUND');
  END IF;
  INSERT INTO hunt_drop_commerce (hunt_stop_id, deactivated_at, deactivation_reason)
  VALUES (p_stop_id, NOW(), trim(p_reason))
  ON CONFLICT (hunt_stop_id) DO UPDATE SET deactivated_at = NOW(), deactivation_reason = EXCLUDED.deactivation_reason, updated_at = NOW();
  UPDATE collectibles SET sale_status = 'deactivated', updated_at = NOW() WHERE hunt_stop_id = p_stop_id;
  INSERT INTO revenue_audit_events (actor_user_id, entity_type, entity_id, event_type, idempotency_key, details)
  VALUES (p_actor_user_id, 'hunt_drop', p_stop_id, 'admin_deactivated', p_idempotency_key,
    jsonb_build_object('reason', trim(p_reason)));
  RETURN jsonb_build_object('success', true, 'alreadyApplied', false, 'deactivated', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_seller_onboarding_status(
  p_actor_user_id UUID, p_seller_user_id UUID, p_status TEXT, p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_previous TEXT;
BEGIN
  PERFORM assert_revenue_admin(p_actor_user_id);
  IF EXISTS (SELECT 1 FROM revenue_audit_events WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true);
  END IF;
  IF p_status NOT IN ('not_started', 'pending', 'verified', 'restricted', 'disabled') THEN RAISE EXCEPTION 'invalid_seller_status'; END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT onboarding_status INTO v_previous FROM seller_profiles WHERE user_id = p_seller_user_id FOR UPDATE;
  INSERT INTO seller_profiles (user_id, onboarding_status, verified_at)
  VALUES (p_seller_user_id, p_status, CASE WHEN p_status = 'verified' THEN NOW() ELSE NULL END)
  ON CONFLICT (user_id) DO UPDATE SET onboarding_status = EXCLUDED.onboarding_status,
    verified_at = CASE WHEN EXCLUDED.onboarding_status = 'verified' THEN COALESCE(seller_profiles.verified_at, NOW()) ELSE seller_profiles.verified_at END,
    updated_at = NOW();
  IF p_status IN ('restricted', 'disabled') THEN
    UPDATE collectibles SET sale_status = 'deactivated', updated_at = NOW()
    WHERE creator_user_id = p_seller_user_id AND price_minor > 0 AND sale_status IN ('draft', 'active');
  ELSIF p_status = 'verified' THEN
    UPDATE collectibles SET sale_status = CASE WHEN quantity IS NOT NULL AND acquired_count >= quantity THEN 'sold_out' ELSE 'active' END, updated_at = NOW()
    WHERE creator_user_id = p_seller_user_id AND price_minor > 0 AND sale_status = 'draft';
  END IF;
  INSERT INTO revenue_audit_events (actor_user_id, subject_user_id, entity_type, entity_id, event_type, idempotency_key, details)
  VALUES (p_actor_user_id, p_seller_user_id, 'seller_profile', p_seller_user_id, 'onboarding_status_updated', p_idempotency_key,
    jsonb_build_object('previousStatus', v_previous, 'newStatus', p_status, 'reason', trim(p_reason)));
  RETURN jsonb_build_object('success', true, 'previousStatus', v_previous, 'newStatus', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION admin_reverse_collectible_purchase(
  p_actor_user_id UUID, p_order_id UUID, p_event_type TEXT, p_provider_event_id TEXT,
  p_amount_minor INTEGER, p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM assert_revenue_admin(p_actor_user_id);
  IF EXISTS (SELECT 1 FROM revenue_audit_events WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true);
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  v_result := reverse_collectible_purchase(p_order_id, p_event_type, p_provider_event_id, p_amount_minor);
  INSERT INTO revenue_audit_events (actor_user_id, entity_type, entity_id, event_type, idempotency_key, details)
  VALUES (p_actor_user_id, 'marketplace_order', p_order_id, 'admin_' || p_event_type, p_idempotency_key,
    jsonb_build_object('amountMinor', p_amount_minor, 'reason', trim(p_reason), 'result', v_result));
  RETURN v_result;
END;
$$;

-- Preserve the current secure collection flow while hiding deactivated and
-- exhausted Drops from discovery. The location/session checks remain unchanged.
CREATE OR REPLACE FUNCTION get_hunt_drop_search_zones(
  p_participation_id UUID
) RETURNS TABLE (
  drop_id UUID, hunt_id UUID, drop_type TEXT, search_lat DOUBLE PRECISION,
  search_lng DOUBLE PRECISION, search_radius_meters INTEGER, clue_reveal_radius_meters INTEGER,
  collection_radius_meters INTEGER, clue_state TEXT, collection_state TEXT, title TEXT, points INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hs.id, hp.hunt_id, hs.drop_type, g.public_search_lat, g.public_search_lng,
    g.public_search_radius_meters, g.clue_reveal_radius_meters, g.collection_radius_meters,
    CASE WHEN hsp.status = 'not_started' THEN 'locked' ELSE 'available' END,
    CASE WHEN c.id IS NOT NULL THEN 'COLLECTED'
         WHEN hsp.status = 'not_started' THEN 'CLUE_LOCKED' ELSE 'SEARCHING' END,
    hs.title, hs.final_hunt_points
  FROM hunt_participants hp
  JOIN hunt_stop_progress hsp ON hsp.hunt_participant_id = hp.id
  JOIN hunt_stops hs ON hs.id = hsp.hunt_stop_id
  JOIN hunt_stop_geofences g ON g.hunt_stop_id = hs.id
  LEFT JOIN hunt_drop_collections c ON c.hunt_participant_id = hp.id AND c.hunt_stop_id = hs.id
  LEFT JOIN hunt_drop_commerce commerce ON commerce.hunt_stop_id = hs.id
  WHERE hp.id = p_participation_id AND hp.user_id = auth.uid() AND hp.status IN ('active', 'paused')
    AND hs.placement_status = 'PASS'
    AND (hs.drop_available_from IS NULL OR hs.drop_available_from <= NOW())
    AND (hs.drop_available_until IS NULL OR hs.drop_available_until >= NOW())
    AND (commerce.deactivated_at IS NULL OR commerce.hunt_stop_id IS NULL)
    AND (commerce.find_limit IS NULL OR commerce.find_count < commerce.find_limit)
    AND g.public_search_lat IS NOT NULL AND g.public_search_lng IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION revenue_plan_for_user(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revenue_allowance_limit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revenue_period_bounds(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revenue_ensure_period(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_my_revenue_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION consume_quest_allowance(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION enforce_quest_allowance_on_participation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION consume_drop_creation_allowance(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION grant_extra_drop_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION apply_membership_entitlement(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_hunt_draft_with_allowance(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION create_hunt_draft_with_allowance(JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION configure_hunt_drop_commerce(UUID, INTEGER, TEXT, TEXT, UUID, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION deactivate_hunt_drop(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION claim_free_collectible(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION create_collectible_purchase_intent(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION finalize_collectible_purchase(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reverse_collectible_purchase(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION assert_revenue_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_update_revenue_configuration(UUID, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_deactivate_hunt_drop(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_update_seller_onboarding_status(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_reverse_collectible_purchase(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_hunt_drop_search_zones(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_my_revenue_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION consume_quest_allowance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_drop_creation_allowance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_hunt_draft_with_allowance(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_hunt_draft_with_allowance(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION configure_hunt_drop_commerce(UUID, INTEGER, TEXT, TEXT, UUID, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_hunt_drop(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_free_collectible(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_collectible_purchase_intent(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION grant_extra_drop_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION apply_membership_entitlement(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_collectible_purchase(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reverse_collectible_purchase(UUID, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION admin_update_revenue_configuration(UUID, TEXT, JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_deactivate_hunt_drop(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_update_seller_onboarding_status(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_reverse_collectible_purchase(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_hunt_drop_search_zones(UUID) TO authenticated;

REVOKE ALL ON FUNCTION create_hunt_draft(JSONB) FROM authenticated;