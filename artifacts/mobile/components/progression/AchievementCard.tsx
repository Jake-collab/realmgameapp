/**
 * AchievementCard — Rich card for an unlocked achievement.
 * Hidden achievements revealed normally once unlocked.
 * Never exposes internal rule expressions.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import AchievementIcon from './AchievementIcon';
import type { UserAchievement } from '@/features/progression/types/progression.types';

const WORLDS_PURPLE = '#7C3AED';

interface Props {
  achievement: UserAchievement;
  onPress?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function AchievementCard({ achievement, onPress }: Props) {
  const colors = useColors();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: WORLDS_PURPLE + '25',
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={`${achievement.name}: ${achievement.description}. Awarded ${formatDate(achievement.awardedAt)}`}
    >
      <AchievementIcon
        iconName={achievement.iconName}
        isHidden={achievement.isHidden}
        isUnlocked
        size="lg"
      />

      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]}>
          {achievement.name}
        </Text>
        {achievement.subtitle && (
          <Text style={[styles.subtitle, { color: WORLDS_PURPLE }]}>
            {achievement.subtitle}
          </Text>
        )}
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {achievement.description}
        </Text>

        <View style={styles.footer}>
          <View style={[styles.categoryPill, { backgroundColor: WORLDS_PURPLE + '12' }]}>
            <Text style={[styles.categoryLabel, { color: WORLDS_PURPLE }]}>
              {achievement.category.charAt(0).toUpperCase() + achievement.category.slice(1)}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(achievement.awardedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: spacing[1] },
  name: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  description: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[1] },
  categoryPill: {
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full,
  },
  categoryLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  date: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
});
