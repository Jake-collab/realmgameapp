-- ============================================================
-- Migration 018 — Quest Seed Data (Development)
-- Worlds — Build 1, Prompt 6
-- ============================================================
-- Seeds representative quests covering all participation states,
-- quest types, difficulty levels, and completion modes.
-- Intended for development and integration testing only.
-- Production: do NOT run this migration.
-- ============================================================

DO $$
DECLARE
  today         DATE    := CURRENT_DATE;
  month_start   DATE    := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  month_end     DATE    := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE;
  next_month    DATE    := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE;

  -- Quest UUIDs
  q_daily_walk  UUID    := '00000000-0000-0000-0001-000000000001';
  q_daily_photo UUID    := '00000000-0000-0000-0001-000000000002';
  q_daily_text  UUID    := '00000000-0000-0000-0001-000000000003';
  q_monthly_exp UUID    := '00000000-0000-0000-0002-000000000001';
  q_monthly_doc UUID    := '00000000-0000-0000-0002-000000000002';
  q_geo_mural   UUID    := '00000000-0000-0000-0003-000000000001';
  q_geo_park    UUID    := '00000000-0000-0000-0003-000000000002';
  q_geo_prereq  UUID    := '00000000-0000-0000-0003-000000000003';

  -- Category UUIDs (inserted by migration 015)
  cat_exploration UUID;
  cat_community   UUID;

