/**
 * CurrentCluePanel — Worlds (Prompt 13)
 *
 * The visually dominant element of the Active Hunt screen.
 * Shows the current stop's authorized clue content:
 *   - Stop number (ordered hunts only)
 *   - Clue text
 *   - Clue image (authorized signed URL)
 *   - Safety note if present
 *
 * Rules:
 * - Plain text only — no arbitrary HTML
 * - Image fallback if URL fails to load
 * - Alt text required for all images
 * - Does NOT show locked clue titles or future stop content
 * - Does NOT log clue content to analytics
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { getMediaFallbackMessage } from '@/services/media/media.service';
import type { ActiveHuntStop } from '@/features/hunts/types/hunt.types';

interface CurrentCluePanelProps {
  stop: ActiveHuntStop;
  isOrdered: boolean;
  stopNumber?: number;
  totalStops?: number;
  onMediaUnavailable?: () => void;
}

export function CurrentCluePanel({
  stop,
  isOrdered,
  stopNumber,
  totalStops,
  onMediaUnavailable,
}: CurrentCluePanelProps) {
  const colors = useColors();
  const clue = stop.clue;
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!clue?.imageUrl);

  useEffect(() => {
    setImageError(false);
    setImageLoading(!!clue?.imageUrl);
  }, [clue?.imageUrl]);

  const hasText  = !!clue?.clueText;
  const hasImage = !!clue?.imageUrl && !imageError;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hunt + '40' }]}>
      {/* Card header strip */}
      <View style={[styles.strip, { backgroundColor: colors.hunt }]} />

      <View style={styles.content}>
        {/* Stop label */}
        <View style={styles.labelRow}>
          <View style={[styles.clueBadge, { backgroundColor: colors.hunt + '18' }]}>
            <Feather name="compass" size={12} color={colors.hunt} />
            <Text style={[styles.clueBadgeText, { color: colors.hunt }]}>
              {isOrdered && stopNumber != null && totalStops != null
                ? `Stop ${stopNumber} of ${totalStops}`
                : 'Current Objective'}
            </Text>
          </View>
        </View>

        {/* Stop title */}
        <Text style={[styles.stopTitle, { color: colors.foreground }]} accessibilityRole="header">
          {stop.title}
        </Text>

        {/* Clue image */}
        {hasImage && (
          <View style={styles.imageWrapper}>
            {imageLoading && (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.secondary }]}>
                <ActivityIndicator color={colors.hunt} />
              </View>
            )}
            <Image
              source={{ uri: clue!.imageUrl! }}
              style={[styles.clueImage, imageLoading && styles.hidden]}
              resizeMode="cover"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
                onMediaUnavailable?.();
              }}
              accessibilityLabel={`Clue image for stop: ${stop.title}`}
            />
          </View>
        )}

        {/* Clue text */}
        {hasText && (
          <View style={[styles.clueTextBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.clueText, { color: colors.foreground }]}>
              {clue!.clueText}
            </Text>
          </View>
        )}

        {/* Withdrawn or expired image fallback */}
        {imageError && (
          <View style={[styles.clueTextBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.clueText, { color: colors.mutedForeground }]}>
              {getMediaFallbackMessage('clue')}
            </Text>
          </View>
        )}

        {/* No clue content */}
        {!hasText && !hasImage && !imageError && clue && (
          <View style={[styles.clueTextBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.clueText, { color: colors.mutedForeground }]}>
              Head to the area shown above.
            </Text>
          </View>
        )}

        {!clue && (
          <View style={[styles.clueTextBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.clueText, { color: colors.mutedForeground }]}>
              Follow the instructions for this stop.
            </Text>
          </View>
        )}

        {/* Safety note */}
        {stop.safetyNote && (
          <View style={[styles.safetyRow, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Feather name="alert-triangle" size={14} color="#D97706" />
            <Text style={styles.safetyText}>{stop.safetyNote}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth:  1,
    overflow:     'hidden',
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  6,
    elevation:    3,
  },
  strip: {
    height: 4,
    width:  '100%',
  },
  content: {
    padding: spacing[5],
    gap:     spacing[4],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  clueBadge: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical:  spacing[1],
    borderRadius:     radius.full,
  },
  clueBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   fontSize.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stopTitle: {
    fontFamily: fontFamily.bold,
    fontSize:   fontSize['2xl'],
    lineHeight: 32,
  },
  imageWrapper: {
    borderRadius: radius.lg,
    overflow:     'hidden',
    aspectRatio:  16 / 9,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems:      'center',
    justifyContent:  'center',
  },
  clueImage: {
    width: '100%',
    height: '100%',
  },
  hidden: {
    opacity: 0,
  },
  clueTextBox: {
    borderRadius: radius.lg,
    padding:      spacing[4],
  },
  clueText: {
    fontFamily: fontFamily.medium,
    fontSize:   fontSize.base,
    lineHeight: 24,
  },
  safetyRow: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    gap:              spacing[2],
    borderRadius:     radius.md,
    borderWidth:      1,
    padding:          spacing[3],
  },
  safetyText: {
    flex:       1,
    fontFamily: fontFamily.regular,
    fontSize:   fontSize.sm,
    color:      '#92400E',
    lineHeight: 18,
  },
});
