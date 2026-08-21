/**
 * Social Repository — Worlds (Prompt 16)
 *
 * Data access for all social features via SECURITY DEFINER RPCs.
 * Never calls raw profile/friend_requests/friendships/user_blocks tables directly.
 *
 * Rules:
 * - All writes go through server RPCs.
 * - No email or exact location ever flows through here.
 * - snake_case DB fields → camelCase TS types.
 * - Blocks in both directions handled server-side.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/supabase/helpers';
import type {
  PublicProfile,
  PublicProfileResult,
  UserSearchResult,
  FriendEntry,
  FriendRequestEntry,
  BlockedUserEntry,
  SocialPrivacySettings,
  SocialPrivacySettingsUpdate,
  SendFriendRequestResult,
  MutualFriendCount,
  HuntInvitationEligibility,
  SocialRelationshipState,
} from '../types/social.types';
import { SEARCH_PAGE_SIZE } from '../constants/social.constants';

// ─── User Search ──────────────────────────────────────────────────────────────

export async function searchPublicUsers(
  query: string,
  limit: number = SEARCH_PAGE_SIZE,
  cursor?: string,
): Promise<UserSearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('search_public_users', {
    p_query: query,
    p_limit: limit,
    p_cursor: cursor ?? null,
  });
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];
  return (data as any[]).map(mapSearchResult);
}

function mapSearchResult(row: any): UserSearchResult {
  return {
    publicUserRef:      row.public_user_ref ?? row.username,
    displayName:        row.display_name,
    username:           row.username,
    avatarPath:         row.avatar_path ?? null,
    relationshipState:  (row.relationship_state ?? 'none') as any,
    mutualFriendCount:  row.mutual_friend_count ?? undefined,
  };
}

// ─── Public Profile ───────────────────────────────────────────────────────────

export async function fetchPublicProfile(username: string): Promise<PublicProfileResult> {
  if (!isSupabaseConfigured()) {
    return { unavailable: true, reason: 'not_found' };
  }
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_public_profile', {
    p_username: username,
  });
  if (error) throw normalizeError(error);
  if (!data) return { unavailable: true, reason: 'not_found' };

  if (data.is_self) return { isSelf: true, username: data.username };
  if (data.unavailable) {
    return {
      unavailable: true,
      reason: data.reason ?? 'unavailable',
      relationshipState: data.relationship_state as SocialRelationshipState | undefined,
      username: data.username,
    };
  }
  return mapPublicProfile(data);
}

function mapPublicProfile(row: any): PublicProfile {
  return {
    publicUserRef:              row.public_user_ref ?? row.username,
    displayName:                row.display_name,
    username:                   row.username,
    avatarPath:                 row.avatar_path ?? null,
    bio:                        row.bio ?? null,
    createdAt:                  row.created_at ?? undefined,
    relationshipState:          (row.relationship_state ?? 'none') as SocialRelationshipState,
    allowFriendRequests:        row.allow_friend_requests ?? true,
    allowHuntInvitationsFrom:   (row.allow_hunt_invitations_from ?? 'friends') as 'friends' | 'nobody',
    mutualFriendCount:          row.mutual_friend_count ?? undefined,
    profileLimited:             row.profile_limited ?? false,
    showActiveTitle:            row.show_active_title ?? true,
    showBadges:                 row.show_badges ?? true,
    showAchievements:           row.show_achievements ?? true,
    showStatistics:             row.show_statistics ?? false,
  };
}

// ─── Relationship ─────────────────────────────────────────────────────────────

export async function fetchSocialRelationship(
  targetUsername: string,
): Promise<{ state: SocialRelationshipState; pendingRequestId?: string }> {
  if (!isSupabaseConfigured()) return { state: 'unavailable' };
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_social_relationship', {
    p_target_username: targetUsername,
  });
  if (error) throw normalizeError(error);
  return {
    state:            (data?.state ?? 'unavailable') as SocialRelationshipState,
    pendingRequestId: data?.pending_request_id ?? undefined,
  };
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export async function fetchFriends(
  limit: number = 50,
  cursor?: string,
  search?: string,
): Promise<FriendEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_friends', {
    p_limit:  limit,
    p_cursor: cursor ?? null,
    p_search: search ?? null,
  });
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];
  return (data as any[]).map((row): FriendEntry => ({
    publicUserRef:    row.public_user_ref ?? row.username,
    displayName:      row.display_name,
    username:         row.username,
    avatarPath:       row.avatar_path ?? null,
    friendshipSince:  row.friendship_since,
  }));
}

// ─── Friend Requests ──────────────────────────────────────────────────────────

export async function fetchReceivedFriendRequests(): Promise<FriendRequestEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_received_friend_requests');
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];
  return (data as any[]).map(mapFriendRequestEntry);
}

export async function fetchSentFriendRequests(): Promise<FriendRequestEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_sent_friend_requests');
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];
  return (data as any[]).map(mapFriendRequestEntry);
}

function mapFriendRequestEntry(row: any): FriendRequestEntry {
  return {
    requestId:    row.request_id,
    publicUserRef: row.public_user_ref ?? row.username,
    displayName:  row.display_name,
    username:     row.username,
    avatarPath:   row.avatar_path ?? null,
    createdAt:    row.created_at,
    expiresAt:    row.expires_at,
  };
}

// ─── Friend Request Mutations ─────────────────────────────────────────────────

export async function sendFriendRequest(
  targetUsername: string,
  sourceContext: string = 'public_profile',
): Promise<SendFriendRequestResult> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('send_friend_request', {
    p_target_username: targetUsername,
    p_source_context:  sourceContext,
  });
  if (error) throw normalizeError(error);
  return {
    ok:        Boolean(data?.ok),
    code:      data?.code ?? 'unknown',
    requestId: data?.request_id ?? undefined,
    state:     data?.state as any ?? undefined,
  };
}

export async function acceptFriendRequest(requestId: string): Promise<{ ok: boolean; code: string }> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('accept_friend_request', {
    p_request_id: requestId,
  });
  if (error) throw normalizeError(error);
  return { ok: Boolean(data?.ok), code: data?.code ?? 'unknown' };
}

export async function declineFriendRequest(requestId: string): Promise<{ ok: boolean; code: string }> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('decline_friend_request', {
    p_request_id: requestId,
  });
  if (error) throw normalizeError(error);
  return { ok: Boolean(data?.ok), code: data?.code ?? 'unknown' };
}

export async function cancelFriendRequest(requestId: string): Promise<{ ok: boolean; code: string }> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('cancel_friend_request', {
    p_request_id: requestId,
  });
  if (error) throw normalizeError(error);
  return { ok: Boolean(data?.ok), code: data?.code ?? 'unknown' };
}

// ─── Friendship ───────────────────────────────────────────────────────────────

export async function removeFriend(friendUsername: string): Promise<{ ok: boolean; code: string }> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('remove_friend', {
    p_friend_username: friendUsername,
  });
  if (error) throw normalizeError(error);
  return { ok: Boolean(data?.ok), code: data?.code ?? 'unknown' };
}

// ─── Blocking ─────────────────────────────────────────────────────────────────

export async function blockUser(targetUsername: string): Promise<{ ok: boolean; code: string }> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('block_user', {
    p_target_username: targetUsername,
  });
  if (error) throw normalizeError(error);
  return { ok: Boolean(data?.ok), code: data?.code ?? 'unknown' };
}

export async function unblockUser(targetUsername: string): Promise<{ ok: boolean; code: string }> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('unblock_user', {
    p_target_username: targetUsername,
  });
  if (error) throw normalizeError(error);
  return { ok: Boolean(data?.ok), code: data?.code ?? 'unknown' };
}

export async function fetchBlockedUsers(): Promise<BlockedUserEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_blocked_users');
  if (error) throw normalizeError(error);
  if (!data || !Array.isArray(data)) return [];
  return (data as any[]).map((row): BlockedUserEntry => ({
    publicUserRef: row.public_user_ref ?? row.username ?? '[removed]',
    displayName:   row.display_name ?? 'Deleted user',
    username:      row.username ?? null,
    blockedAt:     row.blocked_at,
  }));
}

// ─── Social Privacy Settings ──────────────────────────────────────────────────

export async function fetchSocialPrivacySettings(): Promise<SocialPrivacySettings> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_social_privacy_settings');
  if (error) throw normalizeError(error);
  return mapPrivacySettings(data);
}

export async function updateSocialPrivacySettings(
  updates: SocialPrivacySettingsUpdate,
): Promise<SocialPrivacySettings> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('update_social_privacy_settings', {
    p_profile_visibility:           updates.profileVisibility           ?? null,
    p_show_bio:                     updates.showBio                     ?? null,
    p_show_active_title:            updates.showActiveTitle             ?? null,
    p_show_badges:                  updates.showBadges                  ?? null,
    p_show_achievements:            updates.showAchievements            ?? null,
    p_show_statistics:              updates.showStatistics              ?? null,
    p_discoverable_by_username:     updates.discoverableByUsername      ?? null,
    p_discoverable_by_display_name: updates.discoverableByDisplayName   ?? null,
    p_show_mutual_friend_count:     updates.showMutualFriendCount       ?? null,
    p_allow_friend_requests:        updates.allowFriendRequests         ?? null,
    p_allow_hunt_invitations_from:  updates.allowHuntInvitationsFrom    ?? null,
  });
  if (error) throw normalizeError(error);
  return mapPrivacySettings(data);
}

function mapPrivacySettings(row: any): SocialPrivacySettings {
  return {
    userId:                     row.user_id,
    profileVisibility:          (row.profile_visibility ?? 'public') as any,
    showBio:                    Boolean(row.show_bio ?? true),
    showActiveTitle:            Boolean(row.show_active_title ?? true),
    showBadges:                 Boolean(row.show_badges ?? true),
    showAchievements:           Boolean(row.show_achievements ?? true),
    showStatistics:             Boolean(row.show_statistics ?? false),
    discoverableByUsername:     Boolean(row.discoverable_by_username ?? true),
    discoverableByDisplayName:  Boolean(row.discoverable_by_display_name ?? false),
    showMutualFriendCount:      Boolean(row.show_mutual_friend_count ?? true),
    allowFriendRequests:        Boolean(row.allow_friend_requests ?? true),
    allowHuntInvitationsFrom:   (row.allow_hunt_invitations_from ?? 'friends') as any,
    createdAt:                  row.created_at,
    updatedAt:                  row.updated_at,
  };
}

// ─── Mutual Friend Count ──────────────────────────────────────────────────────

export async function fetchMutualFriendCount(targetUsername: string): Promise<MutualFriendCount> {
  if (!isSupabaseConfigured()) return { permitted: false, count: 0 };
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_mutual_friend_count', {
    p_target_username: targetUsername,
  });
  if (error) throw normalizeError(error);
  return { permitted: Boolean(data?.permitted), count: data?.count ?? 0 };
}

// ─── Hunt Invitation Eligibility ─────────────────────────────────────────────

export async function fetchHuntInvitationEligibility(
  targetUsername: string,
  huntId: string,
  occurrenceId: string,
): Promise<HuntInvitationEligibility> {
  if (!isSupabaseConfigured()) return { eligible: false, code: 'target_unavailable' };
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('get_hunt_invitation_eligibility', {
    p_target_username: targetUsername,
    p_hunt_id:         huntId,
    p_occurrence_id:   occurrenceId,
  });
  if (error) throw normalizeError(error);
  return {
    eligible:      Boolean(data?.eligible),
    code:          data?.code ?? 'target_unavailable',
    publicUserRef: data?.public_user_ref ?? undefined,
    displayName:   data?.display_name ?? undefined,
  };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function submitUserReport(
  targetUsername: string,
  reason: string,
  description?: string,
): Promise<{ ok: boolean; code: string }> {
  if (!isSupabaseConfigured()) throw new Error('Not configured');
  const client = requireSupabase();
  const { data, error } = await (client as any).rpc('submit_user_report', {
    p_target_username: targetUsername,
    p_reason:          reason,
    p_description:     description ?? null,
  });
  if (error) throw normalizeError(error);
  return { ok: Boolean(data?.ok), code: data?.code ?? 'unknown' };
}
