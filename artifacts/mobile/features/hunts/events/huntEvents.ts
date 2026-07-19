/**
 * Hunt Domain Events — Worlds
 *
 * Structured event hooks for Hunt domain actions.
 * Consumed by future notification and analytics infrastructure.
 *
 * Rules:
 * - Never log private clue content.
 * - Never log exact validation geometry.
 * - Never log proof contents.
 * - Never log sensitive moderation details.
 * - Never log access tokens.
 * - Never log another user's private data.
 *
 * Build 1: events emitted to console in __DEV__ only.
 * Production analytics provider connected in a future prompt.
 */

import type { HuntDomainEvent, HuntEventType, HuntAnalyticsEvent } from '../types/hunt.types';

// ─── Internal emitter ─────────────────────────────────────────────────────────

function emitEvent(event: HuntDomainEvent): void {
  if (__DEV__) {
    console.log(`[HuntEvent] ${event.type}`, {
      userId:          event.userId,
      huntId:          event.huntId,
      participationId: event.participationId,
      occurrenceId:    event.occurrenceId,
      invitationId:    event.invitationId,
      stopId:          event.stopId,
      timestamp:       event.timestamp,
      metadata:        event.metadata,
    });
  }
  // Future: analytics.track(event.type, event)
  // Future: notificationService.onDomainEvent(event)
}

