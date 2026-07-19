/**
 * Quest Content State Machine — Worlds
 *
 * Validates quest content status transitions (admin-side lifecycle).
 * These transitions are admin/server-only — mobile clients read status
 * but never directly transition it.
 *
 * Allowed transitions:
 *   draft          → pending_review | rejected
 *   pending_review → approved | rejected
 *   approved       → scheduled | published | rejected
 *   scheduled      → published | paused | archived
 *   published      → paused | expired | archived
 *   paused         → published | archived
 *   expired        → archived
 *   rejected       → draft
 *   archived       → (terminal)
 */

import type { QuestStatus } from '@/lib/supabase/database.types';
import { QUEST_CONTENT_ALLOWED_TRANSITIONS } from '../constants';

// ─── Transition validation ────────────────────────────────────────────────────

export interface ContentTransitionResult {
  allowed: boolean;
  reason?: string;
}

export function validateQuestContentTransition(
  from: QuestStatus,
  to: QuestStatus
): ContentTransitionResult {
  const allowed = QUEST_CONTENT_ALLOWED_TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Cannot transition quest from '${from}' to '${to}'.`,
    };
  }

  return { allowed: true };
}

// ─── Visibility helpers ───────────────────────────────────────────────────────

/** Returns true if the quest is publicly visible to mobile clients */
export function isQuestPubliclyVisible(status: QuestStatus): boolean {
  return status === 'published';
}

/** Returns true if the quest can accept new participations */
export function isQuestOpenForParticipation(status: QuestStatus): boolean {
  return status === 'published';
}

/** Returns true if the quest is in a terminal content state */
export function isQuestContentTerminal(status: QuestStatus): boolean {
  return status === 'archived';
}

/** Returns true if the quest is in a pre-publication state */
export function isQuestDraft(status: QuestStatus): boolean {
  return ['draft', 'pending_review', 'approved', 'scheduled', 'rejected'].includes(status);
}

/** Returns true if the quest has been published at some point */
export function hasQuestBeenPublished(status: QuestStatus): boolean {
  return ['published', 'paused', 'expired', 'archived'].includes(status);
}
