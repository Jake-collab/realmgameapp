/**
 * Achievement Detail Screen — Worlds (Prompt 15)
 *
 * Full detail view for a single unlocked achievement.
 * Shows: artwork, name, description, category, award date, requirement summary.
 * Never exposes internal rule expressions.
 * Hidden achievements are revealed normally once unlocked.
 *
 * Route: /achievement-detail/:achievementId
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAchievements } from '@/features/progression/hooks/useAchievements';
import AchievementIcon from '@/components/progression/AchievementIcon';
import ProgressionEmptyState from '@/components/progression/ProgressionEmptyState';
import { ACHIEVEMENT_CATEGORY_LABELS } from '@/features/progression/types/progression.types';

const WORLDS_PURPLE = '#7C3AED';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function triggerLabel(event: string | null): string | null {
  if (!event) return null;
  switch (event) {
    case 'quest_completed':     return 'Triggered by completing a Quest';
    case 'hunt_completed':      return 'Triggered by completing a Hunt';
    case 'point_milestone':     return 'Triggered by reaching a point milestone';
    case 'combined_milestone':  return 'Triggered by a combined milestone';
    case 'manual_award':        return 'Manually awarded';
    case 'admin_action':        return 'Awarded by an administrator';
    case 'account_age':         return 'Triggered by account age milestone';
    default:                    return null;
  }
}

export default function AchievementDetailScreen() {
  const colors = useColors();
  const { achievementId } = useLocalSearchParams<{ achievementId: string }>();

  // Find achievement in any-category query
  const { data: all, isLoading, isError, refetch } = useAchievements();
  const achievement = all?.find(a => a.achievementId === achievementId) ?? null;

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/profile-achievements');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          Achievement
        </Text>
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <Feather name="loader" size={24} color={colors.mutedForeground} />
        </View>
      )}

      {!isLoading && (isError || !achievement) && (
        <ProgressionEmptyState
          icon="award"
          title="Achievement Not Found"
          body="This achievement could not be found or is not yet unlocked."
          actionLabel="Back to Achievements"
          onAction={() => router.replace('/profile-achievements')}
        />
      )}

      {!isLoading && achievement && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: WORLDS_PURPLE + '10', borderColor: WORLDS_PURPLE + '25' }]}>
            <AchievementIcon
              iconName={achievement.iconName}
              isHidden={achievement.isHidden}
              isUnlocked
              size="lg"
            />
            <Text style={[styles.heroName, { color: colors.foreground }]}>{achievement.name}</Text>
            {achievement.subtitle && (
              <Text style={[styles.heroSubtitle, { color: WORLDS_PURPLE }]}>{achievement.subtitle}</Text>
            )}
            <View style={[styles.categoryPill, { backgroundColor: WORLDS_PURPLE + '15' }]}>
              <Text style={[styles.categoryLabel, { color: WORLDS_PURPLE }]}>
                {ACHIEVEMENT_CATEGORY_LABELS[achievement.category]}
              </Text>
            </View>
          </View>

          {/* Description */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              {achievement.description}
            </Text>
          </View>

          {/* Requirement summary */}
          {achievement.requirementSummary && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Requirement</Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                {achievement.requirementSummary}
              </Text>
            </View>
          )}

          {/* Award details */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Award Details</Text>

            <View style={styles.detailRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>
                Awarded {formatDate(achievement.awardedAt)}
              </Text>
            </View>

            {achievement.awardedBy !== 'engine' && (
              <View style={styles.detailRow}>
                <Feather name="user" size={14} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.foreground }]}>
                  {achievement.awardedBy === 'admin' ? 'Awarded by an administrator' : 'Awarded by the system'}
                </Text>
              </View>
            )}

            {achievement.triggerEvent && triggerLabel(achievement.triggerEvent) && (
              <View style={styles.detailRow}>
                <Feather name="zap" size={14} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.foreground }]}>
                  {triggerLabel(achievement.triggerEvent)}
                </Text>
              </View>
            )}

            {achievement.isManual && (
              <View style={styles.detailRow}>
                <Feather name="shield" size={14} color={WORLDS_PURPLE} />
                <Text style={[styles.detailText, { color: WORLDS_PURPLE }]}>
                  Special recognition
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: spacing[1] },
  headerTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
  hero: {
    alignItems: 'center', gap: spacing[3],
    padding: spacing[6], borderRadius: radius.xl, borderWidth: 1,
  },
  heroName: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center' },
  heroSubtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  categoryPill: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full,
  },
  categoryLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  section: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4], gap: spacing[3],
  },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  detailText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, flex: 1 },
});
