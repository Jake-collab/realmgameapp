-- Migration 039 — Quest write integrity
-- Prevent an authenticated participant from attaching an objective from a
-- different Quest to their own participation. RLS proves row ownership, while
-- this trigger proves the relationship between the two rows.

CREATE OR REPLACE FUNCTION validate_quest_step_progress_quest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participation_quest_id UUID;
  objective_quest_id UUID;
BEGIN
  SELECT quest_id INTO participation_quest_id
  FROM quest_participations
  WHERE id = NEW.participation_id;

  SELECT quest_id INTO objective_quest_id
  FROM quest_objectives
  WHERE id = NEW.quest_step_id;

  IF participation_quest_id IS NULL
     OR objective_quest_id IS NULL
     OR participation_quest_id <> objective_quest_id THEN
    RAISE EXCEPTION 'Objective does not belong to participation Quest.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quest_step_progress_quest
  ON quest_step_progress;

CREATE TRIGGER trg_validate_quest_step_progress_quest
  BEFORE INSERT OR UPDATE OF participation_id, quest_step_id
  ON quest_step_progress
  FOR EACH ROW
  EXECUTE FUNCTION validate_quest_step_progress_quest();

COMMENT ON FUNCTION validate_quest_step_progress_quest IS
  'Rejects quest step progress when the objective belongs to another Quest.';