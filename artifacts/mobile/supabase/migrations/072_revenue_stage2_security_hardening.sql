-- Migration 072 — Stage 2 revenue security hardening
-- Forward-only companion to 071.  Hunt stops and the Quest/Hunt point ledgers
-- remain canonical and are deliberately not altered here.

CREATE TABLE IF NOT EXISTS revenue_external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL CHECK (char_length(trim(provider_name)) BETWEEN 1 AND 80),
  provider_event_id TEXT NOT NULL CHECK (char_length(trim(provider_event_id)) BETWEEN 1 AND 255),
  event_kind TEXT NOT NULL CHECK (event_kind IN ('membership', 'credit_grant', 'purchase_finalization', 'refund', 'chargeback', 'reversal')),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('membership_entitlement', 'drop_credit_ledger', 'marketplace_order')),
  subject_id UUID NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT NOT NULL UNIQUE,
  UNIQUE (provider_name, provider_event_id, event_kind)
);

CREATE TABLE IF NOT EXISTS revenue_configuration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_key TEXT NOT NULL,
  value JSONB NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue_allowance_catalog (
  plan_code TEXT NOT NULL REFERENCES membership_plans(code) ON DELETE RESTRICT,
  allowance_kind TEXT NOT NULL CHECK (allowance_kind IN ('quest_monthly', 'quest_geo_weekly', 'quest_personalized_daily', 'hunt_drop_creation_weekly')),
  allowance_limit INTEGER NOT NULL CHECK (allowance_limit >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_code, allowance_kind)
);

INSERT INTO revenue_allowance_catalog (plan_code, allowance_kind, allowance_limit)
VALUES
  ('free', 'quest_monthly', 10), ('free', 'quest_geo_weekly', 1),
  ('free', 'quest_personalized_daily', 1), ('free', 'hunt_drop_creation_weekly', 2),
  ('worlds_monthly', 'quest_monthly', 50), ('worlds_monthly', 'quest_geo_weekly', 2),
  ('worlds_monthly', 'quest_personalized_daily', 1), ('worlds_monthly', 'hunt_drop_creation_weekly', 5),
  ('worlds_yearly', 'quest_monthly', 50), ('worlds_yearly', 'quest_geo_weekly', 2),
  ('worlds_yearly', 'quest_personalized_daily', 1), ('worlds_yearly', 'hunt_drop_creation_weekly', 5)
ON CONFLICT (plan_code, allowance_kind) DO NOTHING;

CREATE TABLE IF NOT EXISTS paid_collectible_fee_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id UUID NOT NULL UNIQUE REFERENCES hunt_stops(id) ON DELETE RESTRICT,
  creator_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  platform_fee_basis_points INTEGER NOT NULL CHECK (platform_fee_basis_points BETWEEN 0 AND 10000),
  disclosure_version TEXT NOT NULL CHECK (char_length(trim(disclosure_version)) BETWEEN 1 AND 80),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE UNIQUE INDEX IF NOT EXISTS revenue_external_provider_event_once
  ON revenue_external_events(provider_name, provider_event_id);

ALTER TABLE collectibles
  ADD COLUMN IF NOT EXISTS creator_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS image_media_id_snapshot UUID,
  ADD COLUMN IF NOT EXISTS rarity_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS listing_price_snapshot_minor INTEGER,
  ADD COLUMN IF NOT EXISTS listing_currency_snapshot TEXT;
ALTER TABLE collectible_ownership
  ADD COLUMN IF NOT EXISTS collectible_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS creator_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS rarity_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS image_media_id_snapshot UUID,
  ADD COLUMN IF NOT EXISTS price_minor_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS currency_snapshot TEXT;
ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS collectible_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS creator_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS rarity_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS fee_basis_points_snapshot INTEGER;

