-- ============================================================
-- Migration 032 — Prompt 20 report-to-case linking
-- Worlds — Build 1
-- ============================================================

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS moderation_case_id UUID REFERENCES moderation_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS normalized_reason TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_report_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reports_moderation_case
  ON reports(moderation_case_id) WHERE moderation_case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_target_reason
  ON reports(entity_type, entity_id, reason, created_at DESC);

CREATE OR REPLACE FUNCTION enqueue_report_moderation_case()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_case_id UUID;
  v_priority report_priority;
  v_reason TEXT;
BEGIN
  v_reason := lower(regexp_replace(trim(NEW.reason), '[^a-zA-Z0-9]+', '_', 'g'));
  NEW.normalized_reason := v_reason;
  v_priority := CASE
    WHEN v_reason IN ('child_safety', 'imminent_danger', 'threat', 'self_harm', 'graphic_violence')
      THEN 'critical'::report_priority
    ELSE 'medium'::report_priority
  END;

  -- A repeated report from the same reporter for the same target/reason is
  -- retained for audit but linked as a duplicate rather than creating noise.
  SELECT id INTO NEW.duplicate_of
  FROM reports
  WHERE reporter_user_id = NEW.reporter_user_id
    AND entity_type = NEW.entity_type
    AND entity_id = NEW.entity_id
    AND normalized_reason = v_reason
    AND id <> NEW.id
    AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO moderation_cases (
    entity_type, entity_id, status, risk_categories, moderation_policy_version,
    idempotency_key, source_report_id, created_at, updated_at
  )
  VALUES (
    NEW.entity_type::TEXT, NEW.entity_id, 'open', ARRAY[v_reason],
    'worlds-moderation-1', 'report:' || NEW.id, NEW.id, NOW(), NOW()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_case_id;

  NEW.moderation_case_id := v_case_id;

  UPDATE reports
  SET related_report_count = (
    SELECT COUNT(*)::INTEGER FROM reports r
    WHERE r.entity_type = NEW.entity_type AND r.entity_id = NEW.entity_id
      AND r.status NOT IN ('closed', 'dismissed')
  )
  WHERE entity_type = NEW.entity_type AND entity_id = NEW.entity_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_report_moderation_case ON reports;
CREATE TRIGGER trg_enqueue_report_moderation_case
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION enqueue_report_moderation_case();

REVOKE ALL ON FUNCTION enqueue_report_moderation_case() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_report_moderation_case() TO service_role;

COMMENT ON COLUMN reports.moderation_case_id IS
  'Trusted linkage to the case created by the report intake trigger; never visible to the reported user.';