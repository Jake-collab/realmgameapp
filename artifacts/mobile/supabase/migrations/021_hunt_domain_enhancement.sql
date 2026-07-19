-- ============================================================
-- Migration 021 — Hunt Domain Enhancement
-- Worlds — Build 1, Prompt 11
-- ============================================================
-- Adds focused columns and tables to support the full Hunt domain
-- without replacing the schema established in migrations 007–008.
--
-- Additions:
--   hunt_occurrences          — separate occurrences from Hunt definitions
--   hunt_prerequisites        — typed prerequisite model
--   hunt_domain_events        — domain event outbox (future notifications)
--   Columns to hunts          — participation_mode, stop_ordering, start_model,
--                               min_participants, version, cancellation fields,
--                               featured flag, accessibility/safety notes
--   Columns to hunt_participants — occurrence_id, reward_snapshot, removal fields,
--                               withdrawal fields, completion idempotency key
--   Columns to hunt_stop_progress — unlocked_at, locked_until, stop_progress status
--   Columns to hunt_stops     — safety_note, accessibility_note, estimated_duration
--   New enum values           — participation_mode, start_model, stop_ordering
--   RPCs                      — join_hunt, start_hunt, invite_to_hunt,
--                               accept_hunt_invitation, decline_hunt_invitation,
--                               withdraw_from_hunt, remove_hunt_participant,
--                               complete_hunt_stop, complete_hunt,
--                               get_hunt_availability, get_active_hunt,
--                               get_my_hunts_summary, cancel_hunt_occurrence
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- New enum types
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE participation_mode AS ENUM ('solo', 'group', 'solo_or_group');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hunt_start_model AS ENUM ('individual', 'scheduled', 'host_controlled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stop_ordering AS ENUM ('ordered', 'unordered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- Columns added to hunts
-- ──────────────────────────────────────────────────────────────

ALTER TABLE hunts
  ADD COLUMN IF NOT EXISTS participation_mode  participation_mode  NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS stop_ordering       stop_ordering       NOT NULL DEFAULT 'ordered',
  ADD COLUMN IF NOT EXISTS start_model         hunt_start_model    NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS min_participants    INTEGER             NOT NULL DEFAULT 1 CHECK (min_participants >= 1),
  ADD COLUMN IF NOT EXISTS version             INTEGER             NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_featured         BOOLEAN             NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS safety_note         TEXT,
  ADD COLUMN IF NOT EXISTS accessibility_note  TEXT,
  ADD COLUMN IF NOT EXISTS public_meeting_info TEXT,
  ADD COLUMN IF NOT EXISTS venue_hours_note    TEXT,
  ADD COLUMN IF NOT EXISTS is_repeatable       BOOLEAN             NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS repeat_cooldown_hours INTEGER,
  ADD COLUMN IF NOT EXISTS short_description   TEXT,
  -- Cancellation audit fields
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN hunts.version IS
  'Incremented when Hunt configuration changes that affect active participants. '
  'Reward snapshots capture this version at join/start time.';
COMMENT ON COLUMN hunts.participation_mode IS
  'solo: individual play only. group: group play only. solo_or_group: both modes supported.';
COMMENT ON COLUMN hunts.stop_ordering IS
  'ordered: stops must be completed in sort_order sequence. '
  'unordered: any order permitted.';
COMMENT ON COLUMN hunts.start_model IS
  'individual: each participant starts independently. '
  'scheduled: auto-starts at occurrence.starts_at. '
  'host_controlled: co_host triggers start after requirements are met.';

-- ──────────────────────────────────────────────────────────────
-- Hunt stops: add missing columns
-- ──────────────────────────────────────────────────────────────

ALTER TABLE hunt_stops
  ADD COLUMN IF NOT EXISTS safety_note             TEXT,
  ADD COLUMN IF NOT EXISTS accessibility_note      TEXT,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER CHECK (estimated_duration_minutes > 0),
  ADD COLUMN IF NOT EXISTS public_location_label   TEXT,
  ADD COLUMN IF NOT EXISTS unlock_after_stop_id    UUID REFERENCES hunt_stops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unlock_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS time_window_minutes     INTEGER CHECK (time_window_minutes > 0);

COMMENT ON COLUMN hunt_stops.unlock_after_stop_id IS
  'For ordered hunts: this stop becomes available after the referenced stop is completed. '
  'NULL = available from Hunt start (first stop).';

-- ──────────────────────────────────────────────────────────────
-- Hunt occurrences
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_occurrences (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id                         UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  occurrence_key                  TEXT NOT NULL,
  status                          hunt_status NOT NULL DEFAULT 'scheduled',

  -- Schedule
  starts_at                       TIMESTAMPTZ,
  ends_at                         TIMESTAMPTZ,
  join_until                      TIMESTAMPTZ,
  start_until                     TIMESTAMPTZ,
  complete_until                  TIMESTAMPTZ,
  hard_expires_at                 TIMESTAMPTZ,
  started_users_grace_period_minutes INTEGER NOT NULL DEFAULT 60,

  -- Capacity
  max_participants                INTEGER CHECK (max_participants IS NULL OR max_participants > 0),
  min_participants                INTEGER NOT NULL DEFAULT 1 CHECK (min_participants >= 1),
  participant_count               INTEGER NOT NULL DEFAULT 0 CHECK (participant_count >= 0),

  -- Override (occurrence can override Hunt-level rewards)
  reward_override_points          INTEGER CHECK (reward_override_points IS NULL OR reward_override_points > 0),
  start_model                     hunt_start_model NOT NULL DEFAULT 'individual',

  -- Public meeting info (safe — no private geometry)
  public_meeting_info             TEXT,

  -- Host (a co_host user for host-controlled starts)
  host_user_id                    UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Cancellation
  cancelled_at                    TIMESTAMPTZ,
  cancellation_reason             TEXT,
  cancelled_by_user_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Audit
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (hunt_id, occurrence_key),

  CONSTRAINT occurrence_date_range CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

COMMENT ON TABLE hunt_occurrences IS
  'Scheduled instances of a Hunt definition. '
  'Multiple occurrences allow the same Hunt to run at different times or with different participant pools. '
  'participant_count is updated transactionally by join/withdrawal RPCs — do not decrement directly.';

COMMENT ON COLUMN hunt_occurrences.participant_count IS
  'Count of accepted/active/completed participants. Updated atomically by RPCs. '
  'Do not decrement from outside trusted functions.';

CREATE TRIGGER trg_hunt_occurrences_updated_at
  BEFORE UPDATE ON hunt_occurrences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_hunt_occurrences_hunt_status
  ON hunt_occurrences (hunt_id, status);
CREATE INDEX IF NOT EXISTS idx_hunt_occurrences_starts_at
  ON hunt_occurrences (starts_at)
  WHERE status IN ('scheduled', 'active');

-- ──────────────────────────────────────────────────────────────
-- Columns added to hunt_participants
-- ──────────────────────────────────────────────────────────────

ALTER TABLE hunt_participants
  ADD COLUMN IF NOT EXISTS occurrence_id            UUID REFERENCES hunt_occurrences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_snapshot          JSONB,
  -- Withdrawal audit
  ADD COLUMN IF NOT EXISTS withdrawn_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawal_reason        TEXT,
  -- Removal audit
  ADD COLUMN IF NOT EXISTS removed_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by_user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removal_reason           TEXT,
  -- Internal removal note (NOT returned to the removed participant)
  ADD COLUMN IF NOT EXISTS removal_note_internal    TEXT,
  -- Completion idempotency key
  ADD COLUMN IF NOT EXISTS completion_idempotency_key TEXT UNIQUE;

COMMENT ON COLUMN hunt_participants.reward_snapshot IS
  'JSONB snapshot of Hunt reward config at join or start time. '
  'Later Hunt edits do not silently change active participant rewards.';
COMMENT ON COLUMN hunt_participants.removal_note_internal IS
  'Internal moderation note for participant removal. '
  'NEVER returned to the removed participant.';
COMMENT ON COLUMN hunt_participants.completion_idempotency_key IS
  'Unique key preventing duplicate reward insertion. Format: hunt_completion:{id}';

-- ──────────────────────────────────────────────────────────────
-- Columns added to hunt_stop_progress
-- ──────────────────────────────────────────────────────────────

ALTER TABLE hunt_stop_progress
  ADD COLUMN IF NOT EXISTS unlocked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until   TIMESTAMPTZ;

COMMENT ON COLUMN hunt_stop_progress.unlocked_at IS
  'When the stop was unlocked for this participant (by completing the previous stop).';
COMMENT ON COLUMN hunt_stop_progress.locked_until IS
  'For timed-reveal stops: the stop cannot be accessed before this time.';

-- ──────────────────────────────────────────────────────────────
-- Hunt prerequisites
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_prerequisites (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id                  UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  prerequisite_type        TEXT NOT NULL CHECK (prerequisite_type IN (
    'quest_completion', 'hunt_completion', 'minimum_points',
    'achievement', 'invitation', 'admin_access'
  )),
  required_quest_id        UUID REFERENCES quests(id) ON DELETE CASCADE,
  required_hunt_id         UUID REFERENCES hunts(id) ON DELETE CASCADE,
  required_achievement_id  UUID,  -- FK to achievements when implemented
  minimum_points           INTEGER CHECK (minimum_points IS NULL OR minimum_points > 0),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hunt_prerequisites IS
  'Typed, non-executable prerequisites for Hunt eligibility. '
  'All prerequisites in a Hunt list use AND logic (all must be satisfied). '
  'No executable code or arbitrary expressions are stored here.';

CREATE INDEX IF NOT EXISTS idx_hunt_prerequisites_hunt
  ON hunt_prerequisites (hunt_id);

-- ──────────────────────────────────────────────────────────────
-- Hunt domain events outbox
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_domain_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  hunt_id         UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  participation_id UUID REFERENCES hunt_participants(id) ON DELETE SET NULL,
  occurrence_id   UUID REFERENCES hunt_occurrences(id) ON DELETE SET NULL,
  invitation_id   UUID REFERENCES hunt_invitations(id) ON DELETE SET NULL,
  stop_id         UUID REFERENCES hunt_stops(id) ON DELETE SET NULL,
  -- Safe scalar payload — NEVER includes geometry, proof contents, or tokens
  payload         JSONB NOT NULL DEFAULT '{}',
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hunt_domain_events IS
  'Domain event outbox for Hunt lifecycle events. '
  'Consumed by future notification and analytics infrastructure. '
  'payload must NEVER include private geometry, proof contents, or access tokens.';

CREATE INDEX IF NOT EXISTS idx_hunt_domain_events_unprocessed
  ON hunt_domain_events (created_at)
  WHERE processed_at IS NULL;

-- ──────────────────────────────────────────────────────────────
-- RLS for new tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE hunt_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_domain_events ENABLE ROW LEVEL SECURITY;

-- Occurrences: public hunts are publicly visible; private/invite_only require access check
CREATE POLICY hunt_occurrences_select
  ON hunt_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hunts h
      WHERE h.id = hunt_id
        AND (h.privacy IN ('public', 'unlisted')
          OR can_access_hunt(hunt_id, auth.uid()))
    )
  );

-- Prerequisites: visible to anyone who can access the hunt
CREATE POLICY hunt_prerequisites_select
  ON hunt_prerequisites FOR SELECT
  USING (can_access_hunt(hunt_id, auth.uid()));

-- Domain events: no direct client reads
CREATE POLICY hunt_domain_events_no_client_read
  ON hunt_domain_events FOR SELECT
  USING (FALSE);

-- ──────────────────────────────────────────────────────────────
-- Indexes on hunt_participants for new columns
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hunt_participants_occurrence
  ON hunt_participants (hunt_id, occurrence_id, status);

CREATE INDEX IF NOT EXISTS idx_hunt_participants_user_status
  ON hunt_participants (user_id, status);

-- ──────────────────────────────────────────────────────────────
-- RPC: get_hunt_availability
-- ──────────────────────────────────────────────────────────────
-- Returns the authoritative availability state for a Hunt+user pair.
-- Used by Map, Detail, My Hunts, and Invitations — one source of truth.

CREATE OR REPLACE FUNCTION get_hunt_availability(
  p_hunt_id     UUID,
  p_occurrence_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_hunt           RECORD;
  v_occurrence     RECORD;
  v_participant    RECORD;
  v_invitation     RECORD;
  v_capacity_count INTEGER;
  v_state          TEXT;
  v_can_view       BOOLEAN := FALSE;
  v_can_join       BOOLEAN := FALSE;
  v_can_start      BOOLEAN := FALSE;
  v_reason         TEXT    := 'ELIGIBLE';
  v_message        TEXT    := '';
BEGIN
  v_user_id := auth.uid();

  -- Load Hunt
  SELECT * INTO v_hunt FROM hunts WHERE id = p_hunt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'ineligible', 'reasonCode', 'HUNT_NOT_PUBLISHED',
      'canView', FALSE, 'canJoin', FALSE, 'canStart', FALSE,
      'userMessage', 'Hunt not found.');
  END IF;

  -- Load occurrence (use first active/scheduled if not specified)
  IF p_occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occurrence FROM hunt_occurrences
      WHERE id = p_occurrence_id AND hunt_id = p_hunt_id;
  ELSE
    SELECT * INTO v_occurrence FROM hunt_occurrences
      WHERE hunt_id = p_hunt_id AND status IN ('scheduled', 'active')
      ORDER BY starts_at ASC NULLS LAST LIMIT 1;
  END IF;

  -- Load participant record
  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_participant FROM hunt_participants
      WHERE hunt_id = p_hunt_id AND user_id = v_user_id
      ORDER BY created_at DESC LIMIT 1;
    -- Load pending invitation
    SELECT * INTO v_invitation FROM hunt_invitations
      WHERE hunt_id = p_hunt_id AND invitee_user_id = v_user_id AND status = 'pending'
      LIMIT 1;
    -- Expire stale invitations
    UPDATE hunt_invitations SET status = 'expired'
      WHERE id = v_invitation.id AND expires_at IS NOT NULL AND expires_at < NOW();
    IF FOUND THEN v_invitation.status := 'expired'; END IF;
  END IF;

  -- ── Cancelled / Expired ────────────────────────────────────────────────────
  IF v_hunt.status IN ('cancelled', 'archived') THEN
    RETURN jsonb_build_object(
      'state', 'cancelled', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
      'reasonCode', 'HUNT_CANCELLED', 'userMessage', 'This hunt has been cancelled.'
    );
  END IF;

  IF v_hunt.status = 'expired' THEN
    RETURN jsonb_build_object(
      'state', 'expired', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
      'reasonCode', 'HUNT_EXPIRED', 'userMessage', 'This hunt has ended.'
    );
  END IF;

  -- ── Privacy check ──────────────────────────────────────────────────────────
  IF v_hunt.privacy = 'private' THEN
    IF v_user_id IS NULL OR NOT can_access_hunt(p_hunt_id, v_user_id) THEN
      RETURN jsonb_build_object(
        'state', 'private', 'canView', FALSE, 'canJoin', FALSE, 'canStart', FALSE,
        'reasonCode', 'NOT_AUTHORIZED', 'userMessage', 'This hunt is private.'
      );
    END IF;
  END IF;

  v_can_view := TRUE;

  -- ── Draft / Pending ────────────────────────────────────────────────────────
  IF v_hunt.status IN ('draft', 'pending_review', 'rejected') THEN
    RETURN jsonb_build_object(
      'state', 'ineligible', 'canView', FALSE, 'canJoin', FALSE, 'canStart', FALSE,
      'reasonCode', 'HUNT_NOT_PUBLISHED', 'userMessage', "This hunt isn't available yet."
    );
  END IF;

  -- ── Unauthenticated ────────────────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'state', 'available', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
      'reasonCode', 'NOT_AUTHENTICATED', 'userMessage', 'Sign in to join hunts.',
      'huntId', p_hunt_id
    );
  END IF;

  -- ── Existing participation ─────────────────────────────────────────────────
  IF v_participant.id IS NOT NULL THEN
    IF v_participant.status = 'completed' THEN
      RETURN jsonb_build_object(
        'state', 'completed', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
        'reasonCode', 'ALREADY_COMPLETED', 'userMessage', "You've completed this hunt.",
        'participationId', v_participant.id
      );
    END IF;

    IF v_participant.status IN ('active', 'paused') THEN
      RETURN jsonb_build_object(
        'state', 'active', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
        'reasonCode', 'ALREADY_JOINED', 'userMessage', 'Continue your active hunt.',
        'participationId', v_participant.id,
        'occurrenceId', v_participant.occurrence_id
      );
    END IF;

    IF v_participant.status IN ('accepted', 'ready') THEN
      RETURN jsonb_build_object(
        'state', 'ready', 'canView', TRUE, 'canJoin', FALSE, 'canStart', TRUE,
        'reasonCode', 'ALREADY_JOINED', 'userMessage', 'You''re ready. Start the hunt when you arrive.',
        'participationId', v_participant.id,
        'occurrenceId', v_participant.occurrence_id
      );
    END IF;

    IF v_participant.status IN ('removed', 'left', 'expired') THEN
      -- May rejoin depending on Hunt config (default: no rejoin)
      RETURN jsonb_build_object(
        'state', 'ineligible', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
        'reasonCode', 'NOT_AUTHORIZED',
        'userMessage', 'You are no longer a participant in this hunt.'
      );
    END IF;
  END IF;

  -- ── Paused ─────────────────────────────────────────────────────────────────
  IF v_hunt.status = 'paused' THEN
    RETURN jsonb_build_object(
      'state', 'paused', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
      'reasonCode', 'HUNT_PAUSED', 'userMessage', 'This hunt is temporarily paused.'
    );
  END IF;

  -- ── Upcoming (hunt_status = scheduled and starts_at in future) ─────────────
  IF v_hunt.status = 'scheduled' AND v_occurrence.starts_at IS NOT NULL
     AND v_occurrence.starts_at > NOW() THEN
    -- Invited users can join even before start
    IF v_invitation.status = 'pending' THEN
      v_state := 'invited';
    ELSE
      v_state := 'upcoming';
    END IF;
    RETURN jsonb_build_object(
      'state', v_state, 'canView', TRUE, 'canJoin', (v_invitation.status = 'pending'),
      'canStart', FALSE,
      'reasonCode', 'HUNT_UPCOMING',
      'userMessage', 'This hunt starts soon.',
      'availableFrom', v_occurrence.starts_at,
      'invitationId', v_invitation.id
    );
  END IF;

  -- ── Invitation required ───────────────────────────────────────────────────
  IF v_hunt.privacy = 'invite_only' OR v_hunt.join_policy = 'invite_only' THEN
    IF v_invitation.status IS NULL OR v_invitation.status != 'pending' THEN
      RETURN jsonb_build_object(
        'state', 'invitation_required', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
        'reasonCode', 'INVITATION_REQUIRED',
        'userMessage', 'An invitation is required to join this hunt.'
      );
    END IF;
    -- Has valid invitation
    RETURN jsonb_build_object(
      'state', 'invited', 'canView', TRUE, 'canJoin', TRUE, 'canStart', FALSE,
      'reasonCode', 'ELIGIBLE',
      'invitationId', v_invitation.id
    );
  END IF;

  -- ── Capacity check ─────────────────────────────────────────────────────────
  IF v_occurrence.id IS NOT NULL AND v_occurrence.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_capacity_count
    FROM hunt_participants
    WHERE hunt_id = p_hunt_id
      AND occurrence_id = v_occurrence.id
      AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');

    IF v_capacity_count >= v_occurrence.max_participants THEN
      RETURN jsonb_build_object(
        'state', 'full', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
        'reasonCode', 'HUNT_FULL',
        'userMessage', 'This hunt is full.'
      );
    END IF;
  ELSIF v_hunt.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_capacity_count
    FROM hunt_participants
    WHERE hunt_id = p_hunt_id
      AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');

    IF v_capacity_count >= v_hunt.max_participants THEN
      RETURN jsonb_build_object(
        'state', 'full', 'canView', TRUE, 'canJoin', FALSE, 'canStart', FALSE,
        'reasonCode', 'HUNT_FULL',
        'userMessage', 'This hunt is full.'
      );
    END IF;
  END IF;

  -- ── Pending invitation ────────────────────────────────────────────────────
  IF v_invitation.id IS NOT NULL AND v_invitation.status = 'pending' THEN
    RETURN jsonb_build_object(
      'state', 'invited', 'canView', TRUE, 'canJoin', TRUE, 'canStart', FALSE,
      'reasonCode', 'ELIGIBLE', 'invitationId', v_invitation.id
    );
  END IF;

  -- ── Available to join ─────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'state', 'available', 'canView', TRUE, 'canJoin', TRUE, 'canStart', FALSE,
    'reasonCode', 'ELIGIBLE', 'userMessage', '',
    'occurrenceId', v_occurrence.id,
    'availableFrom', COALESCE(v_occurrence.starts_at, v_hunt.starts_at),
    'availableUntil', COALESCE(v_occurrence.ends_at, v_hunt.ends_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_hunt_availability FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hunt_availability TO authenticated, anon;

-- ──────────────────────────────────────────────────────────────
-- RPC: join_hunt
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION join_hunt(
  p_hunt_id       UUID,
  p_occurrence_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_hunt             RECORD;
  v_occurrence       RECORD;
  v_participant      RECORD;
  v_capacity_count   INTEGER;
  v_participant_id   UUID;
  v_reward_snapshot  JSONB;
  v_stop_ids         UUID[];
  v_stop_id          UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED',
      'userMessage', 'Sign in to join hunts.');
  END IF;

  -- Verify active account
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND account_status = 'active') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'ACCOUNT_RESTRICTED',
      'userMessage', 'Your account is not in a valid state to join hunts.');
  END IF;

  -- Load Hunt
  SELECT * INTO v_hunt FROM hunts WHERE id = p_hunt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_NOT_PUBLISHED',
      'userMessage', 'Hunt not found.');
  END IF;

  -- Must be active status
  IF v_hunt.status NOT IN ('active', 'ready', 'scheduled') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_NOT_PUBLISHED',
      'userMessage', 'This hunt is not currently available to join.');
  END IF;

  -- Privacy check
  IF v_hunt.privacy IN ('invite_only', 'private') THEN
    IF NOT can_access_hunt(p_hunt_id, v_user_id) THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'INVITATION_REQUIRED',
        'userMessage', 'An invitation is required to join this hunt.');
    END IF;
  END IF;

  -- Idempotency: check existing participation
  SELECT * INTO v_participant FROM hunt_participants
    WHERE hunt_id = p_hunt_id AND user_id = v_user_id
    ORDER BY created_at DESC LIMIT 1;

  IF v_participant.id IS NOT NULL THEN
    IF v_participant.status IN ('accepted', 'ready', 'active', 'paused', 'completed') THEN
      RETURN jsonb_build_object('success', TRUE, 'participationId', v_participant.id,
        'participationStatus', v_participant.status, 'reasonCode', 'ALREADY_JOINED',
        'userMessage', 'You have already joined this hunt.');
    END IF;
    IF v_participant.status IN ('removed', 'left', 'expired') THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
        'userMessage', 'You are no longer eligible to join this hunt.');
    END IF;
  END IF;

  -- Occurrence
  IF p_occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occurrence FROM hunt_occurrences
      WHERE id = p_occurrence_id AND hunt_id = p_hunt_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'OCCURRENCE_NOT_AVAILABLE',
        'userMessage', 'The selected hunt occurrence is not available.');
    END IF;
  ELSE
    SELECT * INTO v_occurrence FROM hunt_occurrences
      WHERE hunt_id = p_hunt_id AND status IN ('scheduled', 'active')
      ORDER BY starts_at ASC NULLS LAST LIMIT 1;
  END IF;

  -- Capacity check (transactional)
  PERFORM pg_advisory_xact_lock(hashtext('join_hunt:' || p_hunt_id::TEXT));

  IF v_occurrence.id IS NOT NULL AND v_occurrence.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_capacity_count
    FROM hunt_participants
    WHERE hunt_id = p_hunt_id AND occurrence_id = v_occurrence.id
      AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');
    IF v_capacity_count >= v_occurrence.max_participants THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_FULL',
        'userMessage', 'This hunt is now full.');
    END IF;
  ELSIF v_hunt.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_capacity_count
    FROM hunt_participants
    WHERE hunt_id = p_hunt_id
      AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');
    IF v_capacity_count >= v_hunt.max_participants THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_FULL',
        'userMessage', 'This hunt is now full.');
    END IF;
  END IF;

  -- Build reward snapshot
  v_reward_snapshot := jsonb_build_object(
    'huntVersion',         v_hunt.version,
    'occurrenceId',        v_occurrence.id,
    'pointsReward',        COALESCE(v_occurrence.reward_override_points, v_hunt.points_reward),
    'requiredStopCount',   (SELECT COUNT(*) FROM hunt_stops WHERE hunt_id = p_hunt_id AND is_required = TRUE),
    'proofConfigVersion',  1,
    'completionDeadline',  COALESCE(v_occurrence.complete_until, v_occurrence.ends_at, v_hunt.ends_at),
    'participationMode',   v_hunt.participation_mode::TEXT,
    'groupRewardRule',     'individual_full_reward',
    'snapshotAt',          NOW()
  );

  -- Create participation
  INSERT INTO hunt_participants (
    hunt_id, user_id, role, status, occurrence_id, joined_at, reward_snapshot
  ) VALUES (
    p_hunt_id, v_user_id, 'player', 'accepted', v_occurrence.id, NOW(), v_reward_snapshot
  ) RETURNING id INTO v_participant_id;

  -- Update occurrence participant count
  IF v_occurrence.id IS NOT NULL THEN
    UPDATE hunt_occurrences SET participant_count = participant_count + 1
      WHERE id = v_occurrence.id;
  END IF;

  -- Initialize stop progress for ordered hunts (first stop only)
  -- For unordered hunts: initialize all required stops
  SELECT ARRAY_AGG(id ORDER BY sort_order ASC)
    INTO v_stop_ids
    FROM hunt_stops
    WHERE hunt_id = p_hunt_id AND is_required = TRUE;

  IF v_stop_ids IS NOT NULL THEN
    IF v_hunt.stop_ordering = 'unordered' THEN
      -- All stops available immediately
      FOREACH v_stop_id IN ARRAY v_stop_ids LOOP
        INSERT INTO hunt_stop_progress (hunt_participant_id, hunt_stop_id, status)
          VALUES (v_participant_id, v_stop_id, 'not_started')
          ON CONFLICT (hunt_participant_id, hunt_stop_id) DO NOTHING;
      END LOOP;
    ELSE
      -- Ordered: only first stop initialized; rest initialized at start
      INSERT INTO hunt_stop_progress (hunt_participant_id, hunt_stop_id, status)
        VALUES (v_participant_id, v_stop_ids[1], 'not_started')
        ON CONFLICT (hunt_participant_id, hunt_stop_id) DO NOTHING;
    END IF;
  END IF;

  -- Emit domain event
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id,
    occurrence_id, payload)
  VALUES ('hunt_joined', p_hunt_id, v_user_id, v_participant_id, v_occurrence.id,
    jsonb_build_object('role', 'player', 'startModel', v_hunt.start_model));

  RETURN jsonb_build_object(
    'success', TRUE,
    'participationId', v_participant_id,
    'participationStatus', 'accepted',
    'reasonCode', NULL,
    'userMessage', "You've joined the hunt!"
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
    'userMessage', 'Unable to join hunt. Please try again.');