CREATE OR REPLACE FUNCTION revenue_snapshot_collectible()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_creator TEXT;
BEGIN
  SELECT COALESCE(display_name, username) INTO v_creator FROM profiles WHERE id = NEW.creator_user_id;
  NEW.creator_name_snapshot := COALESCE(NEW.creator_name_snapshot, v_creator, 'Worlds creator');
  NEW.image_media_id_snapshot := COALESCE(NEW.image_media_id_snapshot, NEW.image_media_id);
  NEW.rarity_snapshot := COALESCE(NEW.rarity_snapshot, NEW.rarity);
  NEW.listing_price_snapshot_minor := COALESCE(NEW.listing_price_snapshot_minor, NEW.price_minor);
  NEW.listing_currency_snapshot := COALESCE(NEW.listing_currency_snapshot, NEW.currency);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_collectible_snapshot ON collectibles;
CREATE TRIGGER trg_collectible_snapshot BEFORE INSERT ON collectibles
  FOR EACH ROW EXECUTE FUNCTION revenue_snapshot_collectible();

CREATE OR REPLACE FUNCTION revenue_require_paid_fee_acknowledgement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service-role imports and recovery tooling are trusted server operations.
  -- Creator-originated paid listings must retain an explicit acknowledgement.
  IF NEW.price_minor > 0 AND auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM paid_collectible_fee_acknowledgements a
    WHERE a.hunt_stop_id = NEW.hunt_stop_id
      AND a.creator_user_id = NEW.creator_user_id
  ) THEN
    RAISE EXCEPTION 'paid_collectible_fee_disclosure_required';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_collectible_paid_disclosure ON collectibles;
CREATE TRIGGER trg_collectible_paid_disclosure BEFORE INSERT OR UPDATE OF price_minor ON collectibles
  FOR EACH ROW EXECUTE FUNCTION revenue_require_paid_fee_acknowledgement();

CREATE OR REPLACE FUNCTION revenue_snapshot_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_collectible collectibles;
BEGIN
  SELECT * INTO v_collectible FROM collectibles WHERE id = NEW.collectible_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'collectible_not_found'; END IF;
  NEW.collectible_name_snapshot := COALESCE(NEW.collectible_name_snapshot, v_collectible.name);
  NEW.creator_name_snapshot := COALESCE(NEW.creator_name_snapshot, v_collectible.creator_name_snapshot);
  NEW.rarity_snapshot := COALESCE(NEW.rarity_snapshot, v_collectible.rarity_snapshot, v_collectible.rarity);
  NEW.image_media_id_snapshot := COALESCE(NEW.image_media_id_snapshot, v_collectible.image_media_id_snapshot, v_collectible.image_media_id);
  NEW.price_minor_snapshot := COALESCE(NEW.price_minor_snapshot, v_collectible.price_minor);
  NEW.currency_snapshot := COALESCE(NEW.currency_snapshot, v_collectible.currency);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ownership_snapshot ON collectible_ownership;
CREATE TRIGGER trg_ownership_snapshot BEFORE INSERT ON collectible_ownership
  FOR EACH ROW EXECUTE FUNCTION revenue_snapshot_ownership();

CREATE OR REPLACE FUNCTION revenue_guard_ownership_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'immutable_collectible_ownership'; END IF;
  IF OLD.collectible_id IS DISTINCT FROM NEW.collectible_id OR OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.acquisition_type IS DISTINCT FROM NEW.acquisition_type OR OLD.order_id IS DISTINCT FROM NEW.order_id
     OR OLD.acquired_at IS DISTINCT FROM NEW.acquired_at
     OR OLD.collectible_name_snapshot IS DISTINCT FROM NEW.collectible_name_snapshot
     OR OLD.creator_name_snapshot IS DISTINCT FROM NEW.creator_name_snapshot
     OR OLD.rarity_snapshot IS DISTINCT FROM NEW.rarity_snapshot
     OR OLD.image_media_id_snapshot IS DISTINCT FROM NEW.image_media_id_snapshot
     OR OLD.price_minor_snapshot IS DISTINCT FROM NEW.price_minor_snapshot
     OR OLD.currency_snapshot IS DISTINCT FROM NEW.currency_snapshot THEN
    RAISE EXCEPTION 'immutable_collectible_ownership';
  END IF;
  IF auth.role() <> 'service_role' OR NEW.status NOT IN ('refunded', 'reversed', 'revoked')
     OR OLD.status <> 'active' OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'ownership_status_transition_not_authorized';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ownership_immutable ON collectible_ownership;
