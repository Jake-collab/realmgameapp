/**
 * QuestSkeleton
 *
 * Layout-specific loading skeletons for quest screens.
 * Use the specific variant matching the content being loaded.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@/components/loading/Skeleton';
import { useColors } from '@/hooks/useColors';
import { radius, spacing } from '@/constants/spacing';

// ─── Active Quest Panel Skeleton ──────────────────────────────────────────────

export function ActiveQuestPanelSkeleton() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.card, borderRadius: radius.xl },
      ]}
    >
      <Skeleton width={80} height={20} borderRadius={radius.full} />
      <Skeleton width="80%" height={24} />
      <Skeleton width="60%" height={16} />
      <View style={styles.panelFooter}>
        <Skeleton width={80} height={28} borderRadius={radius.full} />
        <Skeleton width={120} height={36} borderRadius={radius.full} />
      </View>
    </View>
  );
}

// ─── Quest Card Skeleton ───────────────────────────────────────────────────────

export function QuestCardSkeleton() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderRadius: radius.lg },
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: colors.border }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Skeleton width="55%" height={16} />
          <Skeleton width={48} height={20} borderRadius={radius.full} />
        </View>
        <Skeleton width="35%" height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

// ─── Quest Detail Skeleton ────────────────────────────────────────────────────

export function QuestDetailSkeleton() {
  return (
    <View style={styles.detail}>
      <Skeleton width="100%" height={200} borderRadius={0} />
      <View style={styles.detailBody}>
        <Skeleton width={80} height={20} borderRadius={radius.full} />
        <Skeleton width="75%" height={28} />
        <View style={styles.metaRow}>
          <Skeleton width={60} height={24} borderRadius={radius.full} />
          <Skeleton width={60} height={24} borderRadius={radius.full} />
          <Skeleton width={80} height={24} borderRadius={radius.full} />
        </View>
        <Skeleton width="100%" height={16} />
        <Skeleton width="90%" height={16} />
        <Skeleton width="70%" height={16} />
        <View style={{ height: spacing[4] }} />
        <Skeleton width="40%" height={20} />
        <Skeleton width="100%" height={80} borderRadius={radius.md} />
      </View>
    </View>
  );
}

// ─── Daily Summary Skeleton ───────────────────────────────────────────────────

export function DailySummarySkeleton() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.summary,
        { backgroundColor: colors.card, borderRadius: radius.lg },
      ]}
    >
      <View style={styles.summaryLeft}>
        <Skeleton width={48} height={14} borderRadius={radius.full} />
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={13} />
      </View>
      <Skeleton width={64} height={32} borderRadius={radius.full} />
    </View>
  );
}

// ─── Monthly Summary Skeleton ─────────────────────────────────────────────────

export function MonthlySummarySkeleton() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.monthlyCard,
        { backgroundColor: colors.card, borderRadius: radius.xl },
      ]}
    >
      <Skeleton width="100%" height={140} borderRadius={radius.md} />
      <View style={styles.monthlyBody}>
        <Skeleton width={90} height={16} borderRadius={radius.full} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="85%" height={14} />
        <Skeleton width="50%" height={14} />
      </View>
    </View>
  );
}

// ─── Home Skeleton (full screen) ──────────────────────────────────────────────

export function HomeQuestSkeleton() {
  return (
    <View style={styles.home}>
      <ActiveQuestPanelSkeleton />
      <DailySummarySkeleton />
      <MonthlySummarySkeleton />
      <QuestCardSkeleton />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    padding: spacing[5],
    gap: spacing[3],
  },
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  detail: {
    flex: 1,
  },
  detailBody: {
    padding: spacing[5],
    gap: spacing[3],
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  summaryLeft: {
    flex: 1,
    gap: spacing[1.5],
  },
  monthlyCard: {
    overflow: 'hidden',
  },
  monthlyBody: {
    padding: spacing[4],
    gap: spacing[2],
  },
  home: {
    gap: spacing[4],
    padding: spacing[5],
  },
});
