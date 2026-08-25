-- ============================================================
-- Migration 015 — Development Seed Data
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- DEVELOPMENT ONLY. Do not run in production.
-- All content is clearly marked as sample/dev data.
-- Precise real-world coordinates are NOT used for geo-quests.
-- Fictional or obviously sample locations only.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Guard: refuse to run if this looks like a production database
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF current_setting('app.environment', TRUE) = 'production' THEN
    RAISE EXCEPTION 'Refusing to seed a production database. Set app.environment = development first.';
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Interests
-- ──────────────────────────────────────────────────────────────
INSERT INTO interests (slug, name, description, icon_key, sort_order) VALUES
  ('hiking',          'Hiking',              'Trails and outdoor walks',          'trending-up',  1),
  ('parks',           'Parks',               'City and national parks',            'map',          2),
  ('wildlife',        'Wildlife',            'Nature and animal spotting',         'feather',      3),
  ('beaches',         'Beaches',             'Coastal and shoreline exploration',  'anchor',       4),
  ('mountains',       'Mountains',           'High-altitude adventures',           'triangle',     5),
  ('museums',         'Museums',             'History and culture collections',    'book-open',    10),
  ('architecture',    'Architecture',        'Buildings and urban design',         'home',         11),
  ('heritage',        'Heritage',            'Historic sites and landmarks',       'flag',         12),
  ('art',             'Art',                 'Galleries and street art',           'pen-tool',     13),
  ('local-history',   'Local History',       'Hidden stories of your city',        'clock',        14),
  ('food-trails',     'Food Trails',         'Culinary adventures and tastings',   'coffee',       20),
  ('local-markets',   'Local Markets',       'Farmers markets and stalls',         'shopping-bag', 21),
  ('coffee-spots',    'Coffee Spots',        'Independent cafés and roasteries',   'coffee',       22),
  ('hidden-gems',     'Hidden Gems',         'Undiscovered local treasures',       'star',         23),
  ('running',         'Running',             'Jogging and running routes',         'activity',     30),
  ('cycling',         'Cycling',             'Bike paths and mountain biking',     'circle',       31),
  ('urban-exploring', 'Urban Exploring',     'City streets and rooftops',          'map-pin',      32),
  ('photography',     'Photography',         'Scenic shots and composition',       'camera',       33),
  ('team-play',       'Team Play',           'Group quests and hunts',             'users',        40),
  ('meetups',         'Meetups',             'Meet other Worlds players',          'user-plus',    41),
  ('competitions',    'Competitions',        'Ranked events and tournaments',      'award',        42),
  ('family-friendly', 'Family-Friendly',     'Activities suitable for all ages',   'heart',        43)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Quest categories
-- ──────────────────────────────────────────────────────────────
INSERT INTO quest_categories (slug, name, description, icon_key, sort_order) VALUES
  ('creativity',   'Creativity',    'Creative and artistic challenges',         'pen-tool',     1),
  ('fitness',      'Fitness',       'Physical activity and movement',           'activity',     2),
  ('nature',       'Nature',        'Outdoor and environmental exploration',    'feather',      3),
  ('learning',     'Learning',      'Educational and knowledge-based tasks',    'book-open',    4),
  ('community',    'Community',     'Social and community engagement',          'users',        5),
  ('mindfulness',  'Mindfulness',   'Wellbeing and reflection activities',      'heart',        6),
  ('exploration',  'Exploration',   'Discovery and adventure',                  'compass',      7),
  ('photography',  'Photography',   'Photography and visual storytelling',      'camera',       8),
  ('skills',       'Skills',        'Learning a new skill or technique',        'star',         9)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Point reward guidelines
-- ──────────────────────────────────────────────────────────────
INSERT INTO point_reward_guidelines
  (activity_type, difficulty, minimum_minutes, maximum_minutes, suggested_min_points, suggested_max_points)
