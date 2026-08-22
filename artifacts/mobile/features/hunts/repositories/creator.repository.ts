import { requireSupabase } from '@/lib/supabase/client';
import { normalizeCreatorPayload, type DraftValidationResult, type HuntCreatorDraft, type HuntCreatorPayload } from '../types/creator.types';

function mapDraft(value: any): HuntCreatorDraft {
  return { id: value.id, ownerUserId: value.ownerUserId ?? value.owner_user_id,
    status: value.status, creationVersion: value.creationVersion ?? value.creation_version ?? 1,
    revision: value.revision ?? 1, payload: normalizeCreatorPayload(value.payload),
    reviewSummary: value.reviewSummary ?? value.review_summary ?? null,
    updatedAt: value.updatedAt ?? value.updated_at ?? new Date().toISOString(),
    submittedAt: value.submittedAt ?? value.submitted_at ?? null };
}
function client(): any { return requireSupabase() as any; }

export async function createHuntDraft(idempotencyKey: string): Promise<HuntCreatorDraft> {
  const { data, error } = await client().rpc('create_hunt_draft', { p_idempotency_key: idempotencyKey });
  if (error) throw error;
  return mapDraft(data);
}
export async function fetchCreatorHunts(): Promise<HuntCreatorDraft[]> {
  const { data, error } = await client().rpc('get_creator_hunts');
  if (error) throw error;
  return (data ?? []).map(mapDraft);
}
export async function fetchCreatorDraft(draftId: string): Promise<HuntCreatorDraft | null> {
  const { data, error } = await client().rpc('get_hunt_creator_draft', { p_draft_id: draftId });
  if (error) throw error;
  return data ? mapDraft(data) : null;
}
export async function updateCreatorDraft(draftId: string, payload: HuntCreatorPayload, revision: number): Promise<HuntCreatorDraft> {
  const { data, error } = await client().rpc('update_hunt_draft', { p_draft_id: draftId, p_payload: payload, p_expected_revision: revision });
  if (error) throw error;
  return mapDraft(data);
}
export async function validateCreatorDraftRemote(draftId: string): Promise<DraftValidationResult> {
  const { data, error } = await client().rpc('validate_hunt_draft', { p_draft_id: draftId });
  if (error) throw error;
  return { valid: Boolean(data?.valid), issues: data?.issues ?? [] };
}
export async function submitCreatorDraft(draftId: string) {
  const { data, error } = await client().rpc('submit_hunt_for_review', { p_draft_id: draftId });
  if (error) throw error;
  return data;
}
export async function archiveCreatorDraft(draftId: string) {
  const { data, error } = await client().rpc('archive_hunt_draft', { p_draft_id: draftId });
  if (error) throw error;
  return data;
}
export async function duplicateCreatorDraft(sourceId: string, idempotencyKey: string): Promise<HuntCreatorDraft> {
  const { data, error } = await client().rpc('duplicate_hunt_to_draft', { p_source_id: sourceId, p_idempotency_key: idempotencyKey });
  if (error) throw error;
  return mapDraft(data);
}