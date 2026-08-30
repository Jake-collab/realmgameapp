/**
 * Quest Detail Screen — Worlds
 *
 * Full quest information with state-driven primary action.
 * Reachable from any quest card; supports deep links.
 *
 * Rules:
 * - Never raw-read Supabase here — use domain hooks only.
 * - Start Quest is the required label before initiation.
 * - Primary action adapts to current availability state.
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { shadows } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  useQuestDetail,
  useQuestAvailability,
  useStartQuest,
} from '@/features/quests/hooks';
import { resolveQuestAction } from '@/features/quests/utils/questActionResolver';
import { getQuestVerificationMethods, verificationLabel } from '@/features/quests/utils/questVerification';
import QuestTypeBadge from '@/components/quest/QuestTypeBadge';
import DifficultyBadge from '@/components/quest/DifficultyBadge';
import DurationLabel from '@/components/quest/DurationLabel';
import AvailabilityNotice from '@/components/quest/AvailabilityNotice';
import QuestObjectiveView from '@/components/quest/QuestObjectiveView';
import ProofRequirementSummary from '@/components/quest/ProofRequirementSummary';
import SafetyNotice from '@/components/quest/SafetyNotice';
import LocationSummary from '@/components/quest/LocationSummary';
import PointsBadge from '@/components/ui/PointsBadge';
import { QuestDetailSkeleton } from '@/components/quest/QuestSkeleton';

// ─── Point reward label ────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[secStyles.title, { color: colors.foreground }]}>{label}</Text>
  );
}
const secStyles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    marginBottom: spacing[3],
  },
});

// ─── Meta pill ─────────────────────────────────────────────────────────────────

function MetaPill({
  icon,
  label,
  color,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        metaStyles.pill,
        { backgroundColor: color + '15', borderColor: color + '30' },
      ]}
    >
      <Feather name={icon} size={12} color={color} />
      <Text style={[metaStyles.label, { color }]}>{label}</Text>
    </View>
  );
}
const metaStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function QuestDetailScreen() {
  const { questId } = useLocalSearchParams<{ questId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();

  const detailQuery = useQuestDetail(questId);
  const availabilityQuery = useQuestAvailability(questId);
  const [isStarting, setIsStarting] = useState(false);

  const quest = detailQuery.data;
  const availability = availabilityQuery.data;

  const startMutation = useStartQuest({
    onSuccess: result => {
      setIsStarting(false);
      if (result.success && result.participation) {
        router.replace(`/quest-active/${result.participation.id}`);
      } else {
        Alert.alert('Could not start quest', result.error?.message ?? 'Please try again.');
      }
    },
    onError: () => {
      setIsStarting(false);
      Alert.alert('Error', 'Could not start quest. Please try again.');
    },
  });

  const action = resolveQuestAction({
    availabilityState: availability?.state ?? 'available',
    reasonCode: availability?.reasonCode,
    userMessage: availability?.userMessage,
    availableFrom: availability?.availableFrom,
  });

  const handleAction = useCallback(() => {
    if (!quest || !availability) return;

    switch (action.actionType) {
      case 'start':
        setIsStarting(true);
        startMutation.mutate(quest.id);
        break;
      case 'continue':
      case 'submit_proof':
      case 'view_submission':
      case 'resubmit':
        if (availability.activeParticipationId) {
          router.push(`/quest-active/${availability.activeParticipationId}`);
        }
        break;
      case 'view_completion':
        if (availability.activeParticipationId) {
          router.push(`/quest-completion/${availability.activeParticipationId}`);
        }
        break;
    }
  }, [action, quest, availability, startMutation, router]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (detailQuery.isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SafeHeader onBack={() => router.back()} />
        <QuestDetailSkeleton />
      </View>
    );
  }

  // ── Error / not found ──────────────────────────────────────────────────────

  if (detailQuery.isError || !quest) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SafeHeader onBack={() => router.back()} />
        <View style={styles.errorState}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            {detailQuery.isError ? 'Could not load quest.' : 'Quest not found.'}
          </Text>
          <TouchableOpacity
            onPress={() => void detailQuery.refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const sortedObjectives = [...(quest.quest_objectives ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const typeColors = {
    daily:   colors.quest,
    monthly: colors.primary,
    geo:     colors.accent,
  };
  const accentColor = typeColors[quest.quest_type] ?? colors.primary;
  const verificationMethods = getQuestVerificationMethods(quest);

  const isUnavailable = !action.enabled;
  const isLoading = isStarting || startMutation.isPending;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <SafeHeader onBack={() => router.back()} title="Quest Details" />

      {/* ── Content ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero accent bar */}
        <View style={[styles.heroBar, { backgroundColor: accentColor }]} />

        {/* Title area */}
        <View style={styles.titleArea}>
          <View style={styles.badgeRow}>
            <QuestTypeBadge questType={quest.quest_type} />
            <AvailabilityNotice state={availability?.state ?? 'available'} compact />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {quest.title}
          </Text>
          {quest.summary && (
            <Text style={[styles.summary, { color: colors.mutedForeground }]}>
              {quest.summary}
            </Text>
          )}
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <PointsBadge value={quest.points_reward} color={accentColor} />
          <DurationLabel estimatedMinutes={quest.estimated_duration_minutes} />
          <DifficultyBadge difficulty={quest.difficulty} />
          {quest.is_repeatable && (
            <MetaPill icon="refresh-cw" label="Repeatable" color={colors.mutedForeground} />
          )}
        </View>

        {/* Availability window */}
        {(quest.available_from || quest.available_until) && (
          <View
            style={[
              styles.windowBox,
              { backgroundColor: colors.secondary, borderRadius: radius.lg },
            ]}
          >
            {quest.available_from && (
              <View style={styles.windowRow}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <Text style={[styles.windowText, { color: colors.mutedForeground }]}>
                  From {new Date(quest.available_from).toLocaleDateString()}
                </Text>
              </View>
            )}
            {quest.available_until && (
              <View style={styles.windowRow}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.windowText, { color: colors.mutedForeground }]}>
                  Until {new Date(quest.available_until).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Description */}
        {quest.description && (
          <View style={styles.section}>
            <SectionTitle label="About this Quest" />
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {quest.description}
            </Text>
          </View>
        )}

        {/* Objectives */}
        {sortedObjectives.length > 0 && (
          <View style={styles.section}>
            <SectionTitle
              label={sortedObjectives.length === 1 ? 'Objective' : 'Objectives'}
            />
            <View style={styles.objectives}>
              {sortedObjectives.map((obj, idx) => (
                <QuestObjectiveView
                  key={obj.id}
                  objective={obj}
                  stepNumber={sortedObjectives.length > 1 ? idx + 1 : undefined}
                />
              ))}
            </View>
          </View>
        )}

        {/* Proof requirement */}
        <View style={styles.section}>
          <SectionTitle label="Proof Requirement" />
          <ProofRequirementSummary
            proofType={quest.proof_type}
            completionMode={quest.completion_mode}
          />
          {verificationMethods.length > 0 && (
            <View style={styles.verificationList}>
              {verificationMethods.map((method) => (
                <View key={method} style={[styles.verificationItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather
                    name={method === 'activity_tracking' ? 'navigation' : method === 'camera' ? 'camera' : method === 'gps' ? 'map-pin' : method === 'timer' ? 'clock' : 'check-circle'}
                    size={15}
                    color={accentColor}
                  />
                  <Text style={[styles.verificationText, { color: colors.foreground }]}>
                    {method === 'activity_tracking' && quest.required_distance_meters
                      ? `${verificationLabel(method)} · ${Math.round(quest.required_distance_meters)} m`
                      : verificationLabel(method)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Location */}
        {quest.quest_locations && quest.quest_locations.length > 0 && (
          <View style={styles.section}>
            <SectionTitle label="Location" />
            <View
              style={[
                styles.locationBox,
                { backgroundColor: colors.secondary, borderRadius: radius.lg },
              ]}
            >
              <LocationSummary
                location={{
                  id: quest.quest_locations[0].id,
                  quest_id: quest.id,
                  display_name: quest.quest_locations[0].display_name,
                  public_lat: quest.quest_locations[0].public_lat ?? null,
                  public_lng: quest.quest_locations[0].public_lng ?? null,
                  public_radius_meters: quest.quest_locations[0].public_radius_meters ?? null,
                  address_hint: quest.quest_locations[0].address_hint ?? null,
                }}
              />
            </View>
          </View>
        )}

        {/* Accessibility */}
        {quest.accessibility_notes && (
          <View style={styles.section}>
            <View style={[styles.accessNote, { borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.accessText, { color: colors.mutedForeground }]}>
                {quest.accessibility_notes}
              </Text>
            </View>
          </View>
        )}

        {/* Safety */}
        {quest.safety_notes && (
          <View style={styles.section}>
            <SafetyNotice notes={quest.safety_notes} />
          </View>
        )}

        {/* Bottom padding for fixed action bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Primary Action Bar ────────────────────────────────────── */}
      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        {!action.enabled && action.disabledReason && (
          <Text style={[styles.disabledNote, { color: colors.mutedForeground }]}>
            {action.disabledReason}
          </Text>
        )}
        <Pressable
          onPress={handleAction}
          disabled={isUnavailable || isLoading}
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: isUnavailable
                ? colors.muted
                : isLoading
                ? accentColor + 'aa'
                : accentColor,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          {isLoading ? (
            <Text style={[styles.actionLabel, { color: colors.primaryForeground }]}>
              Starting…
            </Text>
          ) : (
            <>
              <Text
                style={[
                  styles.actionLabel,
                  {
                    color: isUnavailable ? colors.mutedForeground : colors.primaryForeground,
                  },
                ]}
              >
                {action.label}
              </Text>
              {action.enabled && (
                <Feather
                  name="arrow-right"
                  size={18}
                  color={isUnavailable ? colors.mutedForeground : colors.primaryForeground}
                />
              )}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Safe header ───────────────────────────────────────────────────────────────

function SafeHeader({ onBack, title }: { onBack: () => void; title?: string }) {
  const colors = useColors();
  return (
    <View style={[headerStyles.container, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onBack}
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>
      {title && (
        <Text style={[headerStyles.title, { color: colors.foreground }]}>{title}</Text>
      )}
      <View style={{ width: 22 }} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
  },
});

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing[4],
  },
  heroBar: {
    height: 4,
  },
  titleArea: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
    gap: spacing[3],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * 1.2,
  },
  summary: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  windowBox: {
    marginHorizontal: spacing[5],
    padding: spacing[3],
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  windowText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  section: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.65,
  },
  verificationList: {
    gap: spacing[2],
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  verificationText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
  objectives: {
    gap: spacing[2],
  },
  locationBox: {
    padding: spacing[4],
  },
  accessNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accessText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
  actionBar: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  disabledNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
  },
  actionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[4],
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.full,
  },
  retryText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
});
