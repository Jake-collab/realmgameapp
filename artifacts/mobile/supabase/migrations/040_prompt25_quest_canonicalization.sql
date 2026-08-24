-- Prompt 25: Canonical Quest vocabulary and reward boundary.
-- The shared difficulty enum keeps `very_easy` for historical Hunt compatibility,
-- but Quest content is normalized to EASY/MEDIUM/HARD/EPIC at the database edge.

-- Existing Quest participation reward snapshots remain unchanged. Only the
-- Quest catalog is normalized so future starts read canonical rewards.
UPDATE quests
SET
  difficulty = CASE WHEN difficulty::text = 'very_easy' THEN 'easy'::difficulty ELSE difficulty END,
  points_reward = CASE
    WHEN difficulty::text IN ('very_easy', 'easy') THEN 100
    WHEN difficulty::text = 'medium' THEN 200
    WHEN difficulty::text = 'hard' THEN 300
    WHEN difficulty::text = 'epic' THEN 500
    ELSE points_reward
  END
WHERE quest_type IN ('daily', 'monthly', 'geo')
  AND (
    difficulty::text = 'very_easy'
    OR points_reward <> CASE
      WHEN difficulty::text IN ('very_easy', 'easy') THEN 100
      WHEN difficulty::text = 'medium' THEN 200
      WHEN difficulty::text = 'hard' THEN 300
      WHEN difficulty::text = 'epic' THEN 500
      ELSE points_reward
    END
  );

CREATE OR REPLACE FUNCTION enforce_canonical_quest_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE expected INTEGER;
BEGIN
  -- `very_easy` is a read-compatibility value only. New or edited Quest rows
  -- are deterministically upgraded without changing the shared Hunt enum.
  IF NEW.difficulty::text = 'very_easy' THEN
    NEW.difficulty := 'easy'::difficulty;
  END IF;

  expected := CASE NEW.difficulty::text
    WHEN 'easy' THEN 100
    WHEN 'medium' THEN 200
    WHEN 'hard' THEN 300
    WHEN 'epic' THEN 500
    ELSE NULL
  END;

  IF NEW.quest_type IN ('daily', 'monthly', 'geo')
     AND (expected IS NULL OR NEW.points_reward <> expected) THEN
    RAISE EXCEPTION 'Quest must use canonical difficulty and base points';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonical_quest_points ON quests;
CREATE TRIGGER trg_canonical_quest_points
  BEFORE INSERT OR UPDATE OF status, difficulty, points_reward ON quests
  FOR EACH ROW EXECUTE FUNCTION enforce_canonical_quest_points();

COMMENT ON FUNCTION enforce_canonical_quest_points() IS
  'Quest-only canonical reward boundary: EASY=100, MEDIUM=200, HARD=300, EPIC=500. Hunt rewards are not affected.';

