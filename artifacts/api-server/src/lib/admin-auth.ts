import type { NextFunction, Request, Response } from "express";

export type AdminPermission =
  | "admin.read"
  | "admin.users.read"
  | "admin.quests.read"
  | "admin.quests.manage"
  | "admin.review.read"
  | "admin.audit.read"
  | "admin.diagnostics.read"
  | "ai.read"
  | "ai.generate"
  | "ai.prompts.read"
  | "ai.prompts.edit"
  | "ai.settings.read"
  | "ai.settings.edit"
  | "moderation.read"
  | "moderation.manage"
  | "moderation.case.claim"
  | "moderation.case.resolve"
  | "moderation.account.suspend"
  | "moderation.report.resolve"
  | "integrity.read"
  | "integrity.manage"
  | "integrity.reward.quarantine"
  | "integrity.reward.release"
  | "integrity.reward.reverse";

export type AdminRole = "user" | "creator" | "moderator" | "admin" | "super_admin";

export interface AdminPrincipal {
  userId: string;
  displayName: string;
  username: string;
  role: AdminRole;
  permissions: AdminPermission[];
}

declare global {
  namespace Express {
    interface Request {
      adminPrincipal?: AdminPrincipal;
    }
  }
}

const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  user: [],
  creator: [],
  moderator: ["admin.read", "admin.review.read", "admin.diagnostics.read", "ai.read", "moderation.read", "moderation.manage", "moderation.case.claim", "moderation.case.resolve", "integrity.read", "integrity.reward.quarantine", "integrity.reward.release"],
  admin: [
    "admin.read",
    "admin.users.read",
    "admin.quests.read",
    "admin.quests.manage",
    "admin.review.read",
    "admin.audit.read",
    "admin.diagnostics.read",
    "ai.read",
    "ai.generate",
    "ai.prompts.read",
    "ai.prompts.edit",
    "ai.settings.read",
    "moderation.read",
    "moderation.manage",
    "moderation.case.claim",
    "moderation.case.resolve",
    "moderation.account.suspend",
    "moderation.report.resolve",
    "integrity.read",
    "integrity.manage",
    "integrity.reward.quarantine",
    "integrity.reward.release",
    "integrity.reward.reverse",
  ],
  super_admin: [
    "admin.read",
    "admin.users.read",
    "admin.quests.read",
    "admin.quests.manage",
    "admin.review.read",
    "admin.audit.read",
    "admin.diagnostics.read",
    "ai.read",
    "ai.generate",
    "ai.prompts.read",
    "ai.prompts.edit",
    "ai.settings.read",
    "ai.settings.edit",
    "moderation.read",
    "moderation.manage",
    "moderation.case.claim",
    "moderation.case.resolve",
    "moderation.account.suspend",
    "moderation.report.resolve",
    "integrity.read",
    "integrity.manage",
    "integrity.reward.quarantine",
    "integrity.reward.release",
    "integrity.reward.reverse",
  ],
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey ? { url, serviceKey } : null;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

async function supabaseRequest<T>(url: string, apiKey: string, bearerToken: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${bearerToken}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface SupabaseUser {
  id: string;
}

interface ProfileRecord {
  id: string;
  display_name: string;
  username: string;
  role: string;
  account_status: string;
}

export async function resolveAdminPrincipal(req: Request): Promise<
  { kind: "unauthenticated" } |
  { kind: "unavailable"; reason: string } |
  { kind: "unauthorized"; reason: string } |
  { kind: "authorized"; principal: AdminPrincipal }
> {
  const token = bearerToken(req);
  if (!token) return { kind: "unauthenticated" };

  const config = supabaseConfig();
  if (!config) {
    return {
      kind: "unavailable",
      reason: "Staff session verification is unavailable until Supabase is connected.",
    };
  }

  const user = await supabaseRequest<SupabaseUser>(
    `${config.url}/auth/v1/user`,
    config.serviceKey,
    token,
  );
  if (!user?.id) return { kind: "unauthorized", reason: "The staff session is invalid or expired." };

  const profiles = await supabaseRequest<ProfileRecord[]>(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,display_name,username,role,account_status`,
    config.serviceKey,
    token,
  );
  const profile = profiles?.[0];
  if (!profile || profile.account_status !== "active") {
    return { kind: "unauthorized", reason: "This account is not an active Worlds staff account." };
  }

  const role = profile.role === "super_admin" ? "super_admin" : profile.role as AdminRole;
  if (!rolePermissions[role] || role === "user" || role === "creator") {
    return { kind: "unauthorized", reason: "This account is not authorized for the staff console." };
  }

  return {
    kind: "authorized",
    principal: {
      userId: profile.id,
      displayName: profile.display_name,
      username: profile.username,
      role,
      permissions: rolePermissions[role],
    },
  };
}

export function requireAdmin(permission: AdminPermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await resolveAdminPrincipal(req);
    if (result.kind === "unauthenticated") {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (result.kind === "unavailable") {
      res.status(503).json({ error: result.reason });
      return;
    }
    if (result.kind === "unauthorized") {
      res.status(403).json({ error: result.reason });
      return;
    }
    if (!result.principal.permissions.includes(permission)) {
      res.status(403).json({ error: "You do not have permission to view this data." });
      return;
    }
    req.adminPrincipal = result.principal;
    next();
  };
}

export function getRolePermissions(role: AdminRole): AdminPermission[] {
  return rolePermissions[role];
}
