/**
 * BadgeCard — A single unlocked badge tile.
 * Pinned badge highlighted. No gameplay effect.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { UserBadge } from '@/features/progression/types/progression.types';

const WORLDS_PURPLE = '#7C3AED';

interface Props {
  badge: UserBadge;
  compact?: boolean;
}

export default function BadgeCard({ badge, compact = false }: Props) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        {
          backgroundColor: badge.isPinned ? WORLDS_PURPLE + '10' : colors.card,
          borderColor: badge.isPinned ? WORLDS_PURPLE + '35' : colors.border,
        },
      ]}
      accessible
      accessibilityLabel={`${badge.name}: ${badge.description}${badge.isPinned ? ', pinned' : ''}`}
    >
      <View style={[styles.iconBox, { backgroundColor: WORLDS_PURPLE + '15' }]}>
        <Feather name={badge.iconName as any} size={compact ? 18 : 22} color={WORLDS_PURPLE} />
      </View>
      {!compact && (
        <>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {badge.name}
          </Text>
          {badge.isPinned && (
            <View style={[styles.pinnedPill, { backgroundColor: WORLDS_PURPLE + '18' }]}>
              <Feather name="bookmark" size={10} color={WORLDS_PURPLE} />
              <Text style={[styles.pinnedText, { color: WORLDS_PURPLE }]}>Pinned</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center', padding: spacing[3], borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, gap: spacing[1], minWidth: 80,
  },
  cardCompact: { padding: spacing[2] },
  iconBox: {
    width: 40, height: 40, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textAlign: 'center' },
  pinnedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing[1], paddingVertical: 2, borderRadius: radius.full,
  },
  pinnedText: { fontFamily: fontFamily.medium, fontSize: 10 },
});
