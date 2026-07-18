/**
 * Report Service — Worlds
 *
 * Allows users to report content or other users for safety review.
 * Reporters can submit and check their own report status.
 * Reporter identity is protected — reported parties cannot see who filed.
 *
 * Security: reporters may only create reports and read their own report status.
 * Full moderation access is reserved for service_role / admin RPCs.
 */

import { requireSupabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/supabase/helpers';
import type {
  ReportRow,
  ReportInsert,
  ReportableEntity,
  ReportPriority,
} from '@/lib/supabase/database.types';

// ─── Submit a report ─────────────────────────────────────────────────────────

export async function submitReport(payload: {
  reporterUserId: string;
  entityType: ReportableEntity;
  entityId: string;
  reason: string;
  description?: string;
  evidenceMediaId?: string;
  priority?: ReportPriority;
}): Promise<ReportRow> {
  const client = requireSupabase();
  const insert: ReportInsert = {
    reporter_user_id: payload.reporterUserId,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    reason: payload.reason,
    description: payload.description,
    evidence_media_id: payload.evidenceMediaId,
    priority: payload.priority ?? 'medium',
  };

  const { data, error } = await client
    .from('reports')
    .insert(insert)
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

// ─── Read own reports ─────────────────────────────────────────────────────────

/**
 * Fetch the status of reports the user has filed.
 * Returns only status info — resolution details are not exposed to reporters.
 */
export async function getMyReports(userId: string): Promise<
  Pick<ReportRow, 'id' | 'entity_type' | 'entity_id' | 'reason' | 'status' | 'created_at'>[]
> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('reports')
    .select('id, entity_type, entity_id, reason, status, created_at')
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return data ?? [];
}

// ─── Block a user ─────────────────────────────────────────────────────────────

export async function blockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('user_blocks')
    .insert({ blocker_user_id: blockerUserId, blocked_user_id: blockedUserId });

  // Ignore 23505 (already blocked)
  if (error && error.code !== '23505') throw normalizeError(error);
}

export async function unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('user_blocks')
    .delete()
    .eq('blocker_user_id', blockerUserId)
    .eq('blocked_user_id', blockedUserId);

  if (error) throw normalizeError(error);
}

export async function getMyBlockList(blockerUserId: string): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_blocks')
    .select('blocked_user_id')
    .eq('blocker_user_id', blockerUserId);

  if (error) throw normalizeError(error);
  return (data ?? []).map((r) => r.blocked_user_id);
}
