-- ============================================================
-- Migration 007 — Hunt Core Tables
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- hunts           : official and custom game hunt records
-- hunt_stops      : ordered / unordered stops along a hunt route
-- hunt_clues      : clues and hints associated with stops
-- hunt_stop_geofences : PRIVATE validation geometry (separate from public display)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- hunts
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  title                   TEXT NOT NULL,
  summary                 TEXT NOT NULL,
  description             TEXT NOT NULL,
  hunt_type               hunt_type NOT NULL DEFAULT 'official',
  status                  hunt_status NOT NULL DEFAULT 'draft',
  creator_user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- For custom games: the user who created it
    -- NULL for admin-created official hunts
  created_by_admin_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- For official hunts: the admin who created it
  privacy                 hunt_privacy NOT NULL DEFAULT 'public',
  join_policy             hunt_join_policy NOT NULL DEFAULT 'open',
  points_reward           INTEGER NOT NULL CHECK (points_reward > 0),
  estimated_duration_minutes INTEGER CHECK (estimated_duration_minutes > 0),
  difficulty              difficulty NOT NULL DEFAULT 'medium',
  max_participants        INTEGER CHECK (max_participants IS NULL OR max_participants > 0),
  starts_at               TIMESTAMPTZ,
  ends_at                 TIMESTAMPTZ,
  registration_deadline   TIMESTAMPTZ,
  published_at            TIMESTAMPTZ,
  cover_media_id          UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at             TIMESTAMPTZ,

  -- Exactly one creator context must be set
  CONSTRAINT hunt_creator_context CHECK (
    (creator_user_id IS NOT NULL AND hunt_type = 'custom') OR
    (created_by_admin_id IS NOT NULL AND hunt_type = 'official') OR
    hunt_type = 'community'
  ),
  CONSTRAINT hunt_date_range CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  ),
  CONSTRAINT hunt_title_length CHECK (char_length(title) BETWEEN 3 AND 120),
  CONSTRAINT hunt_slug_format CHECK (slug ~ '^[a-z0-9_-]+$')
);

COMMENT ON TABLE hunts IS
  'Hunt content: official (admin-created) and custom (user-created games). '
  'community type reserved for future. '
  'Paid hunt extensions, creator payouts, and sponsorship are not implemented here.';

COMMENT ON COLUMN hunts.privacy IS
  'public: visible on map. unlisted: link only. invite_only: invitation required. private: creator/participants only.';

CREATE TRIGGER trg_hunts_updated_at
  BEFORE UPDATE ON hunts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- hunt_stops
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_stops (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id             UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  title               TEXT NOT NULL,
  description         TEXT,
  is_ordered          BOOLEAN NOT NULL DEFAULT TRUE,
  is_required         BOOLEAN NOT NULL DEFAULT TRUE,
  is_hidden           BOOLEAN NOT NULL DEFAULT TRUE,
                        -- hidden stops are not revealed until unlocked
  stop_role           TEXT NOT NULL DEFAULT 'waypoint',
                        -- start | waypoint | final
  estimated_radius_meters INTEGER,
  completion_method   TEXT NOT NULL DEFAULT 'location_check',
                        -- location_check | qr_scan | photo_submitted | manual
  proof_required      BOOLEAN NOT NULL DEFAULT FALSE,
  server_reveal_state TEXT NOT NULL DEFAULT 'hidden',
                        -- hidden | revealed_to_participant | public
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stop_role_valid CHECK (stop_role IN ('start', 'waypoint', 'final')),
  CONSTRAINT reveal_state_valid CHECK (server_reveal_state IN ('hidden', 'revealed_to_participant', 'public'))
);

COMMENT ON TABLE hunt_stops IS
  'Stops along a hunt route. is_hidden=true means the stop''s coordinates are not '
  'revealed to participants until server-side reveal logic unlocks them.';

CREATE TRIGGER trg_hunt_stops_updated_at
  BEFORE UPDATE ON hunt_stops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- hunt_clues  (clues + hints per stop)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_clues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id      UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  clue_text         TEXT,
  image_media_id    UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  hint_text         TEXT,     -- revealed after hint request (future penalty system)
  reveal_rule       TEXT NOT NULL DEFAULT 'on_stop_reveal',
                      -- on_stop_reveal | on_request | timed
  reveal_after_seconds INTEGER,   -- for timed reveals
  penalty_points    INTEGER NOT NULL DEFAULT 0,  -- future penalty-ready architecture
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reveal_rule_valid CHECK (reveal_rule IN ('on_stop_reveal', 'on_request', 'timed'))
);

COMMENT ON TABLE hunt_clues IS
  'Clue and hint content for a hunt stop. '
  'hint_text is withheld until participants explicitly request it (future penalty system). '
  'Unrevealed clues must not be sent to mobile clients (enforced by server reveal logic).';

CREATE TRIGGER trg_hunt_clues_updated_at
  BEFORE UPDATE ON hunt_clues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- hunt_stop_geofences  (PRIVATE validation geometry)
-- ──────────────────────────────────────────────────────────────
-- Security boundary:
--   PUBLIC:  hunt_stops.title + estimated_radius_meters (show on map marker only)
--   PLAYER:  revealed coordinates sent only after server_reveal_state = 'revealed_to_participant'
--            via Edge Function (Build 5+)
--   SERVER:  validation_point / validation_polygon — never sent to client

CREATE TABLE IF NOT EXISTS hunt_stop_geofences (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_stop_id              UUID NOT NULL UNIQUE REFERENCES hunt_stops(id) ON DELETE CASCADE,
  -- Public display location (approximate)
  public_lat                DOUBLE PRECISION,
  public_lng                DOUBLE PRECISION,
  public_radius_meters      INTEGER DEFAULT 500,
  -- Private exact target (NEVER sent to clients directly)
  validation_point          GEOGRAPHY(POINT, 4326),
  validation_radius_meters  INTEGER NOT NULL DEFAULT 30,
  validation_polygon        GEOGRAPHY(POLYGON, 4326),
  minimum_accuracy_meters   INTEGER NOT NULL DEFAULT 20,
  -- Reveal state
  is_revealed_to_active_player BOOLEAN NOT NULL DEFAULT FALSE,
    -- when true, server may send approximate revealed coordinates via Edge Function
  server_validation_only    BOOLEAN NOT NULL DEFAULT TRUE,
    -- true: coordinate validation happens server-side only
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hunt_stop_geofences IS
  'PRIVATE. Precise GPS coordinates for Hunt stop validation. '
  'NEVER returned to mobile clients directly. '
  'RLS blocks SELECT for all roles except service_role. '
  'Server-side Edge Function (Build 5+) validates arrival and conditionally reveals '
  'approximate coordinates to active participants only.';

CREATE TRIGGER trg_hunt_stop_geofences_updated_at
  BEFORE UPDATE ON hunt_stop_geofences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
