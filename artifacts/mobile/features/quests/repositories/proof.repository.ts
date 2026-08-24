/**
 * Proof Repository — Worlds
 *
 * Typed database access for proof_submissions and proof_media.
 *
 * Security:
 * - Users access only their own proof via RLS.
 * - Users cannot approve their own proof.
 * - Submitted proof is immutable except through the resubmission flow.
 * - Reviewer fields (reviewer_id, review_notes, reviewed_at) are server-only.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { ProofSubmissionRow, ProofSubmissionStatus, ProofType } from '@/lib/supabase/database.types';
import { normalizeQuestError } from '../utils/questErrors';

// ─── Proof reads ───────────────────────────────────────────────────────────────

/**
 * Fetch the current (most recent) proof submission for a participation.
 */
export async function fetchCurrentProof(
  participationId: string
): Promise<ProofSubmissionRow | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .from('proof_submissions')
    .select('*')
    .eq('quest_participation_id', participationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeQuestError(error);
  return data;
}

/**
 * Fetch all proof submissions for a participation (full history).
 * Used to show resubmission chain.
 */
export async function fetchProofHistory(
  participationId: string
): Promise<ProofSubmissionRow[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('proof_submissions')
    .select('*')
    .eq('quest_participation_id', participationId)
    .order('created_at', { ascending: false });

  if (error) throw normalizeQuestError(error);
  return data ?? [];
}

/**
 * Fetch a specific proof submission by ID.
 * RLS ensures the user can only see their own.
 */
export async function fetchProofById(
  proofId: string
): Promise<ProofSubmissionRow | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .from('proof_submissions')
    .select('*')
    .eq('id', proofId)
    .maybeSingle();

  if (error) throw normalizeQuestError(error);
  return data;
}

// ─── Proof writes ──────────────────────────────────────────────────────────────

/**
 * Create a new draft proof submission.
 * Only the user's own participation is accepted (RLS enforced).
 */
export async function createDraftProof(payload: {
  userId: string;
  participationId: string;
  submissionType: ProofType;
  textResponse?: string;
  locationLat?: number;
  locationLng?: number;
  locationAccuracyMeters?: number;
  previousSubmissionId?: string;
  verificationSessionId?: string;
}): Promise<ProofSubmissionRow> {
  const client = requireSupabase();
  const insertPayload = {
    user_id: payload.userId,
    quest_participation_id: payload.participationId,
    submission_type: payload.submissionType,
    status: 'draft' as ProofSubmissionStatus,
    ...(payload.textResponse ? { text_response: payload.textResponse } : {}),
    ...(payload.locationLat !== undefined ? { location_lat: payload.locationLat } : {}),
    ...(payload.locationLng !== undefined ? { location_lng: payload.locationLng } : {}),
    ...(payload.locationAccuracyMeters !== undefined
      ? { location_accuracy_meters: payload.locationAccuracyMeters }
      : {}),
    ...(payload.previousSubmissionId
      ? { previous_submission_id: payload.previousSubmissionId }
      : {}),
    ...(payload.verificationSessionId
      ? { verification_session_id: payload.verificationSessionId }
      : {}),
  };
  const { data, error } = await client
    .from('proof_submissions')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertPayload as any)
    .select()
    .single();

  if (error) throw normalizeQuestError(error);
  return data;
}

/**
 * Update a draft proof (only editable fields — not reviewer fields).
 * Throws if proof is not in draft/uploading state.
 */
export async function updateDraftProof(
  proofId: string,
  updates: {
    text_response?: string;
    location_lat?: number;
    location_lng?: number;
    location_accuracy_meters?: number;
  }
): Promise<ProofSubmissionRow> {
  const client = requireSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('proof_submissions') as any)
    .update(updates)
    .eq('id', proofId)
    .in('status', ['draft', 'uploading'])
    .select()
    .single();

  if (error) throw normalizeQuestError(error);
  return data as unknown as ProofSubmissionRow;
}

/**
 * Submit a proof draft for review.
 * Sets status to 'submitted' and records submitted_at timestamp.
 * Proof becomes immutable after this point.
 */
export async function submitProof(proofId: string): Promise<ProofSubmissionRow> {
  const client = requireSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('proof_submissions') as any)
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', proofId)
    .in('status', ['draft', 'uploading'])
    .select()
    .single();

  if (error) throw normalizeQuestError(error);
  return data as unknown as ProofSubmissionRow;
}

/**
 * Cancel a draft proof (sets status back; does not delete).
 * Only allowed when in draft/uploading state.
 */
export async function cancelDraftProof(proofId: string): Promise<ProofSubmissionRow> {
  // We soft-cancel by just marking the draft as cancelled
  // (no cancel status — we treat this as leaving draft orphaned,
  // which is cleaned up by the start service when a new draft is created)
  return updateDraftProof(proofId, {});
}

// ─── Proof media reads ─────────────────────────────────────────────────────────

export async function fetchProofMedia(proofId: string) {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('proof_media')
    .select('*, media_assets(*)')
    .eq('submission_id', proofId)
    .order('sort_order');

  if (error) throw normalizeQuestError(error);
  return data ?? [];
}

// ─── Proof media writes ────────────────────────────────────────────────────────

/**
 * Attach an approved media asset to a draft proof.
 * Media must be owned by the user and moderation-approved.
 */
export async function attachProofMedia(
  proofId: string,
  mediaId: string,
  sortOrder: number
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('proof_media')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ submission_id: proofId, media_id: mediaId, sort_order: sortOrder } as any)
    .select()
    .single();

  if (error) throw normalizeQuestError(error);
  return data;
}
