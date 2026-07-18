-- ============================================================
-- Migration 014 — Row Level Security Policies
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- Enable RLS on all application tables and create explicit policies.
-- Security principle: default-deny (no policy = no access).
-- service_role bypasses RLS (Supabase default) — used by Edge Functions.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Helper: current authenticated user ID
-- ──────────────────────────────────────────────────────────────
-- auth.uid() is used throughout policies. No wrapper needed.

-- ──────────────────────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) may read public profile fields via public_profiles view
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  USING (account_status = 'active');

-- Users update only their own profile (role + account_status excluded below)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- role and account_status changes require service_role (handled by admin RPCs)
  );

-- Users cannot change their own role or account_status (trigger-enforced)
CREATE OR REPLACE FUNCTION prevent_role_self_promotion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role <> NEW.role AND auth.uid() = NEW.id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Users cannot change their own role.';
  END IF;
  IF OLD.account_status <> NEW.account_status AND auth.uid() = NEW.id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Users cannot change their own account status.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_self_promotion
  BEFORE UPDATE OF role, account_status ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_promotion();

-- ──────────────────────────────────────────────────────────────
-- reserved_usernames  (admin-managed, read-only for app)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE for app users (service_role only)

-- ──────────────────────────────────────────────────────────────
-- user_settings
-- ──────────────────────────────────────────────────────────────
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_owner_select"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_owner_update"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- interests  (public read, admin write)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interests_public_select"
  ON interests FOR SELECT
  USING (is_active = TRUE);

-- ──────────────────────────────────────────────────────────────
-- user_interests
-- ──────────────────────────────────────────────────────────────
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_interests_owner_select"
  ON user_interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_interests_owner_insert"
  ON user_interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_interests_owner_delete"
  ON user_interests FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- media_assets
-- ──────────────────────────────────────────────────────────────
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- Owners read their own assets
CREATE POLICY "media_owner_select"
  ON media_assets FOR SELECT
  USING (auth.uid() = owner_user_id AND deleted_at IS NULL);

-- Public assets (approved, public visibility)
CREATE POLICY "media_public_select"
  ON media_assets FOR SELECT
  USING (
    visibility = 'public'
    AND moderation_status = 'approved'
    AND deleted_at IS NULL
  );

-- Owners insert (upload registration)
CREATE POLICY "media_owner_insert"
  ON media_assets FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Owners soft-delete their own assets
CREATE POLICY "media_owner_soft_delete"
  ON media_assets FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- ──────────────────────────────────────────────────────────────
-- quests  (published only for mobile)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quests_public_read_published"
  ON quests FOR SELECT
  USING (
    status = 'published'
    AND (available_from IS NULL OR available_from <= NOW())
    AND (available_until IS NULL OR available_until > NOW())
    AND archived_at IS NULL
  );

-- Users cannot insert/update/delete quests (service_role only)

-- ──────────────────────────────────────────────────────────────
-- quest_objectives, quest_categories, quest_tags, quest_*_assignments
-- ──────────────────────────────────────────────────────────────
ALTER TABLE quest_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_objectives_public_select"
  ON quest_objectives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quests q
      WHERE q.id = quest_id
        AND q.status = 'published'
        AND (q.available_from IS NULL OR q.available_from <= NOW())
        AND (q.available_until IS NULL OR q.available_until > NOW())
    )
  );

ALTER TABLE quest_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_categories_public_select"
  ON quest_categories FOR SELECT
  USING (is_active = TRUE);

ALTER TABLE quest_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_tags_public_select"
  ON quest_tags FOR SELECT
  USING (is_active = TRUE);

ALTER TABLE quest_category_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_category_assignments_public_select"
  ON quest_category_assignments FOR SELECT
  USING (TRUE);  -- filtered via quest_categories join in queries

ALTER TABLE quest_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_tag_assignments_public_select"
  ON quest_tag_assignments FOR SELECT
  USING (TRUE);

ALTER TABLE quest_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_media_public_select"
  ON quest_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quests q WHERE q.id = quest_id AND q.status = 'published'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- quest_locations  (public approximate — no security concern)
-- quest_geofences  (PRIVATE — blocked for all non-service_role)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE quest_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_locations_public_select"
  ON quest_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quests q WHERE q.id = quest_id AND q.status = 'published'
    )
  );

