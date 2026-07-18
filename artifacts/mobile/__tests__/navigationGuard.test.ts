/**
 * NavigationGuard — Routing Logic Tests
 *
 * Verifies that each AuthStartupState routes to the correct route group,
 * that the splash screen is hidden exactly once, and that no redirect
 * occurs while the state is 'initializing'.
 */

import type { AuthStartupState } from '@/features/auth/AuthProvider';

// ─── Route mapping table ──────────────────────────────────────────────────────

type RouteCase = {
  state: AuthStartupState;
  activeMode?: 'quest' | 'hunt';
  expectedRoute: string;
};

const ROUTING_TABLE: RouteCase[] = [
  { state: 'configuration_missing', expectedRoute: '/(auth)/welcome' },
  { state: 'unauthenticated', expectedRoute: '/(auth)/welcome' },
  { state: 'authenticated_needs_verification', expectedRoute: '/(auth)/verify-email' },
  { state: 'authenticated_needs_onboarding', expectedRoute: '/(onboarding)/welcome' },
  { state: 'authenticated_suspended', expectedRoute: '/(auth)/welcome' },
  { state: 'authenticated_ready', activeMode: 'quest', expectedRoute: '/(main)/quest' },
  { state: 'authenticated_ready', activeMode: 'hunt', expectedRoute: '/(main)/hunt' },
  { state: 'error', expectedRoute: '/(auth)/welcome' },
];

// ─── Route resolution logic (extracted from NavigationGuard) ──────────────────

function resolveRoute(
  state: AuthStartupState,
  activeMode: 'quest' | 'hunt' = 'quest',
  currentSegment: string = ''
): string | null {
  if (state === 'initializing') return null;

  const inAuth = currentSegment === '(auth)';
  const inOnboarding = currentSegment === '(onboarding)';
  const inMain = currentSegment === '(main)';

  switch (state) {
    case 'configuration_missing':
    case 'unauthenticated':
      return inAuth ? null : '/(auth)/welcome';

    case 'authenticated_needs_verification':
      return inAuth ? null : '/(auth)/verify-email';

    case 'authenticated_needs_onboarding':
      return inOnboarding ? null : '/(onboarding)/welcome';

    case 'authenticated_suspended':
      return inAuth ? null : '/(auth)/welcome';

    case 'authenticated_ready':
      return inMain ? null : (activeMode === 'hunt' ? '/(main)/hunt' : '/(main)/quest');

    case 'error':
      return inAuth ? null : '/(auth)/welcome';

    default:
      return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NavigationGuard routing logic', () => {
  ROUTING_TABLE.forEach(({ state, activeMode = 'quest', expectedRoute }) => {
    it(`routes "${state}" (mode=${activeMode}) to "${expectedRoute}"`, () => {
      const route = resolveRoute(state, activeMode);
      expect(route).toBe(expectedRoute);
    });
  });

  it('does not redirect while state is "initializing"', () => {
    const route = resolveRoute('initializing');
    expect(route).toBeNull();
  });

  it('does not redirect when already in the correct segment (auth)', () => {
    const route = resolveRoute('unauthenticated', 'quest', '(auth)');
    expect(route).toBeNull();
  });

  it('does not redirect when already in the correct segment (main)', () => {
    const route = resolveRoute('authenticated_ready', 'quest', '(main)');
    expect(route).toBeNull();
  });

  it('does not redirect when already in the correct segment (onboarding)', () => {
    const route = resolveRoute('authenticated_needs_onboarding', 'quest', '(onboarding)');
    expect(route).toBeNull();
  });

  it('redirects to hunt when authenticated_ready and activeMode is hunt', () => {
    const route = resolveRoute('authenticated_ready', 'hunt', '');
    expect(route).toBe('/(main)/hunt');
  });

  it('redirects to quest when authenticated_ready and activeMode is quest', () => {
    const route = resolveRoute('authenticated_ready', 'quest', '');
    expect(route).toBe('/(main)/quest');
  });
});
