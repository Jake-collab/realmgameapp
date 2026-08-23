import { isInQuietHours } from '@/features/notifications/notification.service';
import { parseWorldsDeepLink } from '@/features/notifications/deepLinks';

describe('Prompt 21 notification safety', () => {
  it('handles quiet hours that cross midnight', () => {
    const prefs = { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', timezone: 'America/New_York' };
    expect(isInQuietHours(new Date('2026-01-15T03:00:00.000Z'), prefs)).toBe(true);
    expect(isInQuietHours(new Date('2026-01-15T16:00:00.000Z'), prefs)).toBe(false);
  });

  it('rejects malformed or unsupported deep links', () => {
    expect(parseWorldsDeepLink('https://example.com/quest/1')).toBeNull();
    expect(parseWorldsDeepLink('worlds://riddle-answer/secret')).toBeNull();
    expect(parseWorldsDeepLink('worlds://hunt/hunt-1')).toEqual({ type: 'hunt', id: 'hunt-1' });
  });
});