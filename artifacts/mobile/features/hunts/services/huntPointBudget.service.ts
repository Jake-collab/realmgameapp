import { DEFAULT_CANONICAL_HUNT_POLICY } from '../types/canonicalHunt.types';

export interface HuntPointAllocation {
  dropId: string;
  points: number;
  required: boolean;
}

export interface HuntPointBudgetResult {
  valid: boolean;
  budget: number;
  allocated: number;
  remaining: number;
  issues: string[];
}

export function calculateCustomHuntBudget(input: {
  requiredDropCount: number;
  estimatedDurationMinutes?: number;
  proofBurden?: number;
  difficulty?: number;
}, maxBudget = DEFAULT_CANONICAL_HUNT_POLICY.maxCustomHuntPoints): number {
  const count = Math.max(1, Math.floor(input.requiredDropCount));
  const durationBonus = Math.min(100, Math.max(0, Math.floor((input.estimatedDurationMinutes ?? 30) / 30) * 25));
  const proofBonus = Math.min(100, Math.max(0, Math.floor(input.proofBurden ?? 0) * 10));
  const difficultyBonus = Math.min(150, Math.max(0, Math.floor(input.difficulty ?? 0) * 25));
  return Math.min(maxBudget, Math.max(50, count * 50 + durationBonus + proofBonus + difficultyBonus));
}

export function validateHuntPointAllocations(
  allocations: HuntPointAllocation[],
  budget: number,
  maxPerDrop = 200,
): HuntPointBudgetResult {
  const issues: string[] = [];
  const safeBudget = Math.max(0, Math.floor(budget));
  const allocated = allocations.reduce((sum, item) => {
    if (!Number.isFinite(item.points) || item.points < 0 || item.points > maxPerDrop || !Number.isInteger(item.points)) {
      issues.push(`${item.dropId}: points must be a whole number between 0 and ${maxPerDrop}.`);
    }
    return sum + (Number.isFinite(item.points) ? item.points : 0);
  }, 0);
  if (allocated > safeBudget) issues.push(`Allocated points cannot exceed the approved budget of ${safeBudget}.`);
  if (allocations.some(item => item.required && item.points <= 0)) issues.push('Every required Drop must have a positive point value.');
  return { valid: issues.length === 0, budget: safeBudget, allocated, remaining: Math.max(0, safeBudget - allocated), issues };
}