import { requireSupabase } from '@/lib/supabase/client';
import { fetch as expoFetch } from 'expo/fetch';
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

/**
 * A sweep is deliberately a camera capture followed by a short-lived,
 * server-issued session. There is no library/QR path and a media id alone
 * cannot be attached to a different stop or Hunt revision.
 */
export async function beginCreatorStopSweep(draftId: string, stopId: string) {
  const { data, error } = await client().rpc('begin_creator_stop_sweep', {
    p_hunt_id: draftId, p_stop_id: stopId,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.userMessage ?? 'Unable to start a live safety sweep.');
  return { sessionId: String(data.sessionId), expiresAt: String(data.expiresAt) };
}

export async function uploadCreatorStopSweep(
  draftId: string, sessionId: string, uri: string,
): Promise<string> {
  const supabase = client();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in to capture a safety sweep.');
  const response = await expoFetch(uri);
  if (!response.ok) throw new Error('The camera image could not be read.');
  const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const mediaId = crypto.randomUUID();
  const storagePath = `${draftId}/sweeps/${sessionId}/${mediaId}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('custom-game-media').upload(
    storagePath, await response.blob() as any, { contentType: `image/${extension}`, upsert: false },
  );
  if (uploadError) throw uploadError;
  const { error: mediaError } = await supabase.from('media_assets').insert({
    id: mediaId, owner_user_id: auth.user.id, bucket: 'custom-game-media',
    storage_path: storagePath, media_type: 'image', mime_type: `image/${extension}`,
    purpose: 'hunt_creator_sweep', visibility: 'private', moderation_status: 'pending',
  });
  if (mediaError) throw mediaError;
  const { data, error } = await supabase.rpc('record_creator_stop_sweep', {
    p_session_id: sessionId, p_media_id: mediaId,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.userMessage ?? 'The safety sweep could not be verified.');
  return mediaId;
}