/**
 * Active Hunt Screen — Worlds
 *
 * Controlled placeholder for the Active Hunt gameplay experience.
 * Full implementation in Prompt 13.
 *
 * This screen:
 * - Routes here from: Continue Hunt, Start Hunt (after successful start)
 * - Shows current participation state safely (no locked clues, no private geometry)
 * - Provides a "Return to My Hunts" escape hatch
 * - Does NOT fake clues or progress
 * - Does NOT expose locked content
 * - Does NOT award points
 *
 * When Prompt 13 is implemented, this file will be replaced with the full
 * stop-by-stop gameplay experience.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';

export default function HuntActiveScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Back */}
      <TouchableOpacity
        onPress={() => router.replace('/(main)/hunt/my-hunts')}
        style={[styles.backButton, { backgroundColor: colors.card }]}
        accessibilityLabel="Return to My Hunts"
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.badge, { backgroundColor: colors.hunt + '18' }]}>
          <Feather name="flag" size={20} color={colors.hunt} />
          <Text style={[styles.badgeText, { color: colors.hunt }]}>Hunt Active</Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          Active Hunt Experience
        </Text>

        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          The full stop-by-stop hunt gameplay — clues, location validation, proof submission, and completion — will be available in Prompt 13.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Your progress is safely tracked. No clue content is shown here.
            {'\n'}Participation ID: {participationId?.slice(0, 8) ?? '—'}
          </Text>
        </View>

        <Button
          variant="primary"
          size="lg"
          onPress={() => router.replace('/(main)/hunt/my-hunts')}
          style={styles.btn}
        >
          Return to My Hunts
        </Button>

        <Button
          variant="outline"
          size="md"
          onPress={() => router.replace('/(main)/hunt')}
          style={styles.btn}
        >
          Explore Hunt Map
        </Button>
      </View>
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backButton: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 16, left: spacing[4],
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing[8], gap: spacing[5],
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    borderRadius: radius.full,
  },
  badgeText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center' },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: 24, textAlign: 'center' },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    borderRadius: radius.md, borderWidth: 1, padding: spacing[3], width: '100%',
  },
  infoText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, flex: 1, lineHeight: 20 },
  btn: { width: '100%' },
});
