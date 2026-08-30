import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('Stage 2 revenue mobile UX', () => {
  const quests = read('app/(main)/quest/quests.tsx');
  const myHunts = read('app/(main)/hunt/my-hunts.tsx');
  const stopEditor = read('app/(main)/hunt/create/[draftId]/stop/[stopId].tsx');
  const membership = read('app/(main)/membership.tsx');

  test('shows a passive Quest upsell only at the end of a Free allowance', () => {
    expect(quests).toContain("revenueSummary.data?.planCode === 'free'");
    expect(quests).toContain('allowance.remaining <= 1');
    expect(quests).toContain('Make room for more Quests');
  });

  test('keeps badge history and acquired collectibles as dedicated My Hunts surfaces', () => {
    expect(myHunts).toContain("key: 'badges'");
    expect(myHunts).toContain("key: 'collection'");
    expect(myHunts).toContain('testID="find-badge-gallery"');
    expect(myHunts).toContain('testID="collectible-collection"');
    expect(myHunts).toContain('sold out, or deactivated');
  });

  test('requires creator acknowledgement of the exact paid-sale fee disclosure', () => {
    expect(stopEditor).toContain('30% platform fee');
    expect(stopEditor).toContain('paidFeeAcknowledged');
    expect(stopEditor).toContain('Find limit (blank = unlimited)');
    expect(stopEditor).toContain('Quantity (blank = unlimited)');
  });

  test('provides refresh, error, and provider-neutral pending-purchase states', () => {
    expect(membership).toContain('RefreshControl');
    expect(membership).toContain("Couldn't refresh your membership");
    expect(membership).toContain('Payment is pending and no collectible has been added yet.');
    expect(membership).toContain('provider-neutral intent');
  });
});