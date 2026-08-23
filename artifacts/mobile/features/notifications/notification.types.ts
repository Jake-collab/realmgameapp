export type NotificationCategory = 'quest' | 'hunt' | 'social' | 'progress' | 'moderation' | 'account' | 'system';
export type NotificationTargetType = 'quest' | 'hunt' | 'custom-hunt' | 'submission' | 'progress' | 'profile' | 'notifications';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deep_link: string | null;
  data?: Record<string, unknown> | null;
  read_at: string | null;
  archived_at?: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  questEnabled: boolean;
  huntEnabled: boolean;
  progressEnabled: boolean;
  socialEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  showDetails: boolean;
}