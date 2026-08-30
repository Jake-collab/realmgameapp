import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase/client';
import { fetch as expoFetch } from 'expo/fetch';
import type { CreatedHuntSummary, HuntCreatorDraft } from '../types/huntCreator.types';

function client() {
  if (!isSupabaseConfigured()) {
    throw new Error('Hunt creation is unavailable until the account service is connected.');
  }
  return requireSupabase() as any;
}

export async function createHuntDraft(draft: HuntCreatorDraft): Promise<HuntCreatorDraft> {
  const { data, error } = await client().rpc('create_hunt_draft_with_allowance', {
    p_payload: draft,
    p_idempotency_key: `hunt-draft:${crypto.randomUUID()}`,
  });
  if (error) throw error;
  return mapDraft(data);
}

export async function updateHuntDraft(huntId: string, draft: HuntCreatorDraft): Promise<HuntCreatorDraft> {
  const { data, error } = await client().rpc('update_hunt_draft', {
    p_hunt_id: huntId,
    p_payload: draft,
  });
  if (error) throw error;
  return mapDraft(data);
}

export async function publishHunt(huntId: string): Promise<{ huntId: string; status: string; occurrenceId: string | null }> {
  const { data, error } = await client().rpc('publish_hunt', { p_hunt_id: huntId });
  if (error) throw error;
  return {
    huntId: data?.hunt_id ?? huntId,
    status: data?.status ?? 'pending_review',
    occurrenceId: data?.occurrence_id ?? null,
  };
}

export async function beginHuntRevision(huntId: string): Promise<string> {
  const { data, error } = await client().rpc('begin_hunt_revision', { p_hunt_id: huntId });
  if (error) throw error;
  return data ?? huntId;
}

export async function fetchCreatedHunts(): Promise<CreatedHuntSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await client().rpc('get_creator_hunts');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    id: row.id,
    title: row.title,
    summary: row.summary ?? '',
    status: row.status,
    privacy: row.privacy,
    pointsReward: row.pointsReward ?? 0,
    stopCount: row.stopCount ?? 0,
    startsAt: row.startsAt ?? null,
    updatedAt: row.updatedAt,
    occurrenceId: row.occurrenceId ?? null,
  }));
}

export async function fetchCreatorHuntDraft(huntId: string): Promise<HuntCreatorDraft | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await client().rpc('get_creator_hunt', { p_hunt_id: huntId });
  if (error) throw error;
  return data ? mapDraft(data) : null;
}

export async function archiveHunt(huntId: string): Promise<void> {
  const { error } = await client().rpc('archive_hunt', { p_hunt_id: huntId });
  if (error) throw error;
}

export async function deleteHunt(huntId: string): Promise<void> {
  const { error } = await client().rpc('delete_hunt', { p_hunt_id: huntId });
  if (error) throw error;
}

export async function uploadHuntCover(huntId: string, uri: string): Promise<string> {
  const supabase = client();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in to add a cover image.');

  const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const mediaId = crypto.randomUUID();
  const storagePath = `${huntId}/cover/${mediaId}.${extension}`;
  const imageResponse = await expoFetch(uri);
  const imageData = await imageResponse.blob();
  const { error: uploadError } = await supabase.storage
    .from('custom-game-media')
    .upload(storagePath, imageData as any, { contentType: `image/${extension}`, upsert: false });
  if (uploadError) throw uploadError;

  const { data: media, error: mediaError } = await supabase
    .from('media_assets')
    .insert({
      id: mediaId,
      owner_user_id: authData.user.id,
      bucket: 'custom-game-media',
      storage_path: storagePath,
      media_type: 'image',
      mime_type: `image/${extension}`,
      purpose: 'hunt_cover',
      visibility: 'private',
      moderation_status: 'pending',
    })
    .select('id')
    .single();
  if (mediaError || !media) throw mediaError ?? new Error('Could not register cover image.');

  const { error: linkError } = await supabase.rpc('set_hunt_cover_media', {
    p_hunt_id: huntId,
    p_media_id: media.id,
  });
  if (linkError) throw linkError;
  return media.id;
}

export async function inviteFriendToHunt(
  huntId: string,
  occurrenceId: string,
  username: string,
): Promise<{ success: boolean; userMessage: string }> {
  const { data, error } = await client().rpc('invite_friend_to_hunt', {
    p_hunt_id: huntId,
    p_occurrence_id: occurrenceId,
    p_username: username,
  });
  if (error) throw error;
  return { success: Boolean(data?.success), userMessage: data?.userMessage ?? '' };
}

function mapDraft(value: any): HuntCreatorDraft {
  return {
    ...value,
    stops: Array.isArray(value?.stops) ? value.stops : [],
    startsAt: value?.startsAt ?? null,
    endsAt: value?.endsAt ?? null,
    maxParticipants: value?.maxParticipants ?? null,
    publicMeetingInfo: value?.publicMeetingInfo ?? '',
    safetyNote: value?.safetyNote ?? '',
    accessibilityNote: value?.accessibilityNote ?? '',
    coverMediaId: value?.coverMediaId ?? null,
  };
}