CREATE TRIGGER trg_ownership_immutable BEFORE UPDATE OR DELETE ON collectible_ownership
  FOR EACH ROW EXECUTE FUNCTION revenue_guard_ownership_mutation();

CREATE OR REPLACE FUNCTION revenue_guard_order_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'immutable_marketplace_order'; END IF;
  IF OLD.buyer_user_id IS DISTINCT FROM NEW.buyer_user_id OR OLD.seller_user_id IS DISTINCT FROM NEW.seller_user_id
     OR OLD.collectible_id IS DISTINCT FROM NEW.collectible_id OR OLD.currency IS DISTINCT FROM NEW.currency
     OR OLD.gross_minor IS DISTINCT FROM NEW.gross_minor OR OLD.platform_fee_minor IS DISTINCT FROM NEW.platform_fee_minor
     OR OLD.intended_seller_share_minor IS DISTINCT FROM NEW.intended_seller_share_minor
     OR OLD.processing_fee_minor IS DISTINCT FROM NEW.processing_fee_minor OR OLD.app_store_fee_minor IS DISTINCT FROM NEW.app_store_fee_minor
     OR OLD.tax_minor IS DISTINCT FROM NEW.tax_minor OR OLD.seller_payable_minor IS DISTINCT FROM NEW.seller_payable_minor
     OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key THEN RAISE EXCEPTION 'immutable_marketplace_accounting'; END IF;
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'marketplace_order_transition_not_authorized'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_marketplace_order_immutable ON marketplace_orders;
CREATE TRIGGER trg_marketplace_order_immutable BEFORE UPDATE OR DELETE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION revenue_guard_order_mutation();

CREATE OR REPLACE FUNCTION revenue_allowance_limit(p_plan_code TEXT, p_kind TEXT)
RETURNS INTEGER LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT allowance_limit FROM revenue_allowance_catalog
  WHERE plan_code = p_plan_code AND allowance_kind = p_kind AND is_active
$$;

-- Re-checking the idempotency row after the user lock closes the race where two
-- retries both observed no row before one of them consumed an allowance.
CREATE OR REPLACE FUNCTION consume_drop_creation_allowance(p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID := auth.uid(); v_period revenue_allowance_periods;
  v_credit_balance INTEGER; v_credit drop_credit_ledger; v_existing drop_creation_consumptions;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(trim(COALESCE(p_idempotency_key, ''))) < 8 THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 0));
  SELECT * INTO v_existing FROM drop_creation_consumptions WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.user_id <> v_user_id THEN RAISE EXCEPTION 'idempotency_key_conflict'; END IF;
    RETURN jsonb_build_object('success', true, 'alreadyConsumed', true, 'source', v_existing.source, 'result', v_existing.result);
  END IF;
  v_period := revenue_ensure_period(v_user_id, 'hunt_drop_creation_weekly');
  SELECT * INTO v_period FROM revenue_allowance_periods WHERE id = v_period.id FOR UPDATE;
  IF v_period.consumed < v_period.allowance_limit THEN
    UPDATE revenue_allowance_periods SET consumed = consumed + 1 WHERE id = v_period.id;
    INSERT INTO drop_creation_consumptions (user_id, idempotency_key, source, period_id)
      VALUES (v_user_id, p_idempotency_key, 'included_weekly', v_period.id);
    RETURN jsonb_build_object('success', true, 'alreadyConsumed', false, 'source', 'included_weekly',
      'remainingIncluded', v_period.allowance_limit - v_period.consumed - 1);
  END IF;
  SELECT COALESCE(SUM(quantity_delta), 0) INTO v_credit_balance FROM drop_credit_ledger WHERE user_id = v_user_id;
  IF v_credit_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reasonCode', 'DROP_ALLOWANCE_EXHAUSTED',
      'userMessage', 'Your included Drops and Extra Drop Credits are used up.');
  END IF;
  INSERT INTO drop_credit_ledger (user_id, quantity_delta, event_type, idempotency_key, reason)
    VALUES (v_user_id, -1, 'consume', 'drop-consume:' || p_idempotency_key, 'Extra Drop creation') RETURNING * INTO v_credit;
  INSERT INTO drop_creation_consumptions (user_id, idempotency_key, source, credit_ledger_id)
    VALUES (v_user_id, p_idempotency_key, 'extra_credit', v_credit.id);
  RETURN jsonb_build_object('success', true, 'alreadyConsumed', false, 'source', 'extra_credit',
    'remainingCredits', v_credit_balance - 1);
