/**
 * Game-mode types.
 *
 * Currently planned modes:
 *   - Quest: story-driven, location-based puzzles
 *   - Hunt: competitive scavenger hunts
 *
 * Future modes can be added as additional GameMode values.
 */

export type GameMode = 'quest' | 'hunt';

export interface GameModeConfig {
  id: GameMode;
  title: string;
  tagline: string;
  /** Hex color for this game mode */
  color: string;
  /** Icon name from @expo/vector-icons Feather set */
  icon: string;
  /** Whether this mode is currently available */
  available: boolean;
}

export const GAME_MODES: GameModeConfig[] = [
  {
    id: 'quest',
    title: 'Quest',
    tagline: 'Follow the story. Solve the mystery.',
    color: '#FF6B35',
    icon: 'compass',
    available: false, // Unlocked in Build 2
  },
  {
    id: 'hunt',
    title: 'Hunt',
    tagline: 'Find it before the others do.',
    color: '#00E5A0',
    icon: 'map-pin',
    available: false, // Unlocked in Build 3
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
}

/** Difficulty levels used across game modes */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** Geographic location used in maps/game logic */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}
