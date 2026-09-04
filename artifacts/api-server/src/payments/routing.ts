import { PROVIDER_PRODUCT_MAPPINGS, type RevenueProductCode } from "./catalog";
import type { PaymentCategory, PaymentProvider, SellerStatus } from "./types";

export type CheckoutPlatform = "ios" | "android" | "web";
export type CheckoutRouteStatus = "available" | "unavailable";

export type PaymentRouteInput = {
  platform: CheckoutPlatform;
  category: PaymentCategory;
  productCode?: RevenueProductCode;
  providerAvailability: Partial<Record<PaymentProvider, boolean>>;
  sellerStatus?: SellerStatus;
};

export type PaymentRouteDecision = {
  status: CheckoutRouteStatus;
  provider: PaymentProvider | null;
  reason:
    | "native_provider_unavailable"
    | "native_product_not_mapped"
    | "web_provider_unavailable"
    | "web_product_not_mapped"
    | "seller_not_eligible"
    | "available";
};

function nativeProviderFor(platform: CheckoutPlatform): PaymentProvider | null {
  if (platform === "ios") return "apple";
  if (platform === "android") return "google_play";
  return null;
}

function unavailable(reason: PaymentRouteDecision["reason"]): PaymentRouteDecision {
  return { status: "unavailable", provider: null, reason };
}

/**
 * Selects a route from trusted server inputs. There is intentionally no
 * client-selected provider argument.
 */
export function selectPaymentRoute(input: PaymentRouteInput): PaymentRouteDecision {
  const nativeProvider = nativeProviderFor(input.platform);
  if (nativeProvider) {
    if (!input.providerAvailability[nativeProvider]) return unavailable("native_provider_unavailable");
    if (input.category === "collectible" || !input.productCode) {
      return unavailable("native_product_not_mapped");
    }
    const mapping = PROVIDER_PRODUCT_MAPPINGS[nativeProvider][input.productCode];
    return mapping.providerProductId
      ? { status: "available", provider: nativeProvider, reason: "available" }
      : unavailable("native_product_not_mapped");
  }

  if (!input.providerAvailability.stripe) return unavailable("web_provider_unavailable");
  if (input.category === "collectible" && input.sellerStatus !== "active") {
    return unavailable("seller_not_eligible");
  }
  if (!input.productCode) return unavailable("web_product_not_mapped");
  const mapping = PROVIDER_PRODUCT_MAPPINGS.stripe[input.productCode];
  return mapping.providerProductId
    ? { status: "available", provider: "stripe", reason: "available" }
    : unavailable("web_product_not_mapped");
}