/**
 * Game-mode types — Worlds
 *
 * Currently planned modes:
 *   - Quest: story-driven, location-based puzzles
 *   - Hunt:  competitive scavenger hunts
 *
 * Future modes are added as additional GameMode values plus a new
 * entry in GAME_MODES — no other core changes required.
 */

export type GameMode = 'quest' | 'hunt';

export interface GameModeConfig {
  id: GameMode;
  title: string;
  tagline: string;
  description: string;
  /** Hex color for this game mode — matches colors.ts game-mode tokens */
  color: string;
  /** Feather icon name */
  icon: string;
  /** Whether this mode is currently playable */
  available: boolean;
}

export const GAME_MODES: GameModeConfig[] = [
  {
    id: 'quest',
    title: 'Quest',
    tagline: 'Follow the story. Solve the mystery.',
    description: 'Story-driven puzzles anchored to real places. Daily, monthly, and geo-located adventures.',
    color: '#F97316',   // warm adventure orange — matches colors.light.quest
    icon: 'compass',
    available: false,   // Unlocked in Build 4
  },
  {
    id: 'hunt',
    title: 'Hunt',
    tagline: 'Find it before the others do.',
    description: 'Competitive scavenger hunts on a live map. Official hunts, community events, and custom games.',
    color: '#059669',   // forest green — matches colors.light.hunt
    icon: 'map-pin',
    available: false,   // Unlocked in Build 6
  },
];

/** Base interface for any game session */
export interface GameSession {
  id: string;
  mode: GameMode;
  userId: string;
  startedAt: string;
  completedAt: string | null;
  score: number;
  status: 'active' | 'completed' | 'abandoned';
  /** Distinguishes platform-published content from user-created content */
  source: 'official' | 'custom' | 'community';
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** Geographic coordinate used across game modes */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}
