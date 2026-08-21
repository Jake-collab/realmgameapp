/**
 * PublicProgressionPreview — title, badges, achievement count on a public profile.
 * Respects visibility flags from the public profile.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { SOCIAL_PURPLE } from '@/features/social/constants/social.constants';
import type { PublicProfile } from '@/features/social/types/social.types';

interface PublicProgressionPreviewProps {
  profile: PublicProfile;
  activeTitleName?: string | null;
  achievementsCount?: number;
}

export function PublicProgressionPreview({ profile, activeTitleName, achievementsCount }: PublicProgressionPreviewProps) {
  const colors = useColors();
  const hasAnyProgression = profile.showActiveTitle || profile.showBadges || profile.showAchievements;
  if (!hasAnyProgression) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Progression</Text>

      {profile.showActiveTitle && activeTitleName && (
        <View style={[styles.titleRow, { backgroundColor: SOCIAL_PURPLE + '12' }]}>
          <Feather name="tag" size={13} color={SOCIAL_PURPLE} />
          <Text style={[styles.titleName, { color: SOCIAL_PURPLE }]}>{activeTitleName}</Text>
        </View>
      )}

      {profile.showAchievements && achievementsCount !== undefined && (
        <View style={styles.statRow}>
          <Feather name="award" size={14} color={colors.mutedForeground} />
          <Text style={[styles.statText, { color: colors.foreground }]}>
            {achievementsCount} {achievementsCount === 1 ? 'Achievement' : 'Achievements'}
          </Text>
        </View>
      )}

      {!profile.showActiveTitle && !profile.showAchievements && (
        <Text style={[styles.hidden, { color: colors.mutedForeground }]}>
          This user keeps their progression private.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  sectionLabel: {
    fontFamily: fontFamily.medium, fontSize: fontSize.xs,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  titleName: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  statText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  hidden: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, fontStyle: 'italic' },
});
