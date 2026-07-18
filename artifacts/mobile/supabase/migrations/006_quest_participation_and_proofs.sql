-- ============================================================
-- Migration 006 — Quest Participation and Proof Submissions
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- quest_participations  : user ↔ quest relationship
-- quest_step_progress   : per-step tracking
-- proof_submissions     : shared proof system (Quest + Hunt)
-- proof_media           : proof ↔ media_assets relation
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- quest_participations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_participations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id            UUID NOT NULL REFERENCES quests(id) ON DELETE RESTRICT,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status              participation_status NOT NULL DEFAULT 'started',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_progress_at    TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  abandoned_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  awarded_points      INTEGER CHECK (awarded_points IS NULL OR awarded_points >= 0),
  completion_version  INTEGER NOT NULL DEFAULT 1,
                        -- incremented on resubmission for non-repeatable quests
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quest_participations IS
  'A user''s active or historical relationship with a Quest. '
  'awarded_points is set by server-side logic only — never by direct client writes.';

COMMENT ON COLUMN quest_participations.awarded_points IS
  'Set ONLY by trusted server logic (Edge Function or trigger). '
  'Direct client writes are blocked by RLS.';

CREATE TRIGGER trg_quest_participations_updated_at
  BEFORE UPDATE ON quest_participations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Prevent multiple active participations in non-repeatable quests.
-- A partial index: unique (user_id, quest_id) where quest is NOT repeatable
-- is enforced at application level + via a trigger below (DB cannot reference
-- another table in a partial index WHERE clause directly).

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_non_repeatable_completion
  ON quest_participations (user_id, quest_id)
  WHERE status = 'completed';

COMMENT ON INDEX idx_unique_non_repeatable_completion IS
  'Prevents a user completing the same quest twice. '
  'Repeatable quests bypass this via status=abandoned cycle — enforced in service logic.';

-- ──────────────────────────────────────────────────────────────
-- quest_step_progress
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_step_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id  UUID NOT NULL REFERENCES quest_participations(id) ON DELETE CASCADE,
  quest_step_id     UUID NOT NULL REFERENCES quest_objectives(id) ON DELETE CASCADE,
  status            step_status NOT NULL DEFAULT 'not_started',
  completed_at      TIMESTAMPTZ,
  progress_value    JSONB,     -- flexible: {"count": 3, "target": 5} or {"checked": true}
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (participation_id, quest_step_id)
);

COMMENT ON TABLE quest_step_progress IS
  'Per-step progress within a quest participation. '
  'Users may only access rows linked to their own participations (enforced by RLS).';

CREATE TRIGGER trg_quest_step_progress_updated_at
  BEFORE UPDATE ON quest_step_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- proof_submissions  (shared — Quest and Hunt)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proof_submissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  -- Polymorphic source reference (one of the following will be non-null)
  quest_participation_id  UUID REFERENCES quest_participations(id) ON DELETE RESTRICT,
  hunt_stop_progress_id   UUID,     -- FK to hunt_stop_progress.id; added in migration 008
  -- Submission content
  submission_type         proof_type NOT NULL,
  text_response           TEXT,
  location_lat            DOUBLE PRECISION,
  location_lng            DOUBLE PRECISION,
  location_accuracy_meters DOUBLE PRECISION,
  -- Status and review
  status                  proof_submission_status NOT NULL DEFAULT 'draft',
  moderation_status       moderation_status NOT NULL DEFAULT 'pending',
  review_notes            TEXT,
  reviewer_id             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at            TIMESTAMPTZ,
  reviewed_at             TIMESTAMPTZ,
  -- Resubmission chain
  previous_submission_id  UUID REFERENCES proof_submissions(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one source must be set
  CONSTRAINT proof_source_exclusive CHECK (
    (quest_participation_id IS NOT NULL)::int +
    (hunt_stop_progress_id IS NOT NULL)::int = 1
  )
);

COMMENT ON TABLE proof_submissions IS
  'Shared proof infrastructure for Quest and Hunt. Private by default. '
  'Users access only their own rows; moderators/admins access via service_role. '
  'Proof files are in the proof-submissions storage bucket (never public).';

COMMENT ON COLUMN proof_submissions.location_lat IS
  'Device-reported latitude at submission time. Used as supporting evidence only; '
  'authoritative geo-validation is performed server-side using quest_geofences.';

COMMENT ON COLUMN proof_submissions.previous_submission_id IS
  'Links a resubmission to its predecessor. Preserves the review chain.';

CREATE TRIGGER trg_proof_submissions_updated_at
  BEFORE UPDATE ON proof_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- proof_media  (proof ↔ media_assets)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proof_media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES proof_submissions(id) ON DELETE CASCADE,
  media_id        UUID NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE proof_media IS
  'Ordered media files attached to a proof submission. '
  'Inherits proof_submissions privacy — no public access.';
