/**
 * Supabase database type definitions.
 *
 * This file will be replaced by the auto-generated types from Supabase CLI:
 *   npx supabase gen types typescript --project-id <id> > supabase/types.ts
 *
 * Until Supabase is connected, this file provides placeholder types
 * that mirror the expected database schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          role: string;
          xp: number;
          level: number;
          badges: string[];
          quests_completed: number;
          hunts_completed: number;
          total_score: number;
          streak: number;
          longest_streak: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: string;
          xp?: number;
          level?: number;
          badges?: string[];
          quests_completed?: number;
          hunts_completed?: number;
          total_score?: number;
          streak?: number;
          longest_streak?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      game_sessions: {
        Row: {
          id: string;
          mode: string;
          user_id: string;
          started_at: string;
          completed_at: string | null;
          score: number;
          status: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          mode: string;
          user_id: string;
          started_at?: string;
          completed_at?: string | null;
          score?: number;
          status?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['game_sessions']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'anonymous' | 'registered' | 'moderator' | 'creator' | 'administrator';
      game_mode: 'quest' | 'hunt';
      game_status: 'active' | 'completed' | 'abandoned';
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
