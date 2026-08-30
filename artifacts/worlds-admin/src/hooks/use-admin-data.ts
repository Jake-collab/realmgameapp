import {
  getGetAdminDashboardQueryKey,
  getGetAdminDiagnosticsQueryKey,
  getGetAdminReviewQueuesQueryKey,
  getGetAdminSessionQueryKey,
  getListAdminAuditLogsQueryKey,
  getListAdminQuestsQueryKey,
  getListAdminUsersQueryKey,
  useGetAdminDashboard,
  useGetAdminDiagnostics,
  useGetAdminReviewQueues,
  useGetAdminSession,
  useListAdminAuditLogs,
  useListAdminQuests,
  useListAdminUsers,
} from '@workspace/api-client-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export async function moderationFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export type NotificationAdminData = {
  metrics: { notificationsCreatedToday: number; pushAttempts: number; successfulPushes: number; failedSends: number; invalidTokens: number; pendingScheduled: number; queueBacklog: number; averageDeliveryLatencyMs: number | null };
  provider: { configured: boolean; reachable: boolean; reason?: string };
  persistence: string;
  delivery: Array<{ id: string; notificationId: string; channel: 'in_app' | 'push'; status: string; attemptCount: number; failureCategory: string | null; lastAttemptAt: string | null; createdAt: string }>;
};

export type MediaRetentionAdminData = {
  summary: { pending: number; retrying: number; completed: number; resolved: number; blocked: number; total: number };
  items: Array<{
    mediaId: string;
    state: 'pending' | 'retrying' | 'completed' | 'resolved' | 'blocked';
    attemptCount: number;
    lastAttemptAt: string | null;
    nextAttemptAt: string | null;
    deletionOutcome: 'deleted' | 'missing' | null;
    completedAt: string | null;
    lastError: string | null;
    updatedAt: string;
  }>;
  list: { scope: 'latest'; ordering: 'updated_at_desc'; limit: number; returned: number; hasMore: boolean; totalsScope: 'all' };
  generatedAt: string;
};

export type MediaRetentionEvidence = {
  mediaId: string;
  cleanup: {
    state: 'pending' | 'retrying' | 'completed' | 'resolved' | 'blocked';
    status: string;
    attemptCount: number;
    lastAttemptAt: string | null;
    nextAttemptAt: string | null;
    deletionOutcome: 'deleted' | 'missing' | null;
    completedAt: string | null;
    lastError: string | null;
    operatorResolution: string | null;
    resolvedAt: string | null;
    updatedAt: string;
  };
  media: {
    mediaType: string;
    mimeType: string;
    fileSize: number | null;
    width: number | null;
    height: number | null;
    purpose: string;
    visibility: string;
    moderationStatus: string;
    moderationReason: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    preview: { signedUrl: string; expiresAt: string } | null;
  };
  moderationCases: Array<{
    id: string;
    status: string;
    automatedProvider: string | null;
    riskCategories: string[] | null;
    riskScore: number | null;
    moderatorId: string | null;
    moderatorNotes: string | null;
    decision: string | null;
    decisionReason: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  canonicalReference: { fingerprint: string | null; matchesCleanup: boolean };
};

export function useNotificationAdminData(enabled = true) {
  const client = useQueryClient();
  const overview = useQuery<NotificationAdminData>({ queryKey: ['/admin/notifications'], enabled, queryFn: () => moderationFetch<NotificationAdminData>('/api/admin/notifications') });
  const diagnostics = useQuery({ queryKey: ['/admin/notifications/diagnostics'], enabled, queryFn: () => moderationFetch<Record<string, unknown>>('/api/admin/notifications/diagnostics') });
  const test = useMutation({ mutationFn: () => moderationFetch('/api/admin/notifications/test', { method: 'POST', body: '{}' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['/admin/notifications'] }) });
  return { overview, diagnostics, test };
}

export type ModerationCase = {
  id: string; entityType: string; entityId: string; context: string; status: string; decision: string | null;
  priority: string; outcome: { action?: string; reason?: string } | null; assignedModeratorId: string | null;
  sourceReportIds: string[]; notes: string | null; createdAt: string; updatedAt: string;
};
export type ModerationReport = { id: string; entityType: string; entityId: string; reason: string; status: string; priority: string; relatedReportIds: string[]; caseId: string | null; createdAt: string };

export function useModerationData(enabled = true) {
  const client = useQueryClient();
  const cases = useQuery({ queryKey: ['/admin/moderation/cases'], enabled, queryFn: () => moderationFetch<{ items: ModerationCase[]; persistence: string }>('/api/admin/moderation/cases') });
  const reports = useQuery({ queryKey: ['/admin/reports'], enabled, queryFn: () => moderationFetch<{ items: ModerationReport[] }>('/api/admin/reports') });
  const snapshots = useQuery({ queryKey: ['/admin/integrity/snapshots'], enabled, queryFn: () => moderationFetch<{ items: Array<{ id: string; riskBand: string; score: number; entityType: string; entityId: string; createdAt: string }> }>('/api/admin/integrity/snapshots') });
  const diagnostics = useQuery({ queryKey: ['/admin/moderation/diagnostics'], enabled, queryFn: () => moderationFetch<{ state?: { counts: Record<string, number>; persistence: string; policyVersion: string }; provider?: Record<string, unknown> }>('/api/admin/moderation/diagnostics') });
  const settings = useQuery({ queryKey: ['/admin/moderation/settings'], enabled, queryFn: () => moderationFetch<{ settings: { automationEnabled: boolean; autoApprovalMode: 'manual_only' | 'low_risk' | 'mixed'; quarantineThreshold: number; reviewThreshold: number; persistence: string; policyVersion: string } }>('/api/admin/moderation/settings') });
  const claim = useMutation({ mutationFn: (id: string) => moderationFetch(`/api/admin/moderation/cases/${id}/claim`, { method: 'POST', body: '{}' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['/admin/moderation/cases'] }) });
  const resolve = useMutation({ mutationFn: (input: { id: string; decision: 'no_action' | 'warning' | 'content_removed' | 'account_restricted' | 'account_suspended' | 'quarantine' | 'release' | 'reverse'; reason: string; expectedUpdatedAt?: string }) => moderationFetch(`/api/admin/moderation/cases/${encodeURIComponent(input.id)}/resolve`, { method: 'POST', body: JSON.stringify({ decision: input.decision, reason: input.reason, confirmed: true, expectedUpdatedAt: input.expectedUpdatedAt, idempotencyKey: crypto.randomUUID() }) }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['/admin/moderation/cases'] }); void client.invalidateQueries({ queryKey: ['/admin/moderation/diagnostics'] }); void client.invalidateQueries({ queryKey: ['/admin/moderation/audit'] }); } });
  const updateSettings = useMutation({ mutationFn: (input: Record<string, unknown>) => moderationFetch('/api/admin/moderation/settings', { method: 'PUT', body: JSON.stringify(input) }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['/admin/moderation/settings'] }); void client.invalidateQueries({ queryKey: ['/admin/moderation/diagnostics'] }); } });
  return { cases, reports, snapshots, diagnostics, settings, claim, resolve, updateSettings };
}

