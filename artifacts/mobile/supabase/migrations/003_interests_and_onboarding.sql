-- ============================================================
-- Migration 003 — Interests and Onboarding State
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- interests       : admin-managed interest taxonomy
-- user_interests  : many-to-many user ↔ interest selections
--
-- Onboarding state is stored in profiles.onboarding_status and
-- user_settings (last_game_mode preference) rather than in a
-- separate onboarding table. A richer step-tracking JSONB column
-- is added to user_settings to avoid table proliferation.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- interests
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  icon_key    TEXT,                         -- maps to Feather icon name
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9_-]+$'),
  CONSTRAINT name_length CHECK (char_length(name) BETWEEN 2 AND 60)
);

COMMENT ON TABLE interests IS 'Admin-managed interest tags. Users select from this list during onboarding and from their profile.';

CREATE TRIGGER trg_interests_updated_at
  BEFORE UPDATE ON interests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- user_interests  (many-to-many)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_interests (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, interest_id)
);

COMMENT ON TABLE user_interests IS 'User interest selections. Composite PK prevents duplicates.';

-- ──────────────────────────────────────────────────────────────
-- Onboarding progress (stored in user_settings as JSONB)
-- ──────────────────────────────────────────────────────────────
-- Rather than a dedicated onboarding table we extend user_settings
-- with a structured JSONB column. This avoids a join for every
-- onboarding check and keeps all private preferences in one place.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB NOT NULL DEFAULT '{
    "step": "not_started",
    "interests_saved": false,
    "location_explanation_shown": false,
    "location_permission_granted": false,
    "starting_mode_selected": false
  }'::jsonb;

COMMENT ON COLUMN user_settings.onboarding_progress IS
  'Structured onboarding state. Keys: step (not_started|interests|location|starting_mode|complete), '
  'interests_saved, location_explanation_shown, location_permission_granted, starting_mode_selected.';
