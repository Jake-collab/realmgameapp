/**
 * Canonical Drop RPC gateway. These calls only work online: sessions are short
 * lived and the server validates location again when a Drop is collected.
 */
import { getSupabaseClient } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors/normalizeError';
import type { PublicHuntSearchZone } from '../types/canonicalHunt.types';

function db() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Hunt services are unavailable.');
  return client;
}

export async function fetchHuntDropSearchZones(participationId: string): Promise<PublicHuntSearchZone[]> {
  const { data, error } = await db().rpc('get_hunt_drop_search_zones' as never, { p_participation_id: participationId } as never);
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map(row => ({
    dropId: row.drop_id,
    huntId: row.hunt_id,
    dropType: row.drop_type,
    searchCenterLatitude: row.search_lat,
    searchCenterLongitude: row.search_lng,
    searchRadiusMeters: row.search_radius_meters,
    clueRevealRadiusMeters: row.clue_reveal_radius_meters,
    collectionRadiusMeters: row.collection_radius_meters,
    clueState: row.clue_state,
    collectionState: row.collection_state,
    title: row.title,
    points: row.points,
  }));
}

export async function issueHuntDropCollectionSession(input: {
  participationId: string; stopId: string; latitude: number; longitude: number; accuracyMeters: number;
}): Promise<{ sessionId: string; expiresAt: string }> {
  const { data, error } = await db().rpc('issue_hunt_drop_collection_session' as never, {
    p_participation_id: input.participationId, p_stop_id: input.stopId, p_latitude: input.latitude,
    p_longitude: input.longitude, p_accuracy_meters: input.accuracyMeters,
  } as never);
  if (error) throw normalizeError(error);
  const result = data as any;
  if (!result?.success) throw new Error(result?.userMessage ?? 'Unable to start a collection session.');
  return { sessionId: result.sessionId, expiresAt: result.expiresAt };
}

export async function collectHuntDrop(input: {
  sessionId: string; latitude: number; longitude: number; accuracyMeters: number;
}): Promise<{ collectionId: string; awardedPoints: number }> {
  const { data, error } = await db().rpc('collect_hunt_drop' as never, {
    p_session_id: input.sessionId, p_latitude: input.latitude, p_longitude: input.longitude,
    p_accuracy_meters: input.accuracyMeters,
  } as never);
  if (error) throw normalizeError(error);
  const result = data as any;
  if (!result?.success) throw new Error(result?.userMessage ?? 'Unable to collect this Drop.');
  return { collectionId: result.collectionId, awardedPoints: result.awardedPoints };
}

export async function submitHuntDropRiddleAnswer(input: {
  participationId: string; stopId: string; answer: string;
}): Promise<{ correct: boolean; userMessage: string }> {
  const { data, error } = await db().rpc('submit_hunt_drop_riddle_answer' as never, {
    p_participation_id: input.participationId, p_stop_id: input.stopId, p_answer: input.answer,
  } as never);
  if (error) throw normalizeError(error);
  const result = data as any;
  if (!result?.success) throw new Error(result?.userMessage ?? 'Unable to check that answer.');
  return { correct: result.correct, userMessage: result.userMessage };
}