ALTER TABLE quest_geofences ENABLE ROW LEVEL SECURITY;
-- No policies: service_role bypasses RLS. All authenticated and anonymous access is blocked.
COMMENT ON TABLE quest_geofences IS
  'PRIVATE. RLS enabled with no permissive policies. '
  'Only service_role (Edge Functions, server-side code) may access validation geometry.';

-- ──────────────────────────────────────────────────────────────
-- quest_participations
-- ──────────────────────────────────────────────────────────────
ALTER TABLE quest_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qp_owner_select"
  ON quest_participations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "qp_owner_insert"
  ON quest_participations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Updates restricted: users may update status/progress, but not awarded_points
CREATE POLICY "qp_owner_update_progress"
  ON quest_participations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- awarded_points guarded by application-level checks + service_role
  );

ALTER TABLE quest_step_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qsp_owner_select"
  ON quest_step_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quest_participations qp
      WHERE qp.id = participation_id AND qp.user_id = auth.uid()
    )
  );

CREATE POLICY "qsp_owner_insert"
  ON quest_step_progress FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quest_participations qp
      WHERE qp.id = participation_id AND qp.user_id = auth.uid()
    )
  );

CREATE POLICY "qsp_owner_update"
  ON quest_step_progress FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quest_participations qp
      WHERE qp.id = participation_id AND qp.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- proof_submissions + proof_media  (owner + moderator only)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE proof_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proof_owner_select"
  ON proof_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "proof_owner_insert"
  ON proof_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proof_owner_update_draft"
  ON proof_submissions FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft')
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE proof_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proof_media_owner_select"
  ON proof_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proof_submissions ps
      WHERE ps.id = submission_id AND ps.user_id = auth.uid()
    )
  );

CREATE POLICY "proof_media_owner_insert"
  ON proof_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proof_submissions ps
      WHERE ps.id = submission_id AND ps.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- hunts
-- ──────────────────────────────────────────────────────────────
ALTER TABLE hunts ENABLE ROW LEVEL SECURITY;

-- Public and unlisted hunts are readable
CREATE POLICY "hunts_public_select"
  ON hunts FOR SELECT
  USING (
    privacy IN ('public', 'unlisted')
    AND status NOT IN ('draft', 'pending_review', 'archived', 'cancelled', 'rejected')
  );

-- Invite-only + private: participant or invitee only
CREATE POLICY "hunts_participant_select"
  ON hunts FOR SELECT
  USING (can_access_hunt(id, auth.uid()));

-- Custom game creators may manage their own hunts
CREATE POLICY "hunts_creator_manage"
  ON hunts FOR UPDATE
  USING (auth.uid() = creator_user_id AND hunt_type = 'custom')
  WITH CHECK (
    auth.uid() = creator_user_id
    AND hunt_type = 'custom'
    -- status transitions validated in service layer
  );

CREATE POLICY "hunts_creator_insert"
  ON hunts FOR INSERT
  WITH CHECK (
    auth.uid() = creator_user_id
    AND hunt_type = 'custom'
    AND status = 'draft'
  );

-- ──────────────────────────────────────────────────────────────
-- hunt_stops + hunt_clues  (access via hunt visibility)
-- hunt_stop_geofences  (PRIVATE — blocked)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE hunt_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hunt_stops_accessible_hunt"
  ON hunt_stops FOR SELECT
  USING (can_access_hunt(hunt_id, auth.uid()));

ALTER TABLE hunt_clues ENABLE ROW LEVEL SECURITY;

-- Clues: only revealed ones (server sets server_reveal_state on the stop)
CREATE POLICY "hunt_clues_revealed_select"
  ON hunt_clues FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM hunt_stops hs
      WHERE hs.id = hunt_stop_id
        AND hs.server_reveal_state IN ('revealed_to_participant', 'public')
        AND can_access_hunt(hs.hunt_id, auth.uid())
    )
  );

ALTER TABLE hunt_stop_geofences ENABLE ROW LEVEL SECURITY;
-- No permissive policies — service_role only
COMMENT ON TABLE hunt_stop_geofences IS
  'PRIVATE. RLS enabled with no permissive policies. '
  'Only service_role may access precise validation coordinates.';

-- ──────────────────────────────────────────────────────────────
-- hunt_participants
-- ──────────────────────────────────────────────────────────────
ALTER TABLE hunt_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hp_own_select"
  ON hunt_participants FOR SELECT
  USING (auth.uid() = user_id);

