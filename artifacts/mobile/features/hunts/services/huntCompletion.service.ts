/**
 * Hunt Completion Service — Worlds
 *
 * Client-side readiness evaluation and completion trigger for Hunts.
 *
 * Completion is server-authoritative:
 * - Client calls complete_hunt() RPC — server verifies stops, issues points atomically.
 * - Idempotency key: hunt_completion:{participationId}
 * - Points are appended to points_ledger; profile total updated in the same transaction.
 * - Reward always from snapshot at join/start time — never re-read from hunts table.
 *
 * This module evaluates readiness (client-side optimistic check) and wraps the RPC call.
 */

import type {
  HuntCompletionResult,
  HuntCompletionReadiness,
  CompletionReadinessState,
  StopProgressStatus,
} from '../types/hunt.types';
import { rpcCompleteHunt } from '../repositories/hunt.repository';
import { normalizeHuntError } from '../utils/huntErrors';

// ─── Stop summary for readiness evaluation ────────────────────────────────────

export interface StopReadinessSummary {
  id: string;
  isRequired: boolean;
  progressStatus: StopProgressStatus;
}

// ─── Completion readiness evaluator ───────────────────────────────────────────
/**
 * Evaluates client-side completion readiness. Not the server authority —
 * the RPC will also verify. Used to show appropriate UI state.
 */
export function evaluateCompletionReadiness(
  stops: StopReadinessSummary[],
  participationStatus: string | null,
  completionDeadline: string | null,
  now: Date = new Date(),
): HuntCompletionReadiness {

  if (!participationStatus || !['active', 'paused'].includes(participationStatus)) {
    return notReady('invalid_state', [], [], [], 'Hunt cannot be completed in its current state.');
  }

  if (participationStatus === 'completed') {
    return notReady('already_completed', [], [], [], "You've already completed this hunt.");
  }

  // Check deadline
  if (completionDeadline) {
    const deadline = new Date(completionDeadline);
    if (now > deadline) {
      return notReady('expired', [], [], [], 'The completion deadline has passed.');
    }
  }

  const requiredStops = stops.filter(s => s.isRequired);
  const missingStopIds = requiredStops
    .filter(s => s.progressStatus !== 'completed')
    .filter(s => !['awaiting_proof', 'under_review', 'needs_resubmission'].includes(s.progressStatus))
    .map(s => s.id);

  const pendingProofStopIds = requiredStops
    .filter(s => ['awaiting_proof', 'under_review', 'needs_resubmission'].includes(s.progressStatus))
    .map(s => s.id);

  const rejectedProofStopIds = requiredStops
    .filter(s => s.progressStatus === 'rejected')
    .map(s => s.id);

  if (rejectedProofStopIds.length > 0) {
    return notReady('proof_rejected', missingStopIds, pendingProofStopIds, rejectedProofStopIds,
      `${rejectedProofStopIds.length} stop proof(s) were rejected and need resubmission.`);
  }

  if (pendingProofStopIds.length > 0) {
    return notReady('proof_pending', missingStopIds, pendingProofStopIds, rejectedProofStopIds,
      `Proof for ${pendingProofStopIds.length} stop(s) is still under review.`);
  }

  if (missingStopIds.length > 0) {
    return notReady('missing_required_stop', missingStopIds, pendingProofStopIds, rejectedProofStopIds,
      `${missingStopIds.length} required stop(s) still need to be completed.`);
  }

  return {
    state: 'ready',
    isReady: true,
    missingStopIds: [],
    pendingProofStopIds: [],
    rejectedProofStopIds: [],
    userMessage: "All stops complete! You can now finish the hunt.",
  };
}

function notReady(
  state: CompletionReadinessState,
  missingStopIds: string[],
  pendingProofStopIds: string[],
  rejectedProofStopIds: string[],
  userMessage: string,
): HuntCompletionReadiness {
  return { state, isReady: false, missingStopIds, pendingProofStopIds, rejectedProofStopIds, userMessage };
}

// ─── Complete hunt ─────────────────────────────────────────────────────────────
/**
 * Trigger Hunt completion. Server verifies all required stops and issues points atomically.
 * Idempotent: calling twice returns the first result.
 */
export async function completeHunt(participationId: string): Promise<HuntCompletionResult> {
  try {
    return await rpcCompleteHunt(participationId);
  } catch (err) {
    throw normalizeHuntError(err);
  }
}