END;
$$;

REVOKE ALL ON FUNCTION join_hunt FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_hunt TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: start_hunt
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION start_hunt(
  p_participation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_participant  RECORD;
  v_hunt         RECORD;
  v_occurrence   RECORD;
  v_stop_ids     UUID[];
  v_stop_id      UUID;
  v_first_stop   UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED',
      'userMessage', 'Authentication required.');
  END IF;

  -- Verify participation ownership
  SELECT * INTO v_participant FROM hunt_participants
    WHERE id = p_participation_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Participation not found.');
  END IF;

  -- Idempotency
  IF v_participant.status = 'active' THEN
    RETURN jsonb_build_object('success', TRUE, 'participationId', p_participation_id,
      'participationStatus', 'active', 'reasonCode', NULL, 'userMessage', 'Hunt already started.');
  END IF;

  -- Valid start states
  IF v_participant.status NOT IN ('accepted', 'ready', 'invited') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Hunt cannot be started in its current state.');
  END IF;

  -- Load Hunt
  SELECT * INTO v_hunt FROM hunts WHERE id = v_participant.hunt_id;
  IF v_hunt.status NOT IN ('active', 'ready', 'scheduled') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_NOT_PUBLISHED',
      'userMessage', 'This hunt is not currently available.');
  END IF;

  -- Host-controlled: only co_host may start
  IF v_hunt.start_model = 'host_controlled' AND v_participant.role NOT IN ('creator', 'co_host') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Only the host may start this hunt.');
  END IF;

  -- Occurrence check
  IF v_participant.occurrence_id IS NOT NULL THEN
    SELECT * INTO v_occurrence FROM hunt_occurrences WHERE id = v_participant.occurrence_id;
    IF v_occurrence.start_until IS NOT NULL AND v_occurrence.start_until < NOW() THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'START_WINDOW_CLOSED',
        'userMessage', 'The start window for this hunt has closed.');
    END IF;
  END IF;

  -- Initialize stop progress (ordered: make first stop available)
  SELECT ARRAY_AGG(id ORDER BY sort_order ASC)
    INTO v_stop_ids
    FROM hunt_stops
    WHERE hunt_id = v_participant.hunt_id AND is_required = TRUE;

  -- For ordered hunts, mark first stop as available; initialize rest as locked
  IF v_stop_ids IS NOT NULL AND array_length(v_stop_ids, 1) > 0 THEN
    v_first_stop := v_stop_ids[1];

    -- First stop: available
    INSERT INTO hunt_stop_progress (hunt_participant_id, hunt_stop_id, status, unlocked_at)
      VALUES (p_participation_id, v_first_stop, 'available', NOW())
      ON CONFLICT (hunt_participant_id, hunt_stop_id)
        DO UPDATE SET status = 'available', unlocked_at = NOW();

    IF v_hunt.stop_ordering = 'ordered' THEN
      -- Remaining stops: locked
      FOR i IN 2..array_length(v_stop_ids, 1) LOOP
        INSERT INTO hunt_stop_progress (hunt_participant_id, hunt_stop_id, status)
          VALUES (p_participation_id, v_stop_ids[i], 'not_started')
          ON CONFLICT (hunt_participant_id, hunt_stop_id) DO NOTHING;
      END LOOP;
    ELSE
      -- Unordered: all available immediately
      FOREACH v_stop_id IN ARRAY v_stop_ids LOOP
        INSERT INTO hunt_stop_progress (hunt_participant_id, hunt_stop_id, status, unlocked_at)
          VALUES (p_participation_id, v_stop_id, 'available', NOW())
          ON CONFLICT (hunt_participant_id, hunt_stop_id)
            DO UPDATE SET status = 'available', unlocked_at = COALESCE(hunt_stop_progress.unlocked_at, NOW());
      END LOOP;
    END IF;
  END IF;

  -- Mark active
  UPDATE hunt_participants
    SET status = 'active', started_at = NOW(), ready_at = COALESCE(ready_at, NOW())
    WHERE id = p_participation_id;

  -- Emit domain event
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, payload)
  VALUES ('hunt_started', v_participant.hunt_id, v_user_id, p_participation_id, '{}');

  RETURN jsonb_build_object(
    'success', TRUE,
    'participationId', p_participation_id,
    'participationStatus', 'active',
    'reasonCode', NULL,
    'userMessage', 'Hunt started!'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
    'userMessage', 'Unable to start hunt. Please try again.');
