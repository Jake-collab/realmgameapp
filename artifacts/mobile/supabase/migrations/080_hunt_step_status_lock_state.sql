-- Migration 080: repair the Hunt stop lock state used by advanced mechanics
--
-- Hunt stop progress uses the shared step_status enum. Older Hunt functions
-- already treat `locked` as a valid state, so add it forward-only for linked
-- databases. Migration 077 compares the status as TEXT so a fresh database can
-- create that function before this enum repair migration is reached.

ALTER TYPE public.step_status
  ADD VALUE IF NOT EXISTS 'locked';