-- Daily assignments use the database server's UTC day. The retained parameter
-- preserves mobile RPC compatibility, but callers cannot request an arbitrary
-- date and produce a second assignment for the same authoritative day.
CREATE OR REPLACE FUNCTION get_daily_quest_assignment(
  p_user_id UUID,
  p_occurrence_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned UUID;
  assignment_date DATE := CURRENT_DATE;
  result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT quest_id INTO assigned
  FROM daily_quest_assignments
  WHERE user_id = p_user_id AND occurrence_date = assignment_date;

  IF assigned IS NULL THEN
    SELECT q.id INTO assigned
    FROM quests q
    WHERE q.quest_type = 'daily'
      AND q.status = 'published'
      AND (q.available_from IS NULL OR q.available_from <= assignment_date + INTERVAL '1 day')
      AND (q.available_until IS NULL OR q.available_until >= assignment_date)
      AND NOT EXISTS (
        SELECT 1 FROM quest_interest_tags required_tag
        WHERE required_tag.quest_id = q.id
          AND required_tag.targeting_mode = 'REQUIRE_COMBINATION'
          AND NOT EXISTS (
            SELECT 1 FROM user_interests ui
            WHERE ui.user_id = p_user_id AND ui.interest_id = required_tag.interest_id
          )
      )
    ORDER BY
      CASE
        WHEN EXISTS (
          SELECT 1 FROM quest_interest_tags preferred
          WHERE preferred.quest_id = q.id
            AND preferred.targeting_mode = 'PREFER_COMBINATION'
        )
        AND NOT EXISTS (
          SELECT 1 FROM quest_interest_tags preferred
          WHERE preferred.quest_id = q.id
            AND preferred.targeting_mode = 'PREFER_COMBINATION'
            AND NOT EXISTS (
              SELECT 1 FROM user_interests ui
              WHERE ui.user_id = p_user_id AND ui.interest_id = preferred.interest_id
            )
        ) THEN 1
        ELSE 0
      END DESC,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM quest_interest_tags tag
          JOIN user_interests ui ON ui.interest_id = tag.interest_id
          WHERE tag.quest_id = q.id AND ui.user_id = p_user_id
        ) THEN 2
        WHEN NOT EXISTS (
          SELECT 1 FROM quest_interest_tags tag WHERE tag.quest_id = q.id
        ) THEN 1
        ELSE 0
      END DESC,
      (SELECT COUNT(*) FROM quest_interest_tags tag
       JOIN user_interests ui ON ui.interest_id = tag.interest_id
       WHERE tag.quest_id = q.id AND ui.user_id = p_user_id) DESC,
      q.home_priority DESC,
      q.published_at DESC NULLS LAST,
      q.id
    LIMIT 1;

    IF assigned IS NULL THEN
      SELECT q.id INTO assigned
      FROM quests q
      WHERE q.quest_type = 'daily' AND q.status = 'published'
        AND (q.available_from IS NULL OR q.available_from <= assignment_date + INTERVAL '1 day')
        AND (q.available_until IS NULL OR q.available_until >= assignment_date)
        AND NOT EXISTS (
          SELECT 1 FROM quest_interest_tags tag WHERE tag.quest_id = q.id
        )
      ORDER BY q.home_priority DESC, q.published_at DESC NULLS LAST, q.id
      LIMIT 1;
    END IF;

    IF assigned IS NOT NULL THEN
      INSERT INTO daily_quest_assignments (user_id, occurrence_date, quest_id)
      VALUES (p_user_id, assignment_date, assigned)
      ON CONFLICT (user_id, occurrence_date) DO NOTHING;
      SELECT quest_id INTO assigned
      FROM daily_quest_assignments
      WHERE user_id = p_user_id AND occurrence_date = assignment_date;
    END IF;
  END IF;

  IF assigned IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(q) || jsonb_build_object(
    'interest_bubble_ids',
    COALESCE((SELECT jsonb_agg(tag.interest_id) FROM quest_interest_tags tag WHERE tag.quest_id = q.id), '[]'::jsonb)
  ) INTO result
  FROM quests q WHERE q.id = assigned;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_daily_quest_assignment(UUID, DATE) IS
  'Stable, server-authoritative Daily Quest assignment. Uses server UTC day until an explicit user timezone policy is introduced.';

-- Preference edits are atomic so a failed request cannot leave an account with
-- partially replaced Interest Bubbles. Existing Daily assignments are not
-- changed by this function; they remain stable for their UTC occurrence date.
CREATE OR REPLACE FUNCTION replace_my_interests(p_interest_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_interest_ids, ARRAY[]::UUID[])) AS selected(interest_id)
    LEFT JOIN interests i ON i.id = selected.interest_id AND i.is_active = TRUE
    WHERE i.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Interest Bubble is not available';
  END IF;

  DELETE FROM user_interests WHERE user_id = auth.uid();
  INSERT INTO user_interests (user_id, interest_id)
  SELECT auth.uid(), interest_id
  FROM unnest(COALESCE(p_interest_ids, ARRAY[]::UUID[])) AS selected(interest_id)
  ON CONFLICT (user_id, interest_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION replace_my_interests(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_my_interests(UUID[]) TO authenticated;