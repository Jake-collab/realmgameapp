export type ConflictCode = 'VERSION_CONFLICT' | 'ENTITY_FINALIZED' | 'ENTITY_EXPIRED' | 'PERMISSION_CHANGED' | 'ALREADY_SUBMITTED' | 'ALREADY_COMPLETED' | 'REQUIREMENT_CHANGED' | 'AUTH_USER_MISMATCH';

export interface DraftConflict<T> {
  base: T;
  local: T;
  server: T;
  fields: string[];
  code: ConflictCode;
}

export function threeWayMerge<T extends Record<string, unknown>>(conflict: DraftConflict<T>) {
  const merged = { ...conflict.server } as Record<string, unknown>;
  const unresolved: string[] = [];
  for (const field of Object.keys(conflict.base)) {
    const baseValue = conflict.base[field];
    const localChanged = conflict.local[field] !== baseValue;
    const serverChanged = conflict.server[field] !== baseValue;
    if (localChanged && !serverChanged) merged[field] = conflict.local[field];
    else if (localChanged && serverChanged && conflict.local[field] !== conflict.server[field]) unresolved.push(field);
  }
  return { merged: merged as T, unresolved };
}

export function isServerAuthoritative(domain: string) {
  return ['quest_availability', 'hunt_availability', 'participation', 'proof', 'points', 'leaderboard', 'moderation', 'invitation', 'clue', 'achievement', 'account'].includes(domain);
}