END;
$$;

REVOKE ALL ON FUNCTION start_hunt FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_hunt TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: invite_to_hunt
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION invite_to_hunt(
  p_hunt_id        UUID,
  p_invitee_id     UUID,
  p_occurrence_id  UUID    DEFAULT NULL,
  p_message        TEXT    DEFAULT NULL,
  p_expires_days   INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_participant  RECORD;
  v_hunt         RECORD;
  v_invitation   RECORD;
  v_invite_id    UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED',
      'userMessage', 'Authentication required.');
  END IF;

  -- No self-invitation
  IF v_user_id = p_invitee_id THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'You cannot invite yourself.');
  END IF;

  -- Verify inviter authority (must be creator, co_host, or the hunt owner)
  SELECT * INTO v_hunt FROM hunts WHERE id = p_hunt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_NOT_PUBLISHED',
      'userMessage', 'Hunt not found.');
  END IF;

  -- Check inviter role
  SELECT * INTO v_participant FROM hunt_participants
    WHERE hunt_id = p_hunt_id AND user_id = v_user_id AND role IN ('creator', 'co_host');
  -- Also allow hunt creator_user_id
  IF NOT FOUND AND v_hunt.creator_user_id != v_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'You are not authorized to invite participants to this hunt.');
  END IF;

  -- Check invitee exists and is active
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_invitee_id AND account_status = 'active') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'The invited user is not available.');
  END IF;

  -- Block relationship check (both directions)
  IF EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = v_user_id AND blocked_id = p_invitee_id)
       OR (blocker_id = p_invitee_id AND blocked_id = v_user_id)
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'BLOCK_RELATIONSHIP',
      'userMessage', 'You cannot invite this user.');
  END IF;

  -- Check invitee not already a participant
  IF EXISTS (
    SELECT 1 FROM hunt_participants
    WHERE hunt_id = p_hunt_id AND user_id = p_invitee_id
      AND status IN ('accepted', 'ready', 'active', 'completed')
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'ALREADY_JOINED',
      'userMessage', 'This user has already joined the hunt.');
  END IF;

  -- Check duplicate pending invitation
  SELECT * INTO v_invitation FROM hunt_invitations
    WHERE hunt_id = p_hunt_id AND invitee_user_id = p_invitee_id AND status = 'pending';
  IF FOUND THEN
    RETURN jsonb_build_object('success', TRUE, 'invitationId', v_invitation.id,
      'reasonCode', NULL, 'userMessage', 'Invitation already pending.');
  END IF;

  -- Capacity check
  IF v_hunt.max_participants IS NOT NULL THEN
    DECLARE v_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_count FROM hunt_participants
        WHERE hunt_id = p_hunt_id
          AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');
      IF v_count >= v_hunt.max_participants THEN
        RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_FULL',
          'userMessage', 'This hunt is full.');
      END IF;
    END;
  END IF;

  -- Create invitation
  INSERT INTO hunt_invitations (
    hunt_id, inviter_user_id, invitee_user_id, status, message,
    expires_at
  ) VALUES (
    p_hunt_id, v_user_id, p_invitee_id, 'pending', p_message,
    NOW() + (COALESCE(p_expires_days, 7) || ' days')::INTERVAL
  ) RETURNING id INTO v_invite_id;

  -- Emit domain event
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, invitation_id, payload)
  VALUES ('hunt_invitation_created', p_hunt_id, v_user_id, v_invite_id,
    jsonb_build_object('inviteeId', p_invitee_id));

  RETURN jsonb_build_object(
    'success', TRUE, 'invitationId', v_invite_id,
    'reasonCode', NULL, 'userMessage', 'Invitation sent.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
    'userMessage', 'Unable to send invitation. Please try again.');
