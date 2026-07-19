/**
 * LocationValidationPanel — Worlds (Prompt 13)
 *
 * Inline panel for the location-check flow.
 * Explains why location is needed, shows acquisition status, and result.
 *
 * Rules:
 * - Only shown when user taps "Check Location" (never on load)
 * - No geofence radius or coordinates shown to user
 * - Safe messages for all failure states
 * - "Open Settings" provided for permission-denied state
 */

import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import type { LocationValidationResult, LocationValidationOutcome } from '@/features/active-hunt/types/activeHunt.types';

interface LocationValidationPanelProps {
  result:       LocationValidationResult;
  isAcquiring:  boolean;
  onRetry:      () => void;
  onOpenSettings: () => void;
  onDismiss:    () => void;
}

const OUTCOME_CONFIG: Record<LocationValidationOutcome, {
  icon: string;
  iconColor: string;
  bg: string;
  border: string;
  showRetry: boolean;
  showSettings: boolean;
}> = {
  not_started:   { icon: 'map-pin',      iconColor: '#6B7280', bg: 'transparent', border: 'transparent', showRetry: false, showSettings: false },
  acquiring:     { icon: 'loader',        iconColor: '#6B7280', bg: '#F3F4F6',     border: '#E5E7EB',     showRetry: false, showSettings: false },
  validated:     { icon: 'check-circle',  iconColor: '#10B981', bg: '#D1FAE5',     border: '#A7F3D0',     showRetry: false, showSettings: false },
  outside_area:  { icon: 'map-pin',       iconColor: '#F59E0B', bg: '#FEF3C7',     border: '#FDE68A',     showRetry: true,  showSettings: false },
  poor_accuracy: { icon: 'wifi-off',      iconColor: '#F59E0B', bg: '#FEF3C7',     border: '#FDE68A',     showRetry: true,  showSettings: false },
  permission_denied: { icon: 'lock',      iconColor: '#EF4444', bg: '#FEE2E2',     border: '#FECACA',     showRetry: false, showSettings: true },
  timeout:       { icon: 'clock',         iconColor: '#F59E0B', bg: '#FEF3C7',     border: '#FDE68A',     showRetry: true,  showSettings: false },
  rate_limited:  { icon: 'alert-circle',  iconColor: '#F59E0B', bg: '#FEF3C7',     border: '#FDE68A',     showRetry: false, showSettings: false },
  server_error:  { icon: 'alert-circle',  iconColor: '#EF4444', bg: '#FEE2E2',     border: '#FECACA',     showRetry: true,  showSettings: false },
  stop_unavailable: { icon: 'x-circle',   iconColor: '#EF4444', bg: '#FEE2E2',     border: '#FECACA',     showRetry: false, showSettings: false },
  hunt_expired:  { icon: 'clock',         iconColor: '#EF4444', bg: '#FEE2E2',     border: '#FECACA',     showRetry: false, showSettings: false },
};

export function LocationValidationPanel({
  result,
  isAcquiring,
  onRetry,
  onOpenSettings,
  onDismiss,
}: LocationValidationPanelProps) {
  const colors = useColors();

  if (result.outcome === 'not_started') return null;

  const config = OUTCOME_CONFIG[result.outcome] ?? OUTCOME_CONFIG.server_error;
  const isDark = false; // future: detect dark mode

  const bg     = config.bg     === 'transparent' ? colors.card     : config.bg;
  const border = config.border === 'transparent' ? colors.border   : config.border;

  return (
    <View style={[styles.panel, { backgroundColor: bg, borderColor: border }]}>
      {/* Icon + message */}
      <View style={styles.topRow}>
        {isAcquiring ? (
          <ActivityIndicator size="small" color={colors.hunt} />
        ) : (
          <Feather name={config.icon as any} size={20} color={config.iconColor} />
        )}
        <Text style={[styles.message, { color: colors.foreground }]}>
          {isAcquiring ? 'Acquiring your location…' : result.userMessage}
        </Text>
        {!isAcquiring && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} accessibilityLabel="Dismiss">
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Accuracy note (shown during acquisition) */}
      {isAcquiring && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          For best results, stand in an open area away from buildings.
        </Text>
      )}

      {/* Actions */}
      {!isAcquiring && (config.showRetry || config.showSettings) && (
        <View style={styles.actions}>
          {config.showSettings && (
            <TouchableOpacity
              onPress={onOpenSettings}
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              accessibilityLabel="Open Settings to enable location"
            >
              <Feather name="settings" size={14} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Open Settings</Text>
            </TouchableOpacity>
          )}
          {config.showRetry && (
            <TouchableOpacity
              onPress={onRetry}
              style={[styles.actionBtn, { backgroundColor: colors.hunt, borderColor: colors.hunt }]}
              accessibilityLabel="Try location check again"
            >
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={[styles.actionText, { color: '#fff' }]}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.lg,
    borderWidth:  1,
    padding:      spacing[4],
    gap:          spacing[3],
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
  },
  message: {
    flex:       1,
    fontFamily: fontFamily.medium,
    fontSize:   fontSize.sm,
    lineHeight: 20,
  },
  dismissBtn: {
    padding: spacing[1],
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize:   fontSize.xs,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing[2],
    flexWrap:      'wrap',
  },
  actionBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing[1],
    paddingVertical:  spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius:     radius.md,
    borderWidth:      1,
  },
  actionText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   fontSize.xs,
  },
});
