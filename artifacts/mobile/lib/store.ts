/**
 * Global Zustand store — Worlds
 *
 * Only lightweight, truly global UI state belongs here.
 * Server/database state stays in React Query.
 * Feature-local state stays in feature-level contexts or useState.
 *
 * State ownership:
 *   Supabase Auth   → session identity (source of truth for auth)
 *   AuthProvider    → startupState, user, profile, auth actions
 *   React Query     → profile/settings/interests (server-cached)
 *   Zustand (here)  → navigation preferences + transient UI state
 *
 * Persistence:
 *   Navigation prefs (activeMode, lastQuestTab, lastHuntTab) are persisted
 *   to AsyncStorage so they survive app restarts.
 *   hasOnboarded is NOT persisted here — it is derived from profile.onboarding_status
 *   and synced into Zustand by AuthProvider for convenient synchronous reads.
 *
 * Slices:
 *   - app:          initialization flags and onboarding cache
 *   - navigation:   active game mode + last-visited tab per mode (persisted)
 *   - ui:           toasts and global modal state
 *   - notifications: unread count badge
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameMode } from '@/types/game.types';

// ─── App Slice ────────────────────────────────────────────────────────────────

interface AppSlice {
  isReady: boolean;
  /**
   * Cached copy of profile.onboarding_status === 'completed'.
   * Source of truth is the database. AuthProvider syncs this value here
   * so components can do synchronous checks without reading the DB.
   */
  hasOnboarded: boolean;
  setReady: (value: boolean) => void;
  setHasOnboarded: (value: boolean) => void;
}

// ─── Navigation Slice ─────────────────────────────────────────────────────────

interface NavigationSlice {
  /**
   * The currently active game mode.
   * Used by the top-level mode switcher and navigation guard.
   * Synced from profile.preferred_game_mode on login.
   */
  activeMode: GameMode;

  /**
   * Last-visited tab within each mode.
   * Preserved when the user switches modes and returns.
   * Quest tabs: 'index' | 'quests' | 'map' | 'progress' | 'profile'
   * Hunt tabs:  'index' | 'my-hunts' | 'progress' | 'profile'
   */
  lastQuestTab: string;
  lastHuntTab: string;

  setActiveMode: (mode: GameMode) => void;
  setLastQuestTab: (tab: string) => void;
  setLastHuntTab: (tab: string) => void;
}

// ─── UI Slice ─────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface UISlice {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

// ─── Notifications Slice ──────────────────────────────────────────────────────

interface NotificationsSlice {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
}

// ─── Combined Store ───────────────────────────────────────────────────────────

type AppStore = AppSlice & NavigationSlice & UISlice & NotificationsSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // ── App ────────────────────────────────────────────────────────────────
      isReady: false,
      hasOnboarded: false,
      setReady: (value) => set({ isReady: value }),
      setHasOnboarded: (value) => set({ hasOnboarded: value }),

      // ── Navigation ─────────────────────────────────────────────────────────
      activeMode: 'quest',
      lastQuestTab: 'index',
      lastHuntTab: 'index',
      setActiveMode: (mode) => set({ activeMode: mode }),
      setLastQuestTab: (tab) => set({ lastQuestTab: tab }),
      setLastHuntTab: (tab) => set({ lastHuntTab: tab }),

      // ── UI ─────────────────────────────────────────────────────────────────
      toasts: [],
      addToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            {
              ...toast,
              id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
            },
          ],
        })),
      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
      clearToasts: () => set({ toasts: [] }),

      // ── Notifications ───────────────────────────────────────────────────────
      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),
      incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
      clearUnread: () => set({ unreadCount: 0 }),
    }),
    {
      name: 'worlds-navigation-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist navigation preferences — not transient UI state
      partialize: (state) => ({
        activeMode: state.activeMode,
        lastQuestTab: state.lastQuestTab,
        lastHuntTab: state.lastHuntTab,
      }),
      version: 1,
      migrate: (_persistedState, _version) => {
        // Future: handle schema changes between store versions
        return _persistedState as AppStore;
      },
    }
  )
);