END;
$$;

REVOKE ALL ON FUNCTION invite_to_hunt FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invite_to_hunt TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: accept_hunt_invitation
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_hunt_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_invitation     RECORD;
  v_hunt           RECORD;
  v_participant_id UUID;
  v_capacity_count INTEGER;
  v_reward_snapshot JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED',
      'userMessage', 'Authentication required.');
  END IF;

  -- Verify invitation ownership
  SELECT * INTO v_invitation FROM hunt_invitations
    WHERE id = p_invitation_id AND invitee_user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Invitation not found or not yours.');
  END IF;

  -- Verify pending
  IF v_invitation.status != 'pending' THEN
    IF v_invitation.status = 'accepted' THEN
      -- Idempotent: return existing participation
      DECLARE v_p RECORD;
      BEGIN
        SELECT * INTO v_p FROM hunt_participants
          WHERE hunt_id = v_invitation.hunt_id AND user_id = v_user_id
          ORDER BY created_at DESC LIMIT 1;
        RETURN jsonb_build_object('success', TRUE, 'participationId', v_p.id,
          'reasonCode', 'ALREADY_JOINED', 'userMessage', 'Invitation already accepted.');
      END;
    END IF;
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'INVITATION_EXPIRED',
      'userMessage', 'This invitation is no longer valid.');
  END IF;

  -- Check expiration
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    UPDATE hunt_invitations SET status = 'expired' WHERE id = p_invitation_id;
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'INVITATION_EXPIRED',
      'userMessage', 'This invitation has expired.');
  END IF;

  -- Load Hunt
  SELECT * INTO v_hunt FROM hunts WHERE id = v_invitation.hunt_id;
  IF v_hunt.status NOT IN ('active', 'ready', 'scheduled') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_NOT_PUBLISHED',
      'userMessage', 'This hunt is no longer available.');
  END IF;

  -- Capacity recheck (transactional)
  PERFORM pg_advisory_xact_lock(hashtext('join_hunt:' || v_invitation.hunt_id::TEXT));

  IF v_hunt.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_capacity_count FROM hunt_participants
      WHERE hunt_id = v_invitation.hunt_id
        AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');
    IF v_capacity_count >= v_hunt.max_participants THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_FULL',
        'userMessage', 'This hunt is now full.');
    END IF;
  END IF;

  -- Build reward snapshot
  v_reward_snapshot := jsonb_build_object(
    'huntVersion', v_hunt.version,
    'occurrenceId', NULL,
    'pointsReward', v_hunt.points_reward,
    'requiredStopCount', (SELECT COUNT(*) FROM hunt_stops WHERE hunt_id = v_hunt.id AND is_required),
    'proofConfigVersion', 1,
    'participationMode', v_hunt.participation_mode::TEXT,
    'groupRewardRule', 'individual_full_reward',
    'snapshotAt', NOW()
  );

  -- Create or reuse participation (idempotent)
  INSERT INTO hunt_participants (hunt_id, user_id, role, status, joined_at, reward_snapshot)
    VALUES (v_invitation.hunt_id, v_user_id, 'player', 'accepted', NOW(), v_reward_snapshot)
    ON CONFLICT (hunt_id, user_id) DO UPDATE
      SET status = CASE WHEN hunt_participants.status IN ('declined', 'expired')
                        THEN 'accepted' ELSE hunt_participants.status END,
          joined_at = COALESCE(hunt_participants.joined_at, NOW())
    RETURNING id INTO v_participant_id;

  -- Mark invitation accepted (atomic with participation creation)
  UPDATE hunt_invitations
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_invitation_id;

  -- Emit event
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, invitation_id, payload)
  VALUES ('invitation_accepted', v_invitation.hunt_id, v_user_id, v_participant_id, p_invitation_id, '{}');

  RETURN jsonb_build_object(
    'success', TRUE, 'participationId', v_participant_id,
    'reasonCode', NULL, 'userMessage', "You've joined the hunt!"
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
    'userMessage', 'Unable to accept invitation. Please try again.');
