-- ============================================================
-- Migration 005 — Quest Core Tables
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- quests                  : all quest types (daily, monthly, geo)
-- quest_objectives        : ordered steps within a quest
-- quest_categories        : admin-managed taxonomy
-- quest_tags              : flexible tagging
-- quest_category_assignments
-- quest_tag_assignments
-- quest_media             : quest ↔ media_assets relation
-- quest_locations         : geo-quest coordinates (public approx)
-- quest_geofences         : geo-quest validation geometry (PRIVATE)
-- point_reward_guidelines : configurable calibration table
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- point_reward_guidelines
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS point_reward_guidelines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type     TEXT NOT NULL DEFAULT 'quest',  -- quest | hunt | achievement
  difficulty        difficulty NOT NULL,
  minimum_minutes   INTEGER NOT NULL CHECK (minimum_minutes >= 0),
  maximum_minutes   INTEGER NOT NULL CHECK (maximum_minutes >= minimum_minutes),
  suggested_min_points  INTEGER NOT NULL CHECK (suggested_min_points > 0),
  suggested_max_points  INTEGER NOT NULL CHECK (suggested_max_points >= suggested_min_points),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE point_reward_guidelines IS
  'Admin-configurable point calibration reference. These are recommendations only — '
  'admins may override individual quest rewards. AI generation uses these as suggestions '
  'but cannot auto-approve or publish based on them.';

CREATE TRIGGER trg_point_guidelines_updated_at
  BEFORE UPDATE ON point_reward_guidelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- quest_categories
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  icon_key    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT category_slug_format CHECK (slug ~ '^[a-z0-9_-]+$')
);

COMMENT ON TABLE quest_categories IS 'Admin-managed quest categories. Stored in DB (not hardcoded in client) for AI generation support.';

CREATE TRIGGER trg_quest_categories_updated_at
  BEFORE UPDATE ON quest_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- quest_tags
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- quests
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                        TEXT NOT NULL UNIQUE,
  title                       TEXT NOT NULL,
  summary                     TEXT NOT NULL,
  description                 TEXT NOT NULL,
  quest_type                  quest_type NOT NULL,
  status                      quest_status NOT NULL DEFAULT 'draft',
  difficulty                  difficulty NOT NULL DEFAULT 'medium',
  estimated_duration_minutes  INTEGER CHECK (estimated_duration_minutes > 0),
  points_reward               INTEGER NOT NULL CHECK (points_reward > 0),
  indoor_outdoor              indoor_outdoor NOT NULL DEFAULT 'both',
  accessibility_notes         TEXT,
  safety_notes                TEXT,
  proof_type                  proof_type NOT NULL DEFAULT 'photo',
  location_requirement_type   location_requirement_type NOT NULL DEFAULT 'none',
  available_from              TIMESTAMPTZ,
  available_until             TIMESTAMPTZ,
  published_at                TIMESTAMPTZ,
  created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by                 UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source_type                 quest_source_type NOT NULL DEFAULT 'admin',
  ai_generation_id            UUID,                    -- FK added in 012_ai_foundation.sql
  is_repeatable               BOOLEAN NOT NULL DEFAULT FALSE,
  repeat_cooldown_hours       INTEGER CHECK (repeat_cooldown_hours IS NULL OR repeat_cooldown_hours >= 0),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at                 TIMESTAMPTZ,

  -- Temporal consistency
  CONSTRAINT available_range_valid CHECK (
    available_from IS NULL OR available_until IS NULL OR available_from <= available_until
  ),
  CONSTRAINT title_length CHECK (char_length(title) BETWEEN 3 AND 120),
  CONSTRAINT summary_length CHECK (char_length(summary) BETWEEN 10 AND 300),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9_-]+$')
);

COMMENT ON TABLE quests IS 'All quest content: daily, monthly, geo. Only published + currently-available rows are visible to mobile clients via RLS.';
COMMENT ON COLUMN quests.ai_generation_id IS 'References ai_generated_content.id (FK added in migration 012). NULL for human-authored quests.';
COMMENT ON COLUMN quests.is_repeatable IS 'If false, a user may only complete once. Enforced via uniqueness constraint on quest_participations.';

