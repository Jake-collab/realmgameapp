-- Cover updates that move an existing Quest into a canonical Quest type.
-- The previous trigger only observed status, difficulty, and points_reward, so
-- a quest_type-only update was not evaluated by the canonical reward boundary.

CREATE OR REPLACE FUNCTION enforce_canonical_quest_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected INTEGER;
BEGIN
  -- `very_easy` remains in the shared enum only for historical compatibility.
  -- Quest rows are upgraded at this boundary; the enum itself is not changed.
  IF NEW.quest_type IN ('daily', 'monthly', 'geo')
     AND NEW.difficulty::text = 'very_easy' THEN
    NEW.difficulty := 'easy'::difficulty;
  END IF;

  IF NEW.quest_type IN ('daily', 'monthly', 'geo') THEN
    expected := CASE NEW.difficulty::text
      WHEN 'easy' THEN 100
      WHEN 'medium' THEN 200
      WHEN 'hard' THEN 300
      WHEN 'epic' THEN 500
      ELSE NULL
    END;

    IF expected IS NULL OR NEW.points_reward <> expected THEN
      RAISE EXCEPTION 'Quest must use canonical difficulty and base points';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonical_quest_points ON quests;
CREATE TRIGGER trg_canonical_quest_points
  BEFORE INSERT OR UPDATE OF quest_type, status, difficulty, points_reward ON quests
  FOR EACH ROW EXECUTE FUNCTION enforce_canonical_quest_points();

COMMENT ON FUNCTION enforce_canonical_quest_points() IS
  'Quest canonical reward boundary: changing quest_type, difficulty, status, or points cannot bypass EASY=100, MEDIUM=200, HARD=300, EPIC=500.';