import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useClaimFreeCollectible, useCreateCollectiblePurchaseIntent, useRevenueSummary } from '@/features/revenue/hooks/useRevenueSummary';
import type { RevenueSummary } from '@/features/revenue/types/revenue.types';
import { useRevenueCatOfferings, useRevenueCatPurchase, useRevenueCatRestore } from '@/features/revenue/hooks/useRevenueCat';
import { packageForCode, packageForOrder, type StorePackage } from '@/features/revenue/services/revenueCat';

const allowanceLabels: Record<string, string> = {
  quest_monthly: 'Monthly Quests',
  quest_geo_weekly: 'Geo-Quests / week',
  quest_personalized_daily: 'Daily / Personalized Quests',
  hunt_drop_creation_weekly: 'Drop creations / week',
};

export default function MembershipScreen() {
  const colors = useColors();
  const summary = useRevenueSummary();
  const freeClaim = useClaimFreeCollectible();
  const purchaseIntent = useCreateCollectiblePurchaseIntent();
  const offerings = useRevenueCatOfferings();
  const storePurchase = useRevenueCatPurchase();
  const restore = useRevenueCatRestore();
  const current = summary.data?.planCode ?? 'free';
  const refreshSummary = useCallback(() => { void summary.refetch(); }, [summary]);
  useEffect(() => {
    if (!storePurchase.isSuccess) return;
    // RevenueCat's client acknowledgement is not ownership. Keep the neutral
    // summary fresh while the provider webhook finalizes the server record.
    const timer = setInterval(() => { void summary.refetch(); }, 5_000);
    return () => clearInterval(timer);
  }, [storePurchase.isSuccess, summary]);
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={summary.isFetching} onRefresh={refreshSummary} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}><Feather name="award" size={22} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Worlds Membership</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>One membership for Quest and Hunt.</Text>
        </View>
       {summary.isLoading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading membership summary" />}
       {summary.isError && (
         <View style={[styles.error, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '45' }]}>
            <Text style={[styles.planDetail, { color: colors.destructive }]}>{"Couldn't refresh your membership, balances, and Hunt history."}</Text>
           <Button variant="outline" onPress={refreshSummary}>Retry</Button>
         </View>
       )}
        <Feather name="x" size={20} color={colors.mutedForeground} onPress={() => router.back()} />
      </View>
      {summary.data && (
        <View style={[styles.current, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
          <Text style={[styles.currentLabel, { color: colors.primary }]}>CURRENT PLAN</Text>
          <Text style={[styles.currentName, { color: colors.foreground }]}>{summary.data.planName}</Text>
          <Text style={[styles.currentCopy, { color: colors.mutedForeground }]}>Your balances resolve automatically on UTC calendar periods.</Text>
          {summary.data.allowances.map((allowance) => (
            <View key={allowance.kind} style={styles.allowanceRow}>
              <Text style={[styles.allowanceLabel, { color: colors.foreground }]}>{allowanceLabels[allowance.kind] ?? allowance.kind}</Text>
              <Text style={[styles.allowanceValue, { color: colors.primary }]}>{allowance.remaining} remaining</Text>
            </View>
          ))}
          <View style={styles.allowanceRow}>
            <Text style={[styles.allowanceLabel, { color: colors.foreground }]}>Extra Drop Credits</Text>
            <Text style={[styles.allowanceValue, { color: colors.primary }]}>{summary.data.extraDropCredits}</Text>
          </View>
        </View>
      )}
      <Text style={[styles.section, { color: colors.mutedForeground }]}>Membership</Text>
      {['worlds_monthly', 'worlds_yearly'].map((code) => {
        const pkg = packageForCode(offerings.data ?? [], code);
        const annual = code === 'worlds_yearly';
        return (
        <View key={code} style={[styles.plan, { backgroundColor: colors.card, borderColor: code === current ? colors.primary : colors.border }]}>
          <View style={styles.planTop}>
            <Text style={[styles.planName, { color: colors.foreground }]}>Worlds Membership</Text>
            <Text style={[styles.price, { color: colors.primary }]}>{pkg?.product.priceString ?? 'Loading price…'}</Text>
          </View>
          <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>{annual ? 'The same member benefits with annual billing.' : 'More Quest access and more weekly Drop creation.'}</Text>
          <Text style={[styles.benefit, { color: colors.foreground }]}>
            50 Monthly · 2 Geo / week · 5 Drop creations / week
          </Text>
          <Text style={[styles.benefit, { color: colors.foreground }]}>1 Daily / Personalized Quest / day</Text>
          {code === current ? <Text style={[styles.currentBadge, { color: colors.primary }]}>Current plan</Text> : (
            <PurchaseButton pkg={pkg} purchase={storePurchase} colors={colors} label={`Choose ${annual ? 'yearly' : 'monthly'}`} />
          )}
        </View>
        );
      })}
      <Text style={[styles.section, { color: colors.mutedForeground }]}>Extra Drop Credits</Text>
      <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>Credits are separate from your included weekly balance and never expire. Included Drops are consumed first.</Text>
      <View style={styles.creditRow}>
        {['drop_credits_5', 'drop_credits_15', 'drop_credits_35'].map((code) => {
          const pkg = packageForCode(offerings.data ?? [], code);
          return <View key={code} style={[styles.credit, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.creditCount, { color: colors.foreground }]}>{code.split('_').pop()}</Text>
            <Text style={[styles.creditLabel, { color: colors.mutedForeground }]}>credits</Text>
            <Text style={[styles.creditPrice, { color: colors.primary }]}>{pkg?.product.priceString ?? 'Loading…'}</Text>
            <PurchaseButton pkg={pkg} purchase={storePurchase} colors={colors} label="Buy" />
          </View>
        })}
      </View>
      {summary.data && (
        <>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Hunt keepsakes</Text>
          <View style={[styles.plan, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.foreground }]}>Drops Found</Text><Text style={[styles.allowanceValue, { color: colors.hunt }]}>{summary.data.statistics.dropsFound}</Text></View>
            <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.foreground }]}>Find Badges Earned</Text><Text style={[styles.allowanceValue, { color: colors.hunt }]}>{summary.data.statistics.findBadgesEarned}</Text></View>
            <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.foreground }]}>Collectibles Acquired</Text><Text style={[styles.allowanceValue, { color: colors.hunt }]}>{summary.data.statistics.collectiblesAcquired}</Text></View>
            <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.foreground }]}>Drops Created</Text><Text style={[styles.allowanceValue, { color: colors.hunt }]}>{summary.data.statistics.dropsCreated}</Text></View>
          </View>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Find Badge gallery</Text>
          {summary.data.findBadges.length === 0 ? (
            <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>Verified Drop finds appear here permanently, even when a collectible is declined, sold out, deactivated, or refunded.</Text>
          ) : summary.data.findBadges.map((badge) => (
            <View key={badge.id} style={[styles.plan, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.planName, { color: colors.foreground }]}>{badge.dropTitle}</Text>
              <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>{badge.rarity ?? 'Find Badge'}{badge.creatorName ? ` · by ${badge.creatorName}` : ''}</Text>
              <CollectibleAction
                badge={badge}
                freeClaim={freeClaim}
                purchaseIntent={purchaseIntent}
                packages={offerings.data ?? []}
                storePurchase={storePurchase}
                colors={colors}
              />
            </View>
          ))}
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Collection</Text>
          {summary.data.collection.length === 0 ? (
            <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>Only free claims and finalized purchases appear in your Collection.</Text>
          ) : summary.data.collection.map((owned) => (
            <View key={owned.ownershipId} style={[styles.plan, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.planTop}><Text style={[styles.planName, { color: colors.foreground }]}>{owned.name}</Text><Text style={[styles.currentBadge, { color: owned.status === 'active' ? colors.hunt : colors.destructive }]}>{owned.status}</Text></View>
              <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>{owned.rarity} · {owned.acquisitionType === 'purchase' ? 'Purchased' : 'Free claim'}</Text>
            </View>
          ))}
        </>
      )}
      {offerings.isError && <View style={styles.error}><Text style={[styles.planDetail, { color: colors.destructive }]}>{offerings.error instanceof Error ? offerings.error.message : 'Could not load store prices.'}</Text><Button variant="outline" onPress={() => void offerings.refetch()}>Retry store</Button></View>}
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Subscriptions automatically renew unless canceled at least 24 hours before the current period ends. Payment is charged to your App Store or Google Play account. Manage or cancel in your store account settings.</Text>
      <Button
        variant="outline"
        loading={restore.isPending}
        onPress={() => {
          restore.reset();
          void restore.mutateAsync().then(() => summary.refetch());
        }}
      >
        Restore Purchases
      </Button>
      {restore.isSuccess && <Text style={[styles.note, { color: colors.hunt }]}>Purchases restored. Membership access may take a moment to verify.</Text>}
      {restore.isError && <Text style={[styles.note, { color: colors.destructive }]}>Restore failed. Check your connection and retry.</Text>}
      <View style={styles.links}><Text onPress={() => void Linking.openURL('https://matterrealm.com/terms')} style={[styles.link, { color: colors.primary }]}>Terms</Text><Text onPress={() => void Linking.openURL('https://matterrealm.com/privacy')} style={[styles.link, { color: colors.primary }]}>Privacy</Text><Text onPress={() => void Linking.openURL('https://matterrealm.com/support')} style={[styles.link, { color: colors.primary }]}>Support</Text></View>
    </ScrollView>
  );
}

