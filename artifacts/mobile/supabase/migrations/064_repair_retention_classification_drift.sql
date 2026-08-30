-- ============================================================
-- Migration 064 — Repair retention classification schema drift
-- Worlds — Build 1
-- ============================================================
-- Migration 057 is present in the remote migration ledger, but the
-- classification column and constraint are absent from the live table.
-- Repair the missing forward state without rewriting migration history.
-- ============================================================

ALTER TABLE public.media_retention_cleanups
  ADD COLUMN IF NOT EXISTS failure_classification TEXT;

UPDATE public.media_retention_cleanups
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
    ALTER TABLE public.media_retention_cleanups
      ADD CONSTRAINT media_retention_cleanups_failure_classification_check
      CHECK (failure_classification IN ('blocked_reference', 'retryable'));
  END IF;
END;
$$;