import { Platform } from 'react-native';

type RevenueCatPackage = {
  identifier: string;
  product: { identifier: string; title: string; description: string; priceString: string; price?: number; currencyCode?: string };
  packageType?: string;
};

type PurchasesModule = {
  configure: (configuration: { apiKey: string; appUserID?: string }) => void;
  logIn: (appUserID: string) => Promise<unknown>;
  logOut: () => Promise<unknown>;
  getOfferings: () => Promise<{ current: { availablePackages: RevenueCatPackage[] } | null }>;
  purchasePackage: (pkg: RevenueCatPackage) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
  setAttributes?: (attributes: Record<string, string | null>) => Promise<void>;
};

export type StorePackage = RevenueCatPackage;

let purchases: PurchasesModule | null | undefined;
let configuredUserId: string | null = null;
let sdkConfigured = false;

function module(): PurchasesModule | null {
  if (purchases !== undefined) return purchases;
  try {
    // Kept optional for Expo Go/web previews; native release builds include this module.
    const loaded = require('react-native-purchases');
    purchases = (loaded.default ?? loaded) as PurchasesModule;
  } catch {
    purchases = null;
  }
  return purchases;
}

export function revenueCatApiKey(): string | null {
  // Test Store is deliberately preferred outside a native production build when supplied.
  const isPreview = __DEV__ || Platform.OS === 'web';
  if (isPreview && process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY) {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? null;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? null;
  return null;
}

export async function configureRevenueCat(userId: string): Promise<boolean> {
  const client = module();
  const apiKey = revenueCatApiKey();
  if (!client || !apiKey) return false;
  if (configuredUserId === userId) return true;
  if (!sdkConfigured) {
    client.configure({ apiKey, appUserID: userId });
    sdkConfigured = true;
  } else {
    await client.logIn(userId);
  }
  configuredUserId = userId;
  return true;
}

export async function logoutRevenueCat(): Promise<void> {
  if (!configuredUserId) return;
  try {
    await module()?.logOut();
  } finally {
    configuredUserId = null;
  }
}

export async function getRevenueCatPackages(): Promise<StorePackage[]> {
  const client = module();
  if (!client || !configuredUserId) throw new Error('Purchases are not available in this build.');
  return (await client.getOfferings()).current?.availablePackages ?? [];
}

export async function buyRevenueCatPackage(pkg: StorePackage, orderId?: string): Promise<void> {
  const client = module();
  if (!client || !configuredUserId) throw new Error('Purchases are not available in this build.');
  // The webhook can use this immutable server order id to reconcile a paid collectible.
  if (orderId) await client.setAttributes?.({ collectible_order_id: orderId });
  await client.purchasePackage(pkg);
}

export async function restoreRevenueCatPurchases(): Promise<void> {
  const client = module();
  if (!client || !configuredUserId) throw new Error('Purchases are not available in this build.');
  await client.restorePurchases();
}

export function packageForCode(packages: StorePackage[], code: string): StorePackage | undefined {
  return packages.find((pkg) => pkg.identifier === code || pkg.product.identifier === code);
}

export function packageForOrder(packages: StorePackage[], grossMinor: number, currency: string): StorePackage | undefined {
  return packages.find((pkg) =>
    pkg.product.identifier === `collectible_${grossMinor}`
    &&
    Math.round((pkg.product.price ?? -1) * 100) === grossMinor
    && (!pkg.product.currencyCode || pkg.product.currencyCode.toUpperCase() === currency.toUpperCase()),
  );
}