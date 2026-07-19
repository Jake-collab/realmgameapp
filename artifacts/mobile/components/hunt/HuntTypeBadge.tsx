/**
 * HuntTypeBadge — Worlds
 *
 * Small pill badge showing Hunt type (official / custom / community)
 * and optionally privacy (invite-only / unlisted).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { HuntType, HuntPrivacy } from '@/features/hunts/types/hunt.types';

interface HuntTypeBadgeProps {
  huntType: HuntType;
  privacy?: HuntPrivacy;
  size?: 'sm' | 'md';
}

export function HuntTypeBadge({ huntType, privacy, size = 'sm' }: HuntTypeBadgeProps) {
  const colors = useColors();
  const { label, icon, color } = getBadgeConfig(huntType, colors);
  const textSize = size === 'sm' ? fontSize.xs : fontSize.sm;

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: color + '18' }]}>
        <Feather name={icon as any} size={10} color={color} />
        <Text style={[styles.text, { color, fontSize: textSize }]}>{label}</Text>
      </View>
      {privacy === 'invite_only' && (
        <View style={[styles.badge, { backgroundColor: colors.mutedForeground + '15' }]}>
          <Feather name="lock" size={10} color={colors.mutedForeground} />
          <Text style={[styles.text, { color: colors.mutedForeground, fontSize: textSize }]}>
            Invite Only
          </Text>
        </View>
      )}
      {privacy === 'unlisted' && (
        <View style={[styles.badge, { backgroundColor: colors.mutedForeground + '15' }]}>
          <Feather name="eye-off" size={10} color={colors.mutedForeground} />
          <Text style={[styles.text, { color: colors.mutedForeground, fontSize: textSize }]}>
            Unlisted
          </Text>
        </View>
      )}
    </View>
  );
}

function getBadgeConfig(type: HuntType, colors: ReturnType<typeof useColors>) {
  switch (type) {
    case 'official':
      return { label: 'Official', icon: 'shield', color: colors.primary };
    case 'community':
      return { label: 'Community', icon: 'users', color: '#7C3AED' };
    default:
      return { label: 'Custom', icon: 'flag', color: colors.hunt };
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  text: {
    fontFamily: fontFamily.semiBold,
  },
});
