-- ============================================================
-- Migration 002 — Profiles and User Settings
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- profiles    : public-facing user identity linked to auth.users
-- user_settings : private per-user preferences (owner-only)
--
-- Security:
--   - Email MUST NOT be copied into profiles (stays in auth.users)
--   - Users cannot update their own role or account_status
--   - Private settings are completely isolated from public profile
--   - A trigger auto-creates profile + settings on auth.users insert
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username                TEXT NOT NULL UNIQUE,
  display_name            TEXT NOT NULL,
  bio                     TEXT,
  avatar_path             TEXT,                    -- path in 'avatars' bucket; generate signed URL on read
  role                    user_role NOT NULL DEFAULT 'user',
  account_status          account_status NOT NULL DEFAULT 'active',
  onboarding_status       onboarding_status NOT NULL DEFAULT 'not_started',
  onboarding_completed_at TIMESTAMPTZ,
  preferred_game_mode     game_mode NOT NULL DEFAULT 'quest',
  last_active_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) BETWEEN 3 AND 20),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]+$'),  -- lowercase enforced by trigger
  CONSTRAINT display_name_length CHECK (char_length(display_name) BETWEEN 2 AND 50),
  CONSTRAINT bio_length CHECK (bio IS NULL OR char_length(bio) <= 300)
);

COMMENT ON TABLE profiles IS 'Public application identity for each authenticated user. Linked 1:1 with auth.users. Email is deliberately excluded.';
COMMENT ON COLUMN profiles.username IS 'Lowercase unique handle. Normalised by trigger before insert/update.';
COMMENT ON COLUMN profiles.avatar_path IS 'Storage path only (not URL). Resolve to signed or public URL at query time.';
COMMENT ON COLUMN profiles.role IS 'Application role. Users cannot self-promote. Elevation requires admin action (logged in audit_logs).';
COMMENT ON COLUMN profiles.account_status IS 'Active, restricted, suspended, or deactivated. Changed only by admin/moderation.';

-- Username normalisation trigger
CREATE OR REPLACE FUNCTION normalize_username()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.username = LOWER(TRIM(NEW.username));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_username
  BEFORE INSERT OR UPDATE OF username ON profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_username();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Reserved username protection table (no UI management yet — future admin feature)
CREATE TABLE IF NOT EXISTS reserved_usernames (
  username    TEXT PRIMARY KEY,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reserved_usernames IS 'Usernames that may not be registered (brand terms, offensive words, admin handles, etc.). Enforced via trigger.';

CREATE OR REPLACE FUNCTION check_reserved_username()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reserved_usernames WHERE username = LOWER(NEW.username)) THEN
    RAISE EXCEPTION 'Username "%" is reserved and cannot be registered.', NEW.username;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_reserved_username
  BEFORE INSERT OR UPDATE OF username ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_reserved_username();

-- ──────────────────────────────────────────────────────────────
-- user_settings
-- ──────────────────────────────────────────────────────────────
-- Owner-only. Admins access via service-role only (not via RLS SELECT).

CREATE TABLE IF NOT EXISTS user_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notifications
  notify_quest_available    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_monthly_drop       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_hunt_invitation    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_hunt_updates       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_proof_decisions    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_achievements       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_admin_messages     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_marketing          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Privacy
  profile_visibility        TEXT NOT NULL DEFAULT 'public'
                              CHECK (profile_visibility IN ('public', 'friends', 'private')),
  leaderboard_visibility    BOOLEAN NOT NULL DEFAULT TRUE,   -- true = visible on leaderboards
  allow_hunt_invitations    BOOLEAN NOT NULL DEFAULT TRUE,

  -- Location
  location_sharing_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  location_precision        TEXT NOT NULL DEFAULT 'approximate'
                              CHECK (location_precision IN ('approximate', 'precise')),

  -- App preferences
  preferred_units           TEXT NOT NULL DEFAULT 'metric'
                              CHECK (preferred_units IN ('metric', 'imperial')),
  theme_preference          TEXT NOT NULL DEFAULT 'system'
                              CHECK (theme_preference IN ('light', 'dark', 'system')),
  reduce_motion             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Navigation state (persisted from Zustand for cross-device sync — Build 2+)
  last_game_mode            game_mode NOT NULL DEFAULT 'quest',
  last_quest_tab            TEXT NOT NULL DEFAULT 'index',
  last_hunt_tab             TEXT NOT NULL DEFAULT 'index',

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_settings IS 'Private per-user preferences. Owner-only via RLS. Admins use service-role only.';

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Auto-create profile + settings on new auth user
-- ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER with restricted search path so it runs with
-- elevated privileges ONLY to create the initial profile row.
-- The generated username is email prefix + random suffix for uniqueness.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
  v_suffix TEXT;
BEGIN
  -- Derive a safe username candidate from email prefix
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );
  v_username := LOWER(REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '_', 'g'));

  -- Ensure uniqueness by appending a 4-char random suffix if needed
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = v_username) LOOP
    v_suffix := LOWER(SUBSTRING(MD5(gen_random_uuid()::TEXT), 1, 4));
    v_username := LOWER(REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '_', 'g'))
                  || '_' || v_suffix;
  END LOOP;

  -- Enforce length
  IF char_length(v_username) > 20 THEN
    v_username := SUBSTRING(v_username, 1, 16) || '_' || LOWER(SUBSTRING(MD5(gen_random_uuid()::TEXT), 1, 3));
  END IF;
  IF char_length(v_username) < 3 THEN
    v_username := 'user_' || LOWER(SUBSTRING(MD5(gen_random_uuid()::TEXT), 1, 8));
  END IF;

  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    v_username,
    SUBSTRING(v_display_name, 1, 50)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ──────────────────────────────────────────────────────────────
-- Public safe profile view (no PII leakage)
-- ──────────────────────────────────────────────────────────────
-- Components should query this view rather than the raw profiles table
-- to ensure accidental field additions never accidentally expose private data.

CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id,
  username,
  display_name,
  bio,
  avatar_path,
  role,
  preferred_game_mode,
  created_at
FROM profiles
WHERE account_status = 'active';

COMMENT ON VIEW public_profiles IS
  'Safe public projection of profiles. Excludes: onboarding_status, last_active_at, '
  'account_status (deactivated/suspended users are not visible), updated_at.';
