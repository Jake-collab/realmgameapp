/**
 * Onboarding — Interests step
 *
 * The user selects interest tags to personalize their Worlds experience.
 * Uses the InterestBubble component from the design system.
 * Skippable — interests can be updated from Profile later.
 */

import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import InterestBubble from '@/components/ui/InterestBubble';

const INTEREST_CATEGORIES = [
  {
    label: 'Outdoors & Nature',
    items: ['Hiking', 'Parks', 'Wildlife', 'Beaches', 'Mountains'],
  },
  {
    label: 'History & Culture',
    items: ['Museums', 'Architecture', 'Heritage', 'Art', 'Local History'],
  },
  {
    label: 'Food & Discovery',
    items: ['Food Trails', 'Local Markets', 'Coffee Spots', 'Hidden Gems'],
  },
  {
    label: 'Activity & Sport',
    items: ['Running', 'Cycling', 'Urban Exploring', 'Photography'],
  },
  {
    label: 'Social',
    items: ['Team Play', 'Meetups', 'Competitions', 'Family-Friendly'],
  },
];

export default function OnboardingInterestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const topPad = Platform.OS === 'web' ? 48 : insets.top + spacing[4];
  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + spacing[6];

  function toggleInterest(item: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  }

  function handleContinue() {
    // TODO (Build 4/6): Save selected interests to user profile via profilesService
    router.push('/(onboarding)/location');
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.step, { color: colors.mutedForeground }]}>
            Step 1 of 3
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            What interests you?
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We'll tailor your quest and hunt recommendations. Choose as many as you like.
          </Text>
        </View>

        {/* Interest groups */}
        {INTEREST_CATEGORIES.map((cat) => (
          <View key={cat.label} style={styles.category}>
            <Text style={[styles.categoryLabel, { color: colors.mutedForeground }]}>
              {cat.label}
            </Text>
            <View style={styles.bubbles}>
              {cat.items.map((item) => (
                <InterestBubble
                  key={item}
                  label={item}
                  selected={selected.has(item)}
                  onPress={() => toggleInterest(item)}
                  color={colors.primary}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          { borderTopColor: colors.border, paddingBottom: bottomPad },
        ]}
      >
        <Button variant="ghost" size="md" onPress={handleContinue}>
          Skip for now
        </Button>
        <Button
          variant="primary"
          size="lg"
          onPress={handleContinue}
          style={{ flex: 1 }}
        >
          {selected.size > 0 ? `Continue (${selected.size})` : 'Continue'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  header: { gap: spacing[2] },
  step: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: fontSize.base * 1.5 },
  category: { gap: spacing[3] },
  categoryLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