END;
$$;

REVOKE ALL ON FUNCTION accept_hunt_invitation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_hunt_invitation TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: decline_hunt_invitation
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION decline_hunt_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_invitation RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_invitation FROM hunt_invitations
    WHERE id = p_invitation_id AND invitee_user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED');
  END IF;

  -- Accepted invitations cannot be silently changed to declined after participation
  IF v_invitation.status = 'accepted' THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'You have already accepted this invitation. Withdraw from the hunt separately.');
  END IF;

  -- Idempotent
  IF v_invitation.status = 'declined' THEN
    RETURN jsonb_build_object('success', TRUE, 'reasonCode', NULL, 'userMessage', 'Invitation already declined.');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'INVITATION_EXPIRED',
      'userMessage', 'This invitation is no longer valid.');
  END IF;

  UPDATE hunt_invitations SET status = 'declined', responded_at = NOW()
    WHERE id = p_invitation_id;

  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, invitation_id, payload)
  VALUES ('invitation_declined', v_invitation.hunt_id, v_user_id, p_invitation_id, '{}');

  RETURN jsonb_build_object('success', TRUE, 'reasonCode', NULL,
    'userMessage', 'Invitation declined.');
END;
$$;

REVOKE ALL ON FUNCTION decline_hunt_invitation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decline_hunt_invitation TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: withdraw_from_hunt
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION withdraw_from_hunt(
  p_participation_id UUID,
  p_reason           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_participant RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_participant FROM hunt_participants
    WHERE id = p_participation_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Participation not found.');
  END IF;

  -- Cannot withdraw from completed
  IF v_participant.status = 'completed' THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Completed hunts cannot be withdrawn from.');
  END IF;

  -- Idempotent
  IF v_participant.status = 'left' THEN
    RETURN jsonb_build_object('success', TRUE, 'participationId', p_participation_id,
      'reasonCode', NULL, 'userMessage', 'Already withdrawn.');
  END IF;

  IF v_participant.status IN ('removed', 'declined', 'expired') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Cannot withdraw in this state.');
  END IF;

  UPDATE hunt_participants
    SET status = 'left', left_at = NOW(), withdrawn_at = NOW(), withdrawal_reason = p_reason
    WHERE id = p_participation_id;

  -- Capacity may reopen — occurrence count decremented
  UPDATE hunt_occurrences
    SET participant_count = GREATEST(0, participant_count - 1)
    WHERE id = v_participant.occurrence_id;

  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, payload)
  VALUES ('participant_withdrew', v_participant.hunt_id, v_user_id, p_participation_id,
    jsonb_build_object('reason', COALESCE(p_reason, '')));

  RETURN jsonb_build_object('success', TRUE, 'participationId', p_participation_id,
    'reasonCode', NULL, 'userMessage', "You've withdrawn from the hunt.");
