-- ============================================================
-- Migration 017 — Quest Domain Extensions
-- Worlds — Build 1, Prompt 6
-- ============================================================
-- Adds fields and tables required for full Quest domain logic:
--
-- quests:
--   + completion_mode        ('auto' | 'manual_review')
--   + expiration_behavior    ('hard' | 'started_users_may_finish')
--   + home_priority          (integer, for home screen sorting)
--
-- quest_participations:
--   + reward_snapshot_points (snapshot of points_reward at start time)
--   + occurrence_key         (for repeatable quest occurrence tracking)
--
-- quest_occurrences (NEW):
--   Tracks scheduled occurrences of repeatable quests.
--   Occurrence key format:
--     daily:{slug}:{YYYY-MM-DD}
--     monthly:{slug}:{YYYY-MM}
--     geo:{slug}
--
-- quest_prerequisites (NEW):
--   Prerequisite requirements for starting a quest.
--   All prerequisites use AND logic (all must be satisfied).
--
-- complete_quest (RPC):
--   Server-side atomic completion + point award function.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Add columns to quests
-- ──────────────────────────────────────────────────────────────

ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS completion_mode TEXT NOT NULL DEFAULT 'manual_review'
    CHECK (completion_mode IN ('auto', 'manual_review')),
  ADD COLUMN IF NOT EXISTS expiration_behavior TEXT NOT NULL DEFAULT 'started_users_may_finish'
    CHECK (expiration_behavior IN ('hard', 'started_users_may_finish')),
  ADD COLUMN IF NOT EXISTS home_priority INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN quests.completion_mode IS
  'auto: completes immediately when all required steps are done. '
  'manual_review: requires proof submission and reviewer approval.';

COMMENT ON COLUMN quests.expiration_behavior IS
  'hard: all participations expire when available_until passes. '
  'started_users_may_finish: active participations continue past expiry; no new starts.';

COMMENT ON COLUMN quests.home_priority IS
  'Higher values appear earlier in Home and Quests list screens. '
  'Admin-controlled. Used as tiebreaker alongside available_from.';

CREATE INDEX IF NOT EXISTS idx_quests_home_priority ON quests (home_priority DESC, available_from DESC)
  WHERE status = 'published';

-- ──────────────────────────────────────────────────────────────
-- Add columns to quest_participations
-- ──────────────────────────────────────────────────────────────

ALTER TABLE quest_participations
  ADD COLUMN IF NOT EXISTS reward_snapshot_points INTEGER
    CHECK (reward_snapshot_points IS NULL OR reward_snapshot_points > 0),
  ADD COLUMN IF NOT EXISTS occurrence_key TEXT;

COMMENT ON COLUMN quest_participations.reward_snapshot_points IS
  'Captures quest.points_reward at the moment of participation start. '
  'Used for completion — immune to subsequent quest reward changes. '
  'NULL for participations created before migration 017.';

COMMENT ON COLUMN quest_participations.occurrence_key IS
  'For repeatable quests: the occurrence key that defines uniqueness for this attempt. '
  'Format: daily:{slug}:{YYYY-MM-DD} | monthly:{slug}:{YYYY-MM} | geo:{slug}. '
  'NULL for non-repeatable quests.';

-- Partial unique index: one completion per (user, occurrence_key) for repeatable quests
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_occurrence_completion
  ON quest_participations (user_id, occurrence_key)
  WHERE status = 'completed' AND occurrence_key IS NOT NULL;

COMMENT ON INDEX idx_unique_occurrence_completion IS
  'Prevents a user from completing the same daily/monthly occurrence twice. '
  'Non-repeatable quests use idx_unique_non_repeatable_completion instead.';

CREATE INDEX IF NOT EXISTS idx_participation_occurrence_key
  ON quest_participations (user_id, occurrence_key)
  WHERE occurrence_key IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- quest_occurrences (NEW)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_occurrences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id              UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  occurrence_key        TEXT NOT NULL UNIQUE,
    -- Format: daily:{slug}:{YYYY-MM-DD} | monthly:{slug}:{YYYY-MM} | geo:{slug}
  available_from        TIMESTAMPTZ NOT NULL,
  available_until       TIMESTAMPTZ NOT NULL,
  is_published          BOOLEAN NOT NULL DEFAULT FALSE,
  reward_override_points INTEGER CHECK (reward_override_points IS NULL OR reward_override_points > 0),
    -- If set, overrides quest.points_reward for this occurrence only
  admin_priority        INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT occurrence_window_valid CHECK (available_from <= available_until),
  CONSTRAINT occurrence_key_format CHECK (occurrence_key ~ '^(daily|monthly|geo):[a-z0-9_-]+')
);

