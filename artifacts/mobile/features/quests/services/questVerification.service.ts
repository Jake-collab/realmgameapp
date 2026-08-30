import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  confirmQuestIntegrity,
  startQuestVerificationTimer,
} from '../repositories/quest.repository';
import { makeQuestError, normalizeQuestError } from '../utils/questErrors';

export async function startQuestTimer(input: { participationId: string; userId: string }) {
  if (!isSupabaseConfigured()) {
    return { success: false as const, error: makeQuestError('SERVICE_UNAVAILABLE', 'Timer verification is unavailable.') };
  }
  try {
    return { success: true as const, timer: await startQuestVerificationTimer(input.participationId, input.userId) };
  } catch (error) {
    return { success: false as const, error: normalizeQuestError(error) };
  }
}

export async function confirmQuestIntegrityRequirement(input: { participationId: string; userId: string }) {
  if (!isSupabaseConfigured()) {
    return { success: false as const, error: makeQuestError('SERVICE_UNAVAILABLE', 'Integrity confirmation is unavailable.') };
  }
  try {
    return { success: true as const, confirmation: await confirmQuestIntegrity(input.participationId, input.userId) };
  } catch (error) {
    return { success: false as const, error: normalizeQuestError(error) };
  }
}