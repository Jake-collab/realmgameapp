import type { Router } from 'expo-router';
import type { NotificationTargetType } from './notification.types';

const routeFor: Record<NotificationTargetType, string> = {
  quest: '/(main)/quest-detail/[questId]',
  hunt: '/(main)/hunt-detail/[huntId]',
  'custom-hunt': '/(main)/hunt-invitation/[invitationId]',
  submission: '/(main)/quest-submission/[participationId]',
  progress: '/(main)/quest/progress',
  profile: '/(main)/quest/profile',
  notifications: '/(main)/notifications',
};

export function parseWorldsDeepLink(value: string | null | undefined): { type: NotificationTargetType; id?: string } | null {
  if (!value?.startsWith('worlds://')) return null;
  const parts = value.slice('worlds://'.length).split('/').filter(Boolean);
  const type = parts[0] as NotificationTargetType;
  if (!routeFor[type]) return null;
  return { type, id: parts[1] };
}

export function openNotificationTarget(router: Router, deepLink: string | null | undefined) {
  const target = parseWorldsDeepLink(deepLink);
  if (!target) { router.push('/(main)/notifications'); return false; }
  if (target.type === 'progress' || target.type === 'profile' || target.type === 'notifications') {
    router.push(routeFor[target.type] as never); return true;
  }
  if (!target.id || !/^[a-zA-Z0-9_-]{1,128}$/.test(target.id)) { router.push('/(main)/notifications'); return false; }
  router.push({ pathname: routeFor[target.type] as never, params: target.type === 'submission' ? { participationId: target.id } : target.type === 'custom-hunt' ? { invitationId: target.id } : target.type === 'quest' ? { questId: target.id } : { huntId: target.id } } as never);
  return true;
}