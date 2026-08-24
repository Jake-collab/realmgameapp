import { z } from "zod";

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
}).passthrough();

const response = z.object({}).passthrough();

export const HealthCheckResponse = z.object({ status: z.literal("ok") });
export const GetAdminSessionResponse = response;
export const GetAdminDashboardResponse = response;
export const GetAdminReviewQueuesResponse = response;
export const GetAdminDiagnosticsResponse = response;
export const ListAdminUsersResponse = response;
export const ListAdminQuestsResponse = response;
export const ListAdminAuditLogsResponse = response;
export const ListAdminUsersQueryParams = pageQuery.extend({ status: z.string().optional() });
export const ListAdminQuestsQueryParams = pageQuery.extend({ status: z.string().optional(), type: z.string().optional() });
export const ListAdminAuditLogsQueryParams = pageQuery;
