import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('RevenueCat mobile purchase wiring', () => {
  const service = read('features/revenue/services/revenueCat.ts');
  const membership = read('app/(main)/membership.tsx');

  test('uses platform keys safely and keeps SDK identity scoped to the signed-in user', () => {
    expect(service).toContain('EXPO_PUBLIC_REVENUECAT_TEST_API_KEY');
    expect(service).toContain("Platform.OS === 'ios'");
    expect(service).toContain("Platform.OS === 'android'");
    expect(service).toContain('configuredUserId === userId');
    expect(service).toContain('await module()?.logOut()');
  });

  test('uses live RevenueCat offering prices and creates paid orders before checkout', () => {
    expect(membership).toContain('useRevenueCatOfferings');
    expect(membership).toContain('pkg?.product.priceString');
    expect(membership).toContain('purchaseIntent.mutateAsync');
    expect(membership).toContain('packageForOrder(packages, order.grossMinor, order.currency)');
    expect(membership).toContain('orderId: order.orderId');
    expect(membership).toContain('provider webhook verification');
  });

  test('makes cancellation, retry, duplicate-tap prevention, and legal disclosures visible inline', () => {
    expect(membership).toContain('Purchase cancelled');
    expect(membership).toContain('loading={(isCurrent && mutation.isPending) || (!isFree && storePurchase.isPending)}');
    expect(membership).toContain('Subscriptions automatically renew');
    expect(membership).toContain('Terms');
    expect(membership).toContain('Privacy');
    expect(membership).toContain('Support');
    expect(membership).toContain('Restore Purchases');
    expect(service).toContain('restorePurchases');
  });
});