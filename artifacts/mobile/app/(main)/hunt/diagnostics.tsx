/**
 * Hunt Dev Diagnostics Screen — Worlds
 *
 * Development-only screen for inspecting Hunt domain state.
 * Gated with __DEV__: never included in production navigation.
 *
 * Navigation:
 *   No tab entry. Only reachable via programmatic navigate in dev builds.
 *   See docs/HUNT_TESTING.md for access instructions.
 */

import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { fontFamily } from '@/constants/typography';
import { spacing, radius } from '@/constants/spacing';
import {
  DEV_HUNT_FIXTURES,
  DEV_ACTIVE_HUNT,
  DEV_PENDING_INVITATION,
  DEV_MY_HUNTS_SUMMARY,
  DEV_VALIDATION_RESPONSES,
} from '@/features/hunts/fixtures/huntFixtures';
import {
  evaluateHuntAvailability,
  evaluateHuntEligibility,
  evaluateCompletionReadiness,
  getStopDisplayPriority,
  resolveHuntAction,
} from '@/features/hunts';

if (!__DEV__) {
  throw new Error('[DEV] Hunt diagnostics screen must not be included in production builds.');
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <View style={styles.section}>
      <TouchableOpacity onPress={() => setCollapsed(c => !c)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{collapsed ? '▶' : '▼'} {title}</Text>
      </TouchableOpacity>
      {!collapsed && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}:</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <Text style={styles.json}>
      {JSON.stringify(data, null, 2)}
    </Text>
  );
}

// ─── Diagnostics screen ───────────────────────────────────────────────────────

