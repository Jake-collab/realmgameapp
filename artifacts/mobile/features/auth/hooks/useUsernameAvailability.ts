/**
 * useUsernameAvailability — Worlds
 *
 * Debounced username availability check with normalized state reporting.
 *
 * States:
 *   idle        — no input or below minimum length
 *   validating  — client-side format check running
 *   checking    — making the DB request (debounce settled)
 *   available   — username is free
 *   unavailable — already taken
 *   invalid     — format is wrong (shown without a DB request)
 *   error       — unable to check (network / Supabase not configured)
 *
 * The DB constraint remains the final authority — handle the duplicate-key
 * error in the signUp caller as a fallback.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isUsernameAvailable } from '@/services/profile/profile.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UsernameAvailabilityStatus =
  | 'idle'
  | 'validating'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'invalid'
  | 'error';

interface UsernameAvailabilityResult {
  status: UsernameAvailabilityStatus;
  message: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]*[a-z0-9]$|^[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;
const DEBOUNCE_MS = 600;

// ─── Validation ───────────────────────────────────────────────────────────────

function validateUsernameFormat(username: string): string | null {
  if (username.length < MIN_LENGTH) return null; // Too short — don't show error yet
  if (username.length > MAX_LENGTH) return `Username must be ${MAX_LENGTH} characters or fewer`;
  if (!/^[a-z0-9_]+$/.test(username)) return 'Only lowercase letters, numbers, and underscores';
  if (username.startsWith('_') || username.endsWith('_')) return 'Cannot start or end with an underscore';
  if (/__/.test(username)) return 'Cannot have consecutive underscores';
  if (!USERNAME_REGEX.test(username)) return 'Invalid username format';
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUsernameAvailability(username: string): UsernameAvailabilityResult {
  const [status, setStatus] = useState<UsernameAvailabilityStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<string>('');

  const check = useCallback(async (value: string) => {
    // Don't check if Supabase isn't configured
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setMessage('Unable to check availability right now');
      return;
    }

    setStatus('checking');
    setMessage('Checking availability…');

    try {
      const available = await isUsernameAvailable(value);
      // Ignore stale results from previous calls
      if (latestRef.current !== value) return;

      if (available) {
        setStatus('available');
        setMessage('Username is available');
      } else {
        setStatus('unavailable');
        setMessage('Username is already taken');
      }
    } catch {
      if (latestRef.current !== value) return;
      setStatus('error');
      setMessage('Unable to check availability right now');
    }
  }, []);

  useEffect(() => {
    // Clear any pending timer
    if (timerRef.current) clearTimeout(timerRef.current);

    const normalized = username.toLowerCase().trim();
    latestRef.current = normalized;

    if (!normalized || normalized.length < MIN_LENGTH) {
      setStatus('idle');
      setMessage(null);
      return;
    }

    // Format validation first (no network needed)
    const formatError = validateUsernameFormat(normalized);
    if (formatError) {
      setStatus('invalid');
      setMessage(formatError);
      return;
    }

    setStatus('validating');
    setMessage(null);

    // Debounce the DB check
    timerRef.current = setTimeout(() => {
      check(normalized);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [username, check]);

  return { status, message };
}
