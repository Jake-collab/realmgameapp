import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { AppNotification, NotificationPreferences } from './notification.types';
import { enqueueOfflineMutation } from '@/features/offline/queue/mutationQueue';

export function isInQuietHours(now: Date, preferences: Pick<NotificationPreferences, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'timezone'>) {
  if (!preferences.quietHoursEnabled) return false;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: preferences.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const current = Number(parts.find(p => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  const parse = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
  const start = parse(preferences.quietHoursStart);
  const end = parse(preferences.quietHoursEnd);
  return start === end ? true : start < end ? current >= start && current < end : current >= start || current < end;
}

export async function getMyNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await requireSupabase().from('notifications').select('*').eq('user_id', userId).is('archived_at', null).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}
export async function getUnreadCount(userId: string) {
  if (!isSupabaseConfigured()) return 0;
  const { data, error } = await requireSupabase().rpc('get_unread_notification_count', { p_user_id: userId });
  if (error) throw error;
  return Number(data ?? 0);
}
export async function markAsRead(userId: string, notificationId: string) {
  if (!isSupabaseConfigured()) {
    await enqueueOfflineMutation({ userId, mutationType: 'notification_read', entityType: 'notification', entityId: notificationId, payload: { notificationId } });
    return;
  }
  const { error } = await requireSupabase().rpc('mark_notification_read', { p_notification_id: notificationId });
  if (error) throw error;
}
export async function markAllAsRead(userId: string) {
  if (!isSupabaseConfigured()) return;
  const { error } = await requireSupabase().rpc('mark_all_notifications_read');
  if (error) throw error;
}
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await requireSupabase().from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as NotificationPreferences | null;
}
export async function updateNotificationPreferences(userId: string, patch: Partial<NotificationPreferences>) {
  if (!isSupabaseConfigured()) {
    await enqueueOfflineMutation({ userId, mutationType: 'profile_preference_save', entityType: 'notification_preferences', entityId: userId, payload: patch as Record<string, unknown> });
    return patch;
  }
  const { data, error } = await requireSupabase().rpc('update_notification_preferences', { p_preferences: patch });
  if (error) throw error;
  return data;
}