/**
 * Social server round-trip coverage.
 *
 * The production social repository talks exclusively to SECURITY DEFINER RPCs.
 * This test uses a stateful RPC double so a mutation is followed by fresh reads
 * from the same server-side state, rather than asserting only a mutation result.
 */

type Relationship = 'none' | 'outgoing_request' | 'incoming_request' | 'friends' | 'blocked_by_me';

type ServerState = {
  relationship: Relationship;
  sentRequests: Array<Record<string, unknown>>;
  receivedRequests: Array<Record<string, unknown>>;
  friends: Array<Record<string, unknown>>;
  blockedUsers: Array<Record<string, unknown>>;
};

const state: ServerState = {
  relationship: 'none',
  sentRequests: [],
  receivedRequests: [],
  friends: [],
  blockedUsers: [],
};

const mockRpc = jest.fn(async (name: string, args?: Record<string, unknown>) => {
  switch (name) {
    case 'send_friend_request':
      state.relationship = 'outgoing_request';
      state.sentRequests = [{
        request_id: 'request-1',
        public_user_ref: 'target',
        username: 'target',
        display_name: 'Target User',
        avatar_path: null,
        created_at: '2026-08-23T12:00:00.000Z',
        expires_at: '2026-08-30T12:00:00.000Z',
      }];
      return {
        data: { ok: true, code: 'sent', request_id: 'request-1', state: 'outgoing_request' },
        error: null,
      };

    case 'get_sent_friend_requests':
      return { data: state.sentRequests, error: null };

    case 'get_social_relationship':
      return {
        data: {
          state: state.relationship,
          pending_request_id: state.relationship === 'outgoing_request' ? 'request-1' : null,
        },
        error: null,
      };

    case 'accept_friend_request':
      expect(args).toEqual({ p_request_id: 'request-2' });
      state.relationship = 'friends';
      state.receivedRequests = [];
      state.friends = [{
        public_user_ref: 'requester',
        username: 'requester',
        display_name: 'Requester User',
        avatar_path: null,
        friendship_since: '2026-08-23T12:01:00.000Z',
      }];
      return { data: { ok: true, code: 'accepted' }, error: null };

    case 'get_received_friend_requests':
      return { data: state.receivedRequests, error: null };

    case 'get_friends':
      return { data: state.friends, error: null };

    case 'block_user':
      state.relationship = 'blocked_by_me';
      state.sentRequests = [];
      state.receivedRequests = [];
      state.friends = [];
      state.blockedUsers = [{
        public_user_ref: 'target',
        username: 'target',
        display_name: 'Target User',
        blocked_at: '2026-08-23T12:02:00.000Z',
      }];
      return { data: { ok: true, code: 'blocked' }, error: null };

    case 'get_blocked_users':
      return { data: state.blockedUsers, error: null };

    case 'unblock_user':
      state.relationship = 'none';
      state.blockedUsers = [];
      return { data: { ok: true, code: 'unblocked' }, error: null };

    default:
      throw new Error(`Unexpected RPC: ${name}`);
  }
});

jest.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  requireSupabase: () => ({ rpc: mockRpc }),
}));

import {
  acceptFriendRequest,
  blockUser,
  fetchBlockedUsers,
  fetchFriends,
  fetchReceivedFriendRequests,
  fetchSentFriendRequests,
  fetchSocialRelationship,
  sendFriendRequest,
  unblockUser,
} from '../features/social/repositories/social.repository';

beforeEach(() => {
  state.relationship = 'none';
  state.sentRequests = [];
  state.receivedRequests = [{
    request_id: 'request-2',
    public_user_ref: 'requester',
    username: 'requester',
    display_name: 'Requester User',
    avatar_path: null,
    created_at: '2026-08-23T11:59:00.000Z',
    expires_at: '2026-08-30T11:59:00.000Z',
  }];
  state.friends = [];
  state.blockedUsers = [];
  mockRpc.mockClear();
});

describe('social server round trips', () => {
  test('friend request send and accept are reflected by subsequent server reads', async () => {
    const sent = await sendFriendRequest('target', 'find_people');
    expect(sent).toEqual({
      ok: true,
      code: 'sent',
      requestId: 'request-1',
      state: 'outgoing_request',
    });
    expect(mockRpc).toHaveBeenLastCalledWith('send_friend_request', {
      p_target_username: 'target',
      p_source_context: 'find_people',
    });

    await expect(fetchSentFriendRequests()).resolves.toEqual([
      expect.objectContaining({ requestId: 'request-1', username: 'target' }),
    ]);
    await expect(fetchSocialRelationship('target')).resolves.toEqual({
      state: 'outgoing_request',
      pendingRequestId: 'request-1',
    });

    const accepted = await acceptFriendRequest('request-2');
    expect(accepted).toEqual({ ok: true, code: 'accepted' });
    await expect(fetchReceivedFriendRequests()).resolves.toEqual([]);
    await expect(fetchFriends()).resolves.toEqual([
      expect.objectContaining({ publicUserRef: 'requester', username: 'requester' }),
    ]);
    await expect(fetchSocialRelationship('requester')).resolves.toEqual({
      state: 'friends',
    });
  });

  test('blocking removes relationships and survives a block/unblock read cycle', async () => {
    const blocked = await blockUser('target');
    expect(blocked).toEqual({ ok: true, code: 'blocked' });
    expect(mockRpc).toHaveBeenLastCalledWith('block_user', {
      p_target_username: 'target',
    });

    await expect(fetchBlockedUsers()).resolves.toEqual([
      expect.objectContaining({ publicUserRef: 'target', username: 'target' }),
    ]);
    await expect(fetchFriends()).resolves.toEqual([]);
    await expect(fetchSocialRelationship('target')).resolves.toEqual({
      state: 'blocked_by_me',
    });

    const unblocked = await unblockUser('target');
    expect(unblocked).toEqual({ ok: true, code: 'unblocked' });
    await expect(fetchBlockedUsers()).resolves.toEqual([]);
    await expect(fetchSocialRelationship('target')).resolves.toEqual({
      state: 'none',
    });
  });
});