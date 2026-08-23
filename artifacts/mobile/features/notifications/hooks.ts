import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import * as service from './notification.service';
import { useAppStore } from '@/lib/store';

export const notificationKeys = { all: ['notifications'] as const, list: (id: string) => ['notifications', id] as const, count: (id: string) => ['notifications', id, 'unread'] as const, prefs: (id: string) => ['notifications', id, 'preferences'] as const };
export function useNotifications() {
  const { user } = useAuth(); const id = user?.id ?? ''; const set = useAppStore(s => s.setUnreadCount);
  const query = useQuery({ queryKey: notificationKeys.list(id), queryFn: () => service.getMyNotifications(id), enabled: Boolean(id), staleTime: 30_000 });
  const count = useQuery({ queryKey: notificationKeys.count(id), queryFn: () => service.getUnreadCount(id), enabled: Boolean(id), staleTime: 30_000 });
  if (count.data !== undefined) set(count.data);
  return { ...query, unreadCount: count.data ?? 0 };
}
export function useMarkNotificationRead() {
  const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => service.markAsRead(user!.id, id), onSuccess: () => { if (user) { void qc.invalidateQueries({ queryKey: notificationKeys.list(user.id) }); void qc.invalidateQueries({ queryKey: notificationKeys.count(user.id) }); } } });
}
export function useMarkAllNotificationsRead() {
  const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({ mutationFn: () => service.markAllAsRead(user!.id), onSuccess: () => { if (user) { void qc.invalidateQueries({ queryKey: notificationKeys.list(user.id) }); void qc.invalidateQueries({ queryKey: notificationKeys.count(user.id) }); } } });
}
export function useNotificationPreferences() {
  const { user } = useAuth(); const id = user?.id ?? '';
  return useQuery({ queryKey: notificationKeys.prefs(id), queryFn: () => service.getNotificationPreferences(id), enabled: Boolean(id), staleTime: 60_000 });
}
export function useUpdateNotificationPreferences() {
  const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({ mutationFn: (patch: Parameters<typeof service.updateNotificationPreferences>[1]) => service.updateNotificationPreferences(user!.id, patch), onSuccess: () => { if (user) void qc.invalidateQueries({ queryKey: notificationKeys.prefs(user.id) }); } });
}