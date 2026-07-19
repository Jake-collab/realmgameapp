/**
 * Quest Domain Events — Worlds
 *
 * Structured event hooks for Quest domain actions. These are consumed by
 * future notification and analytics infrastructure (Prompt 21+).
 *
 * Rules:
 * - Never log proof image contents.
 * - Never log precise private location coordinates.
 * - Never log review notes or hidden validation data.
 * - Never log access tokens.
 *
 * For Build 1, events are logged to console in __DEV__ only.
 * Production analytics provider will be connected in a future prompt.
 */

import type { QuestEventType, QuestEvent } from '../types/quest.types';

// ─── Event emitter ────────────────────────────────────────────────────────────

function emitEvent(event: QuestEvent): void {
  if (__DEV__) {
    console.log(`[QuestEvent] ${event.type}`, {
      userId: event.userId,
      questId: event.questId,
      participationId: event.participationId,
      occurrenceKey: event.occurrenceKey,
      timestamp: event.timestamp,
      metadata: event.metadata,
    });
  }
  // Future: analytics.track(event.type, event)
  // Future: notificationService.onDomainEvent(event)
}

function makeEvent(
  type: QuestEventType,
  userId: string,
  questId: string,
  extra?: Partial<Omit<QuestEvent, 'type' | 'userId' | 'questId' | 'timestamp'>>
): QuestEvent {
  return {
    type,
    userId,
    questId,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

// ─── Quest availability events ─────────────────────────────────────────────────

export function onQuestBecameAvailable(
  questId: string,
  questType: string,
  occurrenceKey?: string
): void {
  emitEvent(makeEvent('quest_became_available', 'system', questId, {
    occurrenceKey,
    metadata: { questType },
  }));
}

export function onMonthlyDropPublished(questId: string, occurrenceKey: string): void {
  emitEvent(makeEvent('monthly_drop_published', 'system', questId, {
    occurrenceKey,
  }));
}

// ─── User interaction events ───────────────────────────────────────────────────

export function onQuestListViewed(userId: string, questType?: string): void {
  emitEvent(makeEvent('quest_list_viewed', userId, 'all', {
    metadata: questType ? { questType } : undefined,
  }));
}

export function onQuestDetailViewed(userId: string, questId: string): void {
  emitEvent(makeEvent('quest_detail_viewed', userId, questId));
}

export function onQuestStartAttempted(
  userId: string,
  questId: string,
  eligible: boolean,
  reasonCode?: string
): void {
  emitEvent(makeEvent('quest_start_attempted', userId, questId, {
    metadata: { eligible: eligible ? 1 : 0, reasonCode: reasonCode ?? '' },
  }));
}

export function onQuestStarted(
  userId: string,
  questId: string,
  participationId: string,
  occurrenceKey?: string
): void {
  emitEvent(makeEvent('quest_started', userId, questId, {
    participationId,
    occurrenceKey,
  }));
}

export function onQuestAbandoned(
  userId: string,
  questId: string,
  participationId: string
): void {
  emitEvent(makeEvent('quest_abandoned', userId, questId, {
    participationId,
  }));
}

export function onStepCompleted(
  userId: string,
  questId: string,
  participationId: string,
  stepId: string
): void {
  emitEvent(makeEvent('step_completed', userId, questId, {
    participationId,
    metadata: { stepId },
  }));
}

// ─── Proof events ─────────────────────────────────────────────────────────────

export function onProofStarted(
  userId: string,
  questId: string,
  participationId: string
): void {
  emitEvent(makeEvent('proof_started', userId, questId, {
    participationId,
    // Never log proof content
  }));
}

export function onProofSubmitted(
  userId: string,
  questId: string,
  participationId: string,
  submissionType: string
): void {
  emitEvent(makeEvent('proof_submitted', userId, questId, {
    participationId,
    metadata: { submissionType }, // type only — never content
  }));
}

export function onProofApproved(
  userId: string,
  questId: string,
  participationId: string
): void {
  emitEvent(makeEvent('proof_approved', userId, questId, {
    participationId,
    // Never log review notes or reviewer identity
  }));
}

export function onProofRejected(
  userId: string,
  questId: string,
  participationId: string
): void {
  emitEvent(makeEvent('proof_rejected', userId, questId, {
    participationId,
    // Never log rejection reason to client analytics
  }));
}

export function onResubmissionRequested(
  userId: string,
  questId: string,
  participationId: string
): void {
  emitEvent(makeEvent('resubmission_requested', userId, questId, {
    participationId,
  }));
}

// ─── Completion events ─────────────────────────────────────────────────────────

export function onQuestCompleted(
  userId: string,
  questId: string,
  participationId: string,
  awardedPoints: number,
  occurrenceKey?: string
): void {
  emitEvent(makeEvent('quest_completed', userId, questId, {
    participationId,
    occurrenceKey,
    metadata: { awardedPoints }, // amount is safe to log
  }));
}

export function onQuestExpired(
  userId: string,
  questId: string,
  participationId?: string
): void {
  emitEvent(makeEvent('quest_expired', userId, questId, {
    participationId,
  }));
}
