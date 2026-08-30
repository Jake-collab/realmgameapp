export type RevenueAllowanceKind =
  | 'quest_monthly'
  | 'quest_geo_weekly'
  | 'quest_personalized_daily'
  | 'hunt_drop_creation_weekly';

export interface RevenueAllowance {
  kind: RevenueAllowanceKind;
  periodStart: string;
  periodEnd: string;
  limit: number;
  used: number;
  remaining: number;
}

export interface RevenueSummary {
  planCode: 'free' | 'worlds_monthly' | 'worlds_yearly';
  planName: string;
  membershipPriceMinor: number;
  membershipCurrency: string;
  allowances: RevenueAllowance[];
  extraDropCredits: number;
  statistics: {
    dropsFound: number;
    findBadgesEarned: number;
    collectiblesAcquired: number;
    dropsCreated: number;
  };
  findBadges: Array<{
    id: string;
    dropTitle: string;
    creatorName: string | null;
    collectibleName: string | null;
    rarity: string | null;
    foundAt: string;
    collectibleId: string | null;
    saleStatus: 'draft' | 'active' | 'sold_out' | 'deactivated' | null;
    priceMinor: number | null;
    currency: string | null;
    ownershipStatus: 'active' | 'revoked' | 'refunded' | 'reversed' | null;
  }>;
  collection: Array<{
    ownershipId: string;
    collectibleId: string;
    name: string;
    rarity: string;
    creatorName: string | null;
    acquisitionType: 'free_claim' | 'purchase';
    status: 'active' | 'revoked' | 'refunded' | 'reversed';
    acquiredAt: string;
  }>;
}

export const MEMBERSHIP_PLANS = [
  { code: 'free', name: 'Free', price: '$0', detail: 'Explore Worlds at your own pace.' },
  { code: 'worlds_monthly', name: 'Worlds Membership', price: '$4.99/month', detail: 'More Quest access and more weekly Drop creation.' },
  { code: 'worlds_yearly', name: 'Worlds Membership', price: '$44.99/year', detail: 'The same member benefits with annual billing.' },
] as const;

export const DROP_CREDIT_PACKS = [
  { code: 'drop_credits_5', price: '$1.99', credits: 5 },
  { code: 'drop_credits_15', price: '$4.99', credits: 15 },
  { code: 'drop_credits_35', price: '$9.99', credits: 35 },
] as const;