export function useAdminData() {
  const client = useQueryClient();
  const session = useGetAdminSession({
    query: { queryKey: getGetAdminSessionQueryKey() },
  });
  const permissions = session.data?.permissions ?? [];
  const can = (permission: string) => session.data?.authorized === true && permissions.includes(permission);
  const dashboard = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey(), enabled: can('admin.read') },
  });
  const reviewQueues = useGetAdminReviewQueues({
    query: { queryKey: getGetAdminReviewQueuesQueryKey(), enabled: can('admin.review.read') },
  });
  const users = useListAdminUsers(
    { page: 1, pageSize: 25 },
    { query: { queryKey: getListAdminUsersQueryKey({ page: 1, pageSize: 25 }), enabled: can('admin.users.read') } },
  );
  const quests = useListAdminQuests(
    { page: 1, pageSize: 25 },
    { query: { queryKey: getListAdminQuestsQueryKey({ page: 1, pageSize: 25 }), enabled: can('admin.quests.read') } },
  );
  const audit = useListAdminAuditLogs(
    { page: 1, pageSize: 25 },
    { query: { queryKey: getListAdminAuditLogsQueryKey({ page: 1, pageSize: 25 }), enabled: can('admin.audit.read') } },
  );
  const diagnostics = useGetAdminDiagnostics({
    query: { queryKey: getGetAdminDiagnosticsQueryKey(), enabled: can('admin.diagnostics.read') },
  });
  const moderation = useModerationData(session.data?.authorized === true && permissions.some((permission: string) => permission === 'moderation.read' || permission === 'integrity.read'));
  const notifications = useNotificationAdminData(session.data?.authorized === true && permissions.includes('admin.read'));
  const mediaRetention = useQuery<MediaRetentionAdminData>({ queryKey: ['/admin/moderation/media-retention'], enabled: can('moderation.read'), queryFn: () => moderationFetch<MediaRetentionAdminData>('/api/admin/moderation/media-retention') });

  const mediaRetentionAction = useMutation({
    mutationFn: (input: { mediaId: string; action: 'requeue' | 'resolve'; referenceFingerprint: string; reason: string }) => moderationFetch(`/api/admin/moderation/media-retention/${encodeURIComponent(input.mediaId)}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: input.action, referenceFingerprint: input.referenceFingerprint, reason: input.reason, confirmed: true }),
    }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['/admin/moderation/media-retention'] });
      void client.invalidateQueries({ queryKey: ['/admin/moderation/media-retention/evidence'] });
      void client.invalidateQueries({ queryKey: ['/admin/moderation/audit'] });
    },
  });

  return { session, dashboard, reviewQueues, users, quests, audit, diagnostics, moderation, notifications, mediaRetention, mediaRetentionAction };
}