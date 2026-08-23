/**
 * Public Profile Screen — Worlds (Prompt 16)
 *
 * Displays a privacy-filtered view of another user's profile.
 * Route: /public-profile/[userRef]  where userRef = username.
 *
 * Safety:
 * - Self-route → redirects to own Profile tab.
 * - Unavailable/blocked → shows generic unavailable state.
 * - All data comes from get_public_profile RPC — no raw table access.
 * - Email, exact location, proof, active Hunt NEVER shown.
 * - Deep links revalidate access on every mount.
 */

import React, { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePublicProfile } from '@/features/social/hooks/usePublicProfile';
import { useSendFriendRequest } from '@/features/social/hooks/useSendFriendRequest';
import { useAcceptFriendRequest } from '@/features/social/hooks/useAcceptFriendRequest';
import { useCancelFriendRequest } from '@/features/social/hooks/useCancelFriendRequest';
import { useRemoveFriend } from '@/features/social/hooks/useRemoveFriend';
import { useBlockUser } from '@/features/social/hooks/useBlockUser';
import { useUnblockUser } from '@/features/social/hooks/useUnblockUser';
import { useSocialRelationship } from '@/features/social/hooks/useSocialRelationship';
import {
  isPublicProfile, isPublicProfileSelf, isPublicProfileUnavailable,
  resolvePrimaryAction,
  type SocialRelationshipState,
  type PublicProfile,
} from '@/features/social/types/social.types';
import { SOCIAL_PURPLE } from '@/features/social/constants/social.constants';
import { PublicProfileHeader } from '@/components/social/PublicProfileHeader';
import { PublicProgressionPreview } from '@/components/social/PublicProgressionPreview';
import { PublicStatisticsSummary } from '@/components/social/PublicStatisticsSummary';
import { BlockUserConfirmation } from '@/components/social/BlockUserConfirmation';
import { RemoveFriendConfirmation } from '@/components/social/RemoveFriendConfirmation';
import { ReportUserEntry } from '@/components/social/ReportUserEntry';
import { PublicProfileSkeleton } from '@/components/social/SocialSkeleton';

