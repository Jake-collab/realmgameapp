/**
 * Profile Service — Worlds
 *
 * Manages user profiles, settings, interests, and public profile lookups.
 * All reads and writes go through this service — UI components must not
 * contain raw Supabase queries.
 *
 * RLS enforcement: users may only update their own profile/settings.
 * Role and account_status changes require admin RPCs (not available in client).
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, queryKeys, getSignedUrl } from '@/lib/supabase/helpers';
import type {
  ProfileRow,
  PublicProfileRow,
  UserSettingsRow,
  InterestRow,
  UserInterestRow,
  OnboardingProgress,
} from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpdateProfilePayload = Partial<Pick<ProfileRow,
  | 'username'
  | 'display_name'
  | 'bio'
  | 'preferred_game_mode'
  | 'onboarding_status'
  | 'onboarding_completed_at'
>>;

export type UpdateSettingsPayload = Partial<Omit<
  UserSettingsRow,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>>;

export interface ProfileWithAvatarUrl extends ProfileRow {
  avatar_url: string | null;
}

// ─── Profile reads ────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's own full profile.
 * Includes fields not exposed in public_profiles (onboarding_status, etc.).
 */
export async function getMyProfile(userId: string): Promise<ProfileRow | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Fetch a public profile by user ID.
 * Returns only fields safe to expose publicly.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfileRow | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('public_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Fetch a public profile by username (case-insensitive).
 */
export async function getPublicProfileByUsername(username: string): Promise<PublicProfileRow | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('public_profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Resolves the avatar URL for a profile.
 * Returns a signed URL for private avatars, or null if no avatar.
 */
export async function getAvatarUrl(avatarPath: string | null): Promise<string | null> {
  if (!avatarPath) return null;
  return getSignedUrl('avatars', avatarPath, 3600);
}

// ─── Profile writes ────────────────────────────────────────────────────────────

/**
 * Update the authenticated user's own profile.
 * Cannot change role or account_status (blocked by RLS trigger).
 */
export async function updateMyProfile(
  userId: string,
  payload: UpdateProfilePayload
): Promise<ProfileRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Update the authenticated user's avatar path (storage path only — not URL).
 * Called after successful upload to the avatars bucket.
 */
export async function updateAvatarPath(userId: string, storagePath: string | null): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('profiles')
    .update({ avatar_path: storagePath })
    .eq('id', userId);

  if (error) throw normalizeError(error);
}

/**
 * Mark the user's last active timestamp.
 * Call on app foreground — debounce to at most once per 5 minutes in the caller.
 */
export async function updateLastActive(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = requireSupabase();
  const { error } = await client
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) console.warn('[profileService] updateLastActive failed:', error.message);
}

// ─── User settings ─────────────────────────────────────────────────────────────

export async function getMySettings(userId: string): Promise<UserSettingsRow | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data;
}

export async function updateMySettings(
  userId: string,
  payload: UpdateSettingsPayload
): Promise<UserSettingsRow> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_settings')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw normalizeError(error);
  return data;
}

/**
 * Update the onboarding progress JSON within user_settings.
 * Merges the provided partial update into the existing progress object.
 */
export async function updateOnboardingProgress(
  userId: string,
  progress: Partial<OnboardingProgress>
): Promise<void> {
  const client = requireSupabase();
  // Fetch current progress first, then merge
  const current = await getMySettings(userId);
  const merged = { ...(current?.onboarding_progress ?? {}), ...progress };

  const { error } = await client
    .from('user_settings')
    .update({ onboarding_progress: merged })
    .eq('user_id', userId);

  if (error) throw normalizeError(error);
}

// ─── Interests ─────────────────────────────────────────────────────────────────

export async function getAllInterests(): Promise<InterestRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('interests')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw normalizeError(error);
  return data ?? [];
}

export async function getMyInterests(userId: string): Promise<InterestRow[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_interests')
    .select('interest_id, interests(*)')
    .eq('user_id', userId);

  if (error) throw normalizeError(error);
  return (data ?? []).map((row: any) => row.interests).filter(Boolean);
}

export async function setMyInterests(userId: string, interestIds: string[]): Promise<void> {
  const client = requireSupabase();

  // Delete existing, then insert new (replace all)
  const { error: deleteError } = await client
    .from('user_interests')
    .delete()
    .eq('user_id', userId);
  if (deleteError) throw normalizeError(deleteError);

  if (interestIds.length === 0) return;

  const rows: UserInterestRow[] = interestIds.map((id) => ({
    user_id: userId,
    interest_id: id,
    created_at: new Date().toISOString(),
  }));

  const { error: insertError } = await client.from('user_interests').insert(rows);
  if (insertError) throw normalizeError(insertError);
}

// ─── Username availability ────────────────────────────────────────────────────

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error) throw normalizeError(error);
  return data === null;
}

// ─── Query key exports ────────────────────────────────────────────────────────
export { queryKeys };
