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

  return { session, dashboard, reviewQueues, users, quests, audit, diagnostics };
}