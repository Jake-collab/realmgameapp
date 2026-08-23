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

async function moderationFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Request failed (${response.status})`);
  return response.json() as Promise<T>;
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
  const claim = useMutation({ mutationFn: (id: string) => moderationFetch(`/api/admin/moderation/cases/${id}/claim`, { method: 'POST', body: '{}' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['/admin/moderation/cases'] }) });
  const resolve = useMutation({ mutationFn: (input: { id: string; decision: string; reason: string; expectedUpdatedAt?: string }) => moderationFetch(`/api/admin/moderation/cases/${input.id}/resolve`, { method: 'POST', body: JSON.stringify({ decision: input.decision, reason: input.reason, expectedUpdatedAt: input.expectedUpdatedAt }) }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['/admin/moderation/cases'] }); void client.invalidateQueries({ queryKey: ['/admin/moderation/diagnostics'] }); } });
  return { cases, reports, snapshots, diagnostics, claim, resolve };
}

export function useAdminData() {
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
  const moderation = useModerationData(session.data?.authorized === true && permissions.some((permission) => permission === 'moderation.read' || permission === 'integrity.read'));

  return { session, dashboard, reviewQueues, users, quests, audit, diagnostics, moderation };
}