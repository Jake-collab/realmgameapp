-- ============================================================
-- Migration 042 — Prompt 20 trusted moderation workflows
-- Worlds — Build 1
-- ============================================================
-- All writes in this migration are service-role RPCs. Ordinary clients
-- receive only their own report status and never provider/risk internals.

CREATE TABLE IF NOT EXISTS moderation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  context TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  provider TEXT,
  model TEXT,
  result JSONB,
  policy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS point_quarantines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL UNIQUE REFERENCES points_ledger(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  risk_snapshot_id UUID REFERENCES integrity_risk_snapshots(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'released', 'reversed')),
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE moderation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_quarantines ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_cases
  ADD COLUMN IF NOT EXISTS priority report_priority NOT NULL DEFAULT 'medium';
-- No permissive policies: service_role and trusted RPCs only.

CREATE INDEX IF NOT EXISTS idx_moderation_requests_entity
  ON moderation_requests(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_quarantines_user_status
  ON point_quarantines(user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION record_moderation_result(
  p_idempotency_key TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_context TEXT,
  p_content_hash TEXT,
  p_status TEXT,
  p_provider TEXT,
  p_model TEXT,
  p_result JSONB,
  p_policy_version TEXT
) RETURNS TABLE(request_id UUID, reused BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM moderation_requests WHERE idempotency_key = p_idempotency_key;
  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, TRUE;
    RETURN;
  END IF;

  INSERT INTO moderation_requests
    (idempotency_key, entity_type, entity_id, context, content_hash, status,
     provider, model, result, policy_version)
  VALUES
    (p_idempotency_key, p_entity_type, p_entity_id, p_context, p_content_hash,
     p_status, p_provider, p_model, p_result, p_policy_version)
  RETURNING id INTO v_id;

  -- Keep the queue transactionally aligned with the moderation request.
  -- Safe results do not create staff work; anything flagged or requiring
  -- review gets a case with provider internals retained server-side only.
  IF COALESCE((p_result ->> 'reviewRequired')::BOOLEAN, TRUE)
     OR COALESCE(p_result ->> 'outcome', 'manual_review') <> 'allow' THEN
    INSERT INTO moderation_cases (
      entity_type, entity_id, status, automated_provider, automated_result,
      moderation_decision, moderation_policy_version, idempotency_key,
      priority, created_at, updated_at
    )
    VALUES (
      p_entity_type, p_entity_id, 'open', p_provider,
      jsonb_build_object('decision', p_result ->> 'decision', 'categories', p_result -> 'categories'),
      p_result ->> 'decision', p_policy_version,
      'moderation:' || p_idempotency_key, 'medium', NOW(), NOW()
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_id, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION claim_moderation_case(
  p_case_id UUID,
  p_moderator_id UUID
) RETURNS SETOF moderation_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE moderation_cases
  SET moderator_id = p_moderator_id,
      claimed_by = p_moderator_id,
      claimed_at = NOW(),
      status = 'under_review',
      updated_at = NOW()
  WHERE id = p_case_id
    AND (moderator_id IS NULL OR moderator_id = p_moderator_id)
    AND status IN ('open', 'under_review')
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION decide_moderation_case(
  p_case_id UUID,
  p_moderator_id UUID,
  p_decision TEXT,
  p_reason TEXT,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF moderation_cases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF char_length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A moderation decision reason is required';
  END IF;
  RETURN QUERY
  UPDATE moderation_cases
  SET moderator_id = COALESCE(moderator_id, p_moderator_id),
      decision = p_decision,
      decision_reason = trim(p_reason),
      moderation_internal_reason = trim(p_reason),
      status = CASE WHEN p_decision = 'no_action' THEN 'dismissed'::moderation_case_status ELSE 'action_taken'::moderation_case_status END,
      resolved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_case_id
    AND (moderator_id IS NULL OR moderator_id = p_moderator_id)
    AND (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at)
    AND status IN ('open', 'under_review')
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION quarantine_points(
  p_ledger_id UUID,
  p_reason TEXT,
  p_risk_snapshot_id UUID DEFAULT NULL
) RETURNS SETOF point_quarantines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO point_quarantines (ledger_id, user_id, reason, risk_snapshot_id)
  SELECT id, user_id, trim(p_reason), p_risk_snapshot_id
  FROM points_ledger
  WHERE id = p_ledger_id
  ON CONFLICT (ledger_id) DO NOTHING;
  RETURN QUERY SELECT * FROM point_quarantines WHERE ledger_id = p_ledger_id;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_point_quarantine(
  p_quarantine_id UUID,
  p_moderator_id UUID,
  p_action TEXT,
  p_reason TEXT
) RETURNS SETOF point_quarantines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q point_quarantines;
  v_ledger points_ledger;
BEGIN
  SELECT * INTO v_q FROM point_quarantines WHERE id = p_quarantine_id FOR UPDATE;
  IF v_q.id IS NULL OR v_q.status <> 'quarantined' THEN
    RETURN;
  END IF;
  IF p_action = 'reverse' THEN
    SELECT * INTO v_ledger FROM points_ledger WHERE id = v_q.ledger_id;
    INSERT INTO points_ledger
      (user_id, amount, transaction_type, source_type, source_id, reason,
       idempotency_key, created_by, reversed_transaction_id)
    VALUES
      (v_ledger.user_id, v_ledger.amount, 'reversal', 'admin', v_ledger.source_id,
       trim(p_reason), 'quarantine-reversal:' || v_q.id, p_moderator_id, v_ledger.id)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  UPDATE point_quarantines
  SET status = CASE WHEN p_action = 'release' THEN 'released' ELSE 'reversed' END,
      resolved_by = p_moderator_id, resolved_at = NOW()
  WHERE id = v_q.id;
  RETURN QUERY SELECT * FROM point_quarantines WHERE id = v_q.id;
END;
$$;

REVOKE ALL ON FUNCTION record_moderation_result(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_moderation_case(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_moderation_case(UUID,UUID,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION quarantine_points(UUID,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_point_quarantine(UUID,UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_moderation_result(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION claim_moderation_case(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION decide_moderation_case(UUID,UUID,TEXT,TEXT,TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION quarantine_points(UUID,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_point_quarantine(UUID,UUID,TEXT,TEXT) TO service_role;