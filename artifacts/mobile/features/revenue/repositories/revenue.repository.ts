import { requireSupabase } from '@/lib/supabase/client';
import type { RevenueAllowance, RevenueAllowanceKind, RevenueSummary } from '../types/revenue.types';

type RevenueRow = {
  planCode?: unknown;
  planName?: unknown;
  membershipPriceMinor?: unknown;
  membershipCurrency?: unknown;
  allowances?: unknown;
  extraDropCredits?: unknown;
  statistics?: unknown;
  findBadges?: unknown;
  collection?: unknown;
};

function mapAllowance(value: unknown): RevenueAllowance {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    kind: String(row.kind) as RevenueAllowanceKind,
    periodStart: String(row.periodStart ?? ''),
    periodEnd: String(row.periodEnd ?? ''),
    limit: Number(row.limit ?? 0),
    used: Number(row.used ?? 0),
    remaining: Number(row.remaining ?? 0),
  };
}

function mapFindBadge(value: unknown): RevenueSummary['findBadges'][number] {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ''),
    dropTitle: String(row.dropTitle ?? ''),
    creatorName: row.creatorName == null ? null : String(row.creatorName),
    collectibleName: row.collectibleName == null ? null : String(row.collectibleName),
    rarity: row.rarity == null ? null : String(row.rarity),
    foundAt: String(row.foundAt ?? ''),
    collectibleId: row.collectibleId == null ? null : String(row.collectibleId),
    saleStatus: row.saleStatus == null ? null : String(row.saleStatus) as RevenueSummary['findBadges'][number]['saleStatus'],
    priceMinor: row.priceMinor == null ? null : Number(row.priceMinor),
    currency: row.currency == null ? null : String(row.currency),
    ownershipStatus: row.ownershipStatus == null ? null : String(row.ownershipStatus) as RevenueSummary['findBadges'][number]['ownershipStatus'],
  };
}

export async function fetchRevenueSummary(): Promise<RevenueSummary> {
  const { data, error } = await (requireSupabase() as unknown as {
    rpc: (name: string) => Promise<{ data: unknown; error: Error | null }>;
  }).rpc('get_my_revenue_summary');
  if (error) throw error;
  const row = (data ?? {}) as RevenueRow;
  const statistics = (row.statistics ?? {}) as Record<string, unknown>;
  return {
    planCode: (String(row.planCode ?? 'free') as RevenueSummary['planCode']),
    planName: String(row.planName ?? 'Free'),
    membershipPriceMinor: Number(row.membershipPriceMinor ?? 0),
    membershipCurrency: String(row.membershipCurrency ?? 'USD'),
    allowances: Array.isArray(row.allowances) ? row.allowances.map(mapAllowance) : [],
    extraDropCredits: Number(row.extraDropCredits ?? 0),
    statistics: {
      dropsFound: Number(statistics.dropsFound ?? 0),
      findBadgesEarned: Number(statistics.findBadgesEarned ?? 0),
      collectiblesAcquired: Number(statistics.collectiblesAcquired ?? 0),
      dropsCreated: Number(statistics.dropsCreated ?? 0),
    },
    findBadges: Array.isArray(row.findBadges) ? row.findBadges.map(mapFindBadge) : [],
    collection: Array.isArray(row.collection) ? row.collection as RevenueSummary['collection'] : [],
  };
}

export interface CollectibleAcquisitionResult {
  alreadyOwned: boolean;
  collectibleId: string | null;
  ownershipId: string | null;
}

function acquisitionError(reasonCode: unknown): Error {
  const messages: Record<string, string> = {
    BADGE_NOT_FOUND: 'This Find Badge could not be verified.',
    NOT_FREE: 'This collectible is not available as a free claim.',
    NOT_PAID: 'This collectible is not available for purchase.',
    SOLD_OUT: 'This collectible is sold out.',
    ALREADY_OWNED: 'You already own this collectible.',
    SELLER_UNAVAILABLE: 'The seller is not verified for paid collectibles.',
  };
  const code = String(reasonCode ?? '');
  return new Error(messages[code] ?? 'The collectible is unavailable right now. Please try again.');
}

export async function claimFreeCollectible(findBadgeId: string): Promise<CollectibleAcquisitionResult> {
  const { data, error } = await (requireSupabase() as any).rpc('claim_free_collectible', {
    p_find_badge_id: findBadgeId,
  });
  if (error) throw error;
  if (!data?.success) throw acquisitionError(data?.reasonCode);
  return {
    alreadyOwned: Boolean(data.alreadyOwned),
    collectibleId: data.collectibleId == null ? null : String(data.collectibleId),
    ownershipId: data.ownershipId == null ? null : String(data.ownershipId),
  };
}

export interface CollectiblePurchaseIntent {
  orderId: string;
  state: string;
  grossMinor: number;
  currency: string;
}

export async function createCollectiblePurchaseIntent(
  findBadgeId: string,
  idempotencyKey: string,
): Promise<CollectiblePurchaseIntent> {
  const { data, error } = await (requireSupabase() as any).rpc('create_collectible_purchase_intent', {
    p_find_badge_id: findBadgeId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  if (!data?.success) throw acquisitionError(data?.reasonCode);
  return {
    orderId: String(data.orderId),
    state: String(data.state),
    grossMinor: Number(data.grossMinor),
    currency: String(data.currency),
  };
}

export async function consumeQuestAllowance(kind: RevenueAllowanceKind, idempotencyKey: string): Promise<boolean> {
  const { data, error } = await (requireSupabase() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
  }).rpc('consume_quest_allowance', { p_kind: kind, p_idempotency_key: idempotencyKey });
  if (error) throw error;
  return Boolean((data as { success?: boolean } | null)?.success);
}

export async function consumeDropCreationAllowance(idempotencyKey: string): Promise<'included_weekly' | 'extra_credit'> {
  const { data, error } = await (requireSupabase() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
  }).rpc('consume_drop_creation_allowance', { p_idempotency_key: idempotencyKey });
  if (error) throw error;
  const result = data as { success?: boolean; source?: 'included_weekly' | 'extra_credit'; userMessage?: string } | null;
  if (!result?.success || !result.source) throw new Error(result?.userMessage ?? 'Drop creation is unavailable right now.');
  return result.source;
}