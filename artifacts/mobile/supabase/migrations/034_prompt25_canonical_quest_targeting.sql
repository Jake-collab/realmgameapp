-- Prompt 25: canonical Daily Quest targeting metadata.
-- Tags are separate from the consumer quest row so historical Quest data remains valid.

CREATE TABLE IF NOT EXISTS quest_interest_tags (
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE RESTRICT,
  targeting_mode TEXT NOT NULL DEFAULT 'ANY_MATCH'
    CHECK (targeting_mode IN ('ANY_MATCH', 'PREFER_COMBINATION', 'REQUIRE_COMBINATION')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (quest_id, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_interest_tags_interest
  ON quest_interest_tags (interest_id, quest_id);

ALTER TABLE quest_interest_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "published quest interest tags are public" ON quest_interest_tags;
CREATE POLICY "published quest interest tags are public"
  ON quest_interest_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM quests
    WHERE quests.id = quest_interest_tags.quest_id
      AND quests.status = 'published'
  ));

COMMENT ON TABLE quest_interest_tags IS
  'Admin-assigned Interest Bubble targeting for Quest inventory. Unknown AI labels must not create rows.';

CREATE TABLE IF NOT EXISTS daily_quest_assignments (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, occurrence_date)
);

ALTER TABLE daily_quest_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read their Daily Quest assignment" ON daily_quest_assignments;
CREATE POLICY "users read their Daily Quest assignment"
  ON daily_quest_assignments FOR SELECT USING (auth.uid() = user_id);

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
  result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT quest_id INTO assigned
  FROM daily_quest_assignments
  WHERE user_id = p_user_id AND occurrence_date = p_occurrence_date;

  IF assigned IS NULL THEN
    SELECT q.id INTO assigned
    FROM quests q
    WHERE q.quest_type = 'daily'
      AND q.status = 'published'
      AND (q.available_from IS NULL OR q.available_from <= p_occurrence_date + INTERVAL '1 day')
      AND (q.available_until IS NULL OR q.available_until >= p_occurrence_date)
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
              WHERE ui.user_id = p_user_id
                AND ui.interest_id = preferred.interest_id
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
        AND (q.available_from IS NULL OR q.available_from <= p_occurrence_date + INTERVAL '1 day')
        AND (q.available_until IS NULL OR q.available_until >= p_occurrence_date)
        AND NOT EXISTS (
          SELECT 1 FROM quest_interest_tags tag WHERE tag.quest_id = q.id
        )
      ORDER BY q.home_priority DESC, q.published_at DESC NULLS LAST, q.id
      LIMIT 1;
    END IF;

    IF assigned IS NOT NULL THEN
      INSERT INTO daily_quest_assignments (user_id, occurrence_date, quest_id)
      VALUES (p_user_id, p_occurrence_date, assigned)
      ON CONFLICT (user_id, occurrence_date) DO NOTHING;
      SELECT quest_id INTO assigned
      FROM daily_quest_assignments
      WHERE user_id = p_user_id AND occurrence_date = p_occurrence_date;
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

REVOKE ALL ON FUNCTION get_daily_quest_assignment(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_daily_quest_assignment(UUID, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION enforce_canonical_quest_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE expected INTEGER;
BEGIN
  IF NEW.status = 'published' AND NEW.quest_type IN ('daily', 'monthly', 'geo') THEN
    expected := CASE NEW.difficulty::text
      WHEN 'easy' THEN 100 WHEN 'medium' THEN 200 WHEN 'hard' THEN 300 WHEN 'epic' THEN 500 ELSE NULL END;
    IF expected IS NULL OR NEW.points_reward <> expected THEN
      RAISE EXCEPTION 'published Quest must use canonical difficulty and base points';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonical_quest_points ON quests;
CREATE TRIGGER trg_canonical_quest_points
  BEFORE INSERT OR UPDATE OF status, difficulty, points_reward ON quests
  FOR EACH ROW EXECUTE FUNCTION enforce_canonical_quest_points();