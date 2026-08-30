-- Serialize opposite friend-request sends so mutual requests auto-accept
-- instead of creating two pending directional requests.

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

  SELECT id INTO v_target
  FROM profiles
  WHERE username = LOWER(TRIM(p_target_username))
    AND account_status = 'active';
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'target_unavailable');
  END IF;
  IF v_target = v_viewer THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'self_request');
  END IF;

  -- Lock the canonical profile row. This makes the reverse-request check and
  -- the insert/auto-accept decision one serialized pair operation without
  -- requiring two row locks or risking lock-order deadlocks.
  PERFORM id
  FROM profiles
  WHERE id = canonical_pair_a(v_viewer, v_target)
  FOR UPDATE;

  IF are_users_blocked(v_viewer, v_target) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'blocked');
  END IF;

  SELECT * INTO v_sps
  FROM social_privacy_settings
  WHERE user_id = v_target;
  IF NOT COALESCE(v_sps.allow_friend_requests, TRUE) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'requests_disabled');
  END IF;

  IF are_friends(v_viewer, v_target) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'already_friends');
  END IF;

  SELECT id INTO v_req_id
  FROM friend_requests
  WHERE status = 'pending'
    AND requester_id = v_viewer
    AND recipient_id = v_target
    AND expires_at > NOW();
  IF v_req_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'code', 'request_exists',
      'request_id', v_req_id,
      'state', 'outgoing_request'
    );
  END IF;

  SELECT * INTO v_reverse
  FROM friend_requests
  WHERE status = 'pending'
    AND requester_id = v_target
    AND recipient_id = v_viewer
    AND expires_at > NOW();

  IF v_reverse.id IS NOT NULL THEN
    UPDATE friend_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE id = v_reverse.id;

    INSERT INTO friendships(user_id_a, user_id_b, request_id)
    VALUES (
      canonical_pair_a(v_viewer, v_target),
      canonical_pair_b(v_viewer, v_target),
      v_reverse.id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_fs_id;

    -- The pair lock ensures only the auto-accepting call can reach this
    -- branch for a mutual send, so exactly one acceptance notification is
    -- emitted for the friendship.
    INSERT INTO notifications(user_id, type, title, body, data, deep_link)
    VALUES (
      v_target,
      'friend_request_accepted',
      'Friend request accepted',
      'You are now friends.',
      jsonb_build_object('friendship_id', v_fs_id),
      'worlds://social/friends'
    );
    RETURN jsonb_build_object(
      'ok', TRUE,
      'code', 'auto_accepted',
      'state', 'friends'
    );
  END IF;

  IF (
    SELECT COUNT(*)
    FROM friend_requests
    WHERE status = 'pending'
      AND requester_id = v_viewer
      AND expires_at > NOW()
  ) >= 100 THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'pending_limit_reached');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM friend_requests
    WHERE status = 'declined'
      AND requester_id = v_viewer
      AND recipient_id = v_target
      AND responded_at > NOW() - INTERVAL '7 days'
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'code', 'cooldown_active');
  END IF;

  INSERT INTO friend_requests(requester_id, recipient_id, source_context)
  VALUES (v_viewer, v_target, p_source_context)
  ON CONFLICT (requester_id, recipient_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO v_req_id;

  IF v_req_id IS NULL THEN
    SELECT id INTO v_req_id
    FROM friend_requests
    WHERE status = 'pending'
      AND requester_id = v_viewer
      AND recipient_id = v_target;
    RETURN jsonb_build_object(
      'ok', TRUE,
      'code', 'request_exists',
      'request_id', v_req_id,
      'state', 'outgoing_request'
    );
  END IF;

  INSERT INTO notifications(user_id, type, title, body, data, deep_link)
  SELECT
    v_target,
    'friend_request_received',
    'New friend request',
    (SELECT display_name FROM profiles WHERE id = v_viewer) || ' wants to connect.',
    jsonb_build_object(
      'request_id', v_req_id,
      'requester_username', (SELECT username FROM profiles WHERE id = v_viewer)
    ),
    'worlds://social/friend-requests';

  RETURN jsonb_build_object(
    'ok', TRUE,
    'code', 'sent',
    'request_id', v_req_id,
    'state', 'outgoing_request'
  );
END;
$$;