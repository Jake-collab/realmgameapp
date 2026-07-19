/**
 * Ready Hunt Screen — Worlds
 *
 * Shown after a user joins or accepts an invitation.
 * Represents the "joined but not yet started" state.
 *
 * Data source:
 * - useMyHunts to find the participation entry (for participationId → huntId mapping)
 * - useHuntDetail for rich hunt information (stops, timing, points, safety)
 *
 * Start models:
 *   individual — Start Hunt button enabled when participant requirements met
 *   scheduled  — Starts automatically; no Start button
 *   host_controlled — Waiting for Host; no Start button
 *
 * Does NOT expose:
 * - Locked clue content
 * - Future stop locations
 * - Private participant lists
 *
 * Routes to: hunt-active/[participationId] after successful start
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
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
import { useMyHunts } from '@/features/hunts/hooks/useMyHunts';
import { useHuntDetail } from '@/features/hunts/hooks/useHuntDetail';
import { useStartHunt } from '@/features/hunts/hooks/useStartHunt';
import { HuntSafetyNotice } from '@/components/hunt/HuntSafetyNotice';
import { Button } from '@/components/ui/Button';
import PointsBadge from '@/components/ui/PointsBadge';

export default function HuntReadyScreen() {
  const colors = useColors();
  const { participationId } = useLocalSearchParams<{ participationId: string }>();
  const { user } = useAuth();

  const [showStartConfirm, setShowStartConfirm] = useState(false);

  // ── Find participation in My Hunts to get the huntId ────────────────────
  const myHuntsQuery = useMyHunts({ userId: user?.id ?? null });
  const entry =
    myHuntsQuery.data?.ready.find(h => h.participationId === participationId) ??
    myHuntsQuery.data?.active.find(h => h.participationId === participationId);

  // ── Load rich hunt detail ────────────────────────────────────────────────
  const detailQuery = useHuntDetail({
    huntId: entry?.huntId ?? '',
    userId: user?.id ?? null,
    enabled: !!entry?.huntId,
  });

  const hunt = detailQuery.data;
  const startMutation = useStartHunt();

  // ── Start model (server is authoritative; UI uses safe default) ──────────
  // Always 'individual' in UI — server validates eligibility
  const canIndividuallyStart = !!entry && !!user;

  const handleStartPress = useCallback(() => {
    setShowStartConfirm(true);
  }, []);

  const handleConfirmStart = useCallback(() => {
    if (!entry || !user) return;
    setShowStartConfirm(false);
    startMutation.mutate(
      {
        participationId: participationId!,
        huntId: entry.huntId,
        userId: user.id,
      },
      {
        onSuccess: (result) => {
          if (result.success && result.participationId) {
            router.replace(`/(main)/hunt-active/${result.participationId}`);
          }
        },
      }
    );
  }, [entry, user, participationId, startMutation]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (myHuntsQuery.isLoading || detailQuery.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.hunt} />
      </View>
    );
  }

  // ── Not found in ready list ───────────────────────────────────────────────
  if (!entry && !myHuntsQuery.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="check-circle" size={40} color={colors.hunt} />
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>You've Joined!</Text>
        <Text style={[styles.pageBody, { color: colors.mutedForeground }]}>
          Your Hunt is being prepared. Check My Hunts for your current status.
        </Text>
        <Button
          variant="primary"
          size="lg"
          onPress={() => router.replace('/(main)/hunt/my-hunts')}
        >
          View My Hunts
        </Button>
      </View>
    );
  }

  const huntTitle = hunt?.title ?? entry?.huntTitle ?? 'Hunt';
  const stopCount  = hunt?.stopCount ?? entry?.requiredStopCount ?? 0;
  const estimatedDuration = hunt?.estimatedDurationMinutes;
  const pointsReward = hunt?.pointsReward ?? entry?.awardedPoints ?? 0;

  const durationLabel = estimatedDuration
    ? estimatedDuration < 60
      ? `${estimatedDuration}m`
      : `${Math.floor(estimatedDuration / 60)}h${estimatedDuration % 60 > 0 ? ` ${estimatedDuration % 60}m` : ''}`
    : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Back */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backButton, { backgroundColor: colors.card }]}
        accessibilityLabel="Go back"
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Status */}
        <View style={[styles.statusBanner, { backgroundColor: colors.hunt + '18' }]}>
          <Feather name="check-circle" size={18} color={colors.hunt} />
          <Text style={[styles.statusText, { color: colors.hunt }]}>Joined — Ready</Text>
        </View>

        {/* Hunt title */}
        <Text style={[styles.title, { color: colors.foreground }]}>{huntTitle}</Text>

        {/* What to expect */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What happens next</Text>
          <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
            Head to the meeting area and tap Start Hunt when you're ready to begin.
          </Text>
        </View>

        {/* Hunt details */}
        <View style={styles.statsRow}>
          {stopCount > 0 && (
            <StatCard icon="map-pin" label="Stops" value={`${stopCount}`} colors={colors} />
          )}
          {durationLabel && (
            <StatCard icon="clock" label="Duration" value={durationLabel} colors={colors} />
          )}
          {hunt?.participationMode && (
            <StatCard
              icon="users"
              label="Mode"
              value={
                hunt.participationMode === 'solo' ? 'Solo' :
                hunt.participationMode === 'group' ? 'Group' : 'Solo/Group'
              }
              colors={colors}
            />
          )}
        </View>

        {/* Timing */}
        {entry?.startsAt && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timing</Text>
            <View style={styles.timingRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
                {new Date(entry.startsAt) > new Date()
                  ? `Starts ${new Date(entry.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                  : 'Hunt window is open'}
              </Text>
            </View>
          </View>
        )}

        {/* Meeting point */}
        {hunt?.publicMeetingInfo && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Meeting Point</Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
              {hunt.publicMeetingInfo}
            </Text>
          </View>
        )}

        {/* Reward */}
        {pointsReward > 0 && (
          <View style={[styles.rewardRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.rewardLabel, { color: colors.mutedForeground }]}>Earn on completion</Text>
            <PointsBadge value={pointsReward} size="lg" />
          </View>
        )}

        {/* Safety */}
        <HuntSafetyNotice huntNote={hunt?.safetyNote} expanded />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button
          variant="outline"
          size="lg"
          onPress={() => entry ? router.push(`/hunt-detail/${entry.huntId}`) : router.back()}
          style={styles.footerBtn}
        >
          View Hunt
        </Button>
        {canIndividuallyStart && (
          <Button
            variant="primary"
            size="lg"
            onPress={handleStartPress}
            disabled={startMutation.isPending}
            loading={startMutation.isPending}
            style={styles.footerBtn}
          >
            {startMutation.isPending ? 'Starting…' : 'Start Hunt'}
          </Button>
        )}
      </View>

      {/* Start confirmation */}
      <Modal
        visible={showStartConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartConfirm(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowStartConfirm(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Feather name="flag" size={28} color={colors.hunt} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Start Hunt?</Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              {stopCount > 0 ? `${stopCount} stop${stopCount !== 1 ? 's' : ''}` : 'Multi-stop hunt'}
              {durationLabel ? ` · ~${durationLabel}` : ''}.
              {'\n\n'}Stay aware of your surroundings. Do not use this app while driving.
            </Text>
            <View style={styles.modalActions}>
              <Button
                variant="ghost"
                size="md"
                onPress={() => setShowStartConfirm(false)}
                style={styles.modalBtn}
              >
                Not Yet
              </Button>
              <Button
                variant="primary"
                size="md"
                onPress={handleConfirmStart}
                style={styles.modalBtn}
              >
                Start Hunt
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatCard({
  icon, label, value, colors,
}: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon as any} size={18} color={colors.hunt} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[4] },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[5], paddingTop: Platform.OS === 'ios' ? 70 : 70, gap: spacing[4] },
  backButton: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 16, left: spacing[4],
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    borderRadius: radius.md, alignSelf: 'flex-start',
  },
  statusText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'] },
  section: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[2] },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  sectionBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },
  timingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  statsRow: { flexDirection: 'row', gap: spacing[3] },
  statCard: {
    flex: 1, borderRadius: radius.lg, borderWidth: 1,
    padding: spacing[4], alignItems: 'center', gap: spacing[1],
  },
  statValue: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  statLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, textAlign: 'center' },
  rewardRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: radius.lg, borderWidth: 1, padding: spacing[4],
  },
  rewardLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  footer: {
    flexDirection: 'row', gap: spacing[3], padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 4,
  },
  footerBtn: { flex: 1 },
  modalBackdrop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', padding: spacing[6],
  },
  modalCard: {
    borderRadius: radius.xl, borderWidth: 1, padding: spacing[6],
    gap: spacing[4], width: '100%', maxWidth: 360, alignItems: 'center',
  },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  modalBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: spacing[3], width: '100%' },
  modalBtn: { flex: 1 },
  pageTitle: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center' },
  pageBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },
});