function makeEvent(
  type: HuntEventType,
  userId: string,
  huntId: string,
  extra?: Partial<Omit<HuntDomainEvent, 'type' | 'userId' | 'huntId' | 'timestamp'>>,
): HuntDomainEvent {
  return {
    type,
    userId,
    huntId,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

// ─── Analytics helper ─────────────────────────────────────────────────────────

function emitAnalytics(event: HuntAnalyticsEvent, properties?: Record<string, string | number | boolean>): void {
  if (__DEV__) {
    console.log(`[HuntAnalytics] ${event}`, properties ?? {});
  }
  // Future: analytics.track(event, properties)
}

// ─── Hunt discovery events ────────────────────────────────────────────────────

export function onHuntMapViewed(userId: string): void {
  emitAnalytics('hunt_map_viewed', { userId });
}

export function onHuntDetailViewed(userId: string, huntId: string, source?: string): void {
  emitAnalytics('hunt_detail_viewed', { huntId, source: source ?? '' });
}

// ─── Hunt invitation events ───────────────────────────────────────────────────

export function onHuntInvitationCreated(
  inviterUserId: string,
  huntId: string,
  invitationId: string,
  occurrenceId?: string,
): void {
  emitEvent(makeEvent('hunt_invitation_created', inviterUserId, huntId, {
    invitationId,
    occurrenceId,
    // Never include invitee user ID in analytics
  }));
}

export function onInvitationViewed(huntId: string): void {
  emitAnalytics('invitation_viewed', { huntId });
}

export function onInvitationAccepted(
  userId: string,
  huntId: string,
  invitationId: string,
  participationId: string,
): void {
  emitEvent(makeEvent('invitation_accepted', userId, huntId, {
    invitationId,
    participationId,
  }));
  emitAnalytics('invitation_accepted', { huntId });
}

export function onInvitationDeclined(
  userId: string,
  huntId: string,
  invitationId: string,
): void {
  emitEvent(makeEvent('invitation_declined', userId, huntId, {
    invitationId,
    // Do not log reason for decline
  }));
  emitAnalytics('invitation_declined', { huntId });
}

export function onInvitationRevoked(
  revokerId: string,
  huntId: string,
  invitationId: string,
): void {
  emitEvent(makeEvent('invitation_revoked', revokerId, huntId, {
    invitationId,
  }));
}

// ─── Hunt participation events ────────────────────────────────────────────────

export function onJoinAttempted(
  userId: string,
  huntId: string,
  eligible: boolean,
  reasonCode?: string,
): void {
  emitAnalytics('join_attempted', {
    huntId,
    eligible: eligible ? 1 : 0,
    reasonCode: reasonCode ?? '',
  });
}

export function onHuntJoined(
  userId: string,
  huntId: string,
  participationId: string,
  occurrenceId?: string,
): void {
  emitEvent(makeEvent('hunt_joined', userId, huntId, {
    participationId,
    occurrenceId,
  }));
  emitAnalytics('hunt_joined', { huntId });
}

export function onHuntReady(
  userId: string,
  huntId: string,
  participationId: string,
): void {
  emitEvent(makeEvent('hunt_ready', userId, huntId, {
    participationId,
  }));
}

export function onHuntStarted(
  userId: string,
  huntId: string,
  participationId: string,
  occurrenceId?: string,
): void {
  emitEvent(makeEvent('hunt_started', userId, huntId, {
    participationId,
    occurrenceId,
  }));
  emitAnalytics('hunt_started', { huntId });
}

export function onParticipantWithdrew(
  userId: string,
  huntId: string,
  participationId: string,
): void {
  emitEvent(makeEvent('participant_withdrew', userId, huntId, {
    participationId,
    // Do not log withdrawal reason
  }));
  emitAnalytics('hunt_withdrawn', { huntId });
}

export function onParticipantRemoved(
  actorUserId: string,
  huntId: string,
  participationId: string,
): void {
  emitEvent(makeEvent('participant_removed', actorUserId, huntId, {
    participationId,
    // Do not log removal reason or internal note
  }));
}

// ─── Stop and clue events ─────────────────────────────────────────────────────

export function onStopUnlocked(
  userId: string,
  huntId: string,
  participationId: string,
  stopId: string,
): void {
  emitEvent(makeEvent('stop_unlocked', userId, huntId, {
    participationId,
    stopId,
  }));
}

export function onClueViewed(huntId: string, stopId: string): void {
  emitAnalytics('clue_viewed', { huntId, stopId });
  // Never log clue content
}

export function onStopStarted(huntId: string, stopId: string): void {
  emitAnalytics('stop_started', { huntId, stopId });
}

export function onStopCompleted(
  userId: string,
  huntId: string,
  participationId: string,
  stopId: string,
  validationMethod: string,
): void {
  emitEvent(makeEvent('stop_completed', userId, huntId, {
    participationId,
    stopId,
    metadata: { validationMethod },
  }));
  emitAnalytics('stop_completed', { huntId, stopId });
}

// ─── Proof events ─────────────────────────────────────────────────────────────

export function onProofStarted(huntId: string, stopId: string): void {
  emitAnalytics('proof_started', { huntId, stopId });
  // Never log proof content
}

export function onProofSubmitted(
  userId: string,
  huntId: string,
  participationId: string,
  stopId: string,
  submissionType: string,
): void {
  emitEvent(makeEvent('proof_submitted', userId, huntId, {
    participationId,
    stopId,
    metadata: { submissionType },
    // Never log proof image contents or text
  }));
  emitAnalytics('proof_submitted', { huntId });
}

export function onProofApproved(
  userId: string,
  huntId: string,
  participationId: string,
  stopId: string,
): void {
  emitEvent(makeEvent('proof_approved', userId, huntId, {
    participationId,
    stopId,
    // Never log reviewer identity or approval notes
  }));
}

export function onProofRejected(
  userId: string,
  huntId: string,
  participationId: string,
  stopId: string,
): void {
  emitEvent(makeEvent('proof_rejected', userId, huntId, {
    participationId,
    stopId,
    // Never log rejection reason in analytics
  }));
}

export function onResubmissionRequested(
  userId: string,
  huntId: string,
  participationId: string,
  stopId: string,
): void {
  emitEvent(makeEvent('resubmission_requested', userId, huntId, {
    participationId,
    stopId,
  }));
}

// ─── Hunt completion events ───────────────────────────────────────────────────

export function onHuntCompleted(
  userId: string,
  huntId: string,
  participationId: string,
  awardedPoints: number,
  occurrenceId?: string,
): void {
  emitEvent(makeEvent('hunt_completed', userId, huntId, {
    participationId,
    occurrenceId,
    metadata: { awardedPoints }, // amount is safe to log
  }));
  emitAnalytics('hunt_completed', { huntId, awardedPoints });
}

export function onHuntCancelled(
  actorUserId: string,
  huntId: string,
  occurrenceId?: string,
): void {
  emitEvent(makeEvent('hunt_cancelled', actorUserId, huntId, {
    occurrenceId,
    // Do not log cancellation reason in analytics
  }));
  emitAnalytics('hunt_cancelled', { huntId });
}

export function onHuntPublished(huntId: string): void {
  emitEvent(makeEvent('hunt_published', 'system', huntId));
}

export function onHuntExpired(huntId: string, occurrenceId?: string): void {
  emitEvent(makeEvent('hunt_expired', 'system', huntId, {
    occurrenceId,
  }));
}
