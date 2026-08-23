-- ============================================================
-- Migration 030 — Prompt 20 publication gates and retention
-- Worlds — Build 1
-- ============================================================

-- Client-owned rows may never self-approve, alter moderation metadata,
-- attach a provider result, or move a file into the quarantine bucket.
CREATE OR REPLACE FUNCTION prevent_client_moderation_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF TG_TABLE_NAME = 'media_assets' AND (
      NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
      OR NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason
      OR NEW.moderation_provider IS DISTINCT FROM OLD.moderation_provider
      OR NEW.moderation_checked_at IS DISTINCT FROM OLD.moderation_checked_at
      OR NEW.moderation_categories IS DISTINCT FROM OLD.moderation_categories
      OR NEW.moderation_policy_version IS DISTINCT FROM OLD.moderation_policy_version
      OR NEW.moderation_review_required IS DISTINCT FROM OLD.moderation_review_required
      OR NEW.moderation_reviewed_by IS DISTINCT FROM OLD.moderation_reviewed_by
      OR NEW.moderation_reviewed_at IS DISTINCT FROM OLD.moderation_reviewed_at
      OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    ) THEN
      RAISE EXCEPTION 'Only trusted server workflows may change media moderation state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_media_moderation_guard ON media_assets;
CREATE TRIGGER trg_client_media_moderation_guard
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION prevent_client_moderation_mutation();

CREATE OR REPLACE FUNCTION prevent_client_proof_moderation_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.moderation_provider IS DISTINCT FROM OLD.moderation_provider
    OR NEW.moderation_model IS DISTINCT FROM OLD.moderation_model
    OR NEW.moderation_checked_at IS DISTINCT FROM OLD.moderation_checked_at
    OR NEW.moderation_categories IS DISTINCT FROM OLD.moderation_categories
    OR NEW.moderation_policy_version IS DISTINCT FROM OLD.moderation_policy_version
    OR NEW.moderation_review_required IS DISTINCT FROM OLD.moderation_review_required
    OR NEW.integrity_risk_snapshot_id IS DISTINCT FROM OLD.integrity_risk_snapshot_id
  ) THEN
    RAISE EXCEPTION 'Only trusted server workflows may change proof safety metadata';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_proof_moderation_guard ON proof_submissions;
CREATE TRIGGER trg_client_proof_moderation_guard
  BEFORE UPDATE ON proof_submissions
  FOR EACH ROW EXECUTE FUNCTION prevent_client_proof_moderation_mutation();

-- Keep old owner updates for ordinary metadata, but make the invariant
-- explicit for future policies and reviewers.
COMMENT ON POLICY "media_owner_soft_delete" ON media_assets IS
  'Owners may update ordinary metadata and soft-delete. Moderation columns are guarded by a server-only trigger.';

-- Retention is deliberately a trusted, bounded operation. It returns IDs
-- for a worker to delete from Supabase Storage after the database soft-delete.
CREATE OR REPLACE FUNCTION list_moderation_retention_candidates(
  p_rejected_before TIMESTAMPTZ,
  p_exact_location_before TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE(media_id UUID, bucket TEXT, storage_path TEXT, reason TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, bucket, storage_path, 'rejected_media'::TEXT
  FROM media_assets
  WHERE moderation_status = 'rejected'
    AND deleted_at IS NULL
    AND updated_at < p_rejected_before
  ORDER BY updated_at
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION list_moderation_retention_candidates(TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_moderation_retention_candidates(TIMESTAMPTZ,TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION list_moderation_retention_candidates IS
  'Returns bounded rejected-media cleanup candidates. Storage deletion is a separate service-role job; private proof media is never returned by this function.';