/**
 * Notification Service — Worlds
 *
 * Reads and manages in-app notifications for the authenticated user.
 * Push notification delivery is out of scope for this build.
 * System creates notifications via service_role; clients only read + mark-read.
 */

import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { normalizeError, queryKeys } from '@/lib/supabase/helpers';
import type { NotificationRow } from '@/lib/supabase/database.types';

/**
 * Fetch all active (non-expired) notifications for the user.
 */
export async function getMyNotifications(
  userId: string,
  limit = 50
): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured()) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw normalizeError(error);
  return data ?? [];
}

/**
 * Get unread notification count via the database function.
 * Used by the NotificationBell badge.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const client = requireSupabase();
  const { data, error } = await client
    .rpc('get_unread_notification_count', { p_user_id: userId });

  if (error) {
    console.warn('[notificationService] getUnreadCount failed:', error.message);
    return 0;
  }
  return (data as number) ?? 0;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw normalizeError(error);
}

/**
 * Mark all unread notifications for the user as read.
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw normalizeError(error);
}

export { queryKeys };
