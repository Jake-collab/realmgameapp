/**
 * LocationSummary
 *
 * Shows public location info for a quest.
 * Never exposes validation geometry or precise coordinates.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { spacing } from '@/constants/spacing';
import type { QuestPublicLocation } from '@/features/quests/types/quest.types';

interface Props {
  location: QuestPublicLocation | null | undefined;
  /** Approximate distance in meters from user (only if confirmed available) */
  distanceMeters?: number | null;
  compact?: boolean;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `~${Math.round(meters / 10) * 10} m away`;
  const km = meters / 1000;
  return `~${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

export default function LocationSummary({ location, distanceMeters, compact = false }: Props) {
  const colors = useColors();

  if (!location) return null;

  const displayName = location.display_name;
  const hint = location.address_hint;

  return (
    <View style={styles.container} accessibilityLabel={`Location: ${displayName}`}>
      <Feather name="map-pin" size={compact ? 13 : 15} color={colors.accent} />
      <View style={styles.text}>
        <Text
          style={[
            styles.name,
            {
              color: colors.foreground,
              fontFamily: fontFamily.medium,
              fontSize: compact ? fontSize.sm : fontSize.base,
            },
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {!compact && hint && (
          <Text
            style={[styles.hint, { color: colors.mutedForeground, fontFamily: fontFamily.regular }]}
            numberOfLines={2}
          >
            {hint}
          </Text>
        )}
        {distanceMeters != null && (
          <Text
            style={[styles.distance, { color: colors.accent, fontFamily: fontFamily.medium }]}
          >
            {formatDistance(distanceMeters)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  text: {
    flex: 1,
    gap: spacing[0.5],
  },
  name: {},
  hint: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  distance: {
    fontSize: fontSize.sm,
  },
});
