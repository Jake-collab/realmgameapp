/**
 * Hunt Availability Service — Worlds
 *
 * Computes the single authoritative HuntAvailabilityState for a Hunt + user pair.
 * The output drives Map markers, Detail header buttons, and My Hunts cards.
 *
 * This is the ONLY place where HuntAvailabilityState is resolved.
 * Never duplicate this logic in UI components.
 *
 * For writes, the server RPC (get_hunt_availability) is the true authority.
 * This client-side evaluator is used for optimistic UI and offline display.
 */

import type {
  HuntAvailabilityResult,
  HuntAvailabilityState,
  HuntAction,
  HuntStatus,
  HuntPrivacy,
  ParticipantStatus,
  InvitationStatus,
} from '../types/hunt.types';
import { ELIGIBILITY_USER_MESSAGES } from '../constants';
import { resolveHuntAction } from './huntActionResolver';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface HuntAvailabilityInput {
  huntId: string;
  occurrenceId: string | null;
  huntStatus: HuntStatus;
  huntPrivacy: HuntPrivacy;
  huntJoinPolicy: 'open' | 'approval_required' | 'invite_only';
  maxParticipants: number | null;
  currentParticipantCount: number;
  isAuthenticated: boolean;
  // User-specific (null if not authenticated or not relevant)
  participationStatus?: ParticipantStatus | null;
  participationId?: string | null;
  invitationStatus?: InvitationStatus | null;
  invitationId?: string | null;
  // Time window
  occurrenceStartsAt?: string | null;
  occurrenceEndsAt?: string | null;
  occurrenceJoinUntil?: string | null;
  now?: Date;
}

// ─── Evaluator ────────────────────────────────────────────────────────────────
/**
 * Compute the client-side Hunt availability state.
 * Used for optimistic UI — server RPC is authoritative for mutations.
 */
export function evaluateHuntAvailability(
  input: HuntAvailabilityInput
): HuntAvailabilityResult {
  const now = input.now ?? new Date();

  // ── Cancelled / Archived ──────────────────────────────────────────────────
  if (input.huntStatus === 'cancelled') {
    return result('cancelled', false, false, false, 'HUNT_CANCELLED', input);
  }
  if (input.huntStatus === 'archived') {
    return result('cancelled', false, false, false, 'HUNT_CANCELLED', input);
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (input.huntStatus === 'expired') {
    return result('expired', true, false, false, 'HUNT_EXPIRED', input);
  }

  // ── Paused ────────────────────────────────────────────────────────────────
  if (input.huntStatus === 'paused') {
    // Active participants can still see their progress
    if (input.participationStatus === 'active' || input.participationStatus === 'paused') {
      return result('active', true, false, false, 'HUNT_PAUSED', input);
    }
    return result('paused', true, false, false, 'HUNT_PAUSED', input);
  }

  // ── Not published ─────────────────────────────────────────────────────────
  if (!['active', 'ready', 'scheduled'].includes(input.huntStatus)) {
    return result('ineligible', false, false, false, 'HUNT_NOT_PUBLISHED', input);
  }

  // ── Private access ────────────────────────────────────────────────────────
  if (input.huntPrivacy === 'private') {
    const hasAccess = !!input.participationStatus || !!input.invitationId;
    if (!hasAccess) {
      return result('private', false, false, false, 'NOT_AUTHORIZED', input);
    }
  }

  // ── Existing participation ────────────────────────────────────────────────
  const ps = input.participationStatus;
  if (ps) {
    if (ps === 'completed') {
      return result('completed', true, false, false, 'ALREADY_COMPLETED', input);
    }
    if (ps === 'active' || ps === 'paused') {
      return result('active', true, false, false, 'ALREADY_JOINED', input);
    }
    if (ps === 'ready' || ps === 'accepted') {
      return result('ready', true, false, true, 'ALREADY_JOINED', input);
    }
    if (ps === 'invited') {
      return result('invited', true, true, false, 'ELIGIBLE', input);
    }
    // removed / left / declined / expired — re-joining not allowed in Build 1
    if (['removed', 'left', 'declined', 'expired'].includes(ps)) {
      return result('ineligible', true, false, false, 'NOT_AUTHORIZED', input);
    }
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!input.isAuthenticated) {
    // Still show public content but block join
    const state: HuntAvailabilityState =
      input.huntStatus === 'scheduled' ? 'upcoming' : 'available';
    return result(state, true, false, false, 'NOT_AUTHENTICATED', input);
  }

  // ── Upcoming (scheduled, not yet open) ───────────────────────────────────
  if (input.huntStatus === 'scheduled') {
    const startsAt = input.occurrenceStartsAt ? new Date(input.occurrenceStartsAt) : null;
    if (startsAt && now < startsAt) {
      // Pending invitation can still join upcoming hunts
      if (input.invitationStatus === 'pending') {
        return result('invited', true, true, false, 'ELIGIBLE', input);
      }
      return result('upcoming', true, false, false, 'HUNT_UPCOMING', input);
    }
  }

  // ── Invitation required ───────────────────────────────────────────────────
  if (input.huntPrivacy === 'invite_only' || input.huntJoinPolicy === 'invite_only') {
    if (input.invitationStatus === 'pending') {
      return result('invited', true, true, false, 'ELIGIBLE', input);
    }
    return result('invitation_required', true, false, false, 'INVITATION_REQUIRED', input);
  }

  // ── Pending invitation (non-required hunt) ────────────────────────────────
  if (input.invitationStatus === 'pending') {
    return result('invited', true, true, false, 'ELIGIBLE', input);
  }

  // ── Capacity ──────────────────────────────────────────────────────────────
  if (
    input.maxParticipants !== null &&
    input.currentParticipantCount >= input.maxParticipants
  ) {
    return result('full', true, false, false, 'HUNT_FULL', input);
  }

  // ── Join window ───────────────────────────────────────────────────────────
  if (input.occurrenceJoinUntil) {
    const joinUntil = new Date(input.occurrenceJoinUntil);
    if (now > joinUntil) {
      return result('expired', true, false, false, 'START_WINDOW_CLOSED', input);
    }
  }

  // ── Available ─────────────────────────────────────────────────────────────
  return result('available', true, true, false, 'ELIGIBLE', input);
}

// ─── Result builder ───────────────────────────────────────────────────────────

function result(
  state: HuntAvailabilityState,
  canView: boolean,
  canJoin: boolean,
  canStart: boolean,
  reasonCode: Parameters<typeof resolveHuntAction>[0]['reasonCode'],
  input: HuntAvailabilityInput,
): HuntAvailabilityResult {
  const userMessage = ELIGIBILITY_USER_MESSAGES[reasonCode] ?? '';

  const primaryAction = resolveHuntAction({
    state,
    canJoin,
    canStart,
    reasonCode,
    participationId: input.participationId ?? null,
    invitationId: input.invitationId ?? null,
  });

  return {
    state,
    canView,
    canJoin,
    canStart,
    reasonCode,
    userMessage,
    occurrenceId:     input.occurrenceId ?? undefined,
    participationId:  input.participationId ?? undefined,
    invitationId:     input.invitationId ?? undefined,
    availableFrom:    input.occurrenceStartsAt ?? undefined,
    availableUntil:   input.occurrenceEndsAt ?? undefined,
    primaryAction,
  };
}
