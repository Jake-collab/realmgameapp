/**
 * Points Service — Worlds
 *
 * Read-only access to the points ledger for the mobile client.
 * Point award transactions are performed by server-side logic only
 * (Edge Functions or admin RPCs). This service queries the ledger
 * and leaderboard views.
 *
 * Security:
 *   - Users may only read their own ledger rows.
 *   - No INSERT/UPDATE/DELETE is exposed through this service.
 *   - Leaderboard visibility preference is respected by the database view.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, paginationRange, queryKeys } from '@/lib/supabase/helpers';
import type {
  PointsLedgerRow,
  UserPointTotalRow,
  LeaderboardRow,
} from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeaderboardPeriod = 'all_time' | 'monthly' | 'quest' | 'hunt';

// ─── User points ──────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's total point balance.
 * Always derived from the ledger — never from a mutable total column.
 */
export async function getMyPointTotal(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_point_totals')
    .select('total_points')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data?.total_points ?? 0;
}

/**
 * Fetch the authenticated user's transaction history.
 * Ordered by most recent first.
 */
export async function getMyLedger(
  userId: string,
  page = 1,
  pageSize = 25
): Promise<PointsLedgerRow[]> {
  const client = requireSupabase();
  const { from, to } = paginationRange(page, pageSize);
  const { data, error } = await client
    .from('points_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw normalizeError(error);
  return data ?? [];
}

/**
 * Fetch the user's global rank (1-based).
 * Uses the get_user_rank() database function.
 */
export async function getMyRank(userId: string): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const client = requireSupabase();
  const { data, error } = await client
    .rpc('get_user_rank', { p_user_id: userId });

  if (error) throw normalizeError(error);
  return data as number;
}

// ─── Leaderboards ─────────────────────────────────────────────────────────────

const LEADERBOARD_VIEW_MAP: Record<LeaderboardPeriod, string> = {
  all_time: 'leaderboard_global',
  monthly: 'leaderboard_monthly',
  quest: 'leaderboard_quest',
  hunt: 'leaderboard_hunt',
};

/**
 * Fetch a leaderboard page.
 * Leaderboard views already filter out users who opted out.
 */
export async function getLeaderboard(
  period: LeaderboardPeriod = 'all_time',
  page = 1,
  pageSize = 50
): Promise<LeaderboardRow[]> {
  const client = requireSupabase();
  const view = LEADERBOARD_VIEW_MAP[period];
  const { from, to } = paginationRange(page, pageSize);

  const { data, error } = await client
    .from(view as 'leaderboard_global')
    .select('*')
    .range(from, to);

  if (error) throw normalizeError(error);
  return (data ?? []) as LeaderboardRow[];
}

export { queryKeys };
