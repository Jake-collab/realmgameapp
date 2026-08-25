-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025 — Shared Worlds Progression, Achievements, Milestones,
--                  Titles, and Badges (Prompt 15)
--
-- Ownership: all writes via service_role SECURITY DEFINER functions only.
-- Clients read via RLS-gated SELECT. Achievement awarding is server-only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Achievement Definitions ───────────────────────────────────────────────
-- Static catalogue of all known achievements. Managed by admins only.

CREATE TABLE IF NOT EXISTS achievement_definitions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT        NOT NULL UNIQUE,         -- stable ID for code references

  name                TEXT        NOT NULL,
  subtitle            TEXT,
  description         TEXT        NOT NULL,
  category            TEXT        NOT NULL CHECK (
                        category IN ('quest','hunt','worlds','community','exploration','consistency','special')
                      ),
  icon_name           TEXT        NOT NULL DEFAULT 'award', -- Feather icon name
  artwork_url         TEXT,                                 -- optional rich artwork

  -- Visibility / type flags
  is_hidden           BOOLEAN     NOT NULL DEFAULT FALSE,   -- shows as "???" until unlocked
  is_secret           BOOLEAN     NOT NULL DEFAULT FALSE,   -- requirements never revealed
  is_manual           BOOLEAN     NOT NULL DEFAULT FALSE,   -- admin-awarded only
  is_limited_time     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_retired          BOOLEAN     NOT NULL DEFAULT FALSE,   -- no longer awardable

  -- Engine evaluation
  requirement_type    TEXT        NOT NULL DEFAULT 'auto'
                        CHECK (requirement_type IN ('auto','manual','admin')),
  requirement_version INT         NOT NULL DEFAULT 1,       -- increment when rule changes
  rule_key            TEXT,                                 -- engine rule identifier (e.g. 'quests_completed_25')
  rule_threshold      INT,                                  -- numeric threshold for rule
  rule_mode           TEXT,                                 -- 'quest' | 'hunt' | 'combined' | null

  -- Localisation readiness
  locale_key          TEXT,                                 -- future i18n key

  display_priority    INT         NOT NULL DEFAULT 100,     -- lower = shown first
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

-- Everyone can read active (non-retired) definitions
CREATE POLICY "achievement_definitions_read" ON achievement_definitions
  FOR SELECT USING (is_retired = FALSE);

-- ─── 2. User Achievements ─────────────────────────────────────────────────────
-- One row per (user, achievement) pair. Insert-once, never deleted.

CREATE TABLE IF NOT EXISTS user_achievements (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id        UUID        NOT NULL REFERENCES achievement_definitions(id),

  awarded_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_by            TEXT        NOT NULL DEFAULT 'engine'
                          CHECK (awarded_by IN ('engine','admin','system')),

  -- Audit snapshot at award time
  trigger_event         TEXT,       -- e.g. 'quest_completed', 'hunt_completed', 'point_milestone'
  trigger_reference_id  UUID,       -- quest_id / hunt_id / participation_id that triggered it
  progress_snapshot     JSONB,      -- e.g. { quests_completed: 25 } at award time

  -- Notification state
  notification_sent     BOOLEAN     NOT NULL DEFAULT FALSE,

  UNIQUE (user_id, achievement_id)  -- prevents duplicate awards
);

-- user_achievements existed before the progression catalog. Reconcile the
-- legacy earned_at shape before creating the new history indexes and RPCs.
ALTER TABLE user_achievements
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS awarded_by TEXT NOT NULL DEFAULT 'engine'
    CHECK (awarded_by IN ('engine','admin','system')),
  ADD COLUMN IF NOT EXISTS trigger_event TEXT,
  ADD COLUMN IF NOT EXISTS trigger_reference_id UUID,
  ADD COLUMN IF NOT EXISTS progress_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_achievements'
      AND column_name = 'earned_at'
  ) THEN
    EXECUTE '
      UPDATE user_achievements
      SET awarded_at = earned_at
      WHERE awarded_at IS NULL
    ';
  END IF;
END;
$$;

UPDATE user_achievements
SET awarded_at = NOW()
WHERE awarded_at IS NULL;

