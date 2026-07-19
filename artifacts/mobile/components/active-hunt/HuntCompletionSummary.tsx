/**
 * HuntCompletionSummary — Worlds (Prompt 13)
 *
 * Polished hunt completion confirmation screen content.
 * Shown on the /hunt-completion/[participationId] screen.
 *
 * Rules:
 * - Points shown only after confirmed server completion
 * - No unconfirmed reward shown
 * - No social share required
 * - Restrained motion
 * - Routes for Prompt 14 readiness
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import PointsBadge from '@/components/ui/PointsBadge';
import type { HuntCompletionResult } from '@/features/hunts/types/hunt.types';

interface HuntCompletionSummaryProps {
  result:        HuntCompletionResult;
  huntTitle:     string;
  requiredCompleted: number;
  optionalCompleted: number;
  totalRequired: number;
  participationId: string;
}

export function HuntCompletionSummary({
  result,
  huntTitle,
  requiredCompleted,
  optionalCompleted,
  totalRequired,
  participationId,
}: HuntCompletionSummaryProps) {
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1, friction: 7, tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const completedAt = result.completedAt
    ? new Date(result.completedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: colors.hunt + '18' }]}>
          <Feather name="award" size={48} color={colors.hunt} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]}>Hunt Completed!</Text>
        <Text style={[styles.huntTitle, { color: colors.mutedForeground }]}>{huntTitle}</Text>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StatRow
            icon="flag"
            label="Required Stops"
            value={`${requiredCompleted} / ${totalRequired}`}
            colors={colors}
          />
          {optionalCompleted > 0 && (
            <StatRow
              icon="star"
              label="Optional Stops"
              value={`${optionalCompleted}`}
              colors={colors}
            />
          )}
          {completedAt && (
            <StatRow
              icon="calendar"
              label="Completed"
              value={completedAt}
              colors={colors}
            />
          )}
          {result.awardedPoints != null && result.awardedPoints > 0 && (
            <View style={styles.pointsRow}>
              <View style={styles.pointsLabel}>
                <Feather name="zap" size={14} color={colors.mutedForeground} />
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Points Earned</Text>
              </View>
              <PointsBadge value={result.awardedPoints} size="lg" />
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.replace('/(main)/hunt/my-hunts')}
            style={[styles.btn, styles.primaryBtn, { backgroundColor: colors.hunt }]}
            accessibilityLabel="View My Hunts"
          >
            <Text style={styles.primaryBtnText}>View My Hunts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(main)/hunt')}
            style={[styles.btn, styles.ghostBtn, { borderColor: colors.border }]}
            accessibilityLabel="Explore more hunts"
          >
            <Text style={[styles.ghostBtnText, { color: colors.foreground }]}>Explore More Hunts</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function StatRow({ icon, label, value, colors }: {
  icon: string; label: string; value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLabelWrap}>
        <Feather name={icon as any} size={14} color={colors.mutedForeground} />
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  content: { width: '100%', maxWidth: 380, alignItems: 'center', gap: spacing[5] },
  iconWrap: {
    width: 96, height: 96, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  title:     { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'], textAlign: 'center' },
  huntTitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, textAlign: 'center' },
  statsCard: { borderRadius: radius.xl, borderWidth: 1, padding: spacing[5], gap: spacing[4], width: '100%' },
  statRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  statLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  statValue: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pointsLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  actions:   { width: '100%', gap: spacing[3] },
  btn:       { paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: 'center' },
  primaryBtn: {},
  primaryBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base, color: '#fff' },
  ghostBtn: { borderWidth: 1 },
  ghostBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
});