type Badge = RevenueSummary['findBadges'][number];
type ClaimMutation = ReturnType<typeof useClaimFreeCollectible>;
type PurchaseMutation = ReturnType<typeof useCreateCollectiblePurchaseIntent>;

function PurchaseButton({ pkg, purchase, colors, label }: { pkg?: StorePackage; purchase: ReturnType<typeof useRevenueCatPurchase>; colors: ReturnType<typeof useColors>; label: string }) {
  const [cancelled, setCancelled] = useState(false);
  const isCurrent = purchase.variables?.pkg.identifier === pkg?.identifier;
  const error = isCurrent && purchase.isError ? purchase.error : null;
  const isCancelled = Boolean(error && typeof error === 'object' && 'userCancelled' in error && (error as { userCancelled?: boolean }).userCancelled);
  return (
    <View style={{ gap: spacing[1] }}>
      {isCurrent && purchase.isSuccess && <Text style={[styles.note, { color: colors.primary }]}>Purchase submitted. We’re waiting for verification to update your membership.</Text>}
      {(cancelled || isCancelled) && <Text style={[styles.note, { color: colors.mutedForeground }]}>Purchase cancelled. No charge was completed.</Text>}
      {error && !isCancelled && <Text style={[styles.note, { color: colors.destructive }]}>{error instanceof Error ? error.message : 'Purchase could not be completed.'}</Text>}
      <Button fullWidth variant="outline" disabled={!pkg} loading={isCurrent && purchase.isPending} onPress={() => {
        setCancelled(false);
        if (!pkg) return;
        purchase.mutate({ pkg }, { onError: (cause) => setCancelled(Boolean(cause && typeof cause === 'object' && 'userCancelled' in cause && (cause as { userCancelled?: boolean }).userCancelled)) });
      }}>{error && !isCancelled ? `Retry ${label}` : label}</Button>
    </View>
  );
}

