/**
 * MapPermissionState — Worlds
 *
 * Handles location permission UI states for the map.
 * NOT a blocking gate — the map remains browsable without permission.
 * This component renders inline permission prompts or banners only.
 *
 * Rules:
 * - Do not show alarming error states for a normal denial.
 * - Do not repeatedly request permission after denial.
 * - "Open Settings" is shown only for blocked/restricted states.
 * - Explanation is shown before requesting, never after.
 */

import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { LocationPermissionStatus } from '../hooks/useLocationPermission';

interface MapPermissionBannerProps {
  status: LocationPermissionStatus;
  onRequestPermission: () => void;
}

/**
 * Compact inline banner shown at the top or bottom of the map.
 * Shows nothing for 'loading' and 'granted' states.
 */
export function MapPermissionBanner({
  status,
  onRequestPermission,
}: MapPermissionBannerProps) {
  const colors = useColors();

  if (status === 'loading' || status === 'granted') return null;

  const config = getBannerConfig(status);
  if (!config) return null;

  const handleAction = () => {
    if (config.action === 'request') {
      onRequestPermission();
    } else if (config.action === 'settings') {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Feather name="map-pin" size={14} color={colors.mutedForeground} />
      <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
        {config.message}
      </Text>
      {config.actionLabel ? (
        <TouchableOpacity
          onPress={handleAction}
          accessibilityRole="button"
          accessibilityLabel={config.actionLabel}
          style={[styles.bannerAction, { borderColor: colors.border }]}
        >
          <Text style={[styles.bannerActionText, { color: colors.primary }]}>
            {config.actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Full-page permission explanation (shown before first request) ─────────────

interface LocationPermissionExplainerProps {
  onAllow: () => void;
  onSkip: () => void;
}

export function LocationPermissionExplainer({
  onAllow,
  onSkip,
}: LocationPermissionExplainerProps) {
  const colors = useColors();

  return (
    <View style={[styles.explainer, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="navigation" size={28} color={colors.accent} />
      </View>
      <Text style={[styles.explainerHeading, { color: colors.foreground }]}>
        Enable Location for Nearby Quests
      </Text>
      <Text style={[styles.explainerBody, { color: colors.mutedForeground }]}>
        Worlds uses your location to show nearby Geo-Quests and verify
        you are at the right place when completing location-based steps.
        {'\n\n'}
        Your location is only used while the app is open and is never
        stored from ordinary map browsing.
        {'\n\n'}
        You can browse Geo-Quests by map area without sharing your location.
      </Text>
      <TouchableOpacity
        onPress={onAllow}
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
          Allow Location Access
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onSkip}
        accessibilityRole="button"
      >
        <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
          Not now — I'll browse manually
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface BannerConfig {
  message: string;
  actionLabel: string | null;
  action: 'request' | 'settings' | null;
}

function getBannerConfig(status: LocationPermissionStatus): BannerConfig | null {
  switch (status) {
    case 'not_determined':
      return {
        message: 'Enable location to discover nearby Quests.',
        actionLabel: 'Enable Location',
        action: 'request',
      };
    case 'denied':
      return {
        message: 'Location access helps you find nearby Quests.',
        actionLabel: 'Enable Location',
        action: 'request',
      };
    case 'blocked':
    case 'restricted':
      return {
        message: 'Location is blocked. Open Settings to enable nearby discovery.',
        actionLabel: 'Open Settings',
        action: 'settings',
      };
    case 'reduced_accuracy':
      return {
        message: 'Precise location is needed for Quest validation.',
        actionLabel: 'Improve Accuracy',
        action: 'settings',
      };
    case 'unavailable':
      return {
        message: 'Location services unavailable on this device.',
        actionLabel: null,
        action: null,
      };
    default:
      return null;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.5,
  },
  bannerAction: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing[2],
  },
  bannerActionText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  explainer: {
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
  explainerHeading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  explainerBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
    textAlign: 'center',
    maxWidth: 320,
  },
  primaryButton: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.lg,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  primaryButtonText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
  skipText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
