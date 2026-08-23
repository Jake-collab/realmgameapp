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
  const dashboard = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey() },
  });
  const reviewQueues = useGetAdminReviewQueues({
    query: { queryKey: getGetAdminReviewQueuesQueryKey() },
  });
  const users = useListAdminUsers(
    { page: 1, pageSize: 25 },
    { query: { queryKey: getListAdminUsersQueryKey({ page: 1, pageSize: 25 }) } },
  );
  const quests = useListAdminQuests(
    { page: 1, pageSize: 25 },
    { query: { queryKey: getListAdminQuestsQueryKey({ page: 1, pageSize: 25 }) } },
  );
  const audit = useListAdminAuditLogs(
    { page: 1, pageSize: 25 },
    { query: { queryKey: getListAdminAuditLogsQueryKey({ page: 1, pageSize: 25 }) } },
  );
  const diagnostics = useGetAdminDiagnostics({
    query: { queryKey: getGetAdminDiagnosticsQueryKey() },
  });

  return { session, dashboard, reviewQueues, users, quests, audit, diagnostics };
}