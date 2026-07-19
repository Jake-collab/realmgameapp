/**
 * Hunt Detail Screen — Worlds
 *
 * Full Hunt information for discovery, joining, invitation response,
 * and ready/active state access. Renders different primary actions
 * based on the Prompt 11 action resolver.
 *
 * Privacy:
 * - No locked clue content
 * - No private stop geometry
 * - No other participants' proof or private data
 * - No internal moderation notes
 * - Creator identity: public display name only
 *
 * Navigation entry points:
 * - Hunt Map marker → View Hunt
 * - My Hunts → View Hunt
 * - Invitation → View Hunt
 * - Deep link: /hunt-detail/[huntId]
 * - Notification tap
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useHuntDetail } from '@/features/hunts/hooks/useHuntDetail';
import { useHuntAvailability } from '@/features/hunts/hooks/useHuntAvailability';
import { useJoinHunt } from '@/features/hunts/hooks/useJoinHunt';
import { evaluateHuntAvailability } from '@/features/hunts/services/huntAvailability.service';
import { resolveHuntAction } from '@/features/hunts/services/huntActionResolver';
import { HuntTypeBadge } from '@/components/hunt/HuntTypeBadge';
import { CapacityIndicator } from '@/components/hunt/CapacityIndicator';
import { HuntTimingSummary } from '@/components/hunt/HuntTimingSummary';
import { HuntPrimaryAction } from '@/components/hunt/HuntPrimaryAction';
import { HuntSafetyNotice } from '@/components/hunt/HuntSafetyNotice';
import { HuntJoinConfirmation } from '@/components/hunt/HuntJoinConfirmation';
import PointsBadge from '@/components/ui/PointsBadge';

export default function HuntDetailScreen() {
  const colors = useColors();
  const { huntId } = useLocalSearchParams<{ huntId: string }>();
  const { user } = useAuth();

  const [showJoinConfirm, setShowJoinConfirm] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  const detailQuery = useHuntDetail({
    huntId: huntId ?? '',
    userId: user?.id ?? null,
    enabled: !!huntId,
  });

  const hunt = detailQuery.data;
  const joinMutation = useJoinHunt();

  // ── Availability (client-side optimistic) ────────────────────────────────
  const availResult = hunt
    ? evaluateHuntAvailability({
        huntId: hunt.id,
        occurrenceId: hunt.occurrenceId ?? null,
        huntStatus: 'active',
        huntPrivacy: hunt.privacy,
        huntJoinPolicy: hunt.isOrdered ? 'open' : 'open', // hunt.joinPolicy
        maxParticipants: hunt.capacityState?.maxParticipants ?? null,
        currentParticipantCount: hunt.capacityState?.currentCount ?? 0,
        isAuthenticated: !!user,
        participationStatus: hunt.participationStatus ?? undefined,
        participationId: hunt.participationId ?? undefined,
        invitationId: hunt.invitationId ?? undefined,
        invitationStatus: hunt.invitationStatus ?? undefined,
      })
    : null;

  const action = availResult
    ? resolveHuntAction({
        state: availResult.state,
        canJoin: availResult.canJoin,
        canStart: availResult.canStart ?? false,
        reasonCode: availResult.reasonCode as any,
        participationId: hunt?.participationId ?? null,
        invitationId: hunt?.invitationId ?? null,
      })
    : null;

  // ── Action handler ────────────────────────────────────────────────────────
  const handlePrimaryAction = useCallback(() => {
    if (!action) return;
    switch (action.actionType) {
      case 'join_hunt':
        setShowJoinConfirm(true);
        break;
      case 'accept_invitation':
        if (hunt?.invitationId) {
          router.push(`/hunt-invitation/${hunt.invitationId}`);
        }
        break;
      case 'continue_hunt':
      case 'start_hunt':
        if (hunt?.participationId) {
          router.push(`/(main)/hunt-active/${hunt.participationId}`);
        }
        break;
      case 'view_completion':
        if (hunt?.participationId) {
          router.push(`/(main)/hunt-active/${hunt.participationId}`);
        }
        break;
      case 'view_hunt':
        // Already on detail — no-op
        break;
    }
  }, [action, hunt]);

  const handleConfirmJoin = useCallback(() => {
    if (!hunt || !user) return;
    joinMutation.mutate(
      { huntId: hunt.id, occurrenceId: hunt.occurrenceId ?? null, userId: user.id },
      {
        onSuccess: (result) => {
          setShowJoinConfirm(false);
          if (result.success && result.participationId) {
            router.push(`/hunt-ready/${result.participationId}`);
          } else if (!result.success) {
            // Stay on detail — show error via toast or state
          }
        },
        onError: () => { setShowJoinConfirm(false); },
      }
    );
  }, [hunt, user, joinMutation]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (detailQuery.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.hunt} />
      </View>
    );
  }

  // ── Not found / private ───────────────────────────────────────────────────
  if (!hunt) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>Hunt Unavailable</Text>
        <Text style={[styles.notFoundBody, { color: colors.mutedForeground }]}>
          This hunt may have ended, been cancelled, or is not publicly available.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]}>
          <Text style={[styles.backBtnText, { color: colors.foreground }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFull = (hunt.capacityState?.isFull) ?? false;
  const requiresProof = hunt.stops?.some(s => !['none', 'manual_confirmation'].includes(s.completionMethod)) ?? false;
  const requiresLocation = hunt.stops?.some(s => ['location', 'image_and_location'].includes(s.completionMethod)) ?? false;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Back button ───────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backButton, { backgroundColor: colors.card }]}
        accessibilityLabel="Go back"
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Type + privacy badges ────────────────────────────────── */}
        <HuntTypeBadge huntType={hunt.huntType} privacy={hunt.privacy} size="md" />

        {/* ── Title + summary ───────────────────────────────────────── */}
        <Text style={[styles.title, { color: colors.foreground }]}>{hunt.title}</Text>
        {hunt.summary && (
          <Text style={[styles.summary, { color: colors.mutedForeground }]}>{hunt.summary}</Text>
        )}

        {/* ── Availability status banner ────────────────────────────── */}
        {availResult && availResult.state !== 'available' && (
          <View style={[styles.statusBanner, { backgroundColor: getBannerColor(availResult.state) }]}>
            <Text style={styles.statusBannerText}>{getStatusBannerLabel(availResult.state)}</Text>
          </View>
        )}

        {/* ── Key stats ─────────────────────────────────────────────── */}
        <View style={[styles.statsGrid, { borderColor: colors.border }]}>
          <StatCell icon="map-pin" label="Stops" value={`${hunt.stopCount}`} colors={colors} />
          {hunt.estimatedDurationMinutes && (
            <StatCell icon="clock" label="Duration"
              value={formatDuration(hunt.estimatedDurationMinutes)} colors={colors} />
          )}
          <StatCell icon="award" label="Points" value={`${hunt.pointsReward}`} colors={colors} />
          {hunt.difficulty && (
            <StatCell icon="activity" label="Difficulty"
              value={hunt.difficulty.replace('_', ' ')} colors={colors} />
          )}
        </View>

        {/* ── Timing ───────────────────────────────────────────────── */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timing</Text>
          <HuntTimingSummary
            startsAt={hunt.startsAt ?? null}
            endsAt={hunt.endsAt ?? null}
            estimatedMinutes={hunt.estimatedDurationMinutes}
          />
        </View>

        {/* ── Capacity ──────────────────────────────────────────────── */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Participants</Text>
          <CapacityIndicator
            current={hunt.capacityState?.currentCount ?? 0}
            max={hunt.capacityState?.maxParticipants ?? null}
            isFull={isFull}
            showLabel
            size="md"
          />
          <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
            {hunt.participationMode === 'solo'
              ? 'Solo participation'
              : hunt.participationMode === 'group'
                ? 'Group participation'
                : 'Solo or group participation'}
            {' · '}
            {hunt.isOrdered ? 'Sequential stops' : 'Any order'}
          </Text>
        </View>

        {/* ── Description ───────────────────────────────────────────── */}
        {hunt.description && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
            <Text style={[styles.sectionBody, { color: colors.foreground }]}>{hunt.description}</Text>
          </View>
        )}

        {/* ── Proof requirements summary ────────────────────────────── */}
        {(requiresProof || requiresLocation) && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Requirements</Text>
            {requiresLocation && (
              <View style={styles.reqRow}>
                <Feather name="navigation" size={14} color={colors.mutedForeground} />
                <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
                  Location verification required at some stops
                </Text>
              </View>
            )}
            {requiresProof && !requiresLocation && (
              <View style={styles.reqRow}>
                <Feather name="camera" size={14} color={colors.mutedForeground} />
                <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
                  Photo or text proof required at some stops
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Meeting area (public only) ─────────────────────────────── */}
        {hunt.publicMeetingInfo && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Meeting Point</Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
              {hunt.publicMeetingInfo}
            </Text>
          </View>
        )}

        {/* ── Accessibility ─────────────────────────────────────────── */}
        {hunt.accessibilityNote && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Accessibility</Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
              {hunt.accessibilityNote}
            </Text>
          </View>
        )}

        {/* ── Safety ───────────────────────────────────────────────── */}
        <HuntSafetyNotice
          huntNote={hunt.safetyNote}
          compact={!requiresLocation && !hunt.safetyNote}
          expanded={requiresLocation}
        />

        {/* ── Creator ───────────────────────────────────────────────── */}
        {hunt.creator && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Created By</Text>
            <View style={styles.creatorRow}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
                {hunt.creator.isAdmin ? 'Worlds Team' : hunt.creator.displayName ?? 'A community member'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Reward ───────────────────────────────────────────────── */}
        <View style={[styles.rewardCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.rewardLabel, { color: colors.mutedForeground }]}>
            Earn on completion
          </Text>
          <PointsBadge value={hunt.pointsReward} size="lg" />
        </View>

        {/* Spacer for sticky footer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Sticky action footer ──────────────────────────────────── */}
      {action && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <HuntPrimaryAction
            action={action}
            isLoading={joinMutation.isPending}
            onPress={handlePrimaryAction}
            size="lg"
            fullWidth
          />
        </View>
      )}

      {/* ── Join confirmation modal ────────────────────────────────── */}
      <HuntJoinConfirmation
        visible={showJoinConfirm}
        hunt={{
          title: hunt.title,
          participationMode: hunt.participationMode ?? 'solo',
          stopCount: hunt.stopCount,
          estimatedDurationMinutes: hunt.estimatedDurationMinutes,
          pointsReward: hunt.pointsReward,
          startsAt: hunt.startsAt ?? null,
          endsAt: hunt.endsAt ?? null,
          safetyNote: hunt.safetyNote,
          requiresLocation,
          requiresProof,
        }}
        isLoading={joinMutation.isPending}
        onConfirm={handleConfirmJoin}
        onDismiss={() => setShowJoinConfirm(false)}
      />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCell({
  icon, label, value, colors,
}: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.statCell, { borderColor: colors.border }]}>
      <Feather name={icon as any} size={16} color={colors.hunt} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function getBannerColor(state: string): string {
  switch (state) {
    case 'active':     return '#D1FAE5';
    case 'ready':      return '#E0E7FF';
    case 'completed':  return '#F3F4F6';
    case 'full':       return '#FEE2E2';
    case 'cancelled':  return '#FEE2E2';
    case 'expired':    return '#FEE2E2';
    case 'invited':    return '#FEF3C7';
    case 'upcoming':   return '#EDE9FE';
    default:           return '#F3F4F6';
  }
}

function getStatusBannerLabel(state: string): string {
  switch (state) {
    case 'active':     return '✓ You are actively on this Hunt';
    case 'ready':      return '✓ You have joined this Hunt';
    case 'completed':  return '✓ You completed this Hunt';
    case 'full':       return '⊘ This Hunt is full';
    case 'cancelled':  return '⊘ This Hunt has been cancelled';
    case 'expired':    return '⊘ This Hunt has ended';
    case 'invited':    return '✉ You have an invitation to this Hunt';
    case 'upcoming':   return '◷ This Hunt is not yet open';
    default:           return '';
  }
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[4] },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[5], gap: spacing[4] },

  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 16,
    left: spacing[4],
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  title: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'], lineHeight: 38 },
  summary: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: 24, color: '#6B7280' },

  statusBanner: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
  },
  statusBannerText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: '#1F2937',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: spacing[4],
    gap: spacing[1],
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  statLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },

  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[2],
  },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  sectionBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },

  reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },

  rewardCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
  },
  rewardLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },

  footer: {
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 4,
  },

  notFoundTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'center' },
  notFoundBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  backBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  backBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});

// Platform import for back button positioning
import { Platform } from 'react-native';
