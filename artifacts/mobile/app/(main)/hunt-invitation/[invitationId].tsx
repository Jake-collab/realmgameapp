/**
 * Hunt Invitation Detail Screen — Worlds
 *
 * Shows full Hunt invitation details with accept/decline actions.
 * Uses Prompt 11 trusted mutation hooks.
 *
 * Privacy:
 * - Only shows public inviter display name (not email, private fields)
 * - Does NOT expose other invitees
 * - Does NOT expose locked clue content
 * - Does NOT expose private validation geometry
 *
 * Navigation entry:
 * - My Hunts > Invitations > View Invitation
 * - Notification tap
 * - Deep link: /hunt-invitation/[invitationId]
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { useHuntInvitations } from '@/features/hunts/hooks/useHuntInvitations';
import { useAcceptHuntInvitation, useDeclineHuntInvitation } from '@/features/hunts/hooks/useHuntInvitationActions';
import { HuntTypeBadge } from '@/components/hunt/HuntTypeBadge';
import { CapacityIndicator } from '@/components/hunt/CapacityIndicator';
import { HuntTimingSummary } from '@/components/hunt/HuntTimingSummary';
import { HuntSafetyNotice } from '@/components/hunt/HuntSafetyNotice';
import { Button } from '@/components/ui/Button';
import PointsBadge from '@/components/ui/PointsBadge';

export default function HuntInvitationScreen() {
  const colors = useColors();
  const { invitationId } = useLocalSearchParams<{ invitationId: string }>();
  const { user } = useAuth();

  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const invitationsQuery = useHuntInvitations({ userId: user?.id ?? null });
  const invitation = invitationsQuery.data?.find(inv => inv.id === invitationId);

  const acceptMutation  = useAcceptHuntInvitation();
  const declineMutation = useDeclineHuntInvitation();

  const hunt = invitation?.huntSummary;
  const isExpired = invitation?.expiresAt
    ? new Date(invitation.expiresAt) < new Date()
    : false;
  const isRevoked   = invitation?.status === 'revoked';
  const isDeclined  = invitation?.status === 'declined';
  const isAccepted  = invitation?.status === 'accepted';
  const canRespond  = invitation?.status === 'pending' && !isExpired;

  const handleAccept = useCallback(() => {
    if (!invitation || !user || !canRespond) return;
    acceptMutation.mutate(
      {
        invitationId: invitation.id,
        huntId: invitation.huntId,
        occurrenceId: invitation.occurrenceId ?? null,
        userId: user.id,
      },
      {
        onSuccess: (result) => {
          if (result.success && result.participationId) {
            router.replace(`/hunt-ready/${result.participationId}`);
          }
        },
      }
    );
  }, [invitation, user, canRespond, acceptMutation]);

  const handleDecline = useCallback(() => {
    if (!invitation || !user) return;
    declineMutation.mutate(
      { invitationId: invitation.id, huntId: invitation.huntId, userId: user.id },
      {
        onSuccess: () => {
          setShowDeclineConfirm(false);
          router.back();
        },
      }
    );
  }, [invitation, user, declineMutation]);

  if (invitationsQuery.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.hunt} />
      </View>
    );
  }

  if (!invitation) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="mail" size={40} color={colors.mutedForeground} />
        <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>Invitation Not Found</Text>
        <Text style={[styles.notFoundBody, { color: colors.mutedForeground }]}>
          This invitation may have expired or been revoked.
        </Text>
        <Button variant="outline" size="md" onPress={() => router.back()}>
          Return to Invitations
        </Button>
      </View>
    );
  }

  const statusLabel = isExpired   ? 'Expired'  :
                      isRevoked   ? 'Revoked'  :
                      isDeclined  ? 'Declined' :
                      isAccepted  ? 'Accepted' :
                      'Pending';

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

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invitation.status, isExpired) }]}>
          <Feather name="mail" size={13} color="#fff" />
          <Text style={styles.statusBadgeText}>{statusLabel} Invitation</Text>
        </View>

        {/* Hunt title */}
        {hunt && (
          <>
            <HuntTypeBadge huntType={hunt.huntType} privacy={hunt.privacy} size="md" />
            <Text style={[styles.title, { color: colors.foreground }]}>{hunt.title}</Text>
            {hunt.summary && (
              <Text style={[styles.summary, { color: colors.mutedForeground }]}>{hunt.summary}</Text>
            )}
          </>
        )}

        {/* Inviter */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Invitation From</Text>
          <View style={styles.inviterRow}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Feather name="user" size={18} color={colors.mutedForeground} />
            </View>
            {/* Safe: only public display name, never email or private fields */}
            <Text style={[styles.inviterName, { color: colors.foreground }]}>
              A fellow adventurer
            </Text>
          </View>
          {invitation.message && (
            <View style={[styles.messageBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.messageText, { color: colors.foreground }]}>
                "{invitation.message}"
              </Text>
            </View>
          )}
          <Text style={[styles.inviteMeta, { color: colors.mutedForeground }]}>
            Sent {formatDate(invitation.createdAt)}
            {invitation.expiresAt ? ` · ${isExpired ? 'Expired' : 'Expires'} ${formatDate(invitation.expiresAt)}` : ''}
          </Text>
        </View>

        {/* Hunt details */}
        {hunt && (
          <>
            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hunt Details</Text>
              <View style={styles.statRow}>
                <StatPill icon="map-pin" label={`${hunt.stopCount} stops`} colors={colors} />
                {hunt.estimatedDurationMinutes && (
                  <StatPill icon="clock" label={formatDuration(hunt.estimatedDurationMinutes)} colors={colors} />
                )}
                <StatPill
                  icon="users"
                  label={hunt.participationMode === 'solo' ? 'Solo' : hunt.participationMode === 'group' ? 'Group' : 'Solo/Group'}
                  colors={colors}
                />
              </View>
            </View>

            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timing</Text>
              <HuntTimingSummary
                startsAt={hunt.startsAt ?? null}
                endsAt={hunt.endsAt ?? null}
                estimatedMinutes={hunt.estimatedDurationMinutes}
              />
            </View>

            <View style={[styles.section, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Capacity</Text>
              <CapacityIndicator
                current={hunt.capacityState?.currentCount ?? 0}
                max={hunt.capacityState?.maxParticipants ?? null}
                isFull={hunt.capacityState?.isFull ?? false}
                showLabel
                size="md"
              />
            </View>

            <View style={[styles.rewardRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.rewardLabel, { color: colors.mutedForeground }]}>Earn on completion</Text>
              <PointsBadge value={hunt.pointsReward} size="lg" />
            </View>

            {/* safetyNote available only in HuntDetail, not HuntSummary */}
          </>
        )}

        {/* Cannot-respond states */}
        {!canRespond && (
          <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              {isExpired  ? 'This invitation has expired and can no longer be accepted.' :
               isRevoked  ? 'This invitation was revoked by the inviter.' :
               isDeclined ? 'You have already declined this invitation.' :
               isAccepted ? 'You have already accepted this invitation.' : ''}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky footer */}
      {canRespond && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Button
            variant="outline"
            size="lg"
            onPress={() => setShowDeclineConfirm(true)}
            disabled={acceptMutation.isPending}
            style={styles.footerBtn}
          >
            Decline
          </Button>
          <Button
            variant="primary"
            size="lg"
            onPress={handleAccept}
            disabled={acceptMutation.isPending}
            loading={acceptMutation.isPending}
            style={styles.footerBtn}
          >
            {acceptMutation.isPending ? 'Accepting…' : 'Accept Invitation'}
          </Button>
        </View>
      )}

      {!canRespond && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Button variant="outline" size="lg" onPress={() => router.back()} style={styles.footerBtn}>
            Return to Invitations
          </Button>
        </View>
      )}

      {/* Decline confirmation */}
      <Modal
        visible={showDeclineConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclineConfirm(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDeclineConfirm(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Decline Invitation?</Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Declining will not block the person who invited you. The invitation will remain in your history.
            </Text>
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                size="md"
                onPress={() => setShowDeclineConfirm(false)}
                style={styles.modalBtn}
              >
                Keep Invitation
              </Button>
              <Button
                variant="destructive"
                size="md"
                onPress={handleDecline}
                disabled={declineMutation.isPending}
                loading={declineMutation.isPending}
                style={styles.modalBtn}
              >
                {declineMutation.isPending ? 'Declining…' : 'Decline'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatPill({ icon, label, colors }: { icon: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.pill, { backgroundColor: colors.secondary }]}>
      <Feather name={icon as any} size={12} color={colors.mutedForeground} />
      <Text style={[styles.pillText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function getStatusColor(status: string, isExpired: boolean): string {
  if (isExpired) return '#9CA3AF';
  switch (status) {
    case 'pending':  return '#D97706';
    case 'accepted': return '#059669';
    case 'declined': return '#6B7280';
    case 'revoked':  return '#EF4444';
    default: return '#6B7280';
  }
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], gap: spacing[4] },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[5], paddingTop: Platform.OS === 'ios' ? 70 : 70, gap: spacing[4] },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 16,
    left: spacing[4],
    width: 40, height: 40,
    borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  statusBadgeText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs, color: '#fff' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'] },
  summary: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: 24 },
  section: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3] },
  sectionTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  inviterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  inviterName: { fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  messageBox: {
    borderRadius: radius.md, borderWidth: 1,
    padding: spacing[3],
  },
  messageText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20, fontStyle: 'italic' },
  inviteMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.full,
  },
  pillText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  rewardRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: radius.lg, borderWidth: 1, padding: spacing[4],
  },
  rewardLabel: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  infoBox: {
    flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start',
    borderRadius: radius.md, borderWidth: 1, padding: spacing[3],
  },
  infoText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, flex: 1, lineHeight: 20 },
  footer: {
    flexDirection: 'row', gap: spacing[3], padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 4,
  },
  footerBtn: { flex: 1 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: spacing[6] },
  modalCard: {
    borderRadius: radius.xl, borderWidth: 1, padding: spacing[6], gap: spacing[4], width: '100%', maxWidth: 360,
  },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  modalBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: spacing[3] },
  modalBtn: { flex: 1 },
  notFoundTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'center' },
  notFoundBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
});
