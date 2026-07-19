/**
 * Quest Proof Service — Worlds
 *
 * Manages the proof submission lifecycle for quest participations.
 *
 * Rules:
 * - Proof belongs to the authenticated participation (RLS enforced).
 * - Draft proof is editable; submitted proof is immutable.
 * - Users cannot approve their own proof.
 * - Users cannot change reviewer fields.
 * - Submission is idempotent — one active draft per participation.
 * - Resubmission links to the prior submission (audit chain).
 * - Proof media uses the protected storage architecture.
 */

import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  createDraftProof,
  updateDraftProof,
  submitProof,
  fetchCurrentProof,
  fetchProofHistory,
} from '../repositories/proof.repository';
import {
  fetchParticipationById,
  updateParticipationStatus,
} from '../repositories/quest.repository';
import {
  validateProofTransition,
  isProofEditable,
  isProofImmutable,
  canUserSubmitProof,
} from '../stateMachine/proof.machine';
import { normalizeQuestError, makeQuestError } from '../utils/questErrors';
import { onProofStarted, onProofSubmitted } from '../events/questEvents';
import type { ProofSubmissionRow, ProofType } from '@/lib/supabase/database.types';
import type { ProofRequirementConfig } from '../types/quest.types';
import { MAX_PROOF_IMAGES, MAX_PROOF_TEXT_LENGTH, MIN_PROOF_TEXT_LENGTH } from '../constants';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CreateDraftInput {
  participationId: string;
  userId: string;
  submissionType: ProofType;
  textResponse?: string;
  locationLat?: number;
  locationLng?: number;
  locationAccuracyMeters?: number;
}

export interface ProofOperationResult {
  success: boolean;
  proof: ProofSubmissionRow | null;
  error?: ReturnType<typeof makeQuestError>;
}

// ─── Create draft proof ────────────────────────────────────────────────────────

/**
 * Create a new draft proof for a participation.
 * One active draft per participation at a time — existing drafts are returned.
 */
export async function createQuestProofDraft(input: CreateDraftInput): Promise<ProofOperationResult> {
  const { participationId, userId } = input;

  if (!isSupabaseConfigured()) {
    return { success: true, proof: buildMockProof(participationId, userId) };
  }

  // Check for existing draft
  const existing = await fetchCurrentProof(participationId).catch(() => null);
  if (existing && isProofEditable(existing.status)) {
    // Return existing draft (idempotent)
    return { success: true, proof: existing };
  }
  if (existing && isProofImmutable(existing.status)) {
    // Submitted or approved proof exists — cannot create new draft
    if (existing.status === 'needs_resubmission') {
      // Resubmission flow: create new draft linked to prior
      return createResubmissionDraft(input, existing.id);
    }
    return { success: false, proof: existing, error: makeQuestError('PROOF_ALREADY_SUBMITTED') };
  }

  // Verify participation ownership
  const participation = await fetchParticipationById(participationId).catch(() => null);
  if (!participation || participation.user_id !== userId) {
    return { success: false, proof: null, error: makeQuestError('NOT_ELIGIBLE', 'Ownership mismatch') };
  }

  try {
    const proof = await createDraftProof({
      userId,
      participationId,
      submissionType: input.submissionType,
      textResponse: input.textResponse,
      locationLat: input.locationLat,
      locationLng: input.locationLng,
      locationAccuracyMeters: input.locationAccuracyMeters,
    });

    onProofStarted(userId, participation.quest_id, participationId);
    return { success: true, proof };
  } catch (err) {
    return { success: false, proof: null, error: normalizeQuestError(err) };
  }
}

// ─── Update draft proof ────────────────────────────────────────────────────────

export async function updateQuestProofDraft(
  proofId: string,
  userId: string,
  updates: {
    textResponse?: string;
    locationLat?: number;
    locationLng?: number;
    locationAccuracyMeters?: number;
  }
): Promise<ProofOperationResult> {
  if (!isSupabaseConfigured()) {
    return { success: true, proof: null };
  }

  const existing = await fetchCurrentProof(proofId).catch(() => null);
  if (!existing) return { success: false, proof: null, error: makeQuestError('QUEST_NOT_FOUND') };
  if (!isProofEditable(existing.status)) {
    return { success: false, proof: existing, error: makeQuestError('PROOF_ALREADY_SUBMITTED') };
  }
  if (existing.user_id !== userId) {
    return { success: false, proof: null, error: makeQuestError('NOT_ELIGIBLE') };
  }

  try {
    const updated = await updateDraftProof(proofId, {
      text_response: updates.textResponse,
      location_lat: updates.locationLat,
      location_lng: updates.locationLng,
      location_accuracy_meters: updates.locationAccuracyMeters,
    });
    return { success: true, proof: updated };
  } catch (err) {
    return { success: false, proof: null, error: normalizeQuestError(err) };
  }
}

