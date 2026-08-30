import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useClaimFreeCollectible, useCreateCollectiblePurchaseIntent, useRevenueSummary } from '@/features/revenue/hooks/useRevenueSummary';
import type { RevenueSummary } from '@/features/revenue/types/revenue.types';
import { MEMBERSHIP_PLANS, DROP_CREDIT_PACKS } from '@/features/revenue/types/revenue.types';

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
  const current = summary.data?.planCode ?? 'free';
  const refreshSummary = useCallback(() => { void summary.refetch(); }, [summary]);
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
      <Text style={[styles.section, { color: colors.mutedForeground }]}>Compare plans</Text>
      {MEMBERSHIP_PLANS.map((plan) => (
        <View key={plan.code} style={[styles.plan, { backgroundColor: colors.card, borderColor: plan.code === current ? colors.primary : colors.border }]}>
          <View style={styles.planTop}>
            <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
            <Text style={[styles.price, { color: colors.primary }]}>{plan.price}</Text>
          </View>
          <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>{plan.detail}</Text>
          <Text style={[styles.benefit, { color: colors.foreground }]}>
            {plan.code === 'free' ? '10 Monthly · 1 Geo / week · 2 Drop creations / week' : '50 Monthly · 2 Geo / week · 5 Drop creations / week'}
          </Text>
          <Text style={[styles.benefit, { color: colors.foreground }]}>
            {plan.code === 'free' ? '1 Daily / Personalized Quest / week' : '1 Daily / Personalized Quest / day'}
          </Text>
          {plan.code === current && <Text style={[styles.currentBadge, { color: colors.primary }]}>Current plan</Text>}
        </View>
      ))}
      <Text style={[styles.section, { color: colors.mutedForeground }]}>Extra Drop Credits</Text>
      <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>Credits are separate from your included weekly balance and never expire. Included Drops are consumed first.</Text>
      <View style={styles.creditRow}>
        {DROP_CREDIT_PACKS.map((pack) => (
          <View key={pack.code} style={[styles.credit, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.creditCount, { color: colors.foreground }]}>{pack.credits}</Text>
            <Text style={[styles.creditLabel, { color: colors.mutedForeground }]}>credits</Text>
            <Text style={[styles.creditPrice, { color: colors.primary }]}>{pack.price}</Text>
          </View>
        ))}
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
      <Text style={[styles.note, { color: colors.mutedForeground }]}>Payment provider setup is not active yet. No purchase is completed from this screen.</Text>
    </ScrollView>
  );
}

type Badge = RevenueSummary['findBadges'][number];
type ClaimMutation = ReturnType<typeof useClaimFreeCollectible>;
type PurchaseMutation = ReturnType<typeof useCreateCollectiblePurchaseIntent>;

function CollectibleAction({ badge, freeClaim, purchaseIntent, colors }: {
  badge: Badge;
  freeClaim: ClaimMutation;
  purchaseIntent: PurchaseMutation;
  colors: ReturnType<typeof useColors>;
}) {
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
  const success = isCurrent && mutation.isSuccess;

  if (success) {
    if (isFree) {
      return <Text style={[styles.currentBadge, { color: colors.hunt }]}>
        {freeClaim.data?.alreadyOwned ? 'Already owned' : 'Free collectible claimed'}
      </Text>;
    }
    return <Text style={[styles.planDetail, { color: colors.primary }]}>Purchase intent created. Payment is pending and no collectible has been added yet.</Text>;
  }

  const price = badge.priceMinor == null
    ? null
    : new Intl.NumberFormat(undefined, { style: 'currency', currency: badge.currency ?? 'USD' }).format(badge.priceMinor / 100);
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={[styles.price, { color: isFree ? colors.hunt : colors.primary }]}>{isFree ? 'Free' : price ?? 'Price unavailable'}</Text>
      {error && <Text style={[styles.planDetail, { color: colors.destructive }]}>{error instanceof Error ? error.message : 'Please try again.'}</Text>}
      <Button
        fullWidth
        variant="outline"
        loading={isCurrent && mutation.isPending}
        disabled={!isFree && badge.priceMinor == null}
        onPress={() => isFree
          ? freeClaim.mutate(badge.id)
          : purchaseIntent.mutate({ findBadgeId: badge.id, idempotencyKey: crypto.randomUUID() })}
      >
        {error ? `Retry ${isFree ? 'free claim' : 'Purchase Intent'}` : isFree ? 'Claim Free collectible' : 'Create Purchase Intent'}
      </Button>
      {!isFree && <Text style={[styles.note, { color: colors.mutedForeground }]}>This only creates a provider-neutral intent. Purchase completion happens through the payment provider.</Text>}
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
});