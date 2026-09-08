-- Migration 080: repair Hunt stop-progress states used by Hunt mechanics
--
-- Hunt stop progress uses the shared step_status enum, while the Hunt lifecycle
-- has historically used a richer vocabulary. Add the missing values
-- forward-only for linked databases. Migration 077 compares the status as TEXT
-- so a fresh database can create that function before this repair is reached.

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'available';

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'locked';

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'awaiting_proof';

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'under_review';

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'needs_resubmission';

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'rejected';

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'expired';