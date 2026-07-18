/**
 * Global Zustand store — Worlds
 *
 * Only lightweight, truly global UI state belongs here.
 * Server/database state stays in React Query.
 * Feature-local state stays in feature-level contexts or useState.
 *
 * Slices:
 *   - app:          initialization flags and onboarding state
 *   - navigation:   active game mode + last-visited tab per mode
 *   - ui:           toasts and global modal state
 *   - notifications: unread count badge
 *
 * TODO (Build 2): Persist activeMode, lastQuestTab, lastHuntTab, and
 * hasOnboarded to AsyncStorage via zustand/middleware persist so they
 * survive app restarts.
 */

import { create } from 'zustand';
import type { GameMode } from '@/types/game.types';

// ─── App Slice ────────────────────────────────────────────────────────────────

interface AppSlice {
  isReady: boolean;
  /** True once the user has completed first-time onboarding */
  hasOnboarded: boolean;
  setReady: (value: boolean) => void;
  setHasOnboarded: (value: boolean) => void;
}

// ─── Navigation Slice ─────────────────────────────────────────────────────────

interface NavigationSlice {
  /**
   * The currently active game mode. Used by the top-level mode switcher
   * and the navigation guard to route to the correct tab navigator.
   */
  activeMode: GameMode;

  /**
   * Last-visited tab route within each game mode.
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

export const useAppStore = create<AppStore>((set) => ({
  // ── App ──────────────────────────────────────────────────────────────────
  isReady: false,
  hasOnboarded: false,
  setReady: (value) => set({ isReady: value }),
  setHasOnboarded: (value) => set({ hasOnboarded: value }),

  // ── Navigation ───────────────────────────────────────────────────────────
  activeMode: 'quest',
  lastQuestTab: 'index',
  lastHuntTab: 'index',
  setActiveMode: (mode) => set({ activeMode: mode }),
  setLastQuestTab: (tab) => set({ lastQuestTab: tab }),
  setLastHuntTab: (tab) => set({ lastHuntTab: tab }),

  // ── UI ───────────────────────────────────────────────────────────────────
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

  // ── Notifications ─────────────────────────────────────────────────────────
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
}));