export default function HuntDiagnosticsScreen() {
  // ── Eligibility checks ────────────────────────────────────────────────────
  const eligibilityUnauthenticated = evaluateHuntEligibility({
    huntId: DEV_HUNT_FIXTURES[0].id,
    huntStatus: 'active',
    huntPrivacy: 'public',
    huntJoinPolicy: 'open',
    maxParticipants: null,
    minParticipants: 1,
    currentParticipantCount: 0,
    context: { userId: null, profile: null },
  });

  const eligibilityEligible = evaluateHuntEligibility({
    huntId: DEV_HUNT_FIXTURES[0].id,
    huntStatus: 'active',
    huntPrivacy: 'public',
    huntJoinPolicy: 'open',
    maxParticipants: null,
    minParticipants: 1,
    currentParticipantCount: 0,
    context: {
      userId: '00000000-dead-beef-0001-000000000001',
      profile: { account_status: 'active', onboarding_status: 'completed' },
    },
  });

  const eligibilityFull = evaluateHuntEligibility({
    huntId: DEV_HUNT_FIXTURES[0].id,
    huntStatus: 'active',
    huntPrivacy: 'public',
    huntJoinPolicy: 'open',
    maxParticipants: 10,
    minParticipants: 1,
    currentParticipantCount: 10,
    context: {
      userId: '00000000-dead-beef-0001-000000000001',
      profile: { account_status: 'active', onboarding_status: 'completed' },
    },
  });

  // ── Availability ──────────────────────────────────────────────────────────
  const availabilityAvailable = evaluateHuntAvailability({
    huntId: DEV_HUNT_FIXTURES[0].id,
    occurrenceId: null,
    huntStatus: 'active',
    huntPrivacy: 'public',
    huntJoinPolicy: 'open',
    maxParticipants: null,
    currentParticipantCount: 3,
    isAuthenticated: true,
  });

  const availabilityActive = evaluateHuntAvailability({
    huntId: DEV_HUNT_FIXTURES[2].id,
    occurrenceId: null,
    huntStatus: 'active',
    huntPrivacy: 'public',
    huntJoinPolicy: 'open',
    maxParticipants: null,
    currentParticipantCount: 7,
    isAuthenticated: true,
    participationStatus: 'active',
    participationId: '50000000-part-aaaa-0001-000000000001',
  });

  // ── Stop display priority ─────────────────────────────────────────────────
  const stopPriority = getStopDisplayPriority(
    DEV_ACTIVE_HUNT.currentStops.map(s => ({
      id: s.id,
      sortOrder: s.sortOrder,
      progressStatus: s.progressStatus,
      isRequired: s.isRequired,
    }))
  );

  // ── Completion readiness ──────────────────────────────────────────────────
  const completionReadiness = evaluateCompletionReadiness(
    DEV_ACTIVE_HUNT.currentStops.map(s => ({
      id: s.id,
      isRequired: s.isRequired,
      progressStatus: s.progressStatus,
    })),
    'active',
    DEV_ACTIVE_HUNT.completionDeadline,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>[DEV] Hunt Domain Diagnostics</Text>
      <Text style={styles.subheader}>Never visible in production builds.</Text>

      {/* ── Hunt Fixtures ─────────────────────────────────────── */}
      <Section title={`Hunt Fixtures (${DEV_HUNT_FIXTURES.length})`}>
        {DEV_HUNT_FIXTURES.map(h => (
          <View key={h.id} style={styles.card}>
            <Row label="Title"  value={h.title} />
            <Row label="State"  value={h.availabilityState} />
            <Row label="Privacy" value={h.privacy} />
            <Row label="Status (participation)" value={h.participationStatus ?? 'none'} />
          </View>
        ))}
      </Section>

      {/* ── Eligibility Results ───────────────────────────────── */}
      <Section title="Eligibility Checks">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Unauthenticated user</Text>
          <Row label="Eligible"    value={eligibilityUnauthenticated.eligible ? 'Yes' : 'No'} />
          <Row label="Reason"      value={eligibilityUnauthenticated.reasonCode} />
          <Row label="Message"     value={eligibilityUnauthenticated.userMessage} />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Authenticated user (open hunt)</Text>
          <Row label="Eligible"    value={eligibilityEligible.eligible ? 'Yes' : 'No'} />
          <Row label="Reason"      value={eligibilityEligible.reasonCode} />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Full hunt</Text>
          <Row label="Eligible"    value={eligibilityFull.eligible ? 'Yes' : 'No'} />
          <Row label="Reason"      value={eligibilityFull.reasonCode} />
        </View>
      </Section>

      {/* ── Availability Results ──────────────────────────────── */}
      <Section title="Availability Evaluation">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Available (no participation)</Text>
          <Row label="State"   value={availabilityAvailable.state} />
          <Row label="canJoin" value={availabilityAvailable.canJoin ? 'Yes' : 'No'} />
          <Row label="Action"  value={availabilityAvailable.primaryAction.label} />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active (in progress)</Text>
          <Row label="State"   value={availabilityActive.state} />
          <Row label="canJoin" value={availabilityActive.canJoin ? 'Yes' : 'No'} />
          <Row label="Action"  value={availabilityActive.primaryAction.label} />
        </View>
      </Section>

      {/* ── Active Hunt ───────────────────────────────────────── */}
      <Section title="Active Hunt Fixture">
        <View style={styles.card}>
          <Row label="Title"     value={DEV_ACTIVE_HUNT.huntTitle} />
          <Row label="Status"    value={DEV_ACTIVE_HUNT.participationStatus} />
          <Row label="Progress"  value={`${DEV_ACTIVE_HUNT.completedStopCount} / ${DEV_ACTIVE_HUNT.requiredStopCount}`} />
          <Row label="Points"    value={String(DEV_ACTIVE_HUNT.rewardSnapshot?.pointsReward ?? 0)} />
        </View>
        <Text style={styles.subLabel}>Stop Display Priority:</Text>
        {stopPriority.map(s => (
          <View key={s.id} style={styles.card}>
            <Row label="Sort"     value={String(s.sortOrder)} />
            <Row label="Status"   value={s.progressStatus} />
            <Row label="Priority" value={s.displayPriority} />
          </View>
        ))}
      </Section>

      {/* ── Completion Readiness ──────────────────────────────── */}
      <Section title="Completion Readiness">
        <View style={styles.card}>
          <Row label="State"   value={completionReadiness.state} />
          <Row label="Ready"   value={completionReadiness.isReady ? 'Yes' : 'No'} />
          <Row label="Message" value={completionReadiness.userMessage} />
          <Row label="Missing" value={completionReadiness.missingStopIds.length.toString()} />
          <Row label="Pending" value={completionReadiness.pendingProofStopIds.length.toString()} />
        </View>
      </Section>

      {/* ── Pending Invitation ────────────────────────────────── */}
      <Section title="Pending Invitation">
        <View style={styles.card}>
          <Row label="Hunt"      value={DEV_PENDING_INVITATION.huntSummary?.title ?? '—'} />
          <Row label="Status"    value={DEV_PENDING_INVITATION.status} />
          <Row label="Message"   value={DEV_PENDING_INVITATION.message ?? '—'} />
          <Row label="Expires"   value={DEV_PENDING_INVITATION.expiresAt ?? 'Never'} />
        </View>
      </Section>

      {/* ── Dev Validation Responses ──────────────────────────── */}
      <Section title="[DEV] Validation Responses">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Success</Text>
          <JsonBlock data={DEV_VALIDATION_RESPONSES.success} />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Too Far</Text>
          <JsonBlock data={DEV_VALIDATION_RESPONSES.tooFar} />
        </View>
      </Section>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d14',
  },
  content: {
    padding: spacing[4],
    paddingBottom: 60,
  },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: '#ff6b35',
    marginBottom: 4,
  },
  subheader: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#888',
    marginBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#1a1a2a',
    padding: spacing[3],
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: '#c0c0d0',
  },
  sectionBody: {
    padding: spacing[3],
  },
  card: {
    backgroundColor: '#111120',
    borderRadius: radius.sm,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderLeftWidth: 2,
    borderLeftColor: '#444466',
  },
  cardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: '#8888cc',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  rowLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: '#888',
    width: 80,
  },
  rowValue: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#ddd',
    flex: 1,
  },
  subLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 4,
  },
  json: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#7a7a9a',
  },
});