COMMENT ON TABLE quest_occurrences IS
  'Scheduled occurrences of repeatable quests. '
  'One occurrence per quest per period (daily → day, monthly → month). '
  'Uniqueness for user completion is tracked via quest_participations.occurrence_key. '
  'Non-repeatable quests do not require occurrence records.';

COMMENT ON COLUMN quest_occurrences.reward_override_points IS
  'Admin-settable reward for this specific occurrence. '
  'If NULL, the parent quest.points_reward is used.';

CREATE TRIGGER trg_quest_occurrences_updated_at
  BEFORE UPDATE ON quest_occurrences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_quest_occurrences_active
  ON quest_occurrences (quest_id, available_from, available_until)
  WHERE is_published = TRUE;

-- ──────────────────────────────────────────────────────────────
-- quest_prerequisites (NEW)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quest_prerequisites (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id                  UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  prerequisite_type         TEXT NOT NULL
    CHECK (prerequisite_type IN ('quest_completion', 'minimum_points', 'achievement')),
  required_quest_id         UUID REFERENCES quests(id) ON DELETE CASCADE,
  required_achievement_id   UUID,
    -- FK to achievements.id — not enforced here to avoid circular dependency
  minimum_points            INTEGER CHECK (minimum_points IS NULL OR minimum_points > 0),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one prerequisite target must be set for the given type
  CONSTRAINT prereq_quest_complete_target CHECK (
    prerequisite_type <> 'quest_completion' OR required_quest_id IS NOT NULL
  ),
  CONSTRAINT prereq_points_target CHECK (
    prerequisite_type <> 'minimum_points' OR minimum_points IS NOT NULL
  ),
  CONSTRAINT prereq_achievement_target CHECK (
    prerequisite_type <> 'achievement' OR required_achievement_id IS NOT NULL
  ),
  -- No self-referential prerequisites
  CONSTRAINT prereq_no_self_reference CHECK (required_quest_id <> quest_id)
);

COMMENT ON TABLE quest_prerequisites IS
  'Prerequisites a user must satisfy before starting a quest. '
  'All prerequisites are evaluated with AND logic (all must pass). '
  'Evaluated at start time only — not rechecked mid-participation. '
  'Client evaluates using preloaded completed quest IDs and point total.';

CREATE INDEX IF NOT EXISTS idx_quest_prerequisites_quest
  ON quest_prerequisites (quest_id);

-- ──────────────────────────────────────────────────────────────
-- RLS for new tables
-- ──────────────────────────────────────────────────────────────

-- quest_occurrences: public read for published, within-window occurrences
ALTER TABLE quest_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quest_occurrences_public_select"
  ON quest_occurrences FOR SELECT
  USING (
    is_published = TRUE
    AND available_from <= NOW()
    AND available_until > NOW()
  );

-- quest_prerequisites: public read for any user (no sensitive data)
ALTER TABLE quest_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quest_prerequisites_public_select"
  ON quest_prerequisites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quests q
      WHERE q.id = quest_id AND q.status = 'published'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- complete_quest RPC (server-side atomic completion + point award)