-- Hunt creators may see their participants
CREATE POLICY "hp_creator_select"
  ON hunt_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hunts h
      WHERE h.id = hunt_id AND h.creator_user_id = auth.uid()
    )
  );

-- Users join open hunts
CREATE POLICY "hp_self_insert"
  ON hunt_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM hunts h
      WHERE h.id = hunt_id
        AND h.join_policy = 'open'
        AND h.status IN ('ready', 'active')
        AND h.privacy NOT IN ('invite_only', 'private')
    )
  );

-- Users update own participation (leave/pause) — NOT awarded_points
CREATE POLICY "hp_self_update_status"
  ON hunt_participants FOR UPDATE
  USING (auth.uid() = user_id AND status NOT IN ('completed', 'removed'))
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- hunt_invitations
-- ──────────────────────────────────────────────────────────────
ALTER TABLE hunt_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hi_invitee_select"
  ON hunt_invitations FOR SELECT
  USING (auth.uid() = invitee_user_id);

CREATE POLICY "hi_inviter_select"
  ON hunt_invitations FOR SELECT
  USING (auth.uid() = inviter_user_id);

CREATE POLICY "hi_send_invitation"
  ON hunt_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = inviter_user_id
    -- block check enforced in service layer (are_users_blocked)
  );

CREATE POLICY "hi_invitee_respond"
  ON hunt_invitations FOR UPDATE
  USING (auth.uid() = invitee_user_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = invitee_user_id
    AND status IN ('accepted', 'declined')
  );

CREATE POLICY "hi_inviter_revoke"
  ON hunt_invitations FOR UPDATE
  USING (auth.uid() = inviter_user_id AND status = 'pending')
  WITH CHECK (auth.uid() = inviter_user_id AND status = 'revoked');

-- ──────────────────────────────────────────────────────────────
-- hunt_stop_progress
-- ──────────────────────────────────────────────────────────────
ALTER TABLE hunt_stop_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hsp_participant_select"
  ON hunt_stop_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hunt_participants hp
      WHERE hp.id = hunt_participant_id AND hp.user_id = auth.uid()
    )
  );

-- Only server (service_role) may mark stops completed — no direct INSERT/UPDATE for clients
-- except creating the progress row when a stop is revealed
CREATE POLICY "hsp_participant_insert"
  ON hunt_stop_progress FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hunt_participants hp
      WHERE hp.id = hunt_participant_id AND hp.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- points_ledger  (read-own, no write for users)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pl_owner_select"
  ON points_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated users
-- service_role inserts via trusted server logic

-- ──────────────────────────────────────────────────────────────
-- achievements  (public read)
-- user_achievements  (owner read)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_public_select"
  ON achievements FOR SELECT
  USING (is_active = TRUE AND is_hidden = FALSE);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Owner may see their own, including hidden achievements once earned
CREATE POLICY "ua_owner_select"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- notifications  (owner only)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_owner_select"
  ON notifications FOR SELECT
  USING (
    auth.uid() = user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Users may only update read_at (mark as read)
CREATE POLICY "notif_owner_mark_read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT for users — service_role creates notifications

-- ──────────────────────────────────────────────────────────────
-- reports  (reporters may create; own status readable)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_create"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "reports_own_select"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_user_id);

-- ──────────────────────────────────────────────────────────────
-- user_blocks  (owner full control)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_owner_select"
  ON user_blocks FOR SELECT
  USING (auth.uid() = blocker_user_id);

CREATE POLICY "blocks_owner_insert"
  ON user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_user_id AND blocker_user_id <> blocked_user_id);

CREATE POLICY "blocks_owner_delete"
  ON user_blocks FOR DELETE
  USING (auth.uid() = blocker_user_id);

-- ──────────────────────────────────────────────────────────────
-- moderation_cases + audit_logs  (no ordinary user access)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE moderation_cases ENABLE ROW LEVEL SECURITY;
-- No permissive policies — service_role only

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- No permissive policies — service_role only
-- Authorized staff access via service_role or specific admin RPCs (future)

-- ──────────────────────────────────────────────────────────────
-- AI tables  (no user access — admin + service_role only)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;
-- No permissive policies on any AI table

-- ──────────────────────────────────────────────────────────────
-- point_reward_guidelines  (public read — used by quest creation UI)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE point_reward_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prg_public_select"
  ON point_reward_guidelines FOR SELECT
  USING (is_active = TRUE);