ALTER TABLE user_achievements
  ALTER COLUMN awarded_at SET DEFAULT NOW(),
  ALTER COLUMN awarded_at SET NOT NULL;

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_achievements_owner_read" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id, awarded_at DESC);

-- ─── 3. Titles ────────────────────────────────────────────────────────────────
-- Static title catalogue.

CREATE TABLE IF NOT EXISTS titles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  unlock_source    TEXT        NOT NULL DEFAULT 'achievement'
                     CHECK (unlock_source IN ('achievement','milestone','admin','launch','special')),
  -- Which achievement definition unlocks this title (nullable = admin-granted only)
  unlocked_by_achievement_id UUID REFERENCES achievement_definitions(id),
  is_retired       BOOLEAN     NOT NULL DEFAULT FALSE,
  display_priority INT         NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "titles_read" ON titles
  FOR SELECT USING (is_retired = FALSE);

-- ─── 4. User Titles ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_titles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id       UUID        NOT NULL REFERENCES titles(id),
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active      BOOLEAN     NOT NULL DEFAULT FALSE,  -- at most ONE active per user
  UNIQUE (user_id, title_id)
);

ALTER TABLE user_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_titles_owner_read" ON user_titles
  FOR SELECT USING (auth.uid() = user_id);

-- Only one active title per user (enforced by unique partial index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_titles_one_active
  ON user_titles (user_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_titles_user
  ON user_titles (user_id, unlocked_at DESC);

-- ─── 5. Badges ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badges (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  icon_name        TEXT        NOT NULL DEFAULT 'shield',
  artwork_url      TEXT,
  category         TEXT        NOT NULL DEFAULT 'general',
  unlock_source    TEXT        NOT NULL DEFAULT 'achievement'
                     CHECK (unlock_source IN ('achievement','milestone','admin','launch','special')),
  unlocked_by_achievement_id UUID REFERENCES achievement_definitions(id),
  is_retired       BOOLEAN     NOT NULL DEFAULT FALSE,
  display_priority INT         NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges_read" ON badges
  FOR SELECT USING (is_retired = FALSE);

-- ─── 6. User Badges ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_badges (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id       UUID        NOT NULL REFERENCES badges(id),
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_pinned      BOOLEAN     NOT NULL DEFAULT FALSE, -- one pinned badge for profile display
  UNIQUE (user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_owner_read" ON user_badges
  FOR SELECT USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_one_pinned
  ON user_badges (user_id) WHERE is_pinned = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON user_badges (user_id, unlocked_at DESC);

-- ─── 7. Milestones ────────────────────────────────────────────────────────────
-- Milestone definitions are seeded; engine creates user_milestone rows on trigger.

CREATE TABLE IF NOT EXISTS milestones (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  category         TEXT        NOT NULL CHECK (
                     category IN ('quest','hunt','combined','points','special')
                   ),
  metric_key       TEXT        NOT NULL,   -- e.g. 'quests_completed', 'hunt_points'
  threshold        INT         NOT NULL,
  display_priority INT         NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_read" ON milestones
  FOR SELECT USING (TRUE);

-- ─── 8. User Milestones ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_milestones (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id   UUID        NOT NULL REFERENCES milestones(id),
  reached_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  value_at_award INT         NOT NULL DEFAULT 0,  -- actual value when milestone was reached
  UNIQUE (user_id, milestone_id)
);

ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_milestones_owner_read" ON user_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_milestones_user
  ON user_milestones (user_id, reached_at DESC);

-- ─── 9. Achievement Events (audit log) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS achievement_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL CHECK (
                    event_type IN (
                      'quest_completed','hunt_completed','point_milestone',
                      'combined_milestone','profile_updated','account_age',
                      'admin_action','manual_award'
                    )
                  ),
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_id    UUID,           -- entity that caused the event (participation, etc.)
  payload         JSONB,          -- event-specific metadata (counts, snapshots, etc.)
  achievements_awarded JSONB DEFAULT '[]'::JSONB  -- array of achievement slugs awarded
);

ALTER TABLE achievement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievement_events_owner_read" ON achievement_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_achievement_events_user
  ON achievement_events (user_id, triggered_at DESC);

-- ─── 10. Seed: Milestone definitions ─────────────────────────────────────────

INSERT INTO milestones (slug, name, description, category, metric_key, threshold, display_priority) VALUES
  ('first_quest',        'First Quest',           'Complete your first Quest',                'quest',    'quests_completed', 1,   10),
  ('quests_10',         '10 Quests',              'Complete 10 Quests',                       'quest',    'quests_completed', 10,  20),
  ('quests_25',         '25 Quests',              'Complete 25 Quests',                       'quest',    'quests_completed', 25,  30),
  ('quests_100',        '100 Quests',             'Complete 100 Quests',                      'quest',    'quests_completed', 100, 40),
  ('first_hunt',        'First Hunt',             'Complete your first Hunt',                 'hunt',     'hunts_completed',  1,   10),
  ('hunts_10',          '10 Hunts',               'Complete 10 Hunts',                        'hunt',     'hunts_completed',  10,  20),
  ('hunts_25',          '25 Hunts',               'Complete 25 Hunts',                        'hunt',     'hunts_completed',  25,  30),
  ('hunts_50',          '50 Hunts',               'Complete 50 Hunts',                        'hunt',     'hunts_completed',  50,  35),
  ('hunts_100',         '100 Hunts',              'Complete 100 Hunts',                       'hunt',     'hunts_completed',  100, 40),
  ('hunts_250',         '250 Hunts',              'Complete 250 Hunts',                       'hunt',     'hunts_completed',  250, 50),
  ('points_1000',       '1,000 Points',           'Earn 1,000 combined Worlds points',        'points',   'combined_points',  1000,  20),
  ('points_10000',      '10,000 Points',          'Earn 10,000 combined Worlds points',       'points',   'combined_points',  10000, 30),
  ('activities_50',     '50 Activities',          'Complete 50 combined Quests and Hunts',    'combined', 'total_activities', 50,  30),
  ('activities_100',    '100 Activities',         'Complete 100 combined Quests and Hunts',   'combined', 'total_activities', 100, 40),
  ('first_activity',    'First Activity',         'Complete your first Quest or Hunt',        'combined', 'total_activities', 1,   5)
ON CONFLICT (slug) DO NOTHING;

-- ─── 11. Seed: Achievement Definitions ────────────────────────────────────────

INSERT INTO achievement_definitions (slug, name, subtitle, description, category, icon_name, requirement_type, rule_key, rule_threshold, rule_mode, display_priority) VALUES
  ('first_quest',         'First Quest',         'A journey begins',         'Complete your first Quest.',                       'quest',    'compass',    'auto', 'quests_completed',     1,    'quest',    10),
  ('quest_veteran',       'Quest Veteran',       '25 and counting',          'Complete 25 Quests.',                              'quest',    'compass',    'auto', 'quests_completed',     25,   'quest',    20),
  ('quest_champion',      'Quest Champion',      'Master of the quest',      'Complete 100 Quests.',                             'quest',    'award',      'auto', 'quests_completed',     100,  'quest',    30),
  ('first_hunt',          'First Hunt',          'The chase begins',         'Complete your first Hunt.',                        'hunt',     'map-pin',    'auto', 'hunts_completed',      1,    'hunt',     10),
  ('hunt_veteran',        'Hunt Veteran',        '25 hunts complete',        'Complete 25 Hunts.',                               'hunt',     'map-pin',    'auto', 'hunts_completed',      25,   'hunt',     20),
  ('perfect_hunter',      'Perfect Hunter',      'Flawless',                 'Complete a Hunt with all stops, no resubmissions.','hunt',     'zap',        'auto', 'perfect_hunt',         1,    'hunt',     25),
  ('first_activity',      'First Activity',      'You are here',             'Complete your first Quest or Hunt.',               'worlds',   'globe',      'auto', 'total_activities',     1,    'combined', 5),
  ('worlds_explorer',     'Worlds Explorer',     'Both worlds, one player',  'Complete at least one Quest and one Hunt.',         'worlds',   'globe',      'auto', 'both_modes_completed', 1,    'combined', 15),
  ('points_1000',         '1,000 Points',        'Points are piling up',     'Earn 1,000 combined Worlds points.',               'worlds',   'star',       'auto', 'combined_points',      1000, 'combined', 20),
  ('points_10000',        '10,000 Points',       'Point master',             'Earn 10,000 combined Worlds points.',              'worlds',   'star',       'auto', 'combined_points',      10000,'combined', 30),
  ('consistency_week',    'Consistent',          'Keep it going',            'Complete a Quest or Hunt every day for 7 days.',   'consistency','repeat',   'auto', 'daily_streak',         7,    'combined', 20),
  ('community_founder',   'Community Founder',   'Early believer',           'Be among the first 1,000 Worlds players.',         'special',  'users',      'admin', NULL,                  NULL,  NULL,      50),
  ('beta_tester',         'Beta Tester',         'You were there',           'Participated in the Worlds beta.',                 'special',  'terminal',   'admin', NULL,                  NULL,  NULL,      55)
ON CONFLICT (slug) DO NOTHING;

-- ─── 12. Seed: Titles ─────────────────────────────────────────────────────────

INSERT INTO titles (slug, name, description, unlock_source, display_priority) VALUES
  ('explorer',       'Explorer',        'A curious wanderer of the Worlds',          'achievement', 10),
  ('trailblazer',    'Trailblazer',     'Blazing new paths for others to follow',    'achievement', 20),
  ('adventurer',     'Adventurer',      'Born to explore',                           'achievement', 30),
  ('pathfinder',     'Pathfinder',      'Always finds the way',                      'achievement', 40),
  ('pioneer',        'Pioneer',         'First through uncharted territory',         'achievement', 50),
  ('master_hunter',  'Master Hunter',   'The hunt always ends with victory',         'achievement', 60),
  ('quest_champion', 'Quest Champion',  'Quests are no match for this player',       'achievement', 70),
  ('world_traveler', 'World Traveler',  'A citizen of every world',                  'achievement', 80)
ON CONFLICT (slug) DO NOTHING;

-- ─── 13. Seed: Badges ─────────────────────────────────────────────────────────

INSERT INTO badges (slug, name, description, icon_name, category, unlock_source, display_priority) VALUES
  ('first_hunt',         'First Hunt',         'Completed a Hunt for the first time',       'map-pin', 'hunt',    'achievement', 10),
  ('first_quest',        'First Quest',        'Completed a Quest for the first time',      'compass', 'quest',   'achievement', 10),
  ('quest_100',          '100 Quests',         'Completed 100 Quests',                      'award',   'quest',   'achievement', 30),
  ('hunt_veteran',       'Hunt Veteran',       'Completed 25 Hunts',                        'star',    'hunt',    'achievement', 20),
  ('worlds_explorer',    'Worlds Explorer',    'Completed both a Quest and a Hunt',         'globe',   'worlds',  'achievement', 15),
  ('community_founder',  'Community Founder',  'Among the first 1,000 Worlds players',      'users',   'special', 'admin',       50),
  ('beta_tester',        'Beta Tester',        'Participated in the Worlds beta program',   'terminal','special', 'admin',       55)
ON CONFLICT (slug) DO NOTHING;

-- ─── 14. RPCs ─────────────────────────────────────────────────────────────────

-- 14a. get_my_achievements — user's unlocked achievements with definition details
CREATE OR REPLACE FUNCTION get_my_achievements(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  achievement_id        UUID,
  slug                  TEXT,
  name                  TEXT,
  subtitle              TEXT,
  description           TEXT,
  category              TEXT,
  icon_name             TEXT,
  artwork_url           TEXT,
  is_hidden             BOOLEAN,
  is_secret             BOOLEAN,
  is_manual             BOOLEAN,
  display_priority      INT,
  awarded_at            TIMESTAMPTZ,
  awarded_by            TEXT,
  trigger_event         TEXT,
  rule_key              TEXT,
  rule_threshold        INT,
  rule_mode             TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    ad.id,
    ad.slug,
    ad.name,
    ad.subtitle,
    ad.description,
    ad.category,
    ad.icon_name,
    ad.artwork_url,
    ad.is_hidden,
    ad.is_secret,
    ad.is_manual,
    ad.display_priority,
    ua.awarded_at,
    ua.awarded_by,
    ua.trigger_event,
    ad.rule_key,
    ad.rule_threshold,
    ad.rule_mode
  FROM user_achievements ua
  JOIN achievement_definitions ad ON ad.id = ua.achievement_id
  WHERE ua.user_id = p_user_id
    AND (p_category IS NULL OR ad.category = p_category)
  ORDER BY ua.awarded_at DESC;
END;
$$;

-- 14b. get_achievement_history — paginated achievement timeline
CREATE OR REPLACE FUNCTION get_achievement_history(
  p_user_id UUID,
  p_limit   INT DEFAULT 20,
  p_offset  INT DEFAULT 0
)
RETURNS TABLE (
  achievement_id    UUID,
  slug              TEXT,
  name              TEXT,
  description       TEXT,
  category          TEXT,
  icon_name         TEXT,
  is_hidden         BOOLEAN,
  awarded_at        TIMESTAMPTZ,
  trigger_event     TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    ad.id,
    ad.slug,
    ad.name,
    ad.description,
    ad.category,
    ad.icon_name,
    ad.is_hidden,
    ua.awarded_at,
    ua.trigger_event
  FROM user_achievements ua
  JOIN achievement_definitions ad ON ad.id = ua.achievement_id
  WHERE ua.user_id = p_user_id
  ORDER BY ua.awarded_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 14c. get_my_titles — user's unlocked titles
CREATE OR REPLACE FUNCTION get_my_titles(p_user_id UUID)
RETURNS TABLE (
  title_id         UUID,
  slug             TEXT,
  name             TEXT,
  description      TEXT,
  unlock_source    TEXT,
  display_priority INT,
  unlocked_at      TIMESTAMPTZ,
  is_active        BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.slug,
    t.name,
    t.description,
    t.unlock_source,
    t.display_priority,
    ut.unlocked_at,
    ut.is_active
  FROM user_titles ut
  JOIN titles t ON t.id = ut.title_id
  WHERE ut.user_id = p_user_id
  ORDER BY ut.is_active DESC, ut.unlocked_at DESC;
END;
$$;

-- 14d. set_active_title — atomic title swap (clears old, sets new)
CREATE OR REPLACE FUNCTION set_active_title(
  p_user_id UUID,
  p_title_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_title BOOLEAN;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify user owns this title
  SELECT EXISTS(
    SELECT 1 FROM user_titles
    WHERE user_id = p_user_id AND title_id = p_title_id
  ) INTO v_has_title;

  IF NOT v_has_title THEN
    RAISE EXCEPTION 'Title not unlocked';
  END IF;

  -- Clear current active
  UPDATE user_titles
  SET is_active = FALSE
  WHERE user_id = p_user_id AND is_active = TRUE;

  -- Set new active
  UPDATE user_titles
  SET is_active = TRUE
  WHERE user_id = p_user_id AND title_id = p_title_id;

  RETURN TRUE;
END;
$$;

-- 14e. get_my_badges — user's unlocked badges
CREATE OR REPLACE FUNCTION get_my_badges(p_user_id UUID)
RETURNS TABLE (
  badge_id         UUID,
  slug             TEXT,
  name             TEXT,
  description      TEXT,
  icon_name        TEXT,
  artwork_url      TEXT,
  category         TEXT,
  display_priority INT,
  unlocked_at      TIMESTAMPTZ,
  is_pinned        BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.slug,
    b.name,
    b.description,
    b.icon_name,
    b.artwork_url,
    b.category,
    b.display_priority,
    ub.unlocked_at,
    ub.is_pinned
  FROM user_badges ub
  JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id
  ORDER BY ub.is_pinned DESC, ub.unlocked_at DESC;
END;
$$;

-- 14f. get_combined_statistics — cross-mode aggregated stats
CREATE OR REPLACE FUNCTION get_combined_statistics(p_user_id UUID)
RETURNS TABLE (
  quests_completed      BIGINT,
  hunts_completed       BIGINT,
  total_activities      BIGINT,
  quest_points          NUMERIC,
  hunt_points           NUMERIC,
  combined_points       NUMERIC,
  achievements_unlocked BIGINT,
  titles_unlocked       BIGINT,
  badges_unlocked       BIGINT,
  account_age_days      INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT created_at INTO v_created_at FROM auth.users WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    -- Quest completions
    (SELECT COUNT(*) FROM quest_participations
     WHERE user_id = p_user_id AND status = 'completed')::BIGINT,

    -- Hunt completions
    (SELECT COUNT(*) FROM hunt_participants
     WHERE user_id = p_user_id AND status = 'completed')::BIGINT,

    -- Total activities
    (SELECT COUNT(*) FROM quest_participations WHERE user_id = p_user_id AND status = 'completed')::BIGINT
    + (SELECT COUNT(*) FROM hunt_participants WHERE user_id = p_user_id AND status = 'completed')::BIGINT,

    -- Quest points
    COALESCE((SELECT SUM(amount) FROM points_ledger
      WHERE user_id = p_user_id AND transaction_type = 'quest_reward'),0)::NUMERIC,

    -- Hunt points
    COALESCE((SELECT SUM(amount) FROM points_ledger
      WHERE user_id = p_user_id AND transaction_type = 'hunt_reward'),0)::NUMERIC,

    -- Combined points (all positive entries)
    COALESCE((SELECT SUM(amount) FROM points_ledger
      WHERE user_id = p_user_id AND amount > 0),0)::NUMERIC,

    -- Achievements unlocked
    (SELECT COUNT(*) FROM user_achievements WHERE user_id = p_user_id)::BIGINT,

    -- Titles unlocked
    (SELECT COUNT(*) FROM user_titles WHERE user_id = p_user_id)::BIGINT,

    -- Badges unlocked
    (SELECT COUNT(*) FROM user_badges WHERE user_id = p_user_id)::BIGINT,

    -- Account age in days
    EXTRACT(DAY FROM now() - COALESCE(v_created_at, now()))::INT;
END;
$$;

-- 14g. get_progress_overview — compact summary for profile header
CREATE OR REPLACE FUNCTION get_progress_overview(p_user_id UUID)
RETURNS TABLE (
  active_title_name     TEXT,
  active_title_slug     TEXT,
  pinned_badge_name     TEXT,
  pinned_badge_icon     TEXT,
  achievements_count    BIGINT,
  combined_points       NUMERIC,
  total_activities      BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT t.name FROM user_titles ut JOIN titles t ON t.id = ut.title_id
     WHERE ut.user_id = p_user_id AND ut.is_active = TRUE LIMIT 1),
    (SELECT t.slug FROM user_titles ut JOIN titles t ON t.id = ut.title_id
     WHERE ut.user_id = p_user_id AND ut.is_active = TRUE LIMIT 1),
    (SELECT b.name FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = p_user_id AND ub.is_pinned = TRUE LIMIT 1),
    (SELECT b.icon_name FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = p_user_id AND ub.is_pinned = TRUE LIMIT 1),
    (SELECT COUNT(*) FROM user_achievements WHERE user_id = p_user_id)::BIGINT,
    COALESCE((SELECT SUM(amount) FROM points_ledger WHERE user_id = p_user_id AND amount > 0), 0)::NUMERIC,
    (
      (SELECT COUNT(*) FROM quest_participations WHERE user_id = p_user_id AND status = 'completed')
      + (SELECT COUNT(*) FROM hunt_participants WHERE user_id = p_user_id AND status = 'completed')
    )::BIGINT;
END;
$$;

-- 14h. get_my_milestones — user's achieved milestones
CREATE OR REPLACE FUNCTION get_my_milestones(p_user_id UUID)
RETURNS TABLE (
  milestone_id     UUID,
  slug             TEXT,
  name             TEXT,
  description      TEXT,
  category         TEXT,
  metric_key       TEXT,
  threshold        INT,
  reached_at       TIMESTAMPTZ,
  value_at_award   INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.slug, m.name, m.description, m.category,
    m.metric_key, m.threshold, um.reached_at, um.value_at_award
  FROM user_milestones um
  JOIN milestones m ON m.id = um.milestone_id
  WHERE um.user_id = p_user_id
  ORDER BY um.reached_at DESC;
END;
$$;

-- ─── 15. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_achievement_defs_category
  ON achievement_definitions (category, display_priority);

CREATE INDEX IF NOT EXISTS idx_achievement_defs_rule_key
  ON achievement_definitions (rule_key) WHERE rule_key IS NOT NULL;
