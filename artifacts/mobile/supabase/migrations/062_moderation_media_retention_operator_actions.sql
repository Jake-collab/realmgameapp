-- ============================================================
-- Migration 062 — Moderated media-retention operator actions
-- Worlds — Build 1
-- ============================================================
-- Moderators may reconcile a blocked cleanup only through this trusted RPC.
-- The RPC verifies the current canonical media reference while holding both
-- rows locked; it never accepts a bucket/path from the browser and never
-- performs Storage deletion itself.
-- ============================================================

ALTER TABLE media_retention_cleanups
  DROP CONSTRAINT IF EXISTS media_retention_cleanups_status_check;

ALTER TABLE media_retention_cleanups
  ADD CONSTRAINT media_retention_cleanups_status_check
  CHECK (status IN ('pending', 'processing', 'failed', 'completed', 'resolved'));

ALTER TABLE media_retention_cleanups
  ADD COLUMN IF NOT EXISTS operator_resolution TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'media_retention_cleanups_operator_resolution_check'
      AND conrelid = 'public.media_retention_cleanups'::regclass
  ) THEN
    ALTER TABLE media_retention_cleanups
      ADD CONSTRAINT media_retention_cleanups_operator_resolution_check
      CHECK (operator_resolution IS NULL OR operator_resolution = 'moderator_resolved');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_media_retention_cleanups_resolved
  ON media_retention_cleanups (status, resolved_at DESC);

CREATE OR REPLACE FUNCTION moderate_media_retention_cleanup(
  p_media_id UUID,
  p_action TEXT,
  p_reference_fingerprint TEXT,
  p_actor_id UUID,
  p_actor_role TEXT,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_media media_assets%ROWTYPE;
  v_cleanup media_retention_cleanups%ROWTYPE;
  v_before JSONB;
  v_after JSONB;
  v_safe_reason TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'trusted moderator action required';
  END IF;

  IF p_media_id IS NULL
     OR p_action NOT IN ('requeue', 'resolve')
     OR p_reference_fingerprint IS NULL
     OR p_reference_fingerprint !~* '^[0-9a-f]{32}$'
     OR p_actor_id IS NULL
     OR p_actor_role NOT IN ('moderator', 'admin', 'super_admin')
     OR p_reason IS NULL
     OR char_length(trim(p_reason)) < 1
     OR char_length(trim(p_reason)) > 1000 THEN
    RAISE EXCEPTION 'invalid moderation retention action';
  END IF;

  -- Match the worker's lock order to avoid races with a claim.
  SELECT * INTO v_media
  FROM media_assets
  WHERE id = p_media_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'media_missing');
  END IF;

  SELECT * INTO v_cleanup
  FROM media_retention_cleanups
  WHERE media_id = p_media_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'cleanup_missing');
  END IF;

  IF v_cleanup.status <> 'failed'
     OR v_cleanup.failure_classification <> 'blocked_reference' THEN
    RETURN jsonb_build_object('status', 'not_blocked');
  END IF;

  IF v_media.bucket NOT IN (
       'avatars', 'quest-media', 'hunt-media', 'custom-game-media',
       'proof-submissions', 'moderation-quarantine'
     )
     OR v_media.storage_path IS NULL
     OR v_media.storage_path = ''
     OR v_media.storage_path LIKE '/%'
     OR position(E'\\' IN v_media.storage_path) > 0
     OR v_media.storage_path ~ '(^|/)(\.{1,2})(/|$)'
     OR md5(v_media.bucket || '|' || v_media.storage_path)
          <> lower(p_reference_fingerprint) THEN
    RETURN jsonb_build_object('status', 'reference_mismatch');
  END IF;

  v_before := jsonb_build_object(
    'status', v_cleanup.status,
    'failure_classification', v_cleanup.failure_classification,
    'attempt_count', v_cleanup.attempt_count,
    'updated_at', v_cleanup.updated_at
  );

  -- Keep operator-entered audit text bounded and prevent known sensitive
  -- references from being copied into the immutable audit snapshot.
  v_safe_reason := left(trim(p_reason), 1000);
  v_safe_reason := replace(v_safe_reason, v_media.storage_path, '[redacted storage reference]');
  v_safe_reason := replace(v_safe_reason, v_media.bucket || '/' || v_media.storage_path, '[redacted storage reference]');
  v_safe_reason := regexp_replace(v_safe_reason, 'https?://[^\s,;)]+', '[redacted URL]', 'gi');

  IF p_action = 'requeue' THEN
    UPDATE media_retention_cleanups
    SET bucket = v_media.bucket,
        storage_path = v_media.storage_path,
        status = 'failed',
        next_attempt_at = NOW(),
        lease_token = NULL,
        lease_acquired_at = NULL,
        storage_delete_outcome = NULL,
        storage_deleted_at = NULL,
        failure_classification = 'retryable',
        operator_resolution = NULL,
        resolved_at = NULL,
        resolved_by = NULL,
        last_error = 'Requeued after moderator confirmed the canonical media reference.'
    WHERE media_id = p_media_id;
    v_after := jsonb_build_object(
      'status', 'failed',
      'failure_classification', 'retryable',
      'action', 'requeue'
    );
  ELSE
    UPDATE media_retention_cleanups
    SET bucket = v_media.bucket,
        storage_path = v_media.storage_path,
        status = 'resolved',
        next_attempt_at = NULL,
        lease_token = NULL,
        lease_acquired_at = NULL,
        storage_delete_outcome = NULL,
        storage_deleted_at = NULL,
        failure_classification = NULL,
        operator_resolution = 'moderator_resolved',
        resolved_at = NOW(),
        resolved_by = p_actor_id,
        last_error = NULL
    WHERE media_id = p_media_id;
    v_after := jsonb_build_object(
      'status', 'resolved',
      'operator_resolution', 'moderator_resolved',
      'action', 'resolve'
    );
  END IF;

  PERFORM log_admin_action(
    p_actor_id,
    p_actor_role::user_role,
    CASE WHEN p_action = 'requeue'
      THEN 'moderation_media_retention_requeued'
      ELSE 'moderation_media_retention_resolved'
    END,
    'media',
    p_media_id,
    v_before,
    v_after,
    jsonb_build_object(
      'reason', v_safe_reason,
      'reference_fingerprint', lower(p_reference_fingerprint),
      'service_role_cleanup_boundary', TRUE
    )
  );

  RETURN jsonb_build_object(
    'status', 'completed',
    'action', p_action,
    'media_id', p_media_id
  );
END;
$$;

REVOKE ALL ON FUNCTION moderate_media_retention_cleanup(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION moderate_media_retention_cleanup(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;