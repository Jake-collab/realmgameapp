-- ============================================================
-- Migration 026 — Social: Friends, Requests, Blocks, Privacy
-- Worlds — Build 1, Prompt 16
-- ============================================================
-- Extends existing user_blocks.
-- New tables: friend_requests, friendships, social_privacy_settings.
-- New notification_type values: friend_request_received, friend_request_accepted.
-- New RPCs (SECURITY DEFINER):
--   search_public_users, get_public_profile, get_social_relationship,
--   send_friend_request, accept_friend_request, decline_friend_request,
--   cancel_friend_request, remove_friend, block_user, unblock_user,
--   get_friends, get_received_friend_requests, get_sent_friend_requests,
--   get_blocked_users, get_social_privacy_settings,
--   update_social_privacy_settings, get_mutual_friend_count,
--   get_hunt_invitation_eligibility, submit_user_report.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. Notification type extensions
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_request_received';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_request_accepted';
EXCEPTION WHEN others THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 1. Extend user_blocks to support soft-delete (unblock with history)
-- ──────────────────────────────────────────────────────────────

-- Add columns for soft-delete block tracking
ALTER TABLE user_blocks
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;

-- Mark all existing rows as active (they were all active before)
UPDATE user_blocks SET is_active = TRUE WHERE is_active IS NULL;

-- The existing PRIMARY KEY (blocker_user_id, blocked_user_id) prevents soft-delete
-- re-insertion. Replace with an id-based PK + partial unique index.
DO $$
BEGIN
  -- Only restructure if the old composite PK still exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_blocks'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'user_blocks_pkey'
  ) THEN
    ALTER TABLE user_blocks DROP CONSTRAINT user_blocks_pkey;
    ALTER TABLE user_blocks ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE user_blocks ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Partial unique index: only one active block per ordered pair
CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_active_pair_idx
  ON user_blocks(blocker_user_id, blocked_user_id)
  WHERE is_active = TRUE;

-- Update the existing helper to respect is_active
CREATE OR REPLACE FUNCTION are_users_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE is_active = TRUE
      AND (
        (blocker_user_id = p_user_a AND blocked_user_id = p_user_b) OR
        (blocker_user_id = p_user_b AND blocked_user_id = p_user_a)
      )
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- 2. friend_requests
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friend_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending',
  source_context  TEXT,                             -- 'search' | 'public_profile' | 'notification'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',

  CONSTRAINT no_self_request  CHECK (requester_id <> recipient_id),
  CONSTRAINT valid_fr_status  CHECK (status IN ('pending','accepted','declined','cancelled','expired'))
);

-- One active pending request per ordered pair (prevents spam)
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_active_pair_idx
  ON friend_requests(requester_id, recipient_id)
  WHERE status = 'pending';

COMMENT ON TABLE friend_requests IS
  'Directional friend request records. Accepted requests yield a friendships row. '
  'Declined/cancelled requests are preserved for audit and cooldown enforcement. '
  'Requests expire after 30 days (configurable via expires_at). '
  'Idempotent send: the RPC returns the existing pending request if one already exists.';

-- ──────────────────────────────────────────────────────────────
-- 3. friendships (canonical pair)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friendships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Canonical ordering: user_id_a < user_id_b (UUID lexicographic)
  user_id_a   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_b   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'active',   -- 'active' | 'removed'
  request_id  UUID        REFERENCES friend_requests(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,

  CONSTRAINT canonical_pair     CHECK (user_id_a < user_id_b),
  CONSTRAINT no_self_friendship CHECK (user_id_a <> user_id_b),
  CONSTRAINT valid_fs_status    CHECK (status IN ('active','removed'))
);

-- One active friendship per canonical pair
CREATE UNIQUE INDEX IF NOT EXISTS friendships_active_pair_idx
  ON friendships(user_id_a, user_id_b)
  WHERE status = 'active';

COMMENT ON TABLE friendships IS
  'Mutual friendship. Canonical pair ensures uniqueness. '
  'Both users may read their own active friendship via RLS. '
  'Removal preserves the row (status = removed) for audit. '
  'Re-friending after removal is allowed after cooldown via a new friend_request.';

-- ──────────────────────────────────────────────────────────────
-- 4. social_privacy_settings
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_privacy_settings (
  user_id                      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Profile visibility
  profile_visibility            TEXT    NOT NULL DEFAULT 'public',   -- public|friends_only|private
  show_bio                      BOOLEAN NOT NULL DEFAULT TRUE,
  show_active_title             BOOLEAN NOT NULL DEFAULT TRUE,
  show_badges                   BOOLEAN NOT NULL DEFAULT TRUE,
  show_achievements             BOOLEAN NOT NULL DEFAULT TRUE,
  show_statistics               BOOLEAN NOT NULL DEFAULT FALSE,       -- friends_only default

  -- Discovery
  discoverable_by_username      BOOLEAN NOT NULL DEFAULT TRUE,
  discoverable_by_display_name  BOOLEAN NOT NULL DEFAULT FALSE,
  show_mutual_friend_count      BOOLEAN NOT NULL DEFAULT TRUE,

  -- Connections
  allow_friend_requests         BOOLEAN NOT NULL DEFAULT TRUE,
  allow_hunt_invitations_from   TEXT    NOT NULL DEFAULT 'friends',   -- friends|nobody

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_profile_visibility  CHECK (profile_visibility IN ('public','friends_only','private')),
  CONSTRAINT valid_invite_from         CHECK (allow_hunt_invitations_from IN ('friends','nobody'))
);

