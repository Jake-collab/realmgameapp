/**
 * RelationshipStatusBadge — compact pill showing friendship/request state.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { SocialRelationshipState } from '@/features/social/types/social.types';
import { SOCIAL_GREEN, SOCIAL_PURPLE } from '@/features/social/constants/social.constants';

interface RelationshipStatusBadgeProps {
  state: SocialRelationshipState;
}

export function RelationshipStatusBadge({ state }: RelationshipStatusBadgeProps) {
  const colors = useColors();
  const config = getConfig(state, colors);
  if (!config) return null;
  return (
    <View
      style={[styles.badge, { backgroundColor: config.bg }]}
      accessibilityLabel={config.label}
      accessibilityRole="text"
    >
      <Feather name={config.icon as any} size={11} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function getConfig(state: SocialRelationshipState, colors: ReturnType<typeof useColors>) {
  switch (state) {
    case 'friends':
      return { icon: 'user-check', label: 'Friends', color: SOCIAL_GREEN, bg: SOCIAL_GREEN + '18' };
    case 'outgoing_request':
      return { icon: 'clock', label: 'Request Sent', color: SOCIAL_PURPLE, bg: SOCIAL_PURPLE + '18' };
    case 'incoming_request':
      return { icon: 'user-plus', label: 'Wants to Connect', color: colors.primary, bg: colors.primary + '18' };
    case 'blocked_by_me':
      return { icon: 'slash', label: 'Blocked', color: colors.destructive, bg: colors.destructive + '15' };
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: radius.full,
  },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
});