export default function PublicProfileScreen() {
  const colors = useColors();
  const { userRef } = useLocalSearchParams<{ userRef: string }>();
  const { user } = useAuth();

  const [showBlock, setShowBlock]   = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const profileQuery    = usePublicProfile(userRef);
  const relationQuery   = useSocialRelationship(userRef);
  const sendRequest     = useSendFriendRequest();
  const acceptRequest   = useAcceptFriendRequest();
  const cancelRequest   = useCancelFriendRequest();
  const removeFriend    = useRemoveFriend();
  const blockUser       = useBlockUser();
  const unblockUser     = useUnblockUser();

  const result = profileQuery.data;

  // ── Self guard ──────────────────────────────────────────────
  if (result && isPublicProfileSelf(result)) {
    router.replace('/(main)/quest/profile');
    return null;
  }

  // ── Loading ─────────────────────────────────────────────────
  if (profileQuery.isLoading) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Profile" />
        <PublicProfileSkeleton />
      </ScrollView>
    );
  }

  // ── Unavailable ─────────────────────────────────────────────
  if (!result || isPublicProfileUnavailable(result)) {
    const reason = (result as any)?.reason;
    const relState: SocialRelationshipState = (result as any)?.relationshipState ?? 'unavailable';
    return (
      <ScrollView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Profile" />
        <View style={styles.unavailable}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.muted }]}>
            <Feather name="user" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.unavailTitle, { color: colors.foreground }]}>
            {reason === 'private' ? 'Private Profile' : 'Profile Unavailable'}
          </Text>
          <Text style={[styles.unavailBody, { color: colors.mutedForeground }]}>
            {reason === 'private'
              ? 'This profile is only visible to friends.'
              : 'This profile is not available.'}
          </Text>
          {/* If private, show Add Friend option when allowed */}
          {reason === 'private' && relState === 'none' && (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => sendRequest.mutate({ targetUsername: userRef, sourceContext: 'public_profile' })}
              accessibilityRole="button"
            >
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Add Friend</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── Full profile ─────────────────────────────────────────────
  const profile = result as PublicProfile;
  const relState   = profile.relationshipState;
  const pendingId  = relationQuery.data?.pendingRequestId;

  const primaryAction = resolvePrimaryAction(relState, pendingId, profile.allowFriendRequests);
  const isActionBusy  =
    sendRequest.isPending || acceptRequest.isPending ||
    cancelRequest.isPending || blockUser.isPending || unblockUser.isPending;

  function handlePrimaryAction() {
    switch (primaryAction.type) {
      case 'add_friend':
        sendRequest.mutate({ targetUsername: userRef, sourceContext: 'public_profile' });
        break;
      case 'accept_request':
        if (pendingId) acceptRequest.mutate({ requestId: pendingId, requesterUsername: userRef });
        break;
      case 'request_sent':
        if (pendingId) cancelRequest.mutate({ requestId: pendingId, recipientUsername: userRef });
        break;
      case 'unblock':
        unblockUser.mutate({ targetUsername: userRef });
        break;
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Profile" />

      {/* Header: avatar + identity + primary action */}
      <PublicProfileHeader
        profile={profile}
        primaryAction={primaryAction}
        onPrimaryAction={handlePrimaryAction}
        isActionLoading={isActionBusy}
        mutualFriendCount={profile.mutualFriendCount}
        mutualFriendPermitted={profile.mutualFriendCount !== undefined}
      />

      {/* Bio */}
      {profile.showBio && profile.bio && (
        <View style={[styles.bioCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.bioText, { color: colors.foreground }]}>{profile.bio}</Text>
        </View>
      )}

      {/* Limited profile notice for non-friends */}
      {profile.profileLimited && (
        <View style={[styles.limitedBanner, { backgroundColor: colors.muted }]}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.limitedText, { color: colors.mutedForeground }]}>
            Add as a friend to see their full profile.
          </Text>
        </View>
      )}

      {/* Progression preview */}
      <PublicProgressionPreview profile={profile} />

      {/* Statistics */}
      <PublicStatisticsSummary profile={profile} />

      {/* Secondary actions */}
      {relState !== 'blocked_by_me' && relState !== 'unavailable' && relState !== 'self' && (
        <View style={[styles.secondaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>More Actions</Text>

          {relState === 'friends' && (
            <Pressable
              style={styles.secondaryRow}
              onPress={() => setShowRemove(true)}
              accessibilityRole="button"
              accessibilityLabel="Remove friend"
            >
              <Feather name="user-minus" size={16} color={colors.mutedForeground} />
              <Text style={[styles.secondaryLabel, { color: colors.mutedForeground }]}>Remove Friend</Text>
            </Pressable>
          )}

          {relState === 'friends' && profile.allowHuntInvitationsFrom === 'friends' && (
            <Pressable
              style={styles.secondaryRow}
              onPress={() => {/* Hunt invite entry point — wired in Prompt 17 */}}
              accessibilityRole="button"
              accessibilityLabel="Invite to Hunt"
            >
              <Feather name="map-pin" size={16} color={colors.mutedForeground} />
              <Text style={[styles.secondaryLabel, { color: colors.mutedForeground }]}>Invite to Hunt</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.secondaryRow}
            onPress={() => setShowBlock(true)}
            accessibilityRole="button"
            accessibilityLabel="Block user"
          >
            <Feather name="slash" size={16} color={colors.destructive} />
            <Text style={[styles.secondaryLabel, { color: colors.destructive }]}>Block</Text>
          </Pressable>

          <ReportUserEntry targetUsername={userRef} displayName={profile.displayName} />
        </View>
      )}

      <View style={{ height: spacing[8] }} />

      {/* Modals */}
      <BlockUserConfirmation
        visible={showBlock}
        displayName={profile.displayName}
        onConfirm={() => {
          setShowBlock(false);
          blockUser.mutate({ targetUsername: userRef });
        }}
        onCancel={() => setShowBlock(false)}
        isLoading={blockUser.isPending}
      />
      <RemoveFriendConfirmation
        visible={showRemove}
        displayName={profile.displayName}
        onConfirm={() => {
          setShowRemove(false);
          removeFriend.mutate({ friendUsername: userRef });
        }}
        onCancel={() => setShowRemove(false)}
        isLoading={removeFriend.isPending}
      />
    </ScrollView>
  );
}

function ScreenHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[4],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  unavailable: { alignItems: 'center', gap: spacing[4], paddingVertical: spacing[12], paddingHorizontal: spacing[6] },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  unavailTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'center' },
  unavailBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },
  primaryBtn: { paddingVertical: spacing[3], paddingHorizontal: spacing[6], borderRadius: radius.xl, marginTop: spacing[2] },
  primaryBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  bioCard: { padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
  bioText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },
  limitedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.lg,
  },
  limitedText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, flex: 1 },
  secondaryCard: { padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, gap: spacing[4] },
  sectionLabel: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  secondaryLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
});
