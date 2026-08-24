import { useQuery } from "@tanstack/react-query";

export type AdminSession = any;
export type AdminMetric = any;
export type AdminQueueItem = any;
export type AdminDiagnostic = any;

type QueryOptions = { query?: Record<string, unknown> };
type Params = Record<string, string | number | boolean | undefined>;
export type ResolveAdminModerationCaseBody = { decision: string; reason: string; confirmed: boolean; expectedUpdatedAt?: string; idempotencyKey?: string };
export type ResolveAdminModerationCaseResponse = Record<string, unknown>;

const toQuery = (params?: Params) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
};

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: "include" });
  if (!response.ok) throw new Error(`Admin request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export const getGetAdminSessionQueryKey = () => ["/admin/session"] as const;
export const getGetAdminDashboardQueryKey = () => ["/admin/dashboard"] as const;
export const getGetAdminReviewQueuesQueryKey = () => ["/admin/review-queues"] as const;
export const getGetAdminDiagnosticsQueryKey = () => ["/admin/diagnostics"] as const;
export const getListAdminUsersQueryKey = (params?: Params) => ["/admin/users", params] as const;
export const getListAdminQuestsQueryKey = (params?: Params) => ["/admin/quests", params] as const;
export const getListAdminAuditLogsQueryKey = (params?: Params) => ["/admin/audit", params] as const;

export const useGetAdminSession = (_options?: QueryOptions) => useQuery({ queryKey: getGetAdminSessionQueryKey(), queryFn: () => get<AdminSession>("/admin/session") });
export const useGetAdminDashboard = (options?: QueryOptions) => useQuery({ queryKey: getGetAdminDashboardQueryKey(), queryFn: () => get<any>("/admin/dashboard"), ...(options?.query ?? {}) });
export const useGetAdminReviewQueues = (options?: QueryOptions) => useQuery({ queryKey: getGetAdminReviewQueuesQueryKey(), queryFn: () => get<any>("/admin/review-queues"), ...(options?.query ?? {}) });
export const useGetAdminDiagnostics = (options?: QueryOptions) => useQuery({ queryKey: getGetAdminDiagnosticsQueryKey(), queryFn: () => get<any>("/admin/diagnostics"), ...(options?.query ?? {}) });
export const useListAdminUsers = (params?: Params, options?: QueryOptions) => useQuery({ queryKey: getListAdminUsersQueryKey(params), queryFn: () => get<any>(`/admin/users${toQuery(params)}`), ...(options?.query ?? {}) });
export const useListAdminQuests = (params?: Params, options?: QueryOptions) => useQuery({ queryKey: getListAdminQuestsQueryKey(params), queryFn: () => get<any>(`/admin/quests${toQuery(params)}`), ...(options?.query ?? {}) });
export const useListAdminAuditLogs = (params?: Params, options?: QueryOptions) => useQuery({ queryKey: getListAdminAuditLogsQueryKey(params), queryFn: () => get<any>(`/admin/audit${toQuery(params)}`), ...(options?.query ?? {}) });

export async function resolveAdminModerationCase(id: string, body: ResolveAdminModerationCaseBody): Promise<ResolveAdminModerationCaseResponse> {
  const response = await fetch(`/api/admin/moderation/cases/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Admin request failed (${response.status}).`);
  return response.json() as Promise<ResolveAdminModerationCaseResponse>;
}