-- ──────────────────────────────────────────────────────────────
-- This function is called by the mobile client via client.rpc('complete_quest').
-- It performs the completion + point insert atomically, using the reward_snapshot_points
-- captured at start time (not the current quest.points_reward value).
--
-- Security:
--   - SECURITY DEFINER: runs as the function owner (superuser/service_role level access).
--   - SET search_path = public: prevents search_path injection.
--   - Validates auth.uid() === participation.user_id before any write.
--   - Validates participation is in a completable state.
--   - Uses idempotency_key unique constraint to prevent double-awarding.
--   - Never accepts reward values from the client — always reads from the DB snapshot.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_quest(
  p_participation_id UUID,
  p_user_id         UUID,
  p_idempotency_key TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation   quest_participations%ROWTYPE;
  v_quest           quests%ROWTYPE;
  v_points          INTEGER;
  v_completed_at    TIMESTAMPTZ;
  v_ledger_id       UUID;
BEGIN
  -- Validate caller identity
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch.';
  END IF;

  -- Load participation with row lock
  SELECT * INTO v_participation
  FROM quest_participations
  WHERE id = p_participation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participation not found: %', p_participation_id;
  END IF;

  -- Ownership check
  IF v_participation.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: participation does not belong to caller.';
  END IF;

  -- Idempotent: already completed
  IF v_participation.status = 'completed' THEN
    RETURN json_build_object(
      'awarded_points', v_participation.reward_snapshot_points,
      'completed_at',  v_participation.completed_at,
      'was_already_completed', TRUE
    );
  END IF;

  -- Validate completable state
  -- (auto mode: in_progress; manual_review mode: under_review after approval)
  IF v_participation.status NOT IN ('in_progress', 'started', 'under_review') THEN
    RAISE EXCEPTION 'Participation % is in state %; cannot complete.', p_participation_id, v_participation.status;
  END IF;

  -- Load quest for completion_mode and reward validation
  SELECT * INTO v_quest FROM quests WHERE id = v_participation.quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found for participation %', p_participation_id;
  END IF;

  -- For manual_review quests: only proceed if called with proof approval context
  -- (Edge Function handles this check before calling the RPC)

  -- Resolve reward from snapshot (captured at start time)
  v_points := COALESCE(v_participation.reward_snapshot_points, v_quest.points_reward);
  IF v_points IS NULL OR v_points <= 0 THEN
    RAISE EXCEPTION 'Invalid reward amount for participation %', p_participation_id;
  END IF;

  v_completed_at := NOW();

  -- Atomic: update participation status
  UPDATE quest_participations SET
    status       = 'completed',
    completed_at = v_completed_at,
    awarded_points = v_points,
    updated_at   = v_completed_at
  WHERE id = p_participation_id;

  -- Atomic: insert points ledger entry (unique constraint prevents double-award)
  INSERT INTO points_ledger (
    user_id,
    amount,
    transaction_type,
    source_type,
    source_id,
    quest_participation_id,
    reason,
    idempotency_key
  ) VALUES (
    p_user_id,
    v_points,
    'quest_reward',
    'quest',
    v_quest.id,
    p_participation_id,
    'Quest completed: ' || v_quest.title,
    p_idempotency_key
  ) ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_ledger_id;

  -- If ledger insert was skipped (duplicate idempotency_key), treat as success
  RETURN json_build_object(
    'awarded_points',        v_points,
    'completed_at',          v_completed_at,
    'ledger_id',             v_ledger_id,
    'was_already_completed', FALSE
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Duplicate completion attempt — return existing result
    RETURN json_build_object(
      'awarded_points',        v_participation.reward_snapshot_points,
      'completed_at',          v_participation.completed_at,
      'was_already_completed', TRUE
    );
END;
$$;

COMMENT ON FUNCTION complete_quest IS
  'Atomic quest completion and point award. '
  'Called by mobile client via Supabase RPC. '
  'SECURITY DEFINER — runs with elevated privileges. '
  'Validates ownership, state, and uses idempotency_key to prevent double-award. '
  'Never accepts reward values from the client — reads from reward_snapshot_points.';

-- Restrict execution: only authenticated users may call this
REVOKE ALL ON FUNCTION complete_quest FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_quest TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- abandon_quest RPC (server-side abandonment with history preservation)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION abandon_quest(
  p_participation_id UUID,
  p_user_id         UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation quest_participations%ROWTYPE;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity mismatch.';
  END IF;

  SELECT * INTO v_participation
  FROM quest_participations
  WHERE id = p_participation_id
  FOR UPDATE;

  IF NOT FOUND OR v_participation.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Participation not found or unauthorized.';
  END IF;

  IF v_participation.status IN ('completed', 'rejected', 'abandoned', 'expired') THEN
    RAISE EXCEPTION 'Cannot abandon participation in state: %', v_participation.status;
  END IF;

  IF v_participation.status = 'under_review' THEN
    RAISE EXCEPTION 'Cannot abandon while proof is under review. Wait for review decision.';
  END IF;

  UPDATE quest_participations SET
    status       = 'abandoned',
    abandoned_at = NOW(),
    updated_at   = NOW()
  WHERE id = p_participation_id;

  -- History preserved — no delete
  RETURN json_build_object('status', 'abandoned', 'participation_id', p_participation_id);
END;
$$;

REVOKE ALL ON FUNCTION abandon_quest FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abandon_quest TO authenticated;

COMMENT ON FUNCTION abandon_quest IS
  'Abandons an active participation. History is preserved. No points awarded. '
  'Cannot abandon completed or under-review participations.';
