/**
 * BadgeGrid — Wrapping grid of unlocked badges.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/constants/spacing';
import BadgeCard from './BadgeCard';
import type { UserBadge } from '@/features/progression/types/progression.types';

interface Props {
  badges: UserBadge[];
  compact?: boolean;
}

export default function BadgeGrid({ badges, compact = false }: Props) {
  return (
    <View style={styles.grid}>
      {badges.map(badge => (
        <BadgeCard key={badge.badgeId} badge={badge} compact={compact} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
});
