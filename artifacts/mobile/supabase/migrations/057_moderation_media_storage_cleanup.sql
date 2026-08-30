-- ============================================================
-- Migration 057 — Rejected private-media Storage cleanup
-- Worlds — Build 1
-- ============================================================
-- Storage deletion is intentionally two-phase:
--   1. the trusted worker claims an eligible row and soft-deletes the
--      media_assets record, preserving moderation evidence;
--   2. the worker deletes the private Storage object and records the outcome.
--
-- A failed Storage request leaves the evidence row soft-deleted and the
-- cleanup record retryable. A missing object is a successful terminal outcome.
-- ============================================================

CREATE TABLE IF NOT EXISTS media_retention_cleanups (
  media_id             UUID PRIMARY KEY REFERENCES media_assets(id) ON DELETE RESTRICT,
  bucket               TEXT NOT NULL,
  storage_path         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
  attempt_count        INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_token          UUID,
  lease_acquired_at    TIMESTAMPTZ,
  next_attempt_at      TIMESTAMPTZ,
  storage_delete_outcome TEXT CHECK (storage_delete_outcome IN ('deleted', 'missing')),
  storage_deleted_at   TIMESTAMPTZ,
  failure_classification TEXT CHECK (
    failure_classification IN ('blocked_reference', 'retryable')
  ),
  last_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep this migration safe for databases that already created the table from
-- an earlier version of the cleanup contract. The message comparison is only
-- a one-time legacy backfill; all new state is classified by the RPCs below.
ALTER TABLE media_retention_cleanups
  ADD COLUMN IF NOT EXISTS failure_classification TEXT;

UPDATE media_retention_cleanups
SET failure_classification = CASE
  WHEN status = 'failed'
    AND last_error = 'Media Storage reference changed; manual review required.'
    THEN 'blocked_reference'
  WHEN status = 'failed' THEN 'retryable'
  ELSE NULL
END
WHERE failure_classification IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'media_retention_cleanups_failure_classification_check'
      AND conrelid = 'public.media_retention_cleanups'::regclass
  ) THEN
    ALTER TABLE media_retention_cleanups
      ADD CONSTRAINT media_retention_cleanups_failure_classification_check
      CHECK (failure_classification IN ('blocked_reference', 'retryable'));
  END IF;
END;
$$;

ALTER TABLE media_retention_cleanups ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_media_retention_cleanups_updated_at ON media_retention_cleanups;
CREATE TRIGGER trg_media_retention_cleanups_updated_at
  BEFORE UPDATE ON media_retention_cleanups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_media_retention_cleanups_due
  ON media_retention_cleanups (status, next_attempt_at, updated_at);

GRANT SELECT, INSERT, UPDATE ON TABLE media_retention_cleanups TO service_role;

