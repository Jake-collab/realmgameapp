import type {
  QuestVerificationMethod,
  QuestRow,
  QuestObjectiveRow,
} from '@/lib/supabase/database.types';

export const QUEST_VERIFICATION_METHODS: QuestVerificationMethod[] = [
  'camera',
  'gps',
  'timer',
  'integrity_confirmation',
];

/**
 * Explicit methods are trusted configuration. The fallback is only for
 * pre-method rows and keeps the old proof UI readable during migration.
 */
export function getQuestVerificationMethods(
  quest: Pick<QuestRow, 'verification_methods' | 'proof_type' | 'location_requirement_type'>,
): QuestVerificationMethod[] {
  if (quest.verification_methods?.length) return quest.verification_methods;
  if (quest.proof_type === 'photo' || quest.proof_type === 'video') return ['camera'];
  if (quest.proof_type === 'location' || quest.location_requirement_type !== 'none') return ['gps'];
  // NULL means this is a legacy Quest. Do not invent a server-owned integrity
  // requirement that confirm_quest_integrity will correctly reject.
  return [];
}

export function objectiveNeedsVerification(objective: Pick<QuestObjectiveRow, 'proof_type' | 'location_requirement_type'>) {
  return objective.proof_type !== 'none' || objective.location_requirement_type !== 'none';
}

export function verificationLabel(method: QuestVerificationMethod): string {
  switch (method) {
    case 'camera': return 'Camera proof';
    case 'gps': return 'GPS validation';
    case 'timer': return 'Timed activity';
    case 'integrity_confirmation': return 'Integrity confirmation';
  }
}

export function formatRemainingTimer(earliestCompletionAt: string | null, now = Date.now()): string | null {
  if (!earliestCompletionAt) return null;
  const remainingMs = new Date(earliestCompletionAt).getTime() - now;
  if (remainingMs <= 0) return 'Ready to complete';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s remaining` : `${seconds}s remaining`;
}