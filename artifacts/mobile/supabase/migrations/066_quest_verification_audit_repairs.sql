-- Migration 066 — Quest verification audit repairs
--
-- Forward-only repair for production environments where migration 065 has
-- already been applied.

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_timer_requires_integrity;
ALTER TABLE quests
  ADD CONSTRAINT quests_timer_requires_integrity CHECK (
    verification_methods IS NULL
    OR NOT ('timer' = ANY(verification_methods))
    OR 'integrity_confirmation' = ANY(verification_methods)
  );

ALTER TABLE quests
  DROP CONSTRAINT IF EXISTS quests_timer_duration_matches_method;
ALTER TABLE quests
  ADD CONSTRAINT quests_timer_duration_matches_method CHECK (
    verification_methods IS NULL
    OR (
      (
        'timer' = ANY(verification_methods)
        AND required_duration_minutes BETWEEN 1 AND 1440
      )
      OR (
        NOT ('timer' = ANY(verification_methods))
        AND required_duration_minutes IS NULL
      )
    )
  );

-- Migration 065 used the obsolete proof_media.proof_id name. Repair the live
-- function definition without duplicating the full security-definer function.
DO $repair_complete_quest$
DECLARE
  v_definition TEXT;
  v_repaired TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'complete_quest(uuid,uuid,text)'::regprocedure
  ) INTO v_definition;

  v_repaired := replace(
    v_definition,
    'pm.proof_id = ps.id',
    'pm.submission_id = ps.id'
  );

  IF v_repaired <> v_definition THEN
    EXECUTE v_repaired;
  END IF;
END;
$repair_complete_quest$;

REVOKE ALL ON FUNCTION complete_quest(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_quest(UUID, UUID, TEXT) TO authenticated;