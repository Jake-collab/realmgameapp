-- ============================================================
-- Migration 008 — Hunt Participation, Invitations, Stop Progress
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- hunt_participants    : users who have joined or been invited to a hunt
-- hunt_invitations     : invitation records
-- hunt_stop_progress   : per-participant stop completion tracking
-- Also: backfills the FK from proof_submissions → hunt_stop_progress
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- hunt_participants
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id         UUID NOT NULL REFERENCES hunts(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            participant_role NOT NULL DEFAULT 'player',
  status          participant_status NOT NULL DEFAULT 'accepted',
  joined_at       TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  left_at         TIMESTAMPTZ,
  awarded_points  INTEGER CHECK (awarded_points IS NULL OR awarded_points >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (hunt_id, user_id)
);

COMMENT ON TABLE hunt_participants IS
  'A user''s membership record for a hunt. '
  'awarded_points is set only by trusted server logic. '
  'Unauthorized join attempts are blocked by RLS + check_hunt_access function.';

COMMENT ON COLUMN hunt_participants.awarded_points IS
  'Set ONLY by server-side logic (Edge Function or admin RPC). Not writable by clients via RLS.';

CREATE TRIGGER trg_hunt_participants_updated_at
  BEFORE UPDATE ON hunt_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- hunt_invitations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id         UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          invitation_status NOT NULL DEFAULT 'pending',
  message         TEXT,
  expires_at      TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent self-invitation
  CONSTRAINT no_self_invite CHECK (inviter_user_id <> invitee_user_id),

  -- Prevent duplicate pending invitations
  CONSTRAINT unique_pending_invitation UNIQUE (hunt_id, invitee_user_id)
);

COMMENT ON TABLE hunt_invitations IS
  'Hunt invitation records. Only inviter, invitee, hunt creator, and staff may access. '
  'Reporter identity is protected; the reported user cannot see who invited them after a block.';

-- Function to expire overdue invitations (called by a cron job or on read)
CREATE OR REPLACE FUNCTION expire_hunt_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE hunt_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_hunt_invitations IS
  'Marks overdue pending invitations as expired. '
  'Call from a Supabase cron job or Edge Function scheduled task.';

-- ──────────────────────────────────────────────────────────────
-- hunt_stop_progress
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hunt_stop_progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_participant_id   UUID NOT NULL REFERENCES hunt_participants(id) ON DELETE CASCADE,
  hunt_stop_id          UUID NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  status                step_status NOT NULL DEFAULT 'not_started',
  revealed_at           TIMESTAMPTZ,   -- when server revealed this stop to participant
  arrived_at            TIMESTAMPTZ,   -- device-reported; used as supporting evidence only
  completed_at          TIMESTAMPTZ,   -- set by server validation only
  validation_method     TEXT,          -- location_check | qr_scan | photo | manual
  proof_submission_id   UUID REFERENCES proof_submissions(id) ON DELETE SET NULL,
  attempt_count         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (hunt_participant_id, hunt_stop_id)
);

COMMENT ON TABLE hunt_stop_progress IS
  'Per-participant stop completion state. '
  'completed_at MUST be set by server-side validation (Edge Function) — '
  'direct client writes are blocked by RLS. '
  'clients must not mark arbitrary hidden stops complete.';

COMMENT ON COLUMN hunt_stop_progress.arrived_at IS
  'Device-reported arrival time. Supporting evidence only; NOT the authoritative completion signal.';

CREATE TRIGGER trg_hunt_stop_progress_updated_at
  BEFORE UPDATE ON hunt_stop_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Backfill: add FK from proof_submissions to hunt_stop_progress
-- (hunt_stop_progress didn't exist when 006 ran)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE proof_submissions
  ADD CONSTRAINT fk_proof_hunt_stop_progress
  FOREIGN KEY (hunt_stop_progress_id)
  REFERENCES hunt_stop_progress(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- ──────────────────────────────────────────────────────────────
-- Hunt access control function
-- ──────────────────────────────────────────────────────────────
-- Used by RLS policies to determine whether a user may see a hunt.

CREATE OR REPLACE FUNCTION can_access_hunt(p_hunt_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privacy hunt_privacy;
  v_status  hunt_status;
BEGIN
  SELECT privacy, status INTO v_privacy, v_status FROM hunts WHERE id = p_hunt_id;

  IF v_status = 'archived' OR v_status = 'cancelled' THEN
    RETURN FALSE;
  END IF;

  -- Public and unlisted hunts are visible
  IF v_privacy IN ('public', 'unlisted') THEN
    RETURN TRUE;
  END IF;

  -- invite_only and private: must be a participant or invitee
  RETURN EXISTS (
    SELECT 1 FROM hunt_participants
    WHERE hunt_id = p_hunt_id AND user_id = p_user_id
    AND status NOT IN ('declined', 'removed', 'left', 'expired')
  ) OR EXISTS (
    SELECT 1 FROM hunt_invitations
    WHERE hunt_id = p_hunt_id AND invitee_user_id = p_user_id AND status = 'pending'
  );
END;
$$;

COMMENT ON FUNCTION can_access_hunt IS
  'Returns true if the user is authorized to view hunt details. '
  'SECURITY DEFINER — validate inputs and restrict permissions carefully.';
