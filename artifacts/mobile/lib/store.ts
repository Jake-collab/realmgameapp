/**
 * Global Zustand store.
 *
 * Only lightweight, truly global UI state belongs here.
 * Server/database state should stay in React Query.
 * Feature-local state should stay in feature-level contexts or useState.
 *
 * Current slices:
 *   - app:  initialization and readiness flags
 *   - ui:   global UI state (toasts, modals, active modal IDs)
 *   - notifications: unread count badge
 */

import { create } from 'zustand';

// ─── App Slice ────────────────────────────────────────────────────────────────

interface AppSlice {
  isReady: boolean;
  hasOnboarded: boolean;
  setReady: (value: boolean) => void;
  setHasOnboarded: (value: boolean) => void;
}

// ─── UI Slice ─────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
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

type AppStore = AppSlice & UISlice & NotificationsSlice;

export const useAppStore = create<AppStore>((set) => ({
  // App
  isReady: false,
  hasOnboarded: false,
  setReady: (value) => set({ isReady: value }),
  setHasOnboarded: (value) => set({ hasOnboarded: value }),

  // UI
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
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),

  // Notifications
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
}));