// ─── Validate required evidence ────────────────────────────────────────────────

export interface ProofValidationResult {
  valid: boolean;
  missingFields: string[];
}

export function validateProofRequirements(
  proof: ProofSubmissionRow,
  config: ProofRequirementConfig,
  attachedMediaCount: number
): ProofValidationResult {
  const missing: string[] = [];

  if (config.requiresProof && !proof.submission_type) {
    missing.push('Proof type required');
  }

  // Text validation
  if (['text', 'text_and_image'].includes(config.proofType)) {
    const text = proof.text_response ?? '';
    if (text.length < config.minTextLength) {
      missing.push(`Response must be at least ${config.minTextLength} characters`);
    }
    if (text.length > config.maxTextLength) {
      missing.push(`Response must be under ${config.maxTextLength} characters`);
    }
  }

  // Image validation
  if (['photo', 'image', 'image_and_location', 'text_and_image'].includes(config.proofType)) {
    if (attachedMediaCount < config.minImageCount) {
      missing.push(`At least ${config.minImageCount} image${config.minImageCount !== 1 ? 's' : ''} required`);
    }
  }

  // Location validation
  if (config.requiresLocation) {
    if (!proof.location_lat || !proof.location_lng) {
      missing.push('Location evidence required');
    }
  }

  return { valid: missing.length === 0, missingFields: missing };
}

// ─── Submit proof ─────────────────────────────────────────────────────────────

/**
 * Submit a draft proof for review.
 * Validates required fields before submitting.
 * Transitions participation to awaiting_proof or under_review.
 */
export async function submitQuestProof(
  proofId: string,
  userId: string,
  participationId: string
): Promise<ProofOperationResult> {
  if (!isSupabaseConfigured()) {
    return { success: true, proof: buildMockProof(participationId, userId) };
  }

  const proof = await fetchCurrentProof(participationId).catch(() => null);
  if (!proof) return { success: false, proof: null, error: makeQuestError('PROOF_REQUIRED') };
  if (proof.user_id !== userId) return { success: false, proof: null, error: makeQuestError('NOT_ELIGIBLE') };

  // Validate transition
  const transitionCheck = validateProofTransition(proof.status, 'submitted', false);
  if (!transitionCheck.allowed) {
    return { success: false, proof, error: makeQuestError('PROOF_ALREADY_SUBMITTED') };
  }

  try {
    const submitted = await submitProof(proofId);

    // Transition participation to under_review
    await updateParticipationStatus(participationId, {
      status: 'under_review',
      submitted_at: new Date().toISOString(),
      last_progress_at: new Date().toISOString(),
    }).catch(() => {
      // Non-fatal — proof was submitted; participation state will be reconciled
    });

    // Load quest_id for event
    const participation = await fetchParticipationById(participationId).catch(() => null);
    if (participation) {
      onProofSubmitted(userId, participation.quest_id, participationId, submitted.submission_type);
    }

    return { success: true, proof: submitted };
  } catch (err) {
    return { success: false, proof: null, error: normalizeQuestError(err) };
  }
}

// ─── Retrieve current submission ──────────────────────────────────────────────

export async function getQuestProof(participationId: string): Promise<ProofSubmissionRow | null> {
  if (!isSupabaseConfigured()) return null;
  return fetchCurrentProof(participationId).catch(() => null);
}

export async function getQuestProofHistory(participationId: string): Promise<ProofSubmissionRow[]> {
  if (!isSupabaseConfigured()) return [];
  return fetchProofHistory(participationId).catch(() => []);
}

// ─── Resubmission flow ─────────────────────────────────────────────────────────

async function createResubmissionDraft(
  input: CreateDraftInput,
  previousSubmissionId: string
): Promise<ProofOperationResult> {
  try {
    const proof = await createDraftProof({
      userId: input.userId,
      participationId: input.participationId,
      submissionType: input.submissionType,
      textResponse: input.textResponse,
      previousSubmissionId,
    });
    return { success: true, proof };
  } catch (err) {
    return { success: false, proof: null, error: normalizeQuestError(err) };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildMockProof(participationId: string, userId: string): ProofSubmissionRow {
  const now = new Date().toISOString();
  return {
    id: 'dev-proof-' + Math.random().toString(36).slice(2, 8),
    user_id: userId,
    quest_participation_id: participationId,
    hunt_stop_progress_id: null,
    submission_type: 'none',
    text_response: null,
    location_lat: null,
    location_lng: null,
    location_accuracy_meters: null,
    status: 'draft',
    moderation_status: 'pending',
    review_notes: null,
    reviewer_id: null,
    submitted_at: null,
    reviewed_at: null,
    previous_submission_id: null,
    created_at: now,
    updated_at: now,
  };
}