END;
$$;

REVOKE ALL ON FUNCTION withdraw_from_hunt FROM PUBLIC;
GRANT EXECUTE ON FUNCTION withdraw_from_hunt TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: remove_hunt_participant (authorized hosts/creators only)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION remove_hunt_participant(
  p_participant_id UUID,
  p_reason         TEXT DEFAULT NULL,
  p_internal_note  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_actor      RECORD;
  v_target     RECORD;
  v_hunt       RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_target FROM hunt_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Participant not found.');
  END IF;

  SELECT * INTO v_hunt FROM hunts WHERE id = v_target.hunt_id;

  -- Verify actor authority (must be creator, co_host, or admin)
  SELECT * INTO v_actor FROM hunt_participants
    WHERE hunt_id = v_target.hunt_id AND user_id = v_user_id AND role IN ('creator', 'co_host');
  IF NOT FOUND AND v_hunt.creator_user_id != v_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', "You're not authorized to remove participants.");
  END IF;

  -- Cannot remove the Hunt owner through an ordinary operation
  IF v_target.role = 'creator' THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'The hunt creator cannot be removed through this operation.');
  END IF;

  -- Idempotent
  IF v_target.status = 'removed' THEN
    RETURN jsonb_build_object('success', TRUE, 'reasonCode', NULL, 'userMessage', 'Already removed.');
  END IF;

  UPDATE hunt_participants
    SET status = 'removed', removed_at = NOW(),
        removed_by_user_id = v_user_id,
        removal_reason = p_reason,
        removal_note_internal = p_internal_note
    WHERE id = p_participant_id;

  UPDATE hunt_occurrences
    SET participant_count = GREATEST(0, participant_count - 1)
    WHERE id = v_target.occurrence_id;

  -- Emit event (safe — no internal note in payload)
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, payload)
  VALUES ('participant_removed', v_target.hunt_id, v_user_id, p_participant_id,
    jsonb_build_object('removedUserId', v_target.user_id));

  RETURN jsonb_build_object('success', TRUE, 'reasonCode', NULL,
    'userMessage', 'Participant removed.');
