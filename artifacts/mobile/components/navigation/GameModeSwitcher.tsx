/**
 * GameModeSwitcher
 *
 * Compact top-header control displaying the currently active game mode.
 * Tapping opens a bottom sheet with all available modes.
 * Selecting a mode calls router.replace() to the new mode's tab navigator.
 *
 * Used in:
 *   app/(main)/quest/_layout.tsx  — headerLeft
 *   app/(main)/hunt/_layout.tsx   — headerLeft
 *
 * Layout (header):
 *   [ Quest ▼ ]          [Bell]
 *
 * Sheet (when open):
 *   ╭──────────────────────╮
 *   │  Choose a World      │
 *   │  ✓ Quest             │
 *   │    Hunt              │
 *   ╰──────────────────────╯
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import { GAME_MODES } from '@/types/game.types';
import { useAppStore } from '@/lib/store';
import type { GameMode } from '@/types/game.types';

interface Props {
  currentMode: GameMode;
}

export default function GameModeSwitcher({ currentMode }: Props) {
  const colors = useColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const setActiveMode = useAppStore((s) => s.setActiveMode);

  const currentConfig = GAME_MODES.find((m) => m.id === currentMode);
  const tint = currentConfig?.color ?? colors.primary;

  function handleSelect(mode: GameMode) {
    setOpen(false);
    if (mode === currentMode) return;
    setActiveMode(mode);
    // Replace so the user doesn't accumulate stack entries on every switch
    router.replace(mode === 'hunt' ? '/(main)/hunt' : '/(main)/quest');
  }

  return (
    <>
      {/* Compact header button */}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel={`Current mode: ${currentConfig?.title ?? currentMode}. Tap to switch.`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: tint + '12',
            borderColor: tint + '30',
            borderRadius: radius.full,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Feather
          name={currentConfig?.icon as React.ComponentProps<typeof Feather>['name'] ?? 'globe'}
          size={15}
          color={tint}
        />
        <Text style={[styles.triggerLabel, { color: tint }]}>
          {currentConfig?.title ?? currentMode}
        </Text>
        <Feather name="chevron-down" size={14} color={tint} />
      </Pressable>

      {/* Mode selection sheet */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius.xl,
                ...shadows.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                Choose a World
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Mode list */}
            <View style={styles.modeList}>
              {GAME_MODES.map((mode) => {
                const isActive = mode.id === currentMode;
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => handleSelect(mode.id)}
                    accessibilityLabel={`${mode.title} — ${mode.tagline}`}
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      styles.modeRow,
                      {
                        backgroundColor: isActive
                          ? mode.color + '10'
                          : pressed
                            ? colors.muted
                            : 'transparent',
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    {/* Icon */}
                    <View
                      style={[
                        styles.modeIcon,
                        {
                          backgroundColor: mode.color + '15',
                          borderRadius: radius.sm,
                        },
                      ]}
                    >
                      <Feather
                        name={mode.icon as React.ComponentProps<typeof Feather>['name']}
                        size={18}
                        color={mode.color}
                      />
                    </View>

                    {/* Text */}
                    <View style={styles.modeText}>
                      <Text
                        style={[
                          styles.modeName,
                          {
                            color: isActive ? mode.color : colors.foreground,
                            fontFamily: isActive
                              ? fontFamily.semiBold
                              : fontFamily.medium,
                          },
                        ]}
                      >
                        {mode.title}
                      </Text>
                      <Text
                        style={[styles.modeTagline, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {mode.tagline}
                      </Text>
                    </View>

                    {/* Checkmark */}
                    {isActive && (
                      <Feather name="check" size={18} color={mode.color} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Future modes hint */}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              More worlds coming soon
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Header trigger
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    marginLeft: spacing[2],
  },
  triggerLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    padding: spacing[5],
    gap: spacing[4],
    borderWidth: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  modeList: {
    gap: spacing[1],
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
  },
  modeIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    flex: 1,
    gap: 2,
  },
  modeName: {
    fontSize: fontSize.base,
  },
  modeTagline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
