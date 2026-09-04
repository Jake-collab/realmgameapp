import type { PaymentProvider } from "./types";

export type RevenueProductCode =
  | "worlds_monthly"
  | "worlds_yearly"
  | "drop_credits_5"
  | "drop_credits_15"
  | "drop_credits_35";

export type RevenueCatalogEntry = {
  code: RevenueProductCode;
  category: "membership" | "drop_credits";
  amountMinor: number;
  currency: "USD";
  credits?: number;
  entitlement: "worlds_membership" | null;
};

export const REVENUE_CATALOG: Record<RevenueProductCode, RevenueCatalogEntry> = {
  worlds_monthly: {
    code: "worlds_monthly",
    category: "membership",
    amountMinor: 499,
    currency: "USD",
    entitlement: "worlds_membership",
  },
  worlds_yearly: {
    code: "worlds_yearly",
    category: "membership",
    amountMinor: 4499,
    currency: "USD",
    entitlement: "worlds_membership",
  },
  drop_credits_5: {
    code: "drop_credits_5",
    category: "drop_credits",
    amountMinor: 199,
    currency: "USD",
    credits: 5,
    entitlement: null,
  },
  drop_credits_15: {
    code: "drop_credits_15",
    category: "drop_credits",
    amountMinor: 499,
    currency: "USD",
    credits: 15,
    entitlement: null,
  },
  drop_credits_35: {
    code: "drop_credits_35",
    category: "drop_credits",
    amountMinor: 999,
    currency: "USD",
    credits: 35,
    entitlement: null,
  },
};

type ProviderProductMapping = {
  providerProductId: string | null;
  environment: "test_and_production" | "owner_configured";
};

export const PROVIDER_PRODUCT_MAPPINGS: Record<
  PaymentProvider,
  Record<RevenueProductCode, ProviderProductMapping>
> = {
  revenuecat: Object.fromEntries(
    Object.keys(REVENUE_CATALOG).map((code) => [
      code,
      { providerProductId: code, environment: "test_and_production" },
    ]),
  ) as Record<RevenueProductCode, ProviderProductMapping>,
  apple: Object.fromEntries(
    Object.keys(REVENUE_CATALOG).map((code) => [
      code,
      { providerProductId: null, environment: "owner_configured" },
    ]),
  ) as Record<RevenueProductCode, ProviderProductMapping>,
  google_play: Object.fromEntries(
    Object.keys(REVENUE_CATALOG).map((code) => [
      code,
      { providerProductId: null, environment: "owner_configured" },
    ]),
  ) as Record<RevenueProductCode, ProviderProductMapping>,
  stripe: Object.fromEntries(
    Object.keys(REVENUE_CATALOG).map((code) => [
      code,
      { providerProductId: null, environment: "owner_configured" },
    ]),
  ) as Record<RevenueProductCode, ProviderProductMapping>,
};

export function collectibleProductId(grossMinor: number): string {
  if (!Number.isSafeInteger(grossMinor) || grossMinor <= 0) {
    throw new Error("Collectible price must be a positive integer number of minor units.");
  }
  return `collectible_${grossMinor}`;
}