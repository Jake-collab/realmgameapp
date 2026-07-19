/**
 * SearchThisAreaButton — Worlds
 *
 * Compact floating button that appears when the user moves the map
 * meaningfully away from the currently loaded area.
 *
 * Rules:
 * - Shown only when the viewport has changed enough to warrant a new query.
 * - Hidden when Mapbox is disconnected, offline, or current area is already loaded.
 * - Does not fire automatically — requires deliberate user tap.
 * - Shows a non-blocking loading state while the query runs.
 */

import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';

interface SearchThisAreaButtonProps {
  visible: boolean;
  isLoading: boolean;
  onPress: () => void;
}

function SearchThisAreaButtonComponent({
  visible,
  isLoading,
  onPress,
}: SearchThisAreaButtonProps) {
  const colors = useColors();

  if (!visible) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      style={[
        styles.button,
        { backgroundColor: colors.card, borderColor: colors.border },
        isLoading && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Search this area for Geo-Quests"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Feather name="search" size={14} color={colors.primary} />
      )}
      <Text style={[styles.label, { color: colors.primary }]}>
        {isLoading ? 'Searching…' : 'Search this area'}
      </Text>
    </TouchableOpacity>
  );
}

export const SearchThisAreaButton = memo(SearchThisAreaButtonComponent);

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
