/**
 * HuntPreviewSheet
 *
 * Bottom sheet displayed when a hunt marker is tapped on the map.
 * Shows essential hunt info and one primary action.
 *
 * Full implementation in Build 6 — Hunt Core (requires Mapbox + react-native-bottom-sheet).
 * This file stubs the data contract and visual layout so the design system
 * is established before feature work begins.
 *
 * Snap points: ['45%'] by default.
 * Coordinate with the map's padding to avoid overlapping controls.
 *
 * Usage (in the Hunt map screen):
 *   <HuntPreviewSheet
 *     hunt={selectedHunt}
 *     onJoin={() => joinHunt(selectedHunt.id)}
 *     onDismiss={() => setSelectedHunt(null)}
 *   />
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import PointsBadge from '@/components/ui/PointsBadge';
import { Button } from '@/components/ui/Button';

// ─── Data shape ───────────────────────────────────────────────────────────────

export interface HuntPreviewData {
  id: string;
  title: string;
  /** 'official' = Worlds-curated; 'custom' = user-created */
  type: 'official' | 'custom' | 'community';
  distanceMeters: number;
  estimatedMinutes: number;
  points: number;
  accessState: 'open' | 'invite-only' | 'in-progress' | 'completed';
  /** Optional cover image URI */
  imageUri?: string;
  participantCount?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  hunt: HuntPreviewData | null;
  onJoin: () => void;
  onDismiss: () => void;
}

export default function HuntPreviewSheet({ hunt, onJoin, onDismiss }: Props) {
  const colors = useColors();

  if (!hunt) return null;

  const typeColor =
    hunt.type === 'official' ? colors.primary : colors.hunt;
  const typeLabel =
    hunt.type === 'official'
      ? 'Official Hunt'
      : hunt.type === 'community'
        ? 'Community Hunt'
        : 'Custom Game';

  const distanceLabel =
    hunt.distanceMeters < 1000
      ? `${Math.round(hunt.distanceMeters)}m away`
      : `${(hunt.distanceMeters / 1000).toFixed(1)}km away`;

  const primaryLabel =
    hunt.accessState === 'open'
      ? 'Join Hunt'
      : hunt.accessState === 'invite-only'
        ? 'View Invite'
        : hunt.accessState === 'in-progress'
          ? 'Rejoin'
          : 'View Results';

  // TODO (Build 6): Replace Modal with react-native-bottom-sheet
  // for native gesture-driven sheet behaviour.
  return (
    <Modal
      visible={!!hunt}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              ...shadows.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Type badge */}
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '15' }]}>
            <Feather name="flag" size={11} color={typeColor} />
            <Text style={[styles.typeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {hunt.title}
          </Text>

          {/* Meta row */}
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {distanceLabel}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                ~{hunt.estimatedMinutes} min
              </Text>
            </View>
            {hunt.participantCount !== undefined && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Feather name="users" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {hunt.participantCount}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Points + action */}
          <View style={styles.footer}>
            <PointsBadge value={hunt.points} color={typeColor} size="lg" />
            <Button
              variant="primary"
              size="md"
              onPress={onJoin}
              style={{ flex: 1 }}
            >
              {primaryLabel}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing[5],
    paddingTop: spacing[3],
    gap: spacing[4],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  typeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  metaText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[1],
  },
});
