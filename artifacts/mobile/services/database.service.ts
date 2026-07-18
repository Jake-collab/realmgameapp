/**
 * Database service layer.
 *
 * Provides typed wrappers around Supabase table queries.
 * Centralizes all database access — never query Supabase tables
 * directly from components or hooks.
 *
 * Row-level security (RLS) is enforced by Supabase based on the
 * authenticated user's JWT. This service passes through the client
 * session automatically.
 */

import { requireSupabase } from './supabase';
import type { Tables } from '@/supabase/types';
import type { UpdateProfilePayload } from '@/types/user.types';

export const profilesService = {
  /** Fetch a user's profile by user ID */
  async getByUserId(userId: string): Promise<{
    data: Tables<'profiles'> | null;
    error: string | null;
  }> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    return { data, error: error?.message ?? null };
  },

  /** Update a user's profile */
  async update(
    userId: string,
    payload: UpdateProfilePayload
  ): Promise<{ data: Tables<'profiles'> | null; error: string | null }> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('profiles')
      .update({
        display_name: payload.displayName,
        bio: payload.bio,
        avatar_url: payload.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    return { data, error: error?.message ?? null };
  },
};

export const gameSessionsService = {
  /** Get all sessions for a user */
  async getByUserId(userId: string): Promise<{
    data: Tables<'game_sessions'>[] | null;
    error: string | null;
  }> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('game_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error: error?.message ?? null };
  },
};