END;
$$;

REVOKE ALL ON FUNCTION remove_hunt_participant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_hunt_participant TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: complete_hunt_stop
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_hunt_stop(
  p_participation_id UUID,
  p_stop_id          UUID,
  p_validation_method TEXT DEFAULT 'manual_confirmation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_participant   RECORD;
  v_progress      RECORD;
  v_stop          RECORD;
  v_hunt          RECORD;
  v_next_stop_id  UUID;
  v_all_done      BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED');
  END IF;

  -- Verify participation ownership
  SELECT * INTO v_participant FROM hunt_participants
    WHERE id = p_participation_id AND user_id = v_user_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Active participation not found.');
  END IF;

  -- Load stop
  SELECT * INTO v_stop FROM hunt_stops
    WHERE id = p_stop_id AND hunt_id = v_participant.hunt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Stop not found.');
  END IF;

  -- Load stop progress
  SELECT * INTO v_progress FROM hunt_stop_progress
    WHERE hunt_participant_id = p_participation_id AND hunt_stop_id = p_stop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Stop is not available.');
  END IF;

  -- Check stop is accessible (not locked)
  IF v_progress.status IN ('not_started', 'locked') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'This stop is not yet available.');
  END IF;

  -- Idempotent: already completed
  IF v_progress.status = 'completed' THEN
    RETURN jsonb_build_object('success', TRUE, 'stopId', p_stop_id,
      'newStatus', 'completed', 'huntCompletionReady', FALSE,
      'reasonCode', NULL, 'userMessage', 'Stop already completed.');
  END IF;

  -- Verify proof is not still under review
  IF v_progress.status IN ('awaiting_proof', 'under_review', 'needs_resubmission') THEN
    IF v_stop.proof_required THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
        'userMessage', 'Proof review is still pending for this stop.');
    END IF;
  END IF;

  -- Mark stop complete
  UPDATE hunt_stop_progress
    SET status = 'completed', completed_at = NOW(), validation_method = p_validation_method,
        attempt_count = attempt_count + 1
    WHERE hunt_participant_id = p_participation_id AND hunt_stop_id = p_stop_id;

  -- Load Hunt for ordering mode
  SELECT * INTO v_hunt FROM hunts WHERE id = v_participant.hunt_id;

  -- Unlock next stop (ordered hunts only)
  IF v_hunt.stop_ordering = 'ordered' THEN
    SELECT id INTO v_next_stop_id
      FROM hunt_stops
      WHERE hunt_id = v_participant.hunt_id
        AND sort_order > v_stop.sort_order
        AND is_required = TRUE
      ORDER BY sort_order ASC LIMIT 1;

    IF v_next_stop_id IS NOT NULL THEN
      INSERT INTO hunt_stop_progress (hunt_participant_id, hunt_stop_id, status, unlocked_at)
        VALUES (p_participation_id, v_next_stop_id, 'available', NOW())
        ON CONFLICT (hunt_participant_id, hunt_stop_id)
          DO UPDATE SET status = 'available', unlocked_at = NOW();

      INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, stop_id, payload)
      VALUES ('stop_unlocked', v_participant.hunt_id, v_user_id, p_participation_id, v_next_stop_id, '{}');
    END IF;
  END IF;

  -- Emit stop completed event
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, stop_id, payload)
  VALUES ('stop_completed', v_participant.hunt_id, v_user_id, p_participation_id, p_stop_id,
    jsonb_build_object('validationMethod', p_validation_method));

  -- Check if all required stops are done
  SELECT NOT EXISTS (
    SELECT 1 FROM hunt_stops hs
    JOIN hunt_stop_progress hsp ON hsp.hunt_stop_id = hs.id
      AND hsp.hunt_participant_id = p_participation_id
    WHERE hs.hunt_id = v_participant.hunt_id
      AND hs.is_required = TRUE
      AND hsp.status != 'completed'
  ) INTO v_all_done;

  RETURN jsonb_build_object(
    'success', TRUE,
    'stopId', p_stop_id,
    'newStatus', 'completed',
    'nextStopId', v_next_stop_id,
    'huntCompletionReady', v_all_done,
    'reasonCode', NULL,
    'userMessage', CASE WHEN v_all_done THEN 'All stops complete! You can now finish the hunt.' ELSE 'Stop completed!' END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
    'userMessage', 'Unable to complete stop. Please try again.');
END;
$$;

