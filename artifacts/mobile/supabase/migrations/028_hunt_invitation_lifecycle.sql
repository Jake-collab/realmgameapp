-- Forward replacement for the directly executable invitation RPC.
-- Do not rely on historical migration edits: existing databases must receive
-- the same lifecycle guard.
CREATE OR REPLACE FUNCTION invite_to_hunt(
  p_hunt_id UUID,
  p_invitee_id UUID,
  p_occurrence_id UUID DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_expires_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hunt RECORD;
  v_participant RECORD;
  v_invitation RECORD;
  v_invite_id UUID;
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHENTICATED', 'userMessage', 'Authentication required.');
  END IF;
  IF v_user_id = p_invitee_id THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED', 'userMessage', 'You cannot invite yourself.');
  END IF;
  SELECT * INTO v_hunt FROM hunts WHERE id = p_hunt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_NOT_PUBLISHED', 'userMessage', 'Hunt not found.');
  END IF;
  IF v_hunt.status NOT IN ('scheduled', 'active')
    OR p_occurrence_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM hunt_occurrences
      WHERE id = p_occurrence_id
        AND hunt_id = p_hunt_id
        AND status IN ('scheduled', 'active')
        AND (ends_at IS NULL OR ends_at > NOW())
    ) THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'OCCURRENCE_NOT_AVAILABLE',
      'userMessage', 'This Hunt is not currently available for invitations.');
  END IF;
  SELECT * INTO v_participant FROM hunt_participants
  WHERE hunt_id = p_hunt_id AND user_id = v_user_id AND role IN ('creator', 'co_host');
  IF NOT FOUND AND v_hunt.creator_user_id <> v_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED',
      'userMessage', 'You are not authorized to invite participants to this Hunt.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_invitee_id AND account_status = 'active') THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED', 'userMessage', 'The invited user is not available.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = v_user_id AND blocked_id = p_invitee_id)
       OR (blocker_id = p_invitee_id AND blocked_id = v_user_id)
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'BLOCK_RELATIONSHIP', 'userMessage', 'You cannot invite this user.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM hunt_participants
    WHERE hunt_id = p_hunt_id AND user_id = p_invitee_id
      AND status IN ('accepted', 'ready', 'active', 'completed')
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'ALREADY_JOINED', 'userMessage', 'This user has already joined the Hunt.');
  END IF;
  SELECT * INTO v_invitation FROM hunt_invitations
  WHERE hunt_id = p_hunt_id AND invitee_user_id = p_invitee_id AND status = 'pending';
  IF FOUND THEN
    RETURN jsonb_build_object('success', TRUE, 'invitationId', v_invitation.id, 'reasonCode', NULL, 'userMessage', 'Invitation already pending.');
  END IF;
  IF v_hunt.max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM hunt_participants
    WHERE hunt_id = p_hunt_id AND status IN ('invited', 'accepted', 'ready', 'active', 'paused', 'completed');
    IF v_count >= v_hunt.max_participants THEN
      RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'HUNT_FULL', 'userMessage', 'This Hunt is full.');
    END IF;
  END IF;
  INSERT INTO hunt_invitations (hunt_id, inviter_user_id, invitee_user_id, status, message, expires_at)
  VALUES (p_hunt_id, v_user_id, p_invitee_id, 'pending', p_message,
    NOW() + (COALESCE(p_expires_days, 7) || ' days')::INTERVAL)
  RETURNING id INTO v_invite_id;
  INSERT INTO hunt_domain_events (event_type, hunt_id, user_id, invitation_id, payload)
  VALUES ('hunt_invitation_created', p_hunt_id, v_user_id, v_invite_id, jsonb_build_object('inviteeId', p_invitee_id));
  RETURN jsonb_build_object('success', TRUE, 'invitationId', v_invite_id, 'reasonCode', NULL, 'userMessage', 'Invitation sent.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'reasonCode', 'NOT_AUTHORIZED', 'userMessage', 'Unable to send invitation. Please try again.');
END;
$$;

REVOKE ALL ON FUNCTION invite_to_hunt(UUID, UUID, UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invite_to_hunt(UUID, UUID, UUID, TEXT, INTEGER) TO authenticated;