END;
$$;

CREATE OR REPLACE FUNCTION acknowledge_paid_collectible_fee(
  p_stop_id UUID, p_disclosure_version TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fee INTEGER; v_creator UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT h.creator_user_id INTO v_creator FROM hunt_stops s JOIN hunts h ON h.id = s.hunt_id
    WHERE s.id = p_stop_id FOR SHARE;
  IF v_creator IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT COALESCE((value->>'basis_points')::INTEGER, 3000) INTO v_fee
    FROM revenue_configuration WHERE key = 'platform_fee_percent';
  INSERT INTO paid_collectible_fee_acknowledgements
    (hunt_stop_id, creator_user_id, platform_fee_basis_points, disclosure_version, idempotency_key)
  VALUES (p_stop_id, v_creator, v_fee, trim(p_disclosure_version), p_idempotency_key)
  ON CONFLICT (hunt_stop_id) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'platformFeeBasisPoints', v_fee);
END;
$$;

CREATE OR REPLACE FUNCTION revenue_record_external_event(
  p_provider_name TEXT, p_provider_event_id TEXT, p_event_kind TEXT, p_subject_type TEXT,
  p_subject_id UUID, p_idempotency_key TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted_revenue_actor_required'; END IF;
  INSERT INTO revenue_external_events (provider_name, provider_event_id, event_kind, subject_type, subject_id, idempotency_key)
  VALUES (trim(p_provider_name), trim(p_provider_event_id), p_event_kind, p_subject_type, p_subject_id, p_idempotency_key)
  ON CONFLICT (provider_name, provider_event_id, event_kind) DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION revenue_capture_external_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind TEXT; v_subject_type TEXT; v_subject_id UUID; v_provider TEXT; v_event_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'marketplace_transaction_events' THEN
    v_provider := NEW.provider_name; v_event_id := NEW.provider_event_id;
    v_subject_type := 'marketplace_order'; v_subject_id := NEW.order_id;
    v_kind := CASE NEW.event_type WHEN 'finalized' THEN 'purchase_finalization'
      WHEN 'refund' THEN 'refund' WHEN 'partial_refund' THEN 'refund'
      WHEN 'chargeback' THEN 'chargeback' WHEN 'reversal' THEN 'reversal' ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'membership_entitlement_events' THEN
    v_provider := NEW.provider_name; v_event_id := NEW.provider_event_id;
    v_subject_type := 'membership_entitlement'; v_subject_id := NEW.entitlement_id; v_kind := 'membership';
  ELSE
    v_provider := NEW.provider_name; v_event_id := NEW.provider_event_id;
    v_subject_type := 'drop_credit_ledger'; v_subject_id := NEW.id; v_kind := 'credit_grant';
  END IF;
  IF v_kind IS NOT NULL AND v_provider IS NOT NULL AND v_event_id IS NOT NULL THEN
    INSERT INTO revenue_external_events
      (provider_name, provider_event_id, event_kind, subject_type, subject_id, idempotency_key)
    VALUES (v_provider, v_event_id, v_kind, v_subject_type, v_subject_id,
      'captured:' || TG_TABLE_NAME || ':' || NEW.id::TEXT)
    ON CONFLICT (provider_name, provider_event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_public_collectible_detail(p_collectible_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_build_object(
    'collectibleId', c.id, 'huntStopId', c.hunt_stop_id, 'name', c.name, 'description', c.description,
    'imageMediaId', c.image_media_id_snapshot, 'rarity', c.rarity_snapshot, 'priceMinor', c.price_minor,
    'currency', c.currency, 'saleStatus', CASE WHEN c.sale_status = 'active'
      AND (c.quantity IS NULL OR c.acquired_count < c.quantity) THEN 'active' ELSE c.sale_status END,
    'remainingQuantity', CASE WHEN c.quantity IS NULL THEN NULL ELSE GREATEST(0, c.quantity - c.acquired_count) END,
    'creatorName', c.creator_name_snapshot
  ), '{}'::jsonb)
  FROM collectibles c WHERE c.id = p_collectible_id
$$;

CREATE OR REPLACE FUNCTION get_public_hunt_drop_detail(p_hunt_stop_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_build_object(
    'huntStopId', s.id, 'title', s.title, 'collectible', CASE WHEN c.id IS NULL THEN NULL ELSE
      jsonb_build_object('id', c.id, 'name', c.name, 'rarity', c.rarity_snapshot, 'priceMinor', c.price_minor,
        'currency', c.currency, 'saleStatus', c.sale_status, 'imageMediaId', c.image_media_id_snapshot) END,
    'discoveryStatus', CASE WHEN commerce.deactivated_at IS NOT NULL THEN 'deactivated'
      WHEN commerce.find_limit IS NOT NULL AND commerce.find_count >= commerce.find_limit THEN 'exhausted' ELSE 'active' END
  ), '{}'::jsonb)
  FROM hunt_stops s LEFT JOIN hunt_drop_commerce commerce ON commerce.hunt_stop_id = s.id
  LEFT JOIN collectibles c ON c.hunt_stop_id = s.id
  WHERE s.id = p_hunt_stop_id AND s.placement_status = 'PASS'
$$;

CREATE OR REPLACE FUNCTION admin_set_revenue_allowance(
  p_actor_user_id UUID, p_plan_code TEXT, p_allowance_kind TEXT, p_limit INTEGER,
  p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_revenue_admin(p_actor_user_id);
  IF p_limit < 0 OR char_length(trim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'invalid_allowance_configuration'; END IF;
  IF EXISTS (SELECT 1 FROM revenue_configuration_history WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true);
  END IF;
  INSERT INTO revenue_allowance_catalog (plan_code, allowance_kind, allowance_limit)
  VALUES (p_plan_code, p_allowance_kind, p_limit)
  ON CONFLICT (plan_code, allowance_kind) DO UPDATE SET allowance_limit = EXCLUDED.allowance_limit, updated_at = now();
  INSERT INTO revenue_configuration_history (configuration_key, value, effective_at, changed_by, reason, idempotency_key)
  VALUES ('allowance:' || p_plan_code || ':' || p_allowance_kind, jsonb_build_object('limit', p_limit), now(),
    p_actor_user_id, trim(p_reason), p_idempotency_key);
  RETURN jsonb_build_object('success', true, 'alreadyApplied', false);
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_revenue_catalog_item(
  p_actor_user_id UUID, p_catalog TEXT, p_code TEXT, p_value JSONB, p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_revenue_admin(p_actor_user_id);
  IF EXISTS (SELECT 1 FROM revenue_configuration_history WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true);
  END IF;
  IF p_catalog = 'membership_plan' THEN
    INSERT INTO membership_plans (code, name, billing_cadence, price_minor, currency, is_active)
    VALUES (p_code, p_value->>'name', p_value->>'billing_cadence', (p_value->>'price_minor')::INTEGER,
      COALESCE(p_value->>'currency', 'USD'), COALESCE((p_value->>'is_active')::BOOLEAN, true))
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, billing_cadence = EXCLUDED.billing_cadence,
      price_minor = EXCLUDED.price_minor, currency = EXCLUDED.currency, is_active = EXCLUDED.is_active;
  ELSIF p_catalog = 'drop_credit_pack' THEN
    INSERT INTO drop_credit_packs (code, credits, price_minor, currency, is_active)
    VALUES (p_code, (p_value->>'credits')::INTEGER, (p_value->>'price_minor')::INTEGER,
      COALESCE(p_value->>'currency', 'USD'), COALESCE((p_value->>'is_active')::BOOLEAN, true))
    ON CONFLICT (code) DO UPDATE SET credits = EXCLUDED.credits, price_minor = EXCLUDED.price_minor,
      currency = EXCLUDED.currency, is_active = EXCLUDED.is_active;
  ELSE RAISE EXCEPTION 'revenue_catalog_not_allowed';
  END IF;
  INSERT INTO revenue_configuration_history (configuration_key, value, effective_at, changed_by, reason, idempotency_key)
  VALUES (p_catalog || ':' || p_code, p_value, now(), p_actor_user_id, trim(p_reason), p_idempotency_key);
  RETURN jsonb_build_object('success', true, 'alreadyApplied', false);
END;
$$;

ALTER TABLE revenue_external_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_external_events FORCE ROW LEVEL SECURITY;
ALTER TABLE revenue_configuration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_configuration_history FORCE ROW LEVEL SECURITY;
ALTER TABLE revenue_allowance_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_allowance_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE paid_collectible_fee_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_collectible_fee_acknowledgements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON revenue_external_events, revenue_configuration_history, revenue_allowance_catalog,
  paid_collectible_fee_acknowledgements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION acknowledge_paid_collectible_fee(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION revenue_record_external_event(TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_public_collectible_detail(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_public_hunt_drop_detail(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_set_revenue_allowance(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_set_revenue_catalog_item(UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_paid_collectible_fee(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revenue_record_external_event(TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_public_collectible_detail(UUID), get_public_hunt_drop_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_revenue_allowance(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_set_revenue_catalog_item(UUID, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;

DROP TRIGGER IF EXISTS trg_external_events_immutable ON revenue_external_events;
CREATE TRIGGER trg_external_events_immutable BEFORE UPDATE OR DELETE ON revenue_external_events
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_configuration_history_immutable ON revenue_configuration_history;
CREATE TRIGGER trg_configuration_history_immutable BEFORE UPDATE OR DELETE ON revenue_configuration_history
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_fee_ack_immutable ON paid_collectible_fee_acknowledgements;
CREATE TRIGGER trg_fee_ack_immutable BEFORE UPDATE OR DELETE ON paid_collectible_fee_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION revenue_prevent_history_mutation();
DROP TRIGGER IF EXISTS trg_capture_marketplace_external_event ON marketplace_transaction_events;
CREATE TRIGGER trg_capture_marketplace_external_event AFTER INSERT ON marketplace_transaction_events
  FOR EACH ROW EXECUTE FUNCTION revenue_capture_external_event();
DROP TRIGGER IF EXISTS trg_capture_membership_external_event ON membership_entitlement_events;
CREATE TRIGGER trg_capture_membership_external_event AFTER INSERT ON membership_entitlement_events
  FOR EACH ROW EXECUTE FUNCTION revenue_capture_external_event();
DROP TRIGGER IF EXISTS trg_capture_credit_external_event ON drop_credit_ledger;
CREATE TRIGGER trg_capture_credit_external_event AFTER INSERT ON drop_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION revenue_capture_external_event();