BEGIN

  -- Resolve categories
  SELECT id INTO cat_exploration FROM quest_categories WHERE slug = 'exploration' LIMIT 1;
  SELECT id INTO cat_community   FROM quest_categories WHERE slug = 'community'   LIMIT 1;

  -- ──────────────────────────────────────────────────────────
  -- Daily Quests
  -- ──────────────────────────────────────────────────────────

  -- Daily: auto-completion, no proof
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, repeat_cooldown_hours,
    completion_mode, expiration_behavior, home_priority,
    published_at, source_type
  ) VALUES (
    q_daily_walk,
    'morning-walk',
    'Morning Walk',
    'Take a 15-minute walk outdoors.',
    E'Start your day with a refreshing walk. Step outside for at least 15 minutes.\n\n'
    'Notice three things you find interesting or beautiful in your surroundings.',
    'daily', 'published', 'very_easy', 15, 50,
    'outdoor', 'none', 'none',
    (today::TIMESTAMPTZ), ((today + 1)::TIMESTAMPTZ),
    TRUE, NULL,
    'auto', 'hard', 100,
    NOW(), 'admin'
  ) ON CONFLICT (id) DO UPDATE SET
    available_from = (today::TIMESTAMPTZ),
    available_until = ((today + 1)::TIMESTAMPTZ),
    updated_at = NOW();

  -- Daily: manual review with photo proof
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, repeat_cooldown_hours,
    completion_mode, expiration_behavior, home_priority,
    published_at, source_type
  ) VALUES (
    q_daily_photo,
    'daily-sky-watch',
    'Sky Watch',
    'Photograph today''s sky at any time of day.',
    E'Look up. Whatever you see above you — clouds, sun, stars, fog — photograph it.\n\n'
    'One photo is enough. Add a caption if you''d like.',
    'daily', 'published', 'very_easy', 5, 30,
    'outdoor', 'photo', 'none',
    (today::TIMESTAMPTZ), ((today + 1)::TIMESTAMPTZ),
    TRUE, NULL,
    'manual_review', 'hard', 80,
    NOW(), 'admin'
  ) ON CONFLICT (id) DO UPDATE SET
    available_from = (today::TIMESTAMPTZ),
    available_until = ((today + 1)::TIMESTAMPTZ),
    updated_at = NOW();

  -- Daily: manual review with text proof
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, repeat_cooldown_hours,
    completion_mode, expiration_behavior, home_priority,
    published_at, source_type
  ) VALUES (
    q_daily_text,
    'daily-reflection',
    'Daily Reflection',
    'Write three things you are grateful for today.',
    E'Pause for five minutes. In the text field, write three things you are grateful for today.\n\n'
    'Be specific — "the smell of coffee this morning" beats "food."',
    'daily', 'published', 'very_easy', 5, 25,
    'indoor', 'text', 'none',
    (today::TIMESTAMPTZ), ((today + 1)::TIMESTAMPTZ),
    TRUE, NULL,
    'manual_review', 'hard', 70,
    NOW(), 'admin'
  ) ON CONFLICT (id) DO UPDATE SET
    available_from = (today::TIMESTAMPTZ),
    available_until = ((today + 1)::TIMESTAMPTZ),
    updated_at = NOW();

  -- ──────────────────────────────────────────────────────────
  -- Monthly Quests
  -- ──────────────────────────────────────────────────────────

  -- Monthly: multi-step exploration quest
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, completion_mode, expiration_behavior, home_priority,
    published_at, source_type
  ) VALUES (
    q_monthly_exp,
    'local-landmark-explorer',
    'Local Landmark Explorer',
    'Visit and photograph five landmarks in your area this month.',
    E'This month: discover the history of your surroundings by visiting five significant '
    'local landmarks and documenting your journey.\n\n'
    'For each landmark: photograph it and write one sentence about what makes it notable.',
    'monthly', 'published', 'medium', 120, 500,
    'outdoor', 'photo', 'none',
    (month_start::TIMESTAMPTZ), (month_end::TIMESTAMPTZ),
    FALSE,
    'manual_review', 'started_users_may_finish', 200,
    NOW(), 'admin'
  ) ON CONFLICT (id) DO UPDATE SET
    available_from = (month_start::TIMESTAMPTZ),
    available_until = (month_end::TIMESTAMPTZ),
    updated_at = NOW();

  -- Monthly: community documentary quest
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, completion_mode, expiration_behavior, home_priority,
    published_at, source_type
  ) VALUES (
    q_monthly_doc,
    'neighborhood-voices',
    'Neighborhood Voices',
    'Document three things that make your neighborhood unique.',
    E'Look around your neighborhood with fresh eyes this month. '
    'Document three things that make it unique — a shop, a person, a tradition, an oddity.\n\n'
    'Submit three photos with written descriptions.',
    'monthly', 'published', 'easy', 60, 300,
    'both', 'photo', 'none',
    (month_start::TIMESTAMPTZ), (month_end::TIMESTAMPTZ),
    FALSE,
    'manual_review', 'started_users_may_finish', 150,
    NOW(), 'admin'
  ) ON CONFLICT (id) DO UPDATE SET
    available_from = (month_start::TIMESTAMPTZ),
    available_until = (month_end::TIMESTAMPTZ),
    updated_at = NOW();

  -- ──────────────────────────────────────────────────────────
  -- Geo Quests
  -- ──────────────────────────────────────────────────────────

  -- Geo: riverside discovery (easy, photo proof)
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, completion_mode, expiration_behavior, home_priority,
    accessibility_notes, safety_notes,
    published_at, source_type
  ) VALUES (
    q_geo_mural,
    'riverside-discovery',
    'Riverside Discovery',
    'Find the riverside mural near the old bridge.',
    E'Head to the river district and locate the famous riverside mural. '
    'It depicts the city''s industrial history in vivid colour.\n\n'
    'Take a photo that includes the full mural and you in the frame.',
    'geo', 'published', 'easy', 30, 100,
    'outdoor', 'photo', 'approximate',
    NOW(), (NOW() + INTERVAL '30 days'),
    FALSE,
    'manual_review', 'started_users_may_finish', 50,
    'Paved path. Suitable for wheelchairs and prams.',
    'Stay on the riverside path. Do not enter the water.',
    NOW(), 'admin'
  ) ON CONFLICT (id) DO UPDATE SET
    available_until = (NOW() + INTERVAL '30 days'),
    updated_at = NOW();

  -- Geo: city park adventure (medium difficulty, text+photo, no location req)
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, repeat_cooldown_hours,
    completion_mode, expiration_behavior, home_priority,
    published_at, source_type
  ) VALUES (
    q_geo_park,
    'park-naturalist',
    'Park Naturalist',
    'Identify and photograph five species of plants or birds in a city park.',
    E'Visit any city park and become a naturalist for an hour. '
    'Identify five distinct species of plants, birds, or insects.\n\n'
    'For each: photograph it and write its common name (and scientific name if you know it).',
    'geo', 'published', 'medium', 60, 200,
    'outdoor', 'photo', 'none',
    NOW(), (NOW() + INTERVAL '60 days'),
    TRUE, 168, -- repeatable, 7-day cooldown
    'manual_review', 'started_users_may_finish', 30,
    NOW(), 'admin'
  ) ON CONFLICT (id) DO UPDATE SET
    available_until = (NOW() + INTERVAL '60 days'),
    updated_at = NOW();

  -- Geo: with prerequisite (requires riverside-discovery completion)
  INSERT INTO quests (
    id, slug, title, summary, description,
    quest_type, status, difficulty, estimated_duration_minutes, points_reward,
    indoor_outdoor, proof_type, location_requirement_type,
    available_from, available_until,
    is_repeatable, completion_mode, expiration_behavior, home_priority,
    published_at, source_type
  ) VALUES (
    q_geo_prereq,
    'river-district-deep-dive',
    'River District Deep Dive',
    'Unlock after completing Riverside Discovery. Explore the full river district.',
    E'You''ve found the mural. Now go deeper.\n\n'
    'The river district has three more hidden gems. Explore the area, find all three, '
    'and document each with a photo and a brief note.',
    'geo', 'published', 'hard', 90, 350,
    'outdoor', 'photo', 'approximate',
    NOW(), (NOW() + INTERVAL '30 days'),
    FALSE,
    'manual_review', 'started_users_may_finish', 5,
    NOW(), 'admin'
  ) ON CONFLICT (id) DO NOTHING;

  -- Prerequisite: must complete riverside-discovery first
  INSERT INTO quest_prerequisites (
    quest_id, prerequisite_type, required_quest_id
  ) VALUES (
    q_geo_prereq, 'quest_completion', q_geo_mural
  ) ON CONFLICT DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Quest Objectives (Steps)
  -- ──────────────────────────────────────────────────────────

  -- Monthly explorer: 5 landmark objectives
  INSERT INTO quest_objectives (id, quest_id, sort_order, title, instructions, is_required, proof_type, location_requirement_type, completion_rule)
  SELECT
    gen_random_uuid(),
    q_monthly_exp,
    n,
    'Landmark ' || n,
    'Find and photograph landmark ' || n || '. Write one sentence about what makes it notable.',
    TRUE,
    'photo',
    'none',
    'manual'
  FROM generate_series(1, 5) AS n
  ON CONFLICT DO NOTHING;

  -- Geo deep dive: 3 hidden gems
  INSERT INTO quest_objectives (id, quest_id, sort_order, title, instructions, is_required, proof_type, location_requirement_type, completion_rule)
  SELECT
    gen_random_uuid(),
    q_geo_prereq,
    n,
    'Hidden Gem ' || n,
    'Find and photograph hidden gem ' || n || ' in the river district.',
    TRUE,
    'photo',
    'approximate',
    'manual'
  FROM generate_series(1, 3) AS n
  ON CONFLICT DO NOTHING;

  -- Park naturalist: 5 species objectives
  INSERT INTO quest_objectives (id, quest_id, sort_order, title, instructions, is_required, proof_type, location_requirement_type, completion_rule)
  SELECT
    gen_random_uuid(),
    q_geo_park,
    n,
    'Species ' || n,
    'Identify and photograph species ' || n || '. Write its common name.',
    TRUE,
    'photo',
    'none',
    'manual'
  FROM generate_series(1, 5) AS n
  ON CONFLICT DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Quest Locations (Public, no geofence)
  -- ──────────────────────────────────────────────────────────

  INSERT INTO quest_locations (id, quest_id, display_name, public_lat, public_lng, public_radius_meters, address_hint)
  VALUES
    (gen_random_uuid(), q_geo_mural, 'Riverside District', 51.5074, -0.1278, 500, 'Near the Old Bridge, Riverside Walk'),
    (gen_random_uuid(), q_geo_prereq, 'Riverside District', 51.5074, -0.1278, 800, 'River District — full tour')
  ON CONFLICT DO NOTHING;

  -- ──────────────────────────────────────────────────────────
  -- Daily Occurrence Records (for today)
  -- ──────────────────────────────────────────────────────────

  INSERT INTO quest_occurrences (quest_id, occurrence_key, available_from, available_until, is_published, admin_priority)
  VALUES
    (q_daily_walk,  'daily:morning-walk:'    || today, (today::TIMESTAMPTZ),  ((today + 1)::TIMESTAMPTZ),  TRUE, 100),
    (q_daily_photo, 'daily:daily-sky-watch:' || today, (today::TIMESTAMPTZ),  ((today + 1)::TIMESTAMPTZ),  TRUE, 80),
    (q_daily_text,  'daily:daily-reflection:'|| today, (today::TIMESTAMPTZ),  ((today + 1)::TIMESTAMPTZ),  TRUE, 70)
  ON CONFLICT (occurrence_key) DO UPDATE SET
    available_from  = EXCLUDED.available_from,
    available_until = EXCLUDED.available_until,
    updated_at = NOW();

  -- Monthly occurrence records
  INSERT INTO quest_occurrences (quest_id, occurrence_key, available_from, available_until, is_published, admin_priority)
  VALUES
    (q_monthly_exp, 'monthly:local-landmark-explorer:'   || TO_CHAR(today, 'YYYY-MM'), (month_start::TIMESTAMPTZ), (month_end::TIMESTAMPTZ), TRUE, 200),
    (q_monthly_doc, 'monthly:neighborhood-voices:'       || TO_CHAR(today, 'YYYY-MM'), (month_start::TIMESTAMPTZ), (month_end::TIMESTAMPTZ), TRUE, 150)
  ON CONFLICT (occurrence_key) DO UPDATE SET
    available_from  = EXCLUDED.available_from,
    available_until = EXCLUDED.available_until,
    updated_at = NOW();

END $$;
