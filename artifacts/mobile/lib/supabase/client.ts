/**
 * Supabase client — Worlds mobile
 *
 * Initializes the Supabase client using EXPO_PUBLIC_ environment variables.
 * The service-role key is NEVER bundled here — it belongs only on the server.
 *
 * Safe disconnected mode:
 *   When credentials are absent the module exports null and the helper
 *   isSupabaseConfigured() returns false. All services guard on this before
 *   making any Supabase call.
 *
 * How to configure:
 *   Copy .env.example → .env.local and fill in your Supabase project values.
 *   See /docs/SUPABASE_SETUP.md for step-by-step instructions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './database.types';

// ─── Environment ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Whether Supabase credentials are present and the client can be used.
 * Always check this before calling any Supabase API.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ─── Client ──────────────────────────────────────────────────────────────────

// Supabase's generated schema is authoritative once connected. Until then,
// the checked-in schema is intentionally partial, so keep the SDK client at
// the boundary and preserve domain typing in repositories/services.
let _supabase: SupabaseClient<any> | null = null;

if (isSupabaseConfigured()) {
  _supabase = createClient<any>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-app-version': process.env.EXPO_PUBLIC_APP_VERSION ?? 'dev',
      },
    },
  });
} else if (__DEV__) {
  console.info(
    '[Worlds] Authentication setup is pending. ' +
    'Account creation will be enabled after Supabase is connected. ' +
    'See docs/SUPABASE_SETUP.md'
  );
}

/**
 * The Supabase client instance.
 * Will be null when credentials are absent (development / CI without secrets).
 */
export const supabase = _supabase;

/** Returns the configured client, or null in disconnected development mode. */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  return _supabase;
}

/**
 * Returns the Supabase client, throwing if credentials are not configured.
 * Use in service functions that must not silently proceed without a client.
 *
 * @throws {Error} When credentials are absent
 */
export function requireSupabase(): SupabaseClient<any> {
  if (!_supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment. ' +
      'See docs/SUPABASE_SETUP.md'
    );
  }
  return _supabase;
}
