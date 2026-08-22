/**
 * My Hunts Screen — Worlds
 *
 * Internal sections (NOT bottom tabs):
 *   Active | Ready | Completed | Invitations | Create Hunt
 *
 * Defaults:
 *   1. Active when user has active participation
 *   2. Ready when a ready hunt exists
 *   3. Invitations when a pending invitation exists
 *   4. Active (general default)
 *
 * Build 1 scope:
 *   Active   — lists active hunts; Continue Hunt routes to placeholder (Prompt 13)
 *   Ready    — lists joined hunts awaiting start; Start Hunt fully implemented
 *   Completed — placeholder (Prompt 14)
 *   Invitations — fully implemented (view, accept, decline)
 *   Create Hunt — controlled placeholder (later creator prompt)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyHunts } from '@/features/hunts/hooks/useMyHunts';
import { useHuntInvitations } from '@/features/hunts/hooks/useHuntInvitations';
import { useStartHunt } from '@/features/hunts/hooks/useStartHunt';
import { useCreatorHunts, useCreateHuntDraft, useArchiveHunt } from '@/features/hunts/hooks/creatorHooks';
import { InvitationCard } from '@/components/hunt/InvitationCard';
import type { MyHuntsSummaryEntry } from '@/features/hunts/types/hunt.types';

// ─── Section types ────────────────────────────────────────────────────────────

type Section = 'active' | 'ready' | 'completed' | 'invitations' | 'create';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'active',      label: 'Active' },
  { key: 'ready',       label: 'Ready' },
  { key: 'completed',   label: 'Completed' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'create',      label: 'Create' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyHuntsScreen() {
  const colors = useColors();
  const { user } = useAuth();

  const myHuntsQuery = useMyHunts({ userId: user?.id ?? null });
  const invitationsQuery = useHuntInvitations({ userId: user?.id ?? null });
  const creatorQuery = useCreatorHunts(user?.id ?? null);
  const createDraft = useCreateHuntDraft(user?.id ?? null);

  const summary = myHuntsQuery.data as import('@/features/hunts/types/hunt.types').MyHuntsSummary | undefined;
  const invitations = invitationsQuery.data ?? [];
  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  // ── Default section logic ─────────────────────────────────────────────────
  const getDefaultSection = (): Section => {
    if (summary && summary.active.length > 0) return 'active';
    if (summary && summary.ready.length > 0)  return 'ready';
    if (pendingInvitations.length > 0)        return 'invitations';
    return 'active';
  };

  const [activeSection, setActiveSection] = useState<Section>(() => getDefaultSection());

  // Update default only on first meaningful data load
  const hasSetDefault = React.useRef(false);
  useEffect(() => {
    if (!hasSetDefault.current && summary) {
      hasSetDefault.current = true;
      setActiveSection(getDefaultSection());
    }
  }, [summary]);

  const isRefreshing = myHuntsQuery.isFetching || invitationsQuery.isFetching;
  const handleRefresh = useCallback(() => {
    myHuntsQuery.refetch();
    invitationsQuery.refetch();
  }, [myHuntsQuery, invitationsQuery]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Segmented Control ─────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.segmentContainer, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.segmentContent}
      >
        {SECTIONS.map(s => {
          const isActive = activeSection === s.key;
          const badge =
            s.key === 'active'      ? summary?.active.length :
            s.key === 'ready'       ? summary?.ready.length :
            s.key === 'invitations' ? pendingInvitations.length :
            null;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setActiveSection(s.key)}
              style={[
                styles.segmentTab,
                isActive && { borderBottomColor: colors.hunt, borderBottomWidth: 2 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${s.label}${badge ? ` (${badge})` : ''}`}
            >
              <Text style={[
                styles.segmentLabel,
                { color: isActive ? colors.hunt : colors.mutedForeground },
              ]}>
                {s.label}
              </Text>
              {!!badge && badge > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.hunt }]}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Section content ───────────────────────────────────────────── */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentPad}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.hunt} />
        }
      >
        {myHuntsQuery.isLoading ? (
          <ActivityIndicator color={colors.hunt} style={styles.loader} />
        ) : (
          <>
            {activeSection === 'active' && (
              <ActiveSection hunts={summary?.active ?? []} colors={colors} />
            )}
            {activeSection === 'ready' && (
              <ReadySection hunts={summary?.ready ?? []} colors={colors} />
            )}
            {activeSection === 'completed' && (
              <CompletedSection colors={colors} />
            )}
            {activeSection === 'invitations' && (
              <InvitationsSection
                invitations={invitations}
                colors={colors}
              />
            )}
            {activeSection === 'create' && (
              <CreateHuntSection
                colors={colors}
                drafts={creatorQuery.data ?? []}
                loading={creatorQuery.isLoading}
                onCreate={() => createDraft.mutate(undefined, {
                  onSuccess: d => router.push(`/(main)/hunt/create/${d.id}/details`),
                })}
                creating={createDraft.isPending}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Active Section ───────────────────────────────────────────────────────────

function ActiveSection({ hunts, colors }: { hunts: MyHuntsSummaryEntry[]; colors: ReturnType<typeof useColors> }) {
  if (hunts.length === 0) {
    return (
      <EmptySection
        icon="flag"
        title="No active Hunts"
        body="You don't have an active Hunt yet."
        action="Explore Hunts"
        onAction={() => router.push('/(main)/hunt')}
        colors={colors}
      />
    );
  }

  return (
    <View style={styles.sectionList}>
      {hunts.map(hunt => (
        <ActiveHuntCard
          key={hunt.huntId}
          hunt={hunt}
          onContinue={() => router.push(`/(main)/hunt-active/${hunt.participationId}`)}
          colors={colors}
        />
      ))}
    </View>
  );
}

function ActiveHuntCard({
  hunt, onContinue, colors,
}: { hunt: MyHuntsSummaryEntry; onContinue: () => void; colors: ReturnType<typeof useColors> }) {
  const progress = hunt.requiredStopCount > 0
    ? `${hunt.completedStopCount} / ${hunt.requiredStopCount} stops`
    : 'In progress';
  return (
    <TouchableOpacity
      onPress={onContinue}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hunt }]}
      accessibilityRole="button"
      accessibilityLabel={`${hunt.huntTitle}. In progress. Tap to continue.`}
    >
      <View style={[styles.cardStrip, { backgroundColor: colors.hunt }]} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {hunt.huntTitle}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
          {progress}
        </Text>
        <TouchableOpacity
          onPress={onContinue}
          style={[styles.continueBtn, { backgroundColor: colors.hunt }]}
          accessibilityLabel="Continue Hunt"
        >
          <Text style={styles.continueBtnText}>Continue Hunt</Text>
          <Feather name="arrow-right" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Ready Section ────────────────────────────────────────────────────────────

function ReadySection({ hunts, colors }: { hunts: MyHuntsSummaryEntry[]; colors: ReturnType<typeof useColors> }) {
  const startMutation = useStartHunt();
  const { user } = useAuth();

  if (hunts.length === 0) {
    return (
      <EmptySection
        icon="clock"
        title="No Ready Hunts"
        body="Joined Hunts that are waiting to begin will appear here."
        colors={colors}
      />
    );
  }

  return (
    <View style={styles.sectionList}>
      {hunts.map(hunt => (
        <ReadyEntryCard
          key={hunt.huntId}
          hunt={hunt}
          onViewHunt={() => router.push(`/hunt-detail/${hunt.huntId}`)}
          onStartHunt={
            user
              ? () => startMutation.mutate({
                  participationId: hunt.participationId,
                  huntId: hunt.huntId,
                  userId: user.id,
                }, {
                  onSuccess: (result) => {
                    if (result.success && result.participationId) {
                      router.push(`/(main)/hunt-active/${result.participationId}`);
                    }
                  },
                })
              : undefined
          }
          isStarting={startMutation.isPending}
          colors={colors}
        />
      ))}
    </View>
  );
}

function ReadyEntryCard({
  hunt, onViewHunt, onStartHunt, isStarting, colors,
}: {
  hunt: MyHuntsSummaryEntry;
  onViewHunt: () => void;
  onStartHunt?: () => void;
  isStarting: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onViewHunt}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${hunt.huntTitle}. Ready. Tap to view.`}
    >
      <View style={[styles.cardStrip, { backgroundColor: '#7C3AED' }]} />
      <View style={styles.cardBody}>
        <View style={[styles.readyBadge, { backgroundColor: colors.hunt + '18' }]}>
          <Feather name="check-circle" size={12} color={colors.hunt} />
          <Text style={[styles.readyBadgeText, { color: colors.hunt }]}>Ready</Text>
        </View>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {hunt.huntTitle}
        </Text>
        <View style={styles.readyActions}>
          <TouchableOpacity
            onPress={onViewHunt}
            style={[styles.viewBtn, { borderColor: colors.border }]}
            accessibilityLabel="View hunt details"
          >
            <Text style={[styles.viewBtnText, { color: colors.foreground }]}>View Hunt</Text>
          </TouchableOpacity>
          {onStartHunt && (
            <TouchableOpacity
              onPress={onStartHunt}
              disabled={isStarting}
              style={[styles.continueBtn, { backgroundColor: colors.hunt, opacity: isStarting ? 0.6 : 1 }]}
              accessibilityLabel="Start hunt"
            >
              <Text style={styles.continueBtnText}>{isStarting ? 'Starting…' : 'Start Hunt'}</Text>
              <Feather name="play" size={12} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Completed Section ────────────────────────────────────────────────────────

function CompletedSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <EmptySection
      icon="award"
      title="Completed Hunts"
      body="Your completed Hunt history and rewards will appear here after Prompt 14."
      colors={colors}
      isPlaceholder
    />
  );
}

// ─── Invitations Section ──────────────────────────────────────────────────────

function InvitationsSection({
  invitations, colors,
}: {
  invitations: ReturnType<typeof useHuntInvitations>['data'];
  colors: ReturnType<typeof useColors>;
}) {
  if (!invitations || invitations.length === 0) {
    return (
      <EmptySection
        icon="mail"
        title="No Invitations"
        body="You don't have any pending Hunt invitations."
        colors={colors}
      />
    );
  }

  const pending = invitations.filter(inv => inv.status === 'pending');
  const historical = invitations.filter(inv => inv.status !== 'pending');

  return (
    <View style={styles.sectionList}>
      {pending.length > 0 && (
        <>
          <Text style={[styles.subheader, { color: colors.mutedForeground }]}>Pending</Text>
          {pending.map(inv => (
            <InvitationCard
              key={inv.id}
              invitation={inv}
              onView={() => router.push(`/hunt-invitation/${inv.id}`)}
            />
          ))}
        </>
      )}
      {historical.length > 0 && (
        <>
          <Text style={[styles.subheader, { color: colors.mutedForeground }]}>History</Text>
          {historical.map(inv => (
            <InvitationCard
              key={inv.id}
              invitation={inv}
              onView={() => router.push(`/hunt-invitation/${inv.id}`)}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ─── Create Section ───────────────────────────────────────────────────────────

function CreateHuntSection({ colors, drafts, loading, onCreate, creating }: {
  colors: ReturnType<typeof useColors>;
  drafts: import('@/features/hunts/types/creator.types').HuntCreatorDraft[];
  loading: boolean;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <View style={styles.sectionList}>
      <View style={[styles.placeholderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="compass" size={40} color={colors.hunt} />
        <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>Build an adventure</Text>
        <Text style={[styles.placeholderBody, { color: colors.mutedForeground }]}>
          Create a custom Hunt for friends and explorers. Your work saves as you go and goes through review before publication.
        </Text>
        <TouchableOpacity onPress={onCreate} disabled={creating} style={[styles.emptyAction, { backgroundColor: colors.hunt, opacity: creating ? 0.6 : 1 }]}>
          <Text style={styles.emptyActionText}>{creating ? 'Starting…' : '+ Create Hunt'}</Text>
        </TouchableOpacity>
      </View>
      {loading && <ActivityIndicator color={colors.hunt} />}
      {drafts.map(draft => <CreatorDraftCard key={draft.id} draft={draft} colors={colors} />)}
    </View>
  );
}

function CreatorDraftCard({ draft, colors }: { draft: import('@/features/hunts/types/creator.types').HuntCreatorDraft; colors: ReturnType<typeof useColors> }) {
  const archive = useArchiveHunt(draft.ownerUserId);
  const title = draft.payload.title.trim() || 'Untitled Hunt';
  const action = draft.status === 'pending_review' ? 'View status' : 'Continue editing';
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={[styles.cardStrip, { backgroundColor: colors.hunt }]} />
    <View style={styles.cardBody}><View style={{flexDirection:'row',alignItems:'center'}}><Text style={[styles.cardTitle,{color:colors.foreground,flex:1}]}>{title}</Text><Text style={[styles.cardMeta,{color:colors.hunt}]}>{draft.status.replace('_',' ')}</Text></View>
      <Text style={[styles.cardMeta,{color:colors.mutedForeground}]}>{draft.payload.stops.length} stops · updated {new Date(draft.updatedAt).toLocaleDateString()}</Text>
      <View style={styles.readyActions}><TouchableOpacity onPress={()=>router.push(`/(main)/hunt/create/${draft.id}/review`)} style={[styles.continueBtn,{backgroundColor:colors.hunt}]}><Text style={styles.continueBtnText}>{action}</Text></TouchableOpacity>{draft.status !== 'pending_review'&&<TouchableOpacity onPress={()=>archive.mutate(draft.id)}><Text style={{color:colors.destructive,fontWeight:'600'}}>Archive</Text></TouchableOpacity>}</View>
    </View>
  </View>;
}

// ─── Shared empty state ───────────────────────────────────────────────────────

function EmptySection({
  icon, title, body, action, onAction, colors, isPlaceholder = false,
}: {
  icon: string;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  colors: ReturnType<typeof useColors>;
  isPlaceholder?: boolean;
}) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon as any} size={36} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} style={[styles.emptyAction, { backgroundColor: colors.hunt }]}>
          <Text style={styles.emptyActionText}>{action}</Text>
        </TouchableOpacity>
      )}
      {isPlaceholder && (
        <Text style={[styles.placeholderNote, { color: colors.mutedForeground }]}>
          Coming in Prompt 14
        </Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  segmentContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
  },
  segmentContent: {
    paddingHorizontal: spacing[4],
    gap: 0,
  },
  segmentTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    gap: spacing[1],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  segmentLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontSize: 10,
  },

  content: { flex: 1 },
  contentPad: { padding: spacing[4], gap: spacing[3] },
  loader: { marginTop: spacing[8] },

  sectionList: { gap: spacing[3] },

  subheader: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -spacing[1],
  },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardStrip: { width: 4 },
  cardBody: {
    flex: 1,
    padding: spacing[4],
    gap: spacing[2],
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  cardMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    marginTop: spacing[1],
  },
  continueBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: '#fff',
  },

  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[8],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyAction: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    marginTop: spacing[1],
  },
  emptyActionText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: '#fff',
  },
  placeholderNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },

  placeholderCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacing[8],
    alignItems: 'center',
    gap: spacing[3],
  },
  placeholderTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  placeholderBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  readyBadgeText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.xs },
  readyActions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1], flexWrap: 'wrap' },
  viewBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  viewBtnText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
});
