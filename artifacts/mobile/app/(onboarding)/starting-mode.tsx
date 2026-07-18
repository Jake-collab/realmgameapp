/**
 * Onboarding — Starting mode step
 *
 * The user picks which game mode to begin with.
 * Their choice sets activeMode in the Zustand store and marks onboarding complete.
 * Both modes are shown even though they're placeholder — the user is choosing
 * their default; they can always switch via the top-header mode switcher.
 */

import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/lib/store';
import { GAME_MODES } from '@/types/game.types';
import type { GameMode } from '@/types/game.types';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import { Button } from '@/components/ui/Button';

export default function OnboardingStartingModeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setActiveMode = useAppStore((s) => s.setActiveMode);
  const setHasOnboarded = useAppStore((s) => s.setHasOnboarded);
  const [selected, setSelected] = useState<GameMode>('quest');

  const topPad = Platform.OS === 'web' ? 60 : insets.top + spacing[6];
  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom + spacing[6];

  function handleStart() {
    setActiveMode(selected);
    setHasOnboarded(true);
    // NavigationGuard in _layout.tsx will redirect to (main) automatically
    router.replace(selected === 'hunt' ? '/(main)/hunt' : '/(main)/quest');
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 3 of 3</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Choose your first world
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Don't worry — you can switch between worlds any time using the mode selector at the top of the app.
        </Text>
      </View>

      {/* Mode cards */}
      <View style={styles.cards}>
        {GAME_MODES.map((mode) => {
          const isSelected = selected === mode.id;
          return (
            <Pressable
              key={mode.id}
              onPress={() => setSelected(mode.id)}
              accessibilityLabel={`${mode.title}: ${mode.tagline}`}
              accessibilityState={{ selected: isSelected }}
              accessibilityRole="radio"
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isSelected ? mode.color + '08' : colors.card,
                  borderColor: isSelected ? mode.color : colors.border,
                  borderRadius: radius.xl,
                  opacity: pressed ? 0.9 : 1,
                  ...shadows.sm,
                },
              ]}
            >
              {/* Selection indicator */}
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: isSelected ? mode.color : colors.border,
                    backgroundColor: isSelected ? mode.color : 'transparent',
                  },
                ]}
              >
                {isSelected && <Feather name="check" size={12} color="#fff" />}
              </View>

              {/* Content */}
              <View style={styles.cardContent}>
                <View
                  style={[
                    styles.modeIcon,
                    { backgroundColor: mode.color + '15', borderRadius: radius.md },
                  ]}
                >
                  <Feather
                    name={mode.icon as React.ComponentProps<typeof Feather>['name']}
                    size={28}
                    color={mode.color}
                  />
                </View>

                <View style={styles.modeText}>
                  <Text
                    style={[
                      styles.modeName,
                      {
                        color: isSelected ? mode.color : colors.foreground,
                        fontFamily: isSelected ? fontFamily.bold : fontFamily.semiBold,
                      },
                    ]}
                  >
                    {mode.title}
                  </Text>
                  <Text style={[styles.modeTagline, { color: colors.mutedForeground }]}>
                    {mode.tagline}
                  </Text>
                  <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>
                    {mode.description}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Get started */}
      <Button variant="primary" size="lg" onPress={handleStart}>
        Start with {GAME_MODES.find((m) => m.id === selected)?.title}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing[5], gap: spacing[6] },
  header: { gap: spacing[2] },
  step: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.55 },
  cards: { flex: 1, gap: spacing[4], justifyContent: 'center' },
  card: {
    padding: spacing[5],
    borderWidth: 2,
    gap: spacing[4],
  },
  radio: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4] },
  modeIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  modeText: { flex: 1, gap: spacing[1.5] },
  modeName: { fontSize: fontSize.xl },
  modeTagline: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  modeDesc: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
});
