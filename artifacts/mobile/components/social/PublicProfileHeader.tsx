/**
 * PublicProfileHeader — avatar, identity, title, relationship state, primary action.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { PublicProfile, SocialAction } from '@/features/social/types/social.types';
import { SOCIAL_GREEN, SOCIAL_PURPLE } from '@/features/social/constants/social.constants';
import { RelationshipStatusBadge } from './RelationshipStatusBadge';
import { MutualFriendSummary } from './MutualFriendSummary';

interface PublicProfileHeaderProps {
  profile: PublicProfile;
  primaryAction: SocialAction;
  onPrimaryAction: () => void;
  isActionLoading?: boolean;
  mutualFriendCount?: number;
  mutualFriendPermitted?: boolean;
}

export function PublicProfileHeader({
  profile,
  primaryAction,
  onPrimaryAction,
  isActionLoading,
  mutualFriendCount,
  mutualFriendPermitted,
}: PublicProfileHeaderProps) {
  const colors = useColors();
  const initial = (profile.displayName || profile.username || '?').charAt(0).toUpperCase();

  const actionBg = getActionBg(primaryAction.type, colors);
  const actionText = getActionTextColor(primaryAction.type, colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Avatar */}
      <View style={[styles.avatarCircle, { backgroundColor: SOCIAL_PURPLE + '20' }]}>
        <Text style={[styles.avatarInitial, { color: SOCIAL_PURPLE }]}>{initial}</Text>
      </View>

      {/* Identity */}
      <View style={styles.identity}>
        <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
          {profile.displayName}
        </Text>
        <Text style={[styles.username, { color: colors.mutedForeground }]}>@{profile.username}</Text>
        <RelationshipStatusBadge state={profile.relationshipState} />
        <MutualFriendSummary count={mutualFriendCount ?? 0} permitted={mutualFriendPermitted ?? false} />
      </View>

      {/* Primary action */}
      {primaryAction.type !== 'self' && primaryAction.type !== 'unavailable' && (
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: actionBg, opacity: pressed || !primaryAction.enabled ? 0.7 : 1 },
          ]}
          onPress={onPrimaryAction}
          disabled={!primaryAction.enabled || isActionLoading}
          accessibilityRole="button"
          accessibilityLabel={primaryAction.label}
        >
          {isActionLoading
            ? <ActivityIndicator size="small" color={actionText} />
            : <Text style={[styles.actionLabel, { color: actionText }]}>{primaryAction.label}</Text>
          }
        </Pressable>
      )}
    </View>
  );
}

function getActionBg(type: SocialAction['type'], colors: ReturnType<typeof useColors>) {
  switch (type) {
    case 'add_friend':    return colors.primary;
    case 'accept_request': return SOCIAL_GREEN;
    case 'friends':       return SOCIAL_GREEN + '20';
    case 'request_sent':  return SOCIAL_PURPLE + '20';
    case 'unblock':       return colors.muted;
    default:              return colors.muted;
  }
}

function getActionTextColor(type: SocialAction['type'], colors: ReturnType<typeof useColors>) {
  switch (type) {
    case 'add_friend':    return colors.primaryForeground;
    case 'accept_request': return '#FFFFFF';
    case 'friends':       return SOCIAL_GREEN;
    case 'request_sent':  return SOCIAL_PURPLE;
    default:              return colors.foreground;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  avatarInitial: { fontFamily: fontFamily.bold, fontSize: 28 },
  identity: { alignItems: 'center', gap: spacing[1] },
  displayName: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'center' },
  username: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center' },
  actionBtn: {
    paddingVertical: spacing[3], paddingHorizontal: spacing[5],
    borderRadius: radius.xl, alignItems: 'center', minHeight: 44,
    justifyContent: 'center',
  },
  actionLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
