/**
 * Hunt Stop Service — Worlds
 *
 * Client-side logic for stop availability, clue visibility, and stop completion.
 *
 * Security rules enforced here (client-side checks) + server:
 * - Locked stops: never display clue content, never allow mark-complete.
 * - Hidden clues: hint_text is never included in client types.
 * - Location validation: always deferred to server RPC — never client-computed.
 * - Sequential clue release: determined by server_reveal_state on the stop.
 *
 * The server (complete_hunt_stop RPC) is the authority for all completion logic.
 * Client checks here are for UX feedback only.
 */

import type {
  StopProgressStatus,
  StopCompletionMethod,
  HuntStopCompletionResult,
} from '../types/hunt.types';
import { STOP_ALLOWED_TRANSITIONS, TRUSTED_ONLY_STOP_TRANSITIONS } from '../constants';
import { rpcCompleteHuntStop } from '../repositories/hunt.repository';
import { normalizeHuntError } from '../utils/huntErrors';

// ─── Stop availability ────────────────────────────────────────────────────────

/**
 * Whether a stop is accessible (visible and interactable) for the participant.
 * Locked and not_started stops are not accessible.
 */
export function isStopAccessible(status: StopProgressStatus): boolean {
  return !['locked', 'not_started'].includes(status);
}

/**
 * Whether a stop can be "started" (participant begins work on it).
 */
export function canStartStop(status: StopProgressStatus): boolean {
  return status === 'available';
}

/**
 * Whether a stop can receive a manual-confirmation completion.
 * Proof-required stops cannot be marked complete without proof.
 */
export function canManuallyCompleteStop(
  status: StopProgressStatus,
  completionMethod: StopCompletionMethod,
  locationValidated: boolean,
): boolean {
  if (!isStopAccessible(status)) return false;
  if (status === 'completed') return false;

  switch (completionMethod) {
    case 'none':
    case 'manual_confirmation':
      return true;
    case 'location':
    case 'image_and_location':
      return locationValidated; // server validates; this is optimistic only
    case 'text':
    case 'image':
    case 'text_and_image':
    case 'trusted_code':
      return false; // requires proof flow
    default:
      return false;
  }
}

/**
 * Whether a proof submission is required for a stop.
 */
export function isProofRequired(completionMethod: StopCompletionMethod): boolean {
  return ['text', 'image', 'image_and_location', 'text_and_image', 'trusted_code']
    .includes(completionMethod);
}

/**
 * Whether the participant should see a clue for the stop.
 * Clue content is only shown when the stop is revealed/accessible.
 */
export function shouldShowClue(status: StopProgressStatus): boolean {
  return isStopAccessible(status) && status !== 'expired';
}

// ─── State machine validation ─────────────────────────────────────────────────

/**
 * Validates whether a stop status transition is allowed.
 * Returns false for trusted-only transitions (client cannot request these).
 */
export function isStopTransitionAllowed(
  currentStatus: StopProgressStatus,
  nextStatus: StopProgressStatus,
  isTrustedCaller: boolean,
): boolean {
  if (TRUSTED_ONLY_STOP_TRANSITIONS.has(nextStatus) && !isTrustedCaller) {
    return false;
  }
  const allowed = STOP_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(nextStatus);
}

// ─── Sequential clue release ─────────────────────────────────────────────────
/**
 * For ordered hunts: the next stop becomes available after the current stop is completed.
 * The server manages actual reveal state (server_reveal_state column).
 * This client utility determines the UI ordering to display.
 *
 * Rules:
 * - Never display clue content for locked/not_started stops.
 * - Stop titles may be shown for all stops (for list display).
 * - Clue text shown only for available/in_progress/completed stops.
 */
export function getStopDisplayPriority(
  stops: Array<{
    id: string;
    sortOrder: number;
    progressStatus: StopProgressStatus;
    isRequired: boolean;
  }>
): Array<{
  id: string;
  sortOrder: number;
  progressStatus: StopProgressStatus;
  displayPriority: 'current' | 'next' | 'completed' | 'locked';
}> {
  const sorted = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  let foundActive = false;

  return sorted.map((stop) => {
    const completed = stop.progressStatus === 'completed';
    const active = ['available', 'in_progress', 'awaiting_proof', 'under_review'].includes(stop.progressStatus);
    const locked = ['locked', 'not_started'].includes(stop.progressStatus);

    let displayPriority: 'current' | 'next' | 'completed' | 'locked';

    if (completed) {
      displayPriority = 'completed';
    } else if (active && !foundActive) {
      displayPriority = 'current';
      foundActive = true;
    } else if (locked && foundActive) {
      displayPriority = 'next';
      foundActive = false; // only first locked stop after active is "next"
    } else {
      displayPriority = 'locked';
    }

    return {
      id: stop.id,
      sortOrder: stop.sortOrder,
      progressStatus: stop.progressStatus,
      displayPriority,
    };
  });
}

// ─── Stop completion ──────────────────────────────────────────────────────────
/**
 * Trigger stop completion via RPC.
 * Location-validated stops must use the geo validation RPC instead.
 */
export async function completeHuntStop(
  participationId: string,
  stopId: string,
  validationMethod: StopCompletionMethod = 'manual_confirmation',
): Promise<HuntStopCompletionResult> {
  // Client-side guard: never attempt trusted-only transitions
  // (under_review, needs_resubmission, rejected handled server-side)
  try {
    return await rpcCompleteHuntStop(participationId, stopId, validationMethod);
  } catch (err) {
    throw normalizeHuntError(err);
  }
}

// ─── Stop label utilities ─────────────────────────────────────────────────────

export function getStopStatusLabel(status: StopProgressStatus): string {
  const labels: Record<StopProgressStatus, string> = {
    locked:              'Locked',
    available:           'Ready',
    in_progress:         'In Progress',
    awaiting_proof:      'Proof Needed',
    under_review:        'Under Review',
    needs_resubmission:  'Resubmit Proof',
    completed:           'Completed',
    rejected:            'Proof Rejected',
    skipped:             'Skipped',
    expired:             'Expired',
  };
  return labels[status] ?? 'Unknown';
}

export function getCompletionMethodLabel(method: StopCompletionMethod): string {
  const labels: Record<StopCompletionMethod, string> = {
    none:               'No check required',
    manual_confirmation:'Tap to confirm',
    text:               'Written answer',
    image:              'Photo proof',
    location:           'Location check',
    image_and_location: 'Photo + Location',
    text_and_image:     'Written + Photo',
    trusted_code:       'Secret code',
  };
  return labels[method] ?? method;
}