-- Replace the original candidate query with the private-media-only contract.
-- Existing failed/processing records are returned for retry, including after
-- media_assets.deleted_at has been set during the claim phase.
CREATE OR REPLACE FUNCTION list_moderation_retention_candidates(
  p_rejected_before TIMESTAMPTZ,
  p_exact_location_before TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE(media_id UUID, bucket TEXT, storage_path TEXT, reason TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.bucket, m.storage_path, 'rejected_media'::TEXT
  FROM media_assets m
  LEFT JOIN media_retention_cleanups c ON c.media_id = m.id
  WHERE m.moderation_status = 'rejected'
    AND m.visibility = 'private'
    AND m.bucket IN (
      'avatars', 'quest-media', 'hunt-media', 'custom-game-media',
      'proof-submissions', 'moderation-quarantine'
    )
    AND (
      (
        m.deleted_at IS NULL
        AND m.updated_at < p_rejected_before
        AND (c.media_id IS NULL OR c.status <> 'completed')
      )
      OR (
        c.status IN ('processing', 'failed')
        AND (c.next_attempt_at IS NULL OR c.next_attempt_at <= NOW())
      )
    )
  ORDER BY m.updated_at
  LIMIT 500;
$$;

CREATE OR REPLACE FUNCTION claim_moderation_retention_candidate(
  p_media_id UUID,
  p_rejected_before TIMESTAMPTZ,
  p_worker_id UUID,
  p_lease_seconds INTEGER DEFAULT 300
) RETURNS TABLE(
  media_id UUID,
  bucket TEXT,
  storage_path TEXT,
  lease_token UUID,
  attempt_count INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_media media_assets%ROWTYPE;
  v_cleanup media_retention_cleanups%ROWTYPE;
  v_lease UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted worker required'; END IF;
  IF p_media_id IS NULL OR p_worker_id IS NULL
     OR p_rejected_before IS NULL
     OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid moderation retention claim';
  END IF;

  SELECT m.* INTO v_media
  FROM media_assets AS m
  WHERE m.id = p_media_id
    AND m.moderation_status = 'rejected'
    AND m.visibility = 'private'
    AND m.bucket IN (
      'avatars', 'quest-media', 'hunt-media', 'custom-game-media',
      'proof-submissions', 'moderation-quarantine'
    )
    AND (
      (m.deleted_at IS NULL AND m.updated_at < p_rejected_before)
      OR EXISTS (
        SELECT 1
        FROM media_retention_cleanups AS c
        WHERE c.media_id = m.id
          AND c.status IN ('processing', 'failed')
      )
    )
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT c.* INTO v_cleanup
  FROM media_retention_cleanups AS c
  WHERE c.media_id = p_media_id
  FOR UPDATE;

  IF v_cleanup.media_id IS NOT NULL THEN
    IF v_cleanup.status = 'completed'
       OR (
         v_cleanup.status = 'processing'
         AND v_cleanup.lease_acquired_at > NOW() - make_interval(secs => p_lease_seconds)
       )
       OR (
         v_cleanup.status = 'failed'
         AND v_cleanup.next_attempt_at IS NOT NULL
         AND v_cleanup.next_attempt_at > NOW()
       ) THEN
      RETURN;
    END IF;
    IF v_cleanup.bucket <> v_media.bucket OR v_cleanup.storage_path <> v_media.storage_path THEN
      UPDATE media_retention_cleanups
      SET status = 'failed',
          next_attempt_at = NULL,
          failure_classification = 'blocked_reference',
          last_error = 'Media Storage reference changed; manual review required.',
          lease_token = NULL,
          lease_acquired_at = NULL
      WHERE media_retention_cleanups.media_id = p_media_id;
      RETURN;
    END IF;
  END IF;

  v_lease := gen_random_uuid();
  INSERT INTO media_retention_cleanups (
    media_id, bucket, storage_path, status, attempt_count,
    lease_token, lease_acquired_at, next_attempt_at,
    storage_delete_outcome, storage_deleted_at, failure_classification, last_error
  )
  VALUES (
    p_media_id, v_media.bucket, v_media.storage_path, 'processing', 1,
    v_lease, NOW(), NULL, NULL, NULL, NULL, NULL
  )
  ON CONFLICT ON CONSTRAINT media_retention_cleanups_pkey DO UPDATE SET
    bucket = EXCLUDED.bucket,
    storage_path = EXCLUDED.storage_path,
    status = 'processing',
    attempt_count = media_retention_cleanups.attempt_count + 1,
    lease_token = EXCLUDED.lease_token,
    lease_acquired_at = EXCLUDED.lease_acquired_at,
    next_attempt_at = NULL,
    storage_delete_outcome = NULL,
    failure_classification = NULL,
    last_error = NULL;

  -- Soft-delete only after the retention boundary and all eligibility checks
  -- above have succeeded. This keeps the moderation row queryable.
  UPDATE media_assets
  SET deleted_at = COALESCE(deleted_at, NOW())
  WHERE id = p_media_id;

  RETURN QUERY
  SELECT p_media_id, v_media.bucket, v_media.storage_path, v_lease,
         (SELECT c.attempt_count FROM media_retention_cleanups AS c WHERE c.media_id = p_media_id);
END;
$$;

CREATE OR REPLACE FUNCTION complete_moderation_retention_candidate(
  p_media_id UUID,
  p_lease_token UUID,
  p_outcome TEXT,
  p_error TEXT DEFAULT NULL,
  p_retry_minutes INTEGER DEFAULT 15,
  p_failure_classification TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cleanup media_retention_cleanups%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'trusted worker required'; END IF;
  IF p_media_id IS NULL OR p_lease_token IS NULL
     OR p_outcome NOT IN ('deleted', 'missing', 'failed')
     OR p_retry_minutes < 1 OR p_retry_minutes > 1440
     OR (p_outcome = 'failed' AND p_failure_classification IS DISTINCT FROM 'retryable')
     OR (p_outcome <> 'failed' AND p_failure_classification IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid moderation retention completion';
  END IF;

  SELECT * INTO v_cleanup
  FROM media_retention_cleanups
  WHERE media_id = p_media_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'missing_claim');
  END IF;
  IF v_cleanup.status = 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'completed',
      'outcome', v_cleanup.storage_delete_outcome
    );
  END IF;
  IF v_cleanup.lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN jsonb_build_object('status', 'lease_lost');
  END IF;

  IF p_outcome = 'failed' THEN
    UPDATE media_retention_cleanups
    SET status = 'failed',
        next_attempt_at = NOW() + make_interval(mins => p_retry_minutes),
        lease_token = NULL,
        lease_acquired_at = NULL,
        failure_classification = p_failure_classification,
        last_error = LEFT(COALESCE(NULLIF(TRIM(p_error), ''), 'Storage deletion failed.'), 1000)
    WHERE media_id = p_media_id;
  ELSE
    UPDATE media_retention_cleanups
    SET status = 'completed',
        next_attempt_at = NULL,
        lease_token = NULL,
        lease_acquired_at = NULL,
        storage_delete_outcome = p_outcome,
        storage_deleted_at = NOW(),
        failure_classification = NULL,
        last_error = NULL
    WHERE media_id = p_media_id;
    PERFORM log_admin_action(
      NULL, NULL, 'moderation_media_storage_deleted', 'media', p_media_id,
      NULL, jsonb_build_object('storage_outcome', p_outcome),
      jsonb_build_object('retention_cleanup', TRUE)
    );
  END IF;

  RETURN jsonb_build_object('status', 'completed', 'outcome', p_outcome);
END;
$$;

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'list_moderation_retention_candidates',
        'claim_moderation_retention_candidate',
        'complete_moderation_retention_candidate'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END;
$$;