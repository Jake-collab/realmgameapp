-- Migration 074 — RevenueCat verified-event adapter
-- Only the service-role webhook adapter may call this function. It converts
-- normalized RevenueCat facts into the provider-neutral ledgers from 071.

CREATE OR REPLACE FUNCTION revenuecat_apply_verified_event(
  p_event_id TEXT, p_event_type TEXT, p_app_user_id UUID, p_product_id TEXT,
  p_transaction_id TEXT, p_collectible_order_id UUID DEFAULT NULL,
  p_amount_minor INTEGER DEFAULT NULL, p_currency TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan TEXT;
  v_credits INTEGER;
  v_order marketplace_orders;
  v_result JSONB;
  v_entitlement_id UUID;
  v_existing revenue_external_events;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted_revenue_actor_required'; END IF;
  IF char_length(trim(COALESCE(p_event_id, ''))) = 0
    OR char_length(trim(COALESCE(p_event_type, ''))) = 0
    OR char_length(trim(COALESCE(p_product_id, ''))) = 0
    OR char_length(trim(COALESCE(p_transaction_id, ''))) = 0 THEN
    RAISE EXCEPTION 'invalid_revenuecat_event';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('revenuecat:' || p_event_id, 0));
  SELECT * INTO v_existing FROM revenue_external_events
  WHERE provider_name = 'revenuecat' AND provider_event_id = p_event_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'alreadyApplied', true, 'kind', v_existing.event_kind);
  END IF;

  v_plan := CASE p_product_id
    WHEN 'worlds_monthly' THEN 'worlds_monthly'
    WHEN 'worlds_yearly' THEN 'worlds_yearly'
    ELSE NULL
  END;
  v_credits := CASE p_product_id
    WHEN 'drop_credits_5' THEN 5
    WHEN 'drop_credits_15' THEN 15
    WHEN 'drop_credits_35' THEN 35
    ELSE NULL
  END;

  IF v_plan IS NOT NULL THEN
    IF p_event_type IN ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'CANCELLATION') THEN
      -- Cancellation disables renewal but access remains active until the
      -- provider-supplied expiration. EXPIRATION is the revocation boundary.
      v_result := apply_membership_entitlement(
        p_app_user_id, v_plan, 'active', NOW(), p_expires_at,
        'revenuecat:membership:' || p_event_id, 'revenuecat', p_transaction_id
      );
    ELSIF p_event_type IN ('EXPIRATION', 'BILLING_ISSUE', 'REFUND') THEN
      v_result := apply_membership_entitlement(
        p_app_user_id, v_plan,
        CASE WHEN p_event_type = 'BILLING_ISSUE' THEN 'paused' ELSE 'expired' END,
        NOW(), p_expires_at, 'revenuecat:membership:' || p_event_id,
        'revenuecat', p_transaction_id
      );
    ELSE
      RAISE EXCEPTION 'unsupported_membership_event';
    END IF;
    SELECT id INTO v_entitlement_id FROM membership_entitlements WHERE user_id = p_app_user_id;
    INSERT INTO revenue_external_events
      (provider_name, provider_event_id, event_kind, subject_type, subject_id, idempotency_key)
    VALUES (
      'revenuecat', p_event_id, 'membership', 'membership_entitlement',
      v_entitlement_id, 'revenuecat:event:' || p_event_id
    );
    RETURN v_result || jsonb_build_object('kind', 'membership');
  END IF;

  IF v_credits IS NOT NULL THEN
    IF upper(COALESCE(p_currency, '')) <> 'USD' OR p_amount_minor IS NULL
      OR p_amount_minor <> (
        CASE p_product_id
          WHEN 'drop_credits_5' THEN 199
          WHEN 'drop_credits_15' THEN 499
          ELSE 999
        END
      ) THEN
      RAISE EXCEPTION 'revenuecat_product_amount_mismatch';
    END IF;
    IF p_event_type IN ('INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE') THEN
      v_result := grant_extra_drop_credits(
        p_app_user_id, v_credits, 'revenuecat:credit:' || p_event_id,
        'revenuecat', p_event_id, 'RevenueCat verified purchase'
      );
    ELSIF p_event_type IN ('REFUND', 'CANCELLATION') THEN
      INSERT INTO drop_credit_ledger
        (user_id, quantity_delta, event_type, idempotency_key, provider_name, provider_event_id, reason)
      VALUES (
        p_app_user_id, -v_credits, 'reversal',
        'revenuecat:credit-reversal:' || p_event_id, 'revenuecat',
        p_event_id, 'RevenueCat verified reversal'
      );
      v_result := jsonb_build_object('success', true);
    ELSE
      RAISE EXCEPTION 'unsupported_credit_event';
    END IF;
    RETURN v_result || jsonb_build_object('kind', 'credit_grant');
  END IF;

  IF p_product_id ~ '^collectible_[0-9]+$' THEN
    IF p_collectible_order_id IS NULL THEN RAISE EXCEPTION 'collectible_order_reference_required'; END IF;
    SELECT * INTO v_order FROM marketplace_orders
    WHERE id = p_collectible_order_id AND buyer_user_id = p_app_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'pending_order_not_found_for_buyer'; END IF;
    IF p_product_id <> 'collectible_' || v_order.gross_minor::TEXT
      OR upper(COALESCE(p_currency, '')) <> v_order.currency
      OR p_amount_minor IS NULL OR p_amount_minor <> v_order.gross_minor THEN
      RAISE EXCEPTION 'revenuecat_collectible_amount_mismatch';
    END IF;
    IF p_event_type IN ('INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE') THEN
      IF v_order.state <> 'pending' THEN RAISE EXCEPTION 'collectible_order_not_pending'; END IF;
      v_result := finalize_collectible_purchase(
        v_order.id, 'revenuecat', p_transaction_id, p_event_id
      );
    ELSIF p_event_type IN ('REFUND', 'CANCELLATION') THEN
      IF v_order.provider_name IS DISTINCT FROM 'revenuecat'
        OR v_order.provider_transaction_id IS DISTINCT FROM p_transaction_id THEN
        RAISE EXCEPTION 'revenuecat_collectible_transaction_mismatch';
      END IF;
      v_result := reverse_collectible_purchase(
        v_order.id, 'refund', p_event_id, p_amount_minor
      );
    ELSE
      RAISE EXCEPTION 'unsupported_collectible_event';
    END IF;
    RETURN v_result || jsonb_build_object('kind', 'collectible');
  END IF;

  RAISE EXCEPTION 'unsupported_revenuecat_product';
END;
$$;

REVOKE ALL ON FUNCTION revenuecat_apply_verified_event(
  TEXT, TEXT, UUID, TEXT, TEXT, UUID, INTEGER, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION revenuecat_apply_verified_event(
  TEXT, TEXT, UUID, TEXT, TEXT, UUID, INTEGER, TEXT, TIMESTAMPTZ
) TO service_role;