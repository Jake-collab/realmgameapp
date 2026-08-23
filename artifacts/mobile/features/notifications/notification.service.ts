import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { AppNotification, NotificationPreferences } from './notification.types';

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
  if (!isSupabaseConfigured()) return;
  const { error } = await requireSupabase().rpc('mark_notification_read', { p_notification_id: notificationId, p_user_id: userId });
  if (error) throw error;
}
export async function markAllAsRead(userId: string) {
  if (!isSupabaseConfigured()) return;
  const { error } = await requireSupabase().rpc('mark_all_notifications_read', { p_user_id: userId });
  if (error) throw error;
}
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await requireSupabase().from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as NotificationPreferences | null;
}
export async function updateNotificationPreferences(userId: string, patch: Partial<NotificationPreferences>) {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await requireSupabase().rpc('update_notification_preferences', { p_user_id: userId, p_preferences: patch });
  if (error) throw error;
  return data;
}