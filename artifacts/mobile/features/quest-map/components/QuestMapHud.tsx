import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useStatistics } from '@/features/progression/hooks/useStatistics';
import { useQuestProgress } from '@/features/quests/hooks/useQuestProgress';
import type { QuestWithRelations } from '@/features/quests/repositories/quest.repository';
import type { QuestParticipationRowExtended } from '@/features/quests/repositories/quest.repository';
import type { PublicGeoQuestMapItem } from '../types/questMap.types';
import { buildQuestMapHudProgress } from '../utils/questMapHud';

interface QuestMapHudProps {
  selectedQuest: PublicGeoQuestMapItem | null;
  selectedQuestDetail: QuestWithRelations | null | undefined;
  selectedParticipation: QuestParticipationRowExtended | null;
  activeCount: number | null;
  nearbyCount: number | null;
  nearbyCountIsApproximate?: boolean;
  isLoadingActive: boolean;
}

export function QuestMapHud({
  selectedQuest,
  selectedQuestDetail,
  selectedParticipation,
  activeCount,
  nearbyCount,
  nearbyCountIsApproximate = false,
  isLoadingActive,
}: QuestMapHudProps) {
  const colors = useColors();
  const router = useRouter();
  const statisticsQuery = useStatistics();
  const progressQuery = useQuestProgress(selectedParticipation?.id);
  const [now, setNow] = useState(() => Date.now());
  const hasTimer = Boolean(
    selectedQuest &&
    selectedParticipation &&
    selectedQuestDetail?.verification_methods?.includes('timer') &&
    selectedParticipation?.verification_earliest_completion_at,
  );

  useEffect(() => {
    if (!hasTimer) return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [hasTimer]);

  if (!selectedQuest || !selectedQuestDetail || !selectedParticipation) {
    const points = statisticsQuery.data?.combinedPoints;
    return (
      <View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityLabel={`${points ?? 'Points unavailable'} player points, ${
          activeCount ?? 'active quests unavailable'
        } active quests, ${nearbyCount ?? 'nearby quests unavailable'} nearby quests`}
      >
        <View style={styles.headerRow}>
          <View style={[styles.icon, { backgroundColor: colors.accent + '18' }]}>
            <Feather name="compass" size={16} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Quest Map</Text>
          {statisticsQuery.isFetching && (
            <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.statRow}>
          <HudStat
            icon="award"
            value={points === undefined ? '—' : points.toLocaleString()}
            label="player points"
            colors={colors}
          />
          <HudStat
            icon="zap"
            value={isLoadingActive || activeCount === null ? '—' : String(activeCount)}
            label="active"
            colors={colors}
          />
          <HudStat
            icon="map-pin"
            value={nearbyCount === null ? '—' : String(nearbyCount)}
            label={nearbyCountIsApproximate ? 'in view' : 'nearby'}
            colors={colors}
          />
        </View>
      </View>
    );
  }

  const focusedQuest = selectedQuest;
  const progress = buildQuestMapHudProgress({
    quest: selectedQuestDetail,
    participation: selectedParticipation,
    stepProgress: progressQuery.data ?? [],
    now,
  });
  const accent = colors.accent;
  const isDataLoading = progressQuery.isLoading || selectedQuestDetail === undefined;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityLabel={`${focusedQuest.title}, ${progress.readiness}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.icon, { backgroundColor: accent + '18' }]}>
          <Feather name="navigation" size={16} color={accent} />
        </View>
        <View style={styles.titleCopy}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {focusedQuest.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {progress.readiness}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/quest-active/${selectedParticipation.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${focusedQuest.title}`}
          style={[styles.openButton, { borderColor: colors.border }]}
        >
          <Feather name="arrow-up-right" size={15} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {isDataLoading ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>Syncing progress…</Text>
      ) : (
        <>
          {progress.objective.percent !== null && (
            <ProgressRow
              icon="check-square"
              label="Required objectives"
              value={`${progress.objective.completed}/${progress.objective.total}`}
              percent={progress.objective.percent}
              colors={colors}
            />
          )}
          {progress.geo.percent !== null && (
            <ProgressRow
              icon="map-pin"
              label="Verified GPS checks"
              value={`${progress.geo.verified}/${progress.geo.total}`}
              percent={progress.geo.percent}
              colors={colors}
            />
          )}
          {progress.activity.percent !== null && (
            <ProgressRow
              icon="navigation"
              label="Verified activity"
              value={`${Math.round(progress.activity.distanceMeters)}m / ${Math.round(progress.activity.targetMeters)}m`}
              percent={progress.activity.percent}
              colors={colors}
            />
          )}
          {progress.timer && (
            <View style={styles.detailRow}>
              <Feather name="clock" size={14} color={accent} />
              <Text style={[styles.detailLabel, { color: colors.foreground }]}>Timer</Text>
              <Text style={[styles.detailValue, { color: progress.timer.ready ? colors.success : colors.mutedForeground }]}>
                {progress.timer.label}
              </Text>
            </View>
          )}
          {!progress.canShowProgressBar && !progress.timer && (
            <View style={styles.detailRow}>
              <Feather name="shield" size={14} color={colors.mutedForeground} />
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                Progress appears after server verification updates
              </Text>
            </View>
          )}
          {progressQuery.isError && (
            <Text style={[styles.status, { color: colors.warning }]}>
              Progress is temporarily unavailable; server state remains authoritative.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function HudStat({
  icon,
  value,
  label,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.stat}>
      <Feather name={icon} size={13} color={colors.mutedForeground} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ProgressRow({
  icon,
  label,
  value,
  percent,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  percent: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.progressBlock}>
      <View style={styles.detailRow}>
        <Feather name={icon} size={14} color={colors.accent} />
        <Text style={[styles.detailLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 78,
    left: spacing[4],
    maxWidth: '88%',
    minWidth: 260,
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 8,
    gap: spacing[2],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, marginTop: 1 },
  openButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingTop: spacing[1],
  },
  stat: { flex: 1, gap: 2 },
  statValue: { fontFamily: fontFamily.bold, fontSize: fontSize.base },
  statLabel: { fontFamily: fontFamily.regular, fontSize: 10 },
  progressBlock: { gap: spacing[1] },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  detailLabel: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  detailValue: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  status: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 17 },
});