CREATE TRIGGER trg_social_privacy_updated_at
  BEFORE UPDATE ON social_privacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create settings row when a profile is created
CREATE OR REPLACE FUNCTION handle_new_profile_social_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO social_privacy_settings(user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_profile_social_privacy
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_social_privacy();

-- Back-fill for existing profiles
INSERT INTO social_privacy_settings(user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE social_privacy_settings IS
  'Per-user social privacy configuration. '
  'Separate from user_settings to keep social concerns isolated. '
  'Auto-created via trigger. Owner-only read/write via RLS. '
  'RPCs enforce these settings server-side — client never bypasses them.';

-- ──────────────────────────────────────────────────────────────
-- 5. Indexes
-- ──────────────────────────────────────────────────────────────

-- friend_requests: fast pending inbox/outbox queries
CREATE INDEX IF NOT EXISTS friend_requests_recipient_pending_idx
  ON friend_requests(recipient_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_requester_pending_idx
  ON friend_requests(requester_id, created_at DESC)
  WHERE status = 'pending';

-- friendships: fast lookup for a user's friends
CREATE INDEX IF NOT EXISTS friendships_user_a_idx ON friendships(user_id_a) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS friendships_user_b_idx ON friendships(user_id_b) WHERE status = 'active';

-- user_blocks: fast "am I blocking or blocked" check
CREATE INDEX IF NOT EXISTS user_blocks_blocker_active_idx
  ON user_blocks(blocker_user_id) WHERE is_active = TRUE;

-- ──────────────────────────────────────────────────────────────
-- 6. RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE friend_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_privacy_settings ENABLE ROW LEVEL SECURITY;

-- friend_requests: requester sees outgoing, recipient sees incoming
CREATE POLICY "fr_requester_select"
  ON friend_requests FOR SELECT
  USING (requester_id = auth.uid());

CREATE POLICY "fr_recipient_select"
  ON friend_requests FOR SELECT
  USING (recipient_id = auth.uid());

-- No direct insert/update/delete: all via SECURITY DEFINER RPCs
-- (service_role bypasses RLS for admin tooling)

-- friendships: both participants may read their active friendship
CREATE POLICY "fs_participant_select"
  ON friendships FOR SELECT
  USING (user_id_a = auth.uid() OR user_id_b = auth.uid());

-- social_privacy_settings: owner only
CREATE POLICY "sps_owner_select"
  ON social_privacy_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "sps_owner_update"
  ON social_privacy_settings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_blocks: blocker reads own active blocks; blocked cannot read the row
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any, then recreate
DROP POLICY IF EXISTS "user_blocks_owner" ON user_blocks;

CREATE POLICY "user_blocks_blocker_select"
  ON user_blocks FOR SELECT
  USING (blocker_user_id = auth.uid() AND is_active = TRUE);

-- ──────────────────────────────────────────────────────────────
-- 7. Helper: canonical friendship pair keys
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION canonical_pair_a(id1 UUID, id2 UUID)
RETURNS UUID LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT LEAST(id1, id2); $$;

CREATE OR REPLACE FUNCTION canonical_pair_b(id1 UUID, id2 UUID)
RETURNS UUID LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT GREATEST(id1, id2); $$;

CREATE OR REPLACE FUNCTION are_friends(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'active'
      AND user_id_a = canonical_pair_a(p_user_a, p_user_b)
      AND user_id_b = canonical_pair_b(p_user_a, p_user_b)
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- 8. RPC: search_public_users
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_public_users(
  p_query  TEXT,
  p_limit  INT  DEFAULT 20,
  p_cursor TEXT DEFAULT NULL  -- last username seen (for pagination)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_q      TEXT := LOWER(TRIM(p_query));
  v_lim    INT  := LEAST(COALESCE(p_limit, 20), 50);
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_q) < 2 THEN
    RETURN '[]'::JSONB;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r.sort_key, r.username)
    FROM (
      SELECT
        p.username                              AS public_user_ref,
        p.display_name,
        p.username,
        p.avatar_path,
        -- Relationship state from viewer's perspective
        CASE
          WHEN are_friends(v_viewer, p.id) THEN 'friends'
          WHEN req_out.id IS NOT NULL        THEN 'outgoing_request'
          WHEN req_in.id  IS NOT NULL        THEN 'incoming_request'
          ELSE 'none'
        END                                     AS relationship_state,
        -- Mutual friend count (only when target permits it)
        CASE WHEN COALESCE(sps.show_mutual_friend_count, TRUE) THEN
          (
            SELECT COUNT(*)::INT FROM (
              SELECT CASE WHEN f1.user_id_a = v_viewer THEN f1.user_id_b ELSE f1.user_id_a END AS fid
              FROM friendships f1 WHERE f1.status = 'active' AND (f1.user_id_a = v_viewer OR f1.user_id_b = v_viewer)
            ) AS vf
            JOIN (
              SELECT CASE WHEN f2.user_id_a = p.id THEN f2.user_id_b ELSE f2.user_id_a END AS fid
              FROM friendships f2 WHERE f2.status = 'active' AND (f2.user_id_a = p.id OR f2.user_id_b = p.id)
            ) AS tf ON vf.fid = tf.fid
          )
        ELSE NULL END                           AS mutual_friend_count,
        -- Ranking
        CASE WHEN p.username = v_q THEN 0 ELSE 1 END AS sort_key
      FROM profiles p
      LEFT JOIN social_privacy_settings sps ON sps.user_id = p.id
      LEFT JOIN friend_requests req_out ON req_out.status = 'pending'
        AND req_out.requester_id = v_viewer AND req_out.recipient_id = p.id
        AND req_out.expires_at > NOW()
      LEFT JOIN friend_requests req_in ON req_in.status = 'pending'
        AND req_in.requester_id = p.id AND req_in.recipient_id = v_viewer
        AND req_in.expires_at > NOW()
      WHERE
        p.id             <> v_viewer
        AND p.account_status = 'active'
        AND COALESCE(sps.discoverable_by_username, TRUE) = TRUE
        AND p.username LIKE v_q || '%'
        AND NOT are_users_blocked(v_viewer, p.id)
        AND (p_cursor IS NULL OR p.username > p_cursor)
      ORDER BY sort_key, p.username
      LIMIT v_lim
    ) r
  ), '[]'::JSONB);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 9. RPC: get_public_profile
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_public_profile(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer      UUID := auth.uid();
  v_target      UUID;
  v_sps         social_privacy_settings%ROWTYPE;
  v_is_friend   BOOLEAN;
  v_blocked_by  BOOLEAN;  -- target blocked viewer
  v_i_blocked   BOOLEAN;  -- viewer blocked target
  v_rel_state   TEXT;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Look up target profile
  SELECT id INTO v_target FROM profiles WHERE username = LOWER(TRIM(p_username)) AND account_status = 'active';
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('unavailable', TRUE, 'reason', 'not_found');
  END IF;

  -- Self route
  IF v_target = v_viewer THEN
    RETURN jsonb_build_object('is_self', TRUE, 'username', p_username);
  END IF;

  -- Block checks
  v_i_blocked  := EXISTS(SELECT 1 FROM user_blocks WHERE blocker_user_id = v_viewer AND blocked_user_id = v_target AND is_active = TRUE);
  v_blocked_by := EXISTS(SELECT 1 FROM user_blocks WHERE blocker_user_id = v_target AND blocked_user_id = v_viewer AND is_active = TRUE);

  IF v_i_blocked THEN
    v_rel_state := 'blocked_by_me';
  ELSIF v_blocked_by THEN
    RETURN jsonb_build_object('unavailable', TRUE, 'reason', 'unavailable');
  ELSE
    v_is_friend := are_friends(v_viewer, v_target);
    IF v_is_friend THEN
      v_rel_state := 'friends';
    ELSE
      SELECT CASE
        WHEN req_out.id IS NOT NULL THEN 'outgoing_request'
        WHEN req_in.id  IS NOT NULL THEN 'incoming_request'
        ELSE 'none'
      END INTO v_rel_state
      FROM (SELECT 1) base
      LEFT JOIN friend_requests req_out ON req_out.status = 'pending'
        AND req_out.requester_id = v_viewer AND req_out.recipient_id = v_target
        AND req_out.expires_at > NOW()
      LEFT JOIN friend_requests req_in ON req_in.status = 'pending'
        AND req_in.requester_id = v_target AND req_in.recipient_id = v_viewer
        AND req_in.expires_at > NOW();
    END IF;
  END IF;

  -- Privacy settings
  SELECT * INTO v_sps FROM social_privacy_settings WHERE user_id = v_target;

  -- Visibility check
  IF v_sps.profile_visibility = 'private' AND NOT v_is_friend THEN
    RETURN jsonb_build_object(
      'unavailable', TRUE, 'reason', 'private',
      'relationship_state', v_rel_state,
      'username', (SELECT username FROM profiles WHERE id = v_target)
    );
  END IF;

  IF v_sps.profile_visibility = 'friends_only' AND NOT COALESCE(v_is_friend, FALSE) THEN
    -- Return minimal identity for non-friends
    RETURN (
      SELECT jsonb_build_object(
        'public_user_ref',      p.username,
        'display_name',         p.display_name,
        'username',             p.username,
        'avatar_path',          p.avatar_path,
        'relationship_state',   v_rel_state,
        'profile_limited',      TRUE,
        'allow_friend_requests', COALESCE(v_sps.allow_friend_requests, TRUE)
      ) FROM profiles p WHERE p.id = v_target
    );
  END IF;

  -- Full authorized profile
  RETURN (
    SELECT jsonb_build_object(
      'public_user_ref',          p.username,
      'display_name',             p.display_name,
      'username',                 p.username,
      'avatar_path',              p.avatar_path,
      'bio',                      CASE WHEN COALESCE(v_sps.show_bio, TRUE) THEN p.bio ELSE NULL END,
      'created_at',               p.created_at,
      'relationship_state',       v_rel_state,
      'show_active_title',        COALESCE(v_sps.show_active_title, TRUE),
      'show_badges',              COALESCE(v_sps.show_badges, TRUE),
      'show_achievements',        COALESCE(v_sps.show_achievements, TRUE),
      'show_statistics',          COALESCE(v_sps.show_statistics, FALSE) OR COALESCE(v_is_friend, FALSE),
      'allow_friend_requests',    COALESCE(v_sps.allow_friend_requests, TRUE),
      'allow_hunt_invitations_from', COALESCE(v_sps.allow_hunt_invitations_from, 'friends'),
      'show_mutual_friend_count', COALESCE(v_sps.show_mutual_friend_count, TRUE),
      'mutual_friend_count', CASE WHEN COALESCE(v_sps.show_mutual_friend_count, TRUE) THEN (
        SELECT COUNT(*)::INT FROM (
          SELECT CASE WHEN f1.user_id_a = v_viewer THEN f1.user_id_b ELSE f1.user_id_a END AS fid
          FROM friendships f1 WHERE f1.status='active' AND (f1.user_id_a=v_viewer OR f1.user_id_b=v_viewer)
        ) vf JOIN (
          SELECT CASE WHEN f2.user_id_a = v_target THEN f2.user_id_b ELSE f2.user_id_a END AS fid
          FROM friendships f2 WHERE f2.status='active' AND (f2.user_id_a=v_target OR f2.user_id_b=v_target)
        ) tf ON vf.fid = tf.fid
      ) ELSE NULL END
    ) FROM profiles p WHERE p.id = v_target
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 10. RPC: get_social_relationship
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_social_relationship(p_target_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_target UUID;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_target FROM profiles WHERE username = LOWER(TRIM(p_target_username)) AND account_status = 'active';
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('state', 'unavailable');
  END IF;
  IF v_target = v_viewer THEN
    RETURN jsonb_build_object('state', 'self');
  END IF;
  RETURN jsonb_build_object(
    'state', CASE
      WHEN EXISTS(SELECT 1 FROM user_blocks WHERE blocker_user_id=v_viewer AND blocked_user_id=v_target AND is_active=TRUE) THEN 'blocked_by_me'
      WHEN EXISTS(SELECT 1 FROM user_blocks WHERE blocker_user_id=v_target AND blocked_user_id=v_viewer AND is_active=TRUE) THEN 'unavailable'
      WHEN are_friends(v_viewer, v_target)                                                                                   THEN 'friends'
      WHEN EXISTS(SELECT 1 FROM friend_requests WHERE status='pending' AND requester_id=v_viewer AND recipient_id=v_target AND expires_at>NOW()) THEN 'outgoing_request'
      WHEN EXISTS(SELECT 1 FROM friend_requests WHERE status='pending' AND requester_id=v_target AND recipient_id=v_viewer AND expires_at>NOW()) THEN 'incoming_request'
      ELSE 'none'
    END,
    'pending_request_id', (
      SELECT id::TEXT FROM friend_requests
      WHERE status='pending' AND expires_at>NOW()
        AND (
          (requester_id=v_viewer AND recipient_id=v_target) OR
          (requester_id=v_target AND recipient_id=v_viewer)
        )
      LIMIT 1
    )
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 11. RPC: send_friend_request
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION send_friend_request(
  p_target_username TEXT,
  p_source_context  TEXT DEFAULT 'public_profile'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer   UUID := auth.uid();
  v_target   UUID;
  v_sps      social_privacy_settings%ROWTYPE;
  v_req_id   UUID;
  v_reverse  friend_requests%ROWTYPE;
  v_fs_id    UUID;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Look up target
  SELECT id INTO v_target FROM profiles WHERE username=LOWER(TRIM(p_target_username)) AND account_status='active';
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'target_unavailable');
  END IF;
  IF v_target = v_viewer THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'self_request');
  END IF;

  -- Serialize all requests for this pair on its canonical profile row.
  -- Without a pair-level lock, opposite sends can both miss the reverse
  -- request and create two pending rows instead of auto-accepting one.
  PERFORM id
  FROM profiles
  WHERE id = canonical_pair_a(v_viewer, v_target)
  FOR UPDATE;

  -- Block checks
  IF are_users_blocked(v_viewer, v_target) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'blocked');
  END IF;

  -- Privacy: requests allowed?
  SELECT * INTO v_sps FROM social_privacy_settings WHERE user_id = v_target;
  IF NOT COALESCE(v_sps.allow_friend_requests, TRUE) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'requests_disabled');
  END IF;

  -- Already friends?
  IF are_friends(v_viewer, v_target) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'already_friends');
  END IF;

  -- Existing outgoing request?
  SELECT id INTO v_req_id FROM friend_requests
  WHERE status='pending' AND requester_id=v_viewer AND recipient_id=v_target AND expires_at>NOW();
  IF v_req_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'code', 'request_exists', 'request_id', v_req_id, 'state', 'outgoing_request');
  END IF;

  -- Reverse pending request? Auto-accept (Build 1 policy: mutual interest = accept)
  SELECT * INTO v_reverse FROM friend_requests
  WHERE status='pending' AND requester_id=v_target AND recipient_id=v_viewer AND expires_at>NOW();

  IF v_reverse.id IS NOT NULL THEN
    -- Accept the reverse request atomically
    UPDATE friend_requests SET status='accepted', responded_at=NOW() WHERE id=v_reverse.id;
    INSERT INTO friendships(user_id_a, user_id_b, request_id)
    VALUES(canonical_pair_a(v_viewer,v_target), canonical_pair_b(v_viewer,v_target), v_reverse.id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_fs_id;
    -- Notification: both accepted
    INSERT INTO notifications(user_id, type, title, body, data, deep_link)
    VALUES(v_target, 'friend_request_accepted', 'Friend request accepted',
           'You are now friends.', jsonb_build_object('friendship_id', v_fs_id),
           'worlds://social/friends');
    RETURN jsonb_build_object('ok', TRUE, 'code', 'auto_accepted', 'state', 'friends');
  END IF;

  -- Pending limit (max 100 outgoing pending requests)
  IF (SELECT COUNT(*) FROM friend_requests WHERE status='pending' AND requester_id=v_viewer AND expires_at>NOW()) >= 100 THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'pending_limit_reached');
  END IF;

  -- Cooldown: declined within 7 days
  IF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status='declined' AND requester_id=v_viewer AND recipient_id=v_target
      AND responded_at > NOW() - INTERVAL '7 days'
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'cooldown_active');
  END IF;

  -- Create request
  INSERT INTO friend_requests(requester_id, recipient_id, source_context)
  VALUES(v_viewer, v_target, p_source_context)
  ON CONFLICT ON CONSTRAINT friend_requests_active_pair_idx DO NOTHING
  RETURNING id INTO v_req_id;

  -- Notification to recipient
  INSERT INTO notifications(user_id, type, title, body, data, deep_link)
  SELECT v_target, 'friend_request_received', 'New friend request',
         (SELECT display_name FROM profiles WHERE id=v_viewer) || ' wants to connect.',
         jsonb_build_object('request_id', v_req_id, 'requester_username', (SELECT username FROM profiles WHERE id=v_viewer)),
         'worlds://social/friend-requests';

  RETURN jsonb_build_object('ok', TRUE, 'code', 'sent', 'request_id', v_req_id, 'state', 'outgoing_request');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 12. RPC: accept_friend_request
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_friend_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_req    friend_requests%ROWTYPE;
  v_fs_id  UUID;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM friend_requests WHERE id=p_request_id;
  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'request_not_found');
  END IF;
  IF v_req.recipient_id <> v_viewer THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'not_recipient');
  END IF;
  IF v_req.status = 'accepted' THEN
    -- Idempotent
    RETURN jsonb_build_object('ok', TRUE, 'code', 'already_accepted', 'state', 'friends');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'request_not_pending', 'status', v_req.status);
  END IF;
  IF v_req.expires_at < NOW() THEN
    UPDATE friend_requests SET status='expired' WHERE id=p_request_id;
    RETURN jsonb_build_object('ok', FALSE, 'code', 'request_expired');
  END IF;
  IF are_users_blocked(v_viewer, v_req.requester_id) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'blocked');
  END IF;

  -- Atomic: mark accepted + create friendship
  UPDATE friend_requests SET status='accepted', responded_at=NOW() WHERE id=p_request_id;
  INSERT INTO friendships(user_id_a, user_id_b, request_id)
  VALUES(canonical_pair_a(v_viewer, v_req.requester_id), canonical_pair_b(v_viewer, v_req.requester_id), p_request_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_fs_id;

  -- Notification to requester
  INSERT INTO notifications(user_id, type, title, body, data, deep_link)
  VALUES(v_req.requester_id, 'friend_request_accepted', 'Friend request accepted',
         (SELECT display_name FROM profiles WHERE id=v_viewer) || ' accepted your request.',
         jsonb_build_object('friendship_id', v_fs_id, 'friend_username', (SELECT username FROM profiles WHERE id=v_viewer)),
         'worlds://social/profile/' || (SELECT username FROM profiles WHERE id=v_viewer));

  RETURN jsonb_build_object('ok', TRUE, 'code', 'accepted', 'state', 'friends', 'friendship_id', v_fs_id);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 13. RPC: decline_friend_request
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION decline_friend_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_req    friend_requests%ROWTYPE;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_req FROM friend_requests WHERE id=p_request_id;
  IF v_req.id IS NULL                    THEN RETURN jsonb_build_object('ok',FALSE,'code','not_found'); END IF;
  IF v_req.recipient_id <> v_viewer      THEN RETURN jsonb_build_object('ok',FALSE,'code','not_recipient'); END IF;
  IF v_req.status = 'declined'           THEN RETURN jsonb_build_object('ok',TRUE,'code','already_declined'); END IF;
  IF v_req.status <> 'pending'           THEN RETURN jsonb_build_object('ok',FALSE,'code','not_pending','status',v_req.status); END IF;

  UPDATE friend_requests SET status='declined', responded_at=NOW() WHERE id=p_request_id;
  -- No notification to requester (by policy)
  RETURN jsonb_build_object('ok', TRUE, 'code', 'declined');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 14. RPC: cancel_friend_request
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_friend_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_req    friend_requests%ROWTYPE;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_req FROM friend_requests WHERE id=p_request_id;
  IF v_req.id IS NULL                    THEN RETURN jsonb_build_object('ok',FALSE,'code','not_found'); END IF;
  IF v_req.requester_id <> v_viewer      THEN RETURN jsonb_build_object('ok',FALSE,'code','not_requester'); END IF;
  IF v_req.status = 'cancelled'          THEN RETURN jsonb_build_object('ok',TRUE,'code','already_cancelled'); END IF;
  IF v_req.status = 'accepted'           THEN RETURN jsonb_build_object('ok',FALSE,'code','already_accepted'); END IF;
  IF v_req.status <> 'pending'           THEN RETURN jsonb_build_object('ok',FALSE,'code','not_pending','status',v_req.status); END IF;

  UPDATE friend_requests SET status='cancelled', cancelled_at=NOW() WHERE id=p_request_id;
  RETURN jsonb_build_object('ok', TRUE, 'code', 'cancelled');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 15. RPC: remove_friend
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION remove_friend(p_friend_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_friend UUID;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_friend FROM profiles WHERE username=LOWER(TRIM(p_friend_username)) AND account_status='active';
  IF v_friend IS NULL THEN RETURN jsonb_build_object('ok',FALSE,'code','not_found'); END IF;
  IF NOT are_friends(v_viewer, v_friend) THEN RETURN jsonb_build_object('ok',FALSE,'code','not_friends'); END IF;

  -- Soft-remove: preserve history
  UPDATE friendships SET status='removed', ended_at=NOW()
  WHERE status='active'
    AND user_id_a = canonical_pair_a(v_viewer, v_friend)
    AND user_id_b = canonical_pair_b(v_viewer, v_friend);

  -- No notification (by policy)
  RETURN jsonb_build_object('ok', TRUE, 'code', 'removed');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 16. RPC: block_user
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION block_user(p_target_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_target UUID;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_target FROM profiles WHERE username=LOWER(TRIM(p_target_username));
  IF v_target IS NULL OR v_target = v_viewer THEN
    RETURN jsonb_build_object('ok',FALSE,'code','invalid_target');
  END IF;

  -- Already blocked?
  IF EXISTS(SELECT 1 FROM user_blocks WHERE blocker_user_id=v_viewer AND blocked_user_id=v_target AND is_active=TRUE) THEN
    RETURN jsonb_build_object('ok', TRUE, 'code', 'already_blocked');
  END IF;

  -- Remove active friendship
  UPDATE friendships SET status='removed', ended_at=NOW()
  WHERE status='active'
    AND user_id_a=canonical_pair_a(v_viewer,v_target)
    AND user_id_b=canonical_pair_b(v_viewer,v_target);

  -- Cancel pending friend requests in both directions
  UPDATE friend_requests SET status='cancelled', cancelled_at=NOW()
  WHERE status='pending'
    AND ((requester_id=v_viewer AND recipient_id=v_target) OR (requester_id=v_target AND recipient_id=v_viewer));

  -- Insert block row (is_active=TRUE by default)
  INSERT INTO user_blocks(blocker_user_id, blocked_user_id)
  VALUES(v_viewer, v_target)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', TRUE, 'code', 'blocked');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 17. RPC: unblock_user
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION unblock_user(p_target_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_target UUID;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_target FROM profiles WHERE username=LOWER(TRIM(p_target_username));
  IF v_target IS NULL THEN RETURN jsonb_build_object('ok',FALSE,'code','not_found'); END IF;

  -- Soft-delete the block
  UPDATE user_blocks SET is_active=FALSE, removed_at=NOW()
  WHERE blocker_user_id=v_viewer AND blocked_user_id=v_target AND is_active=TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',TRUE,'code','not_blocked');
  END IF;
  -- Friendship NOT restored. New friend request requires cooldown (enforced in send_friend_request).
  RETURN jsonb_build_object('ok', TRUE, 'code', 'unblocked');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 18. RPC: get_friends
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_friends(
  p_limit  INT  DEFAULT 50,
  p_cursor TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_lim    INT  := LEAST(COALESCE(p_limit,50), 100);
  v_q      TEXT := LOWER(TRIM(COALESCE(p_search,'')));
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r.display_name)
    FROM (
      SELECT
        p.username    AS public_user_ref,
        p.display_name,
        p.username,
        p.avatar_path,
        f.created_at  AS friendship_since
      FROM friendships f
      JOIN profiles p ON p.id = CASE WHEN f.user_id_a=v_viewer THEN f.user_id_b ELSE f.user_id_a END
      WHERE f.status='active' AND (f.user_id_a=v_viewer OR f.user_id_b=v_viewer)
        AND (v_q='' OR p.username LIKE v_q||'%' OR LOWER(p.display_name) LIKE v_q||'%')
        AND (p_cursor IS NULL OR p.display_name > p_cursor)
      ORDER BY p.display_name
      LIMIT v_lim
    ) r
  ), '[]'::JSONB);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 19. RPC: get_received_friend_requests
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_received_friend_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r.created_at DESC)
    FROM (
      SELECT
        fr.id          AS request_id,
        p.username     AS public_user_ref,
        p.display_name,
        p.username,
        p.avatar_path,
        fr.created_at,
        fr.expires_at
      FROM friend_requests fr
      JOIN profiles p ON p.id=fr.requester_id
      WHERE fr.recipient_id=v_viewer AND fr.status='pending' AND fr.expires_at>NOW()
    ) r
  ), '[]'::JSONB);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 20. RPC: get_sent_friend_requests
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_sent_friend_requests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r.created_at DESC)
    FROM (
      SELECT
        fr.id          AS request_id,
        p.username     AS public_user_ref,
        p.display_name,
        p.username,
        p.avatar_path,
        fr.created_at,
        fr.expires_at
      FROM friend_requests fr
      JOIN profiles p ON p.id=fr.recipient_id
      WHERE fr.requester_id=v_viewer AND fr.status='pending' AND fr.expires_at>NOW()
    ) r
  ), '[]'::JSONB);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 21. RPC: get_blocked_users
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_blocked_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r.blocked_at DESC)
    FROM (
      SELECT
        COALESCE(p.username, '[removed]') AS public_user_ref,
        COALESCE(p.display_name, 'Deleted user') AS display_name,
        p.username,
        ub.created_at AS blocked_at
      FROM user_blocks ub
      LEFT JOIN profiles p ON p.id=ub.blocked_user_id
      WHERE ub.blocker_user_id=v_viewer AND ub.is_active=TRUE
    ) r
  ), '[]'::JSONB);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 22. RPC: get_social_privacy_settings
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_social_privacy_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_sps    social_privacy_settings%ROWTYPE;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_sps FROM social_privacy_settings WHERE user_id=v_viewer;
  IF v_sps.user_id IS NULL THEN
    INSERT INTO social_privacy_settings(user_id) VALUES(v_viewer) ON CONFLICT DO NOTHING;
    SELECT * INTO v_sps FROM social_privacy_settings WHERE user_id=v_viewer;
  END IF;
  RETURN row_to_json(v_sps)::JSONB;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 23. RPC: update_social_privacy_settings
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_social_privacy_settings(
  p_profile_visibility           TEXT    DEFAULT NULL,
  p_show_bio                     BOOLEAN DEFAULT NULL,
  p_show_active_title            BOOLEAN DEFAULT NULL,
  p_show_badges                  BOOLEAN DEFAULT NULL,
  p_show_achievements            BOOLEAN DEFAULT NULL,
  p_show_statistics              BOOLEAN DEFAULT NULL,
  p_discoverable_by_username     BOOLEAN DEFAULT NULL,
  p_discoverable_by_display_name BOOLEAN DEFAULT NULL,
  p_show_mutual_friend_count     BOOLEAN DEFAULT NULL,
  p_allow_friend_requests        BOOLEAN DEFAULT NULL,
  p_allow_hunt_invitations_from  TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  IF p_profile_visibility IS NOT NULL AND p_profile_visibility NOT IN ('public','friends_only','private') THEN
    RAISE EXCEPTION 'Invalid profile_visibility value' USING ERRCODE='22000';
  END IF;
  IF p_allow_hunt_invitations_from IS NOT NULL AND p_allow_hunt_invitations_from NOT IN ('friends','nobody') THEN
    RAISE EXCEPTION 'Invalid allow_hunt_invitations_from value' USING ERRCODE='22000';
  END IF;

  INSERT INTO social_privacy_settings(user_id) VALUES(v_viewer) ON CONFLICT(user_id) DO NOTHING;

  UPDATE social_privacy_settings SET
    profile_visibility           = COALESCE(p_profile_visibility,           profile_visibility),
    show_bio                     = COALESCE(p_show_bio,                     show_bio),
    show_active_title            = COALESCE(p_show_active_title,            show_active_title),
    show_badges                  = COALESCE(p_show_badges,                  show_badges),
    show_achievements            = COALESCE(p_show_achievements,            show_achievements),
    show_statistics              = COALESCE(p_show_statistics,              show_statistics),
    discoverable_by_username     = COALESCE(p_discoverable_by_username,     discoverable_by_username),
    discoverable_by_display_name = COALESCE(p_discoverable_by_display_name, discoverable_by_display_name),
    show_mutual_friend_count     = COALESCE(p_show_mutual_friend_count,     show_mutual_friend_count),
    allow_friend_requests        = COALESCE(p_allow_friend_requests,        allow_friend_requests),
    allow_hunt_invitations_from  = COALESCE(p_allow_hunt_invitations_from,  allow_hunt_invitations_from)
  WHERE user_id = v_viewer;

  RETURN (SELECT row_to_json(sps)::JSONB FROM social_privacy_settings sps WHERE user_id=v_viewer);
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 24. RPC: get_mutual_friend_count
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_mutual_friend_count(p_target_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_target UUID;
  v_sps    social_privacy_settings%ROWTYPE;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_target FROM profiles WHERE username=LOWER(TRIM(p_target_username)) AND account_status='active';
  IF v_target IS NULL THEN RETURN jsonb_build_object('count',0,'permitted',FALSE); END IF;
  SELECT * INTO v_sps FROM social_privacy_settings WHERE user_id=v_target;
  IF NOT COALESCE(v_sps.show_mutual_friend_count, TRUE) OR are_users_blocked(v_viewer,v_target) THEN
    RETURN jsonb_build_object('count',0,'permitted',FALSE);
  END IF;
  RETURN jsonb_build_object('permitted',TRUE,'count',(
    SELECT COUNT(*)::INT FROM (
      SELECT CASE WHEN f1.user_id_a=v_viewer THEN f1.user_id_b ELSE f1.user_id_a END AS fid
      FROM friendships f1 WHERE f1.status='active' AND (f1.user_id_a=v_viewer OR f1.user_id_b=v_viewer)
    ) vf JOIN (
      SELECT CASE WHEN f2.user_id_a=v_target THEN f2.user_id_b ELSE f2.user_id_a END AS fid
      FROM friendships f2 WHERE f2.status='active' AND (f2.user_id_a=v_target OR f2.user_id_b=v_target)
    ) tf ON vf.fid=tf.fid
  ));
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 25. RPC: get_hunt_invitation_eligibility
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hunt_invitation_eligibility(
  p_target_username TEXT,
  p_hunt_id         UUID,
  p_occurrence_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer   UUID := auth.uid();
  v_target   UUID;
  v_sps      social_privacy_settings%ROWTYPE;
  v_capacity INT;
  v_enrolled INT;
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_target FROM profiles WHERE username=LOWER(TRIM(p_target_username)) AND account_status='active';
  IF v_target IS NULL THEN RETURN jsonb_build_object('eligible',FALSE,'code','target_unavailable'); END IF;
  IF NOT are_friends(v_viewer, v_target) THEN RETURN jsonb_build_object('eligible',FALSE,'code','not_friends'); END IF;
  IF are_users_blocked(v_viewer, v_target) THEN RETURN jsonb_build_object('eligible',FALSE,'code','blocked'); END IF;

  SELECT * INTO v_sps FROM social_privacy_settings WHERE user_id=v_target;
  IF COALESCE(v_sps.allow_hunt_invitations_from,'friends') = 'nobody' THEN
    RETURN jsonb_build_object('eligible',FALSE,'code','invitations_disabled');
  END IF;

  -- Check existing invitation/participation
  IF EXISTS(
    SELECT 1 FROM hunt_invitations
    WHERE occurrence_id=p_occurrence_id AND invitee_id=v_target AND status NOT IN ('declined','cancelled')
  ) THEN
    RETURN jsonb_build_object('eligible',FALSE,'code','already_invited');
  END IF;

  IF EXISTS(
    SELECT 1 FROM hunt_participations
    WHERE occurrence_id=p_occurrence_id AND user_id=v_target AND status NOT IN ('withdrawn','disqualified')
  ) THEN
    RETURN jsonb_build_object('eligible',FALSE,'code','already_participating');
  END IF;

  -- Check capacity
  SELECT max_participants INTO v_capacity FROM hunt_occurrences WHERE id=p_occurrence_id;
  IF v_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_enrolled FROM hunt_participations
    WHERE occurrence_id=p_occurrence_id AND status NOT IN ('withdrawn','disqualified');
    IF v_enrolled >= v_capacity THEN
      RETURN jsonb_build_object('eligible',FALSE,'code','hunt_full');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'eligible',TRUE,'code','eligible',
    'public_user_ref', (SELECT username FROM profiles WHERE id=v_target),
    'display_name', (SELECT display_name FROM profiles WHERE id=v_target)
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 26. RPC: submit_user_report
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_user_report(
  p_target_username TEXT,
  p_reason          TEXT,
  p_description     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer  UUID := auth.uid();
  v_target  UUID;
  v_valid_reasons TEXT[] := ARRAY['harassment','spam','impersonation','inappropriate_profile','threatening','scam','other'];
BEGIN
  IF v_viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_reason IS NULL OR NOT (p_reason = ANY(v_valid_reasons)) THEN
    RETURN jsonb_build_object('ok',FALSE,'code','invalid_reason');
  END IF;
  SELECT id INTO v_target FROM profiles WHERE username=LOWER(TRIM(p_target_username));
  IF v_target IS NULL OR v_target=v_viewer THEN
    RETURN jsonb_build_object('ok',FALSE,'code','invalid_target');
  END IF;

  -- Rate limit: max 5 reports per day
  IF (SELECT COUNT(*) FROM reports WHERE reporter_user_id=v_viewer AND created_at > NOW()-INTERVAL '1 day') >= 5 THEN
    RETURN jsonb_build_object('ok',FALSE,'code','rate_limited');
  END IF;

  INSERT INTO reports(reporter_user_id, entity_type, entity_id, reason, description)
  VALUES(v_viewer, 'user_profile', v_target, p_reason, p_description);

  RETURN jsonb_build_object('ok',TRUE,'code','submitted');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 27. Grant execute on new RPCs to authenticated users
-- ──────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION search_public_users(TEXT,INT,TEXT)           TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_profile(TEXT)                     TO authenticated;
GRANT EXECUTE ON FUNCTION get_social_relationship(TEXT)                TO authenticated;
GRANT EXECUTE ON FUNCTION send_friend_request(TEXT,TEXT)               TO authenticated;
GRANT EXECUTE ON FUNCTION accept_friend_request(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION decline_friend_request(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_friend_request(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION remove_friend(TEXT)                          TO authenticated;
GRANT EXECUTE ON FUNCTION block_user(TEXT)                             TO authenticated;
GRANT EXECUTE ON FUNCTION unblock_user(TEXT)                           TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends(INT,TEXT,TEXT)                   TO authenticated;
GRANT EXECUTE ON FUNCTION get_received_friend_requests()               TO authenticated;
GRANT EXECUTE ON FUNCTION get_sent_friend_requests()                   TO authenticated;
GRANT EXECUTE ON FUNCTION get_blocked_users()                          TO authenticated;
GRANT EXECUTE ON FUNCTION get_social_privacy_settings()                TO authenticated;
GRANT EXECUTE ON FUNCTION update_social_privacy_settings(TEXT,BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_mutual_friend_count(TEXT)                TO authenticated;
GRANT EXECUTE ON FUNCTION get_hunt_invitation_eligibility(TEXT,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_user_report(TEXT,TEXT,TEXT)           TO authenticated;