CREATE TRIGGER trg_quests_updated_at
  BEFORE UPDATE ON quests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- quest_objectives (steps within a quest)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_objectives (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id                  UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  sort_order                INTEGER NOT NULL DEFAULT 0,
  title                     TEXT NOT NULL,
  instructions              TEXT NOT NULL,
  is_required               BOOLEAN NOT NULL DEFAULT TRUE,
  is_optional               BOOLEAN NOT NULL DEFAULT FALSE,
  proof_type                proof_type NOT NULL DEFAULT 'none',
  location_requirement_type location_requirement_type NOT NULL DEFAULT 'none',
  completion_rule           TEXT NOT NULL DEFAULT 'manual',
                              -- manual | location_check | qr_scan | photo_submitted
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT objective_title_length CHECK (char_length(title) BETWEEN 2 AND 120)
);

COMMENT ON TABLE quest_objectives IS
  'Ordered steps within a quest. For Build 1 the full reward is awarded on final completion; '
  'partial step rewards are architecture-ready but not active.';

CREATE TRIGGER trg_quest_objectives_updated_at
  BEFORE UPDATE ON quest_objectives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- quest_category_assignments  (many-to-many)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_category_assignments (
  quest_id    UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES quest_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (quest_id, category_id)
);

-- ──────────────────────────────────────────────────────────────
-- quest_tag_assignments  (many-to-many)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_tag_assignments (
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES quest_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (quest_id, tag_id)
);

-- ──────────────────────────────────────────────────────────────
-- quest_media  (quest ↔ media_assets)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id    UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  media_id    UUID NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  purpose     TEXT NOT NULL DEFAULT 'cover',
              -- cover | detail | instructional | proof_example
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quest_media IS 'Ordered media attachments for a quest. purpose identifies the display context.';

-- ──────────────────────────────────────────────────────────────
-- quest_locations  (public approximate)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_locations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id              UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  display_name          TEXT NOT NULL,
  public_lat            DOUBLE PRECISION,   -- approximate, safe to show on map
  public_lng            DOUBLE PRECISION,
  public_radius_meters  INTEGER DEFAULT 500, -- fuzz radius for public display
  address_hint          TEXT,               -- e.g. "Near Central Park"
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quest_locations IS
  'Public (approximate) location for Geo-Quest discovery. NOT used for validation. '
  'Precise validation geometry is in quest_geofences.';

CREATE TRIGGER trg_quest_locations_updated_at
  BEFORE UPDATE ON quest_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- quest_geofences  (PRIVATE — validation geometry only)
-- ──────────────────────────────────────────────────────────────
-- Access via RLS is restricted to service_role and admins.
-- Mobile clients NEVER receive raw validation coordinates.
-- Server validates completion via Edge Function (Build 5+).

CREATE TABLE IF NOT EXISTS quest_geofences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id                UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  objective_id            UUID REFERENCES quest_objectives(id) ON DELETE CASCADE,
  -- Precise validation geometry (PostGIS)
  validation_point        GEOGRAPHY(POINT, 4326),
  validation_radius_meters INTEGER NOT NULL DEFAULT 50,
  validation_polygon      GEOGRAPHY(POLYGON, 4326),   -- for complex zones
  minimum_accuracy_meters INTEGER NOT NULL DEFAULT 20,
  -- Validation timing
  requires_start_validation   BOOLEAN NOT NULL DEFAULT FALSE,
  requires_completion_validation BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quest_geofences IS
  'PRIVATE. Contains precise GPS coordinates used for server-side completion validation. '
  'These coordinates must never be returned to mobile clients. '
  'Validation is performed server-side (Edge Function, Build 5+). '
  'RLS blocks SELECT for all roles except service_role.';

CREATE TRIGGER trg_quest_geofences_updated_at
  BEFORE UPDATE ON quest_geofences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