VALUES
  ('quest', 'very_easy', 5,   10,  25,   50),
  ('quest', 'easy',      10,  20,  75,   125),
  ('quest', 'medium',    20,  45,  150,  250),
  ('quest', 'hard',      45,  90,  300,  500),
  ('quest', 'epic',      120, 240, 750,  2000),
  ('hunt',  'very_easy', 10,  20,  50,   100),
  ('hunt',  'easy',      20,  40,  100,  200),
  ('hunt',  'medium',    40,  90,  200,  400),
  ('hunt',  'hard',      90,  180, 500,  1000),
  ('hunt',  'epic',      180, 360, 1000, 3000)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Achievements
-- ──────────────────────────────────────────────────────────────
INSERT INTO achievements (slug, name, description, category, icon_key, point_reward, criteria) VALUES
  ('first-quest',       'First Steps',         'Complete your first Quest',                   'quest',      'compass',    50,   '{"type": "quest_count", "target": 1}'),
  ('quest-streak-7',    'Week Warrior',         'Complete a quest 7 days in a row',            'quest',      'zap',        200,  '{"type": "daily_streak", "target": 7}'),
  ('quest-10',          'Quest Enthusiast',     'Complete 10 Quests',                          'quest',      'award',      100,  '{"type": "quest_count", "target": 10}'),
  ('quest-50',          'Quest Master',         'Complete 50 Quests',                          'quest',      'star',       500,  '{"type": "quest_count", "target": 50}'),
  ('quest-100',         'Centurion',            'Complete 100 Quests',                         'quest',      'shield',     1000, '{"type": "quest_count", "target": 100}'),
  ('first-hunt',        'Hunter''s Debut',      'Participate in your first Hunt',              'hunt',       'map-pin',    50,   '{"type": "hunt_count", "target": 1}'),
  ('hunt-winner',       'Champion',             'Win a Hunt competition',                      'hunt',       'trophy',     300,  '{"type": "hunt_wins", "target": 1}'),
  ('hunt-5',            'Dedicated Hunter',     'Complete 5 Hunts',                            'hunt',       'flag',       200,  '{"type": "hunt_count", "target": 5}'),
  ('explorer',          'Explorer',             'Visit 5 different geographic areas',          'exploration','globe',      150,  '{"type": "geo_areas", "target": 5}'),
  ('geo-quest-first',   'Geo Pioneer',          'Complete your first Geo-Quest',               'exploration','navigation', 100,  '{"type": "geo_quest_count", "target": 1}'),
  ('points-1000',       'Rising Star',          'Earn 1,000 total points',                     'milestone',  'trending-up',0,    '{"type": "total_points", "target": 1000}'),
  ('points-10000',      'Power Player',         'Earn 10,000 total points',                    'milestone',  'zap',        0,    '{"type": "total_points", "target": 10000}'),
  ('early-adopter',     'Early Adopter',        'One of the first 1,000 Worlds players',       'milestone',  'heart',      0,    '{"type": "manual", "description": "Awarded to first 1000 users"}'),
  ('photo-quest',       'Shutter Quest',        'Submit 10 photo proofs for quests',           'quest',      'camera',     100,  '{"type": "photo_proof_count", "target": 10}'),
  ('community-host',    'Community Host',       'Create and host your first Custom Game',      'community',  'users',      150,  '{"type": "custom_game_created", "target": 1}')
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Sample Quest categories assignment (with draft quests)
-- ──────────────────────────────────────────────────────────────