REVOKE ALL ON FUNCTION complete_hunt_stop FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_hunt_stop TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: complete_hunt
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_hunt(p_participation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id           UUID;
  v_participant       RECORD;
  v_hunt              RECORD;
  v_reward_points     INTEGER;
  v_idempotency_key   TEXT;
  v_profile           RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED');
  END IF;

  -- Verify participation
  SELECT * INTO v_participant FROM hunt_participants
    WHERE id = p_participation_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Participation not found.');
  END IF;

  -- Idempotent
  IF v_participant.status = 'completed' THEN
    RETURN jsonb_build_object('success', TRUE, 'participationId', p_participation_id,
      'awardedPoints', v_participant.awarded_points,
      'completedAt', v_participant.completed_at,
      'reasonCode', 'already_completed', 'userMessage', "You've already completed this hunt.");
  END IF;

  -- Must be active
  IF v_participant.status != 'active' THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'invalid_state',
      'userMessage', 'Hunt cannot be completed in its current state.');
  END IF;

  -- Verify all required stops completed
  IF EXISTS (
    SELECT 1 FROM hunt_stops hs
    JOIN hunt_stop_progress hsp ON hsp.hunt_stop_id = hs.id
      AND hsp.hunt_participant_id = p_participation_id
    WHERE hs.hunt_id = v_participant.hunt_id
      AND hs.is_required = TRUE
      AND hsp.status != 'completed'
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'missing_required_stop',
      'userMessage', 'Not all required stops have been completed.');
  END IF;

  -- Check completion deadline
  IF (v_participant.reward_snapshot->>'completionDeadline') IS NOT NULL THEN
    IF (v_participant.reward_snapshot->>'completionDeadline')::TIMESTAMPTZ < NOW() THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'expired',
        'userMessage', 'The completion deadline has passed.');
    END IF;
  END IF;

  -- Idempotency key for points ledger
  v_idempotency_key := 'hunt_completion:' || p_participation_id::TEXT;

  -- Reward from snapshot (never trust client)
  v_reward_points := COALESCE(
    (v_participant.reward_snapshot->>'pointsReward')::INTEGER,
    (SELECT points_reward FROM hunts WHERE id = v_participant.hunt_id)
  );

  -- Reward already issued check
  IF EXISTS (SELECT 1 FROM points_ledger WHERE idempotency_key = v_idempotency_key) THEN
    RETURN jsonb_build_object('success', TRUE, 'participationId', p_participation_id,
      'awardedPoints', v_participant.awarded_points,
      'reasonCode', 'already_completed', 'userMessage', 'Reward already issued.');
  END IF;

  -- Atomic completion + points insertion
  UPDATE hunt_participants
    SET status = 'completed', completed_at = NOW(), awarded_points = v_reward_points,
        completion_idempotency_key = v_idempotency_key
    WHERE id = p_participation_id;

  -- Insert points ledger entry (append-only, idempotent key)
  INSERT INTO points_ledger (
    user_id, amount, transaction_type, reference_id, idempotency_key, description
  ) VALUES (
    v_user_id, v_reward_points, 'hunt_reward', p_participation_id::TEXT,
    v_idempotency_key,
    'Hunt completed: ' || (SELECT title FROM hunts WHERE id = v_participant.hunt_id)
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  -- Update profile total points
  UPDATE profiles SET total_points = total_points + v_reward_points WHERE id = v_user_id;

  -- Emit event
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, participation_id, payload)
  VALUES ('hunt_completed', v_participant.hunt_id, v_user_id, p_participation_id,
    jsonb_build_object('awardedPoints', v_reward_points));

  RETURN jsonb_build_object(
    'success', TRUE,
    'participationId', p_participation_id,
    'awardedPoints', v_reward_points,
    'completedAt', NOW(),
    'reasonCode', NULL,
    'userMessage', 'Hunt complete! Points awarded.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'invalid_state',
    'userMessage', 'Unable to complete hunt. Please try again.');
END;
$$;

REVOKE ALL ON FUNCTION complete_hunt FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_hunt TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: cancel_hunt_occurrence
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_hunt_occurrence(
  p_occurrence_id    UUID,
  p_reason           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_occurrence RECORD;
  v_hunt       RECORD;
  v_actor      RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_occurrence FROM hunt_occurrences WHERE id = p_occurrence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'Occurrence not found.');
  END IF;

  SELECT * INTO v_hunt FROM hunts WHERE id = v_occurrence.hunt_id;

  -- Verify authority
  SELECT * INTO v_actor FROM hunt_participants
    WHERE hunt_id = v_occurrence.hunt_id AND user_id = v_user_id AND role IN ('creator', 'co_host');
  IF NOT FOUND AND v_hunt.creator_user_id != v_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', "You're not authorized to cancel this occurrence.");
  END IF;

  -- Already cancelled
  IF v_occurrence.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', TRUE, 'reasonCode', NULL,
      'userMessage', 'Occurrence already cancelled.');
  END IF;

  UPDATE hunt_occurrences
    SET status = 'cancelled', cancelled_at = NOW(),
        cancellation_reason = p_reason, cancelled_by_user_id = v_user_id
    WHERE id = p_occurrence_id;

  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, occurrence_id, payload)
  VALUES ('hunt_cancelled', v_occurrence.hunt_id, v_user_id, p_occurrence_id,
    jsonb_build_object('reason', COALESCE(p_reason, ''), 'occurrenceId', p_occurrence_id));

  RETURN jsonb_build_object('success', TRUE, 'huntId', v_occurrence.hunt_id,
    'occurrenceId', p_occurrence_id, 'cancelledAt', NOW(),
    'reasonCode', NULL, 'userMessage', 'Occurrence cancelled.');
END;
$$;

REVOKE ALL ON FUNCTION cancel_hunt_occurrence FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_hunt_occurrence TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- RPC: get_my_hunts_summary
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_hunts_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  RETURN jsonb_build_object(
    'active', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'participationId', hp.id,
        'huntId', h.id,
        'occurrenceId', hp.occurrence_id,
        'huntTitle', h.title,
        'huntSlug', h.slug,
        'difficulty', h.difficulty,
        'participationStatus', hp.status,
        'participantRole', hp.role,
        'startedAt', hp.started_at,
        'awardedPoints', hp.awarded_points,
        'completedStopCount', (
          SELECT COUNT(*) FROM hunt_stop_progress hsp
          WHERE hsp.hunt_participant_id = hp.id AND hsp.status = 'completed'
        ),
        'requiredStopCount', (
          SELECT COUNT(*) FROM hunt_stops hs
          WHERE hs.hunt_id = h.id AND hs.is_required = TRUE
        )
      ) ORDER BY hp.started_at DESC NULLS LAST), '[]'::JSONB)
      FROM hunt_participants hp
      JOIN hunts h ON h.id = hp.hunt_id
      WHERE hp.user_id = v_user_id AND hp.status IN ('active', 'paused')
    ),
    'ready', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'participationId', hp.id,
        'huntId', h.id,
        'occurrenceId', hp.occurrence_id,
        'huntTitle', h.title,
        'huntSlug', h.slug,
        'difficulty', h.difficulty,
        'participationStatus', hp.status,
        'participantRole', hp.role,
        'joinedAt', hp.joined_at
      ) ORDER BY hp.joined_at DESC NULLS LAST), '[]'::JSONB)
      FROM hunt_participants hp
      JOIN hunts h ON h.id = hp.hunt_id
      WHERE hp.user_id = v_user_id AND hp.status IN ('accepted', 'ready')
    ),
    'completed', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'participationId', hp.id,
        'huntId', h.id,
        'huntTitle', h.title,
        'huntSlug', h.slug,
        'difficulty', h.difficulty,
        'awardedPoints', hp.awarded_points,
        'completedAt', hp.completed_at
      ) ORDER BY hp.completed_at DESC NULLS LAST), '[]'::JSONB)
      FROM hunt_participants hp
      JOIN hunts h ON h.id = hp.hunt_id
      WHERE hp.user_id = v_user_id AND hp.status = 'completed'
      LIMIT 20
    ),
    'invitations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'invitationId', hi.id,
        'huntId', h.id,
        'huntTitle', h.title,
        'huntSlug', h.slug,
        'difficulty', h.difficulty,
        'inviterUserId', hi.inviter_user_id,
        'message', hi.message,
        'expiresAt', hi.expires_at,
        'createdAt', hi.created_at
      ) ORDER BY hi.created_at DESC), '[]'::JSONB)
      FROM hunt_invitations hi
      JOIN hunts h ON h.id = hi.hunt_id
      WHERE hi.invitee_user_id = v_user_id
        AND hi.status = 'pending'
        AND (hi.expires_at IS NULL OR hi.expires_at > NOW())
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION get_my_hunts_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_hunts_summary TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- PostGIS indexes for hunt geofences
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hunt_stop_geofences_validation_point
  ON hunt_stop_geofences USING GIST (validation_point)
  WHERE validation_point IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hunt_stop_geofences_validation_polygon
  ON hunt_stop_geofences USING GIST (validation_polygon)
  WHERE validation_polygon IS NOT NULL;
