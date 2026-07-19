/**
 * MapDisconnectedState — Worlds
 *
 * Shown when Mapbox is not configured or the native module is unavailable.
 *
 * Rules:
 * - In development: shows the pending-setup message with instructions.
 * - In production: shows a generic "Map unavailable" state — no dev instructions.
 * - Browsing via the Quests list tab is always offered as a fallback.
 * - This component must never crash when Mapbox itself is absent.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { DEV_MAP_UNAVAILABLE_MESSAGE } from '../config/mapConfig';

interface MapDisconnectedStateProps {
  reason: 'token_missing' | 'module_unavailable' | 'error';
}

export function MapDisconnectedState({ reason }: MapDisconnectedStateProps) {
  const colors = useColors();
  const router = useRouter();

  const isDev = __DEV__;
  const isModuleIssue = reason === 'module_unavailable';

  const heading = 'Map Unavailable';
  const body = isDev
    ? DEV_MAP_UNAVAILABLE_MESSAGE +
      (isModuleIssue
        ? '\n\nA development build (npx expo run:ios / run:android) is required to load the Mapbox native module.'
        : '\n\nAdd EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file.')
    : 'The map is temporarily unavailable. You can still browse Geo-Quests as a list.';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
      </View>

      <Text style={[styles.heading, { color: colors.foreground }]}>{heading}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>

      {/* Fallback: browse as list */}
      <TouchableOpacity
        onPress={() => router.push('/quest/quests')}
        style={[styles.button, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel="Browse Geo-Quests as a list"
      >
        <Feather name="list" size={16} color={colors.primary} />
        <Text style={[styles.buttonText, { color: colors.primary }]}>Browse Geo-Quests as a list</Text>
        <Feather name="chevron-right" size={14} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[4],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
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
    maxWidth: 320,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing[2],
  },
  buttonText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    flex: 1,
  },
});
