/**
 * User profile types.
 */

import type { UserRole } from './auth.types';

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  /** Total experience points earned across all game modes */
  xp: number;
  /** Current level derived from XP */
  level: number;
  /** Badges/achievements earned */
  badges: string[];
  /** Stats per game mode */
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  questsCompleted: number;
  huntsCompleted: number;
  totalScore: number;
  streak: number;
  longestStreak: number;
}

export interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}