-- Daily Quest drafts
WITH inserted_quests AS (
  INSERT INTO quests (slug, title, summary, description, quest_type, status,
                      difficulty, estimated_duration_minutes, points_reward,
                      indoor_outdoor, proof_type, location_requirement_type,
                      source_type)
  VALUES
    ('sample-daily-photo-walk',
     '[DEV] Morning Photo Walk',
     'Capture the beauty of your neighbourhood in the golden hour.',
     'Head out within 1 hour of sunrise and photograph three things that catch your eye. They can be anything — a shadow, a leaf, a stranger''s smile. Upload your three favourites.',
     'daily', 'draft', 'easy', 15, 100,
     'outdoor', 'photo', 'none', 'admin'),

    ('sample-daily-kindness',
     '[DEV] Random Act of Kindness',
     'Do something kind for a stranger today and document it.',
     'Perform one genuine random act of kindness for someone you don''t know. It can be small — holding a door, buying someone a coffee, leaving an encouraging note. Take a photo (with consent where required) or write a short reflection.',
     'daily', 'draft', 'very_easy', 10, 50,
     'both', 'photo', 'none', 'admin'),

    ('sample-monthly-city-history',
     '[DEV] City History Hunter',
     'Discover three historical landmarks in your city this month.',
     'Research and visit three historical landmarks or heritage sites in your city. For each, photograph yourself at the location and write a one-sentence fact you learned. Use fictional landmarks for development testing.',
     'monthly', 'draft', 'medium', 90, 300,
     'outdoor', 'photo', 'approximate', 'admin'),

    ('sample-geo-fictional-park',
     '[DEV] Fictional Park Discovery',
     'Navigate to Sample Adventure Park and complete a challenge.',
     'THIS IS DEV DATA. Navigate to the marked location (fictional coordinates for testing only) and photograph the entry sign. Real coordinates will be set before publishing.',
     'geo', 'draft', 'easy', 20, 150,
     'outdoor', 'photo', 'precise', 'admin')

  RETURNING id, slug
)
SELECT * FROM inserted_quests;  -- make results visible in migration log

-- ──────────────────────────────────────────────────────────────
-- Sample Hunt drafts
-- ──────────────────────────────────────────────────────────────

-- These are ownerless development fixtures. The community context is the
-- intentional supported context for sample content without a real user or
-- admin account; never weaken the creator constraint for seed data.

INSERT INTO hunts (slug, title, summary, description, hunt_type, status,
                   privacy, points_reward, estimated_duration_minutes, difficulty,
                   max_participants)
VALUES
  ('sample-official-city-hunt',
   '[DEV] City Discovery Hunt',
   'A fictional 5-stop hunt through Sample City for development testing.',
   'DEV DATA ONLY. This hunt visits five fictional locations in a made-up city layout. '
   'Used for testing Hunt UI components, navigation, and stop-progress tracking. '
   'All coordinates are placeholder values. Do not publish without replacing content.',
   'community', 'draft', 'public', 500, 90, 'medium', 20),

  ('sample-custom-neighbourhood',
   '[DEV] Neighbourhood Treasure Hunt',
   'A short custom game template demonstrating the Custom Game format.',
   'DEV DATA ONLY. A 3-stop neighbourhood hunt for testing Custom Game creation. '
   'Uses placeholder locations. Creator user_id is not set — '
   'this is a direct seed insert bypassing the creator constraint.',
   'community', 'draft', 'invite_only', 200, 45, 'easy', 8)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Sample notifications (for UI testing)
-- NOTE: requires a real user_id — skipped here as no auth users exist at seed time.
-- Uncomment and populate user_id when seeding against a test auth user.
-- ──────────────────────────────────────────────────────────────

-- INSERT INTO notifications (user_id, type, title, body, data)
-- VALUES
--   ('<test-user-uuid>', 'quest_available',   'New Daily Quest',    'Your Morning Photo Walk quest is ready.',     '{"quest_id": "..."}'),
--   ('<test-user-uuid>', 'achievement_earned', 'Achievement Earned', 'You earned "First Steps". +50 points!',       '{"achievement_slug": "first-quest"}'),
--   ('<test-user-uuid>', 'hunt_invitation',    'Hunt Invitation',    'You have been invited to City Discovery Hunt.','{"hunt_id": "..."}');
