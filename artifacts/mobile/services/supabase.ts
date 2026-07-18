/**
 * Supabase client.
 *
 * Reads credentials from environment variables:
 *   EXPO_PUBLIC_SUPABASE_URL      — your Supabase project URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY — your Supabase anon (public) key
 *
 * Both variables must be set before Supabase features will work.
 * Add them to your .env file (see .env.example).
 *
 * IMPORTANT: Never expose the service_role key on the client.
 * Server-side operations requiring elevated privileges belong in
 * Supabase Edge Functions or the Express API server.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const credentialsConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (__DEV__ && !credentialsConfigured) {
  console.warn(
    '[Supabase] Missing credentials. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file. ' +
      'Auth and database features will be disabled until credentials are added.'
  );
}

/**
 * The Supabase client singleton.
 * `null` when credentials are not yet configured.
 * Always check `isSupabaseConfigured()` before using.
 */
export const supabase: SupabaseClient<Database> | null = credentialsConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Returns true when Supabase credentials are present and the client is active. */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/** Returns the configured client or throws a descriptive error. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment variables.'
    );
  }
  return supabase;
}
