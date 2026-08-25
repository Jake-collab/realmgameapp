/**
 * Supabase helpers — Worlds
 *
 * Shared utilities for normalizing errors, handling pagination,
 * constructing signed URLs, and other cross-service patterns.
 *
 * All raw Supabase calls go through services. These helpers support
 * those services without leaking Supabase internals into UI components.
 */

import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './client';

// ─── Error normalization ──────────────────────────────────────────────────────

export interface ServiceError {
  message: string;
  code?: string;
  details?: string;
}

/**
 * Converts a Supabase PostgrestError or generic Error into a ServiceError
 * with a user-friendly message.
 */
export function normalizeError(error: PostgrestError | Error | unknown): ServiceError {
  if (error instanceof Error) {
    return { message: error.message };
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const pg = error as PostgrestError;
    return {
      message: friendlyMessage(pg.message, pg.code),
      code: pg.code,
      details: pg.details ?? undefined,
    };
  }
  return { message: 'An unexpected error occurred. Please try again.' };
}

function friendlyMessage(raw: string, code?: string): string {
  if (code === '23505') return 'This record already exists.';
  if (code === '23503') return 'A related record was not found.';
  if (code === '42501') return 'You do not have permission to perform this action.';
  if (raw.includes('JWT expired')) return 'Your session has expired. Please log in again.';
  if (raw.includes('Invalid login')) return 'Incorrect email or password.';
  if (raw.includes('Email not confirmed')) return 'Please verify your email before logging in.';
  if (raw.includes('network')) return 'Connection error. Check your internet and try again.';
  return 'Something went wrong. Please try again.';
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Returns the Supabase range (from, to) for a page + pageSize. */
export function paginationRange(page = 1, pageSize = 20): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

// ─── Signed URLs ──────────────────────────────────────────────────────────────

/**
 * Generates a signed URL for a private storage object.
 * Falls back to null without throwing if the client is not configured.
 *
 * @param bucket  Storage bucket name
 * @param path    Object path within the bucket
 * @param ttlSeconds  URL expiry in seconds (default 3600 = 1 hour)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  ttlSeconds = 3600
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

// ─── React Query key factory ───────────────────────────────────────────────────

/**
 * Centralized React Query key factory.
 * Keeping keys here prevents typo-based cache misses across services.
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.profile(userId), queryFn: ... })
 */
export const queryKeys = {
  // Auth
  session: ['session'] as const,

  // Profile
  profile: (userId: string) => ['profile', userId] as const,
  profileByUsername: (username: string) => ['profile', 'username', username] as const,

  // Settings
  userSettings: (userId: string) => ['userSettings', userId] as const,

  // Interests
  interests: ['interests'] as const,
  userInterests: (userId: string) => ['userInterests', userId] as const,

  // Quests
  quests: (params?: Record<string, unknown>) => ['quests', params] as const,
  quest: (id: string) => ['quest', id] as const,
  questParticipation: (userId: string, questId: string) =>
    ['questParticipation', userId, questId] as const,
  userQuestParticipations: (userId: string) => ['questParticipations', userId] as const,

  // Hunts
  hunts: (params?: Record<string, unknown>) => ['hunts', params] as const,
  hunt: (id: string) => ['hunt', id] as const,
  huntParticipants: (huntId: string) => ['huntParticipants', huntId] as const,
  huntInvitations: (userId: string) => ['huntInvitations', userId] as const,
  userHuntParticipations: (userId: string) => ['huntParticipations', userId] as const,

  // Points
  pointsTotal: (userId: string) => ['pointsTotal', userId] as const,
  pointsLedger: (userId: string) => ['pointsLedger', userId] as const,

  // Achievements
  achievements: ['achievements'] as const,
  userAchievements: (userId: string) => ['userAchievements', userId] as const,

  // Leaderboards
  leaderboard: (params: { period?: string; type?: string }) =>
    ['leaderboard', params] as const,

  // Notifications
  notifications: (userId: string) => ['notifications', userId] as const,
  unreadNotificationCount: (userId: string) =>
    ['notifications', userId, 'unread'] as const,
} as const;

// ─── Timestamp helpers ────────────────────────────────────────────────────────

/** Returns an ISO timestamp string for the current UTC time. */
export function nowUtc(): string {
  return new Date().toISOString();
}

/** Returns true if a timestamp string represents a past date. */
export function isExpired(isoTimestamp: string | null | undefined): boolean {
  if (!isoTimestamp) return false;
  return new Date(isoTimestamp) < new Date();
}
