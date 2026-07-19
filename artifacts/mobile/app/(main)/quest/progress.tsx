/**
 * Quest — Progress Tab
 *
 * Polished controlled placeholder until Prompt 8 implements:
 * - Leaderboards
 * - In Action (active quest management)
 * - Completed quest history
 * - Full proof-review state organization
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import PointsBadge from '@/components/ui/PointsBadge';

export default function QuestProgressScreen() {
  const colors = useColors();
  const { profile } = useAuth();

  const totalPoints = (profile as unknown as { total_points?: number })?.total_points ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Points summary — shows real data from Prompt 3 */}
      {totalPoints > 0 && (
        <View
          style={[
            styles.pointsCard,
            { backgroundColor: colors.primary, borderRadius: radius.xl },
          ]}
        >
          <Text style={[styles.pointsLabel, { color: colors.primaryForeground + 'aa' }]}>
            Total Points
          </Text>
          <Text style={[styles.pointsValue, { color: colors.primaryForeground }]}>
            {totalPoints.toLocaleString()}
          </Text>
          <Text style={[styles.pointsNote, { color: colors.primaryForeground + 'aa' }]}>
            Points are awarded after quest completion and proof approval.
          </Text>
        </View>
      )}

      {/* Coming in Prompt 8 */}
      <View
        style={[
          styles.comingSoon,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: colors.primary + '15' }]}>
          <Feather name="bar-chart-2" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Progress Coming Soon
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          The full Progress experience — including leaderboards, active quest
          management, and completed quest history — will be available in the
          next update.
        </Text>

        <View style={[styles.featureList, { borderTopColor: colors.border }]}>
          {[
            { icon: 'award'        as const, text: 'Leaderboards and rankings' },
            { icon: 'play-circle'  as const, text: 'Active quest overview' },
            { icon: 'check-circle' as const, text: 'Completed quest history' },
            { icon: 'clock'        as const, text: 'Proof review status' },
          ].map(f => (
            <View key={f.text} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: colors.muted }]}>
                <Feather name={f.icon} size={15} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.mutedForeground }]}>
                {f.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[5],
    gap: spacing[5],
  },
  pointsCard: {
    padding: spacing[6],
    gap: spacing[1],
    alignItems: 'center',
  },
  pointsLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pointsValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['4xl'],
  },
  pointsNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing[1],
  },
  comingSoon: {
    padding: spacing[6],
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    alignItems: 'center',
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
    textAlign: 'center',
  },
  featureList: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[4],
    gap: spacing[3],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    flex: 1,
  },
});