function CollectibleAction({ badge, freeClaim, purchaseIntent, packages, storePurchase, colors }: {
  badge: Badge;
  freeClaim: ClaimMutation;
  purchaseIntent: PurchaseMutation;
  packages: StorePackage[];
  storePurchase: ReturnType<typeof useRevenueCatPurchase>;
  colors: ReturnType<typeof useColors>;
}) {
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  if (!badge.collectibleId) return <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>No collectible offered</Text>;
  if (badge.ownershipStatus === 'active') return <Text style={[styles.currentBadge, { color: colors.hunt }]}>Already owned</Text>;
  if (badge.saleStatus === 'deactivated') return <Text style={[styles.currentBadge, { color: colors.mutedForeground }]}>Deactivated</Text>;
  if (badge.saleStatus === 'draft') return <Text style={[styles.currentBadge, { color: colors.mutedForeground }]}>Unavailable — seller verification required</Text>;
  if (badge.saleStatus === 'sold_out') return <Text style={[styles.currentBadge, { color: colors.destructive }]}>Sold Out</Text>;
  if (badge.saleStatus !== 'active') return <Text style={[styles.currentBadge, { color: colors.mutedForeground }]}>Collectible unavailable</Text>;

  const isFree = badge.priceMinor === 0;
  const mutation = isFree ? freeClaim : purchaseIntent;
  const isCurrent = isFree
    ? freeClaim.variables === badge.id
    : purchaseIntent.variables?.findBadgeId === badge.id;
  const error = isCurrent && mutation.isError ? mutation.error : null;
  const success = isFree ? isCurrent && mutation.isSuccess : Boolean(paidOrderId);

  if (success) {
    if (isFree) {
      return <Text style={[styles.currentBadge, { color: colors.hunt }]}>
        {freeClaim.data?.alreadyOwned ? 'Already owned' : 'Free collectible claimed'}
      </Text>;
    }
    return <Text style={[styles.planDetail, { color: colors.primary }]}>Purchase submitted for verification. Payment is pending and no collectible has been added yet.</Text>;
  }

  const price = badge.priceMinor == null
    ? null
    : new Intl.NumberFormat(undefined, { style: 'currency', currency: badge.currency ?? 'USD' }).format(badge.priceMinor / 100);
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={[styles.price, { color: isFree ? colors.hunt : colors.primary }]}>{isFree ? 'Free' : price ?? 'Price unavailable'}</Text>
      {error && <Text style={[styles.planDetail, { color: colors.destructive }]}>{error instanceof Error ? error.message : 'Please try again.'}</Text>}
      {paymentError && <Text style={[styles.planDetail, { color: colors.destructive }]}>{paymentError}</Text>}
      {cancelled && <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>Purchase cancelled. Your collectible was not added.</Text>}
      <Button
        fullWidth
        variant="outline"
        loading={(isCurrent && mutation.isPending) || (!isFree && storePurchase.isPending)}
        disabled={!isFree && badge.priceMinor == null}
        onPress={() => {
          if (isFree) {
            freeClaim.mutate(badge.id);
            return;
          }
          setPaymentError(null);
          setCancelled(false);
          void purchaseIntent.mutateAsync({ findBadgeId: badge.id, idempotencyKey: crypto.randomUUID() })
            .then((order) => {
              const pkg = packageForOrder(packages, order.grossMinor, order.currency);
              if (!pkg) throw new Error('This collectible price is not available in the store. Please try again later.');
              return storePurchase.mutateAsync({ pkg, orderId: order.orderId }).then(() => setPaidOrderId(order.orderId));
            })
            .catch((cause: unknown) => {
              if (cause && typeof cause === 'object' && 'userCancelled' in cause && (cause as { userCancelled?: boolean }).userCancelled) setCancelled(true);
              else setPaymentError(cause instanceof Error ? cause.message : 'Purchase could not be completed. Please try again.');
            });
        }}
      >
        {error || paymentError ? `Retry ${isFree ? 'free claim' : 'purchase'}` : isFree ? 'Claim Free collectible' : 'Buy collectible'}
      </Button>
      {!isFree && <Text style={[styles.note, { color: colors.mutedForeground }]}>A provider-neutral intent and server order are created before checkout. The store purchase is linked to that order and your Collection updates only after provider webhook verification.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[5], gap: spacing[3], paddingBottom: spacing[12] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingBottom: spacing[2] },
  icon: { width: 42, height: 42, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: 3 },
  current: { borderWidth: 1, borderRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  currentLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, letterSpacing: 1 },
  currentName: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  currentCopy: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18, marginBottom: spacing[2] },
  allowanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(127,127,127,.22)' },
  allowanceLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  allowanceValue: { fontFamily: fontFamily.bold, fontSize: fontSize.sm },
  section: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing[3] },
  plan: { borderWidth: 1, borderRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
  price: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
  planDetail: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 19 },
  benefit: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 19 },
  currentBadge: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, marginTop: spacing[1] },
  creditRow: { flexDirection: 'row', gap: spacing[2] },
  credit: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: spacing[3], alignItems: 'center' },
  creditCount: { fontFamily: fontFamily.bold, fontSize: fontSize.lg },
  creditLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.xs },
  creditPrice: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, marginTop: spacing[2] },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing[2] },
  error: { borderWidth: 1, borderRadius: radius.lg, padding: spacing[3], gap: spacing[2] },
  links: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[1] },
  link: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, textDecorationLine: 'underline' },
});