/**
 * Analytics Event Hooks — Worlds
 *
 * Lightweight event hooks for auth and onboarding lifecycle events.
 * No third-party analytics provider yet — these log in development and
 * prepare call sites for future integration (Amplitude, Mixpanel, Segment, etc).
 *
 * Rules:
 *   - NEVER log passwords, session tokens, or reset links.
 *   - NEVER log precise location data.
 *   - NEVER log sensitive legal form values.
 *   - In production, emit to the analytics provider when connected.
 *   - In development, log to console with a structured prefix.
 */

export type AnalyticsEvent =
  | 'welcome_viewed'
  | 'signup_started'
  | 'signup_completed'
  | 'signup_verification_required'
  | 'login_completed'
  | 'login_failed'
  | 'logout_completed'
  | 'password_reset_requested'
  | 'password_updated'
  | 'email_verification_resent'
  | 'email_verified'
  | 'onboarding_started'
  | 'onboarding_interests_completed'
  | 'onboarding_location_granted'
  | 'onboarding_location_denied'
  | 'onboarding_location_skipped'
  | 'onboarding_mode_selected'
  | 'onboarding_completed'
  | 'startup_state_resolved'
  | 'profile_recovery_attempted';

interface EventPayload {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track an analytics event.
 * Swap out the body of this function when adding a real analytics provider.
 */
export function trackEvent(event: AnalyticsEvent, payload?: EventPayload): void {
  if (__DEV__) {
    console.info(`[Analytics] ${event}`, payload ?? '');
  }
  // TODO (future): send to analytics provider
  // analytics.track(event, { ...payload, timestamp: Date.now() });
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export const analytics = {
  welcomeViewed: () => trackEvent('welcome_viewed'),
  signupStarted: () => trackEvent('signup_started'),
  signupCompleted: (userId: string) => trackEvent('signup_completed', { user_id: userId }),
  signupVerificationRequired: () => trackEvent('signup_verification_required'),
  loginCompleted: (userId: string) => trackEvent('login_completed', { user_id: userId }),
  loginFailed: (category: string) => trackEvent('login_failed', { error_category: category }),
  logoutCompleted: () => trackEvent('logout_completed'),
  passwordResetRequested: () => trackEvent('password_reset_requested'),
  passwordUpdated: () => trackEvent('password_updated'),
  emailVerificationResent: () => trackEvent('email_verification_resent'),
  emailVerified: (userId: string) => trackEvent('email_verified', { user_id: userId }),
  onboardingStarted: (userId: string) => trackEvent('onboarding_started', { user_id: userId }),
  onboardingInterestsCompleted: (count: number) =>
    trackEvent('onboarding_interests_completed', { interest_count: count }),
  onboardingLocationGranted: () => trackEvent('onboarding_location_granted'),
  onboardingLocationDenied: () => trackEvent('onboarding_location_denied'),
  onboardingLocationSkipped: () => trackEvent('onboarding_location_skipped'),
  onboardingModeSelected: (mode: string) =>
    trackEvent('onboarding_mode_selected', { mode }),
  onboardingCompleted: (userId: string, mode: string) =>
    trackEvent('onboarding_completed', { user_id: userId, starting_mode: mode }),
  startupStateResolved: (state: string) =>
    trackEvent('startup_state_resolved', { state }),
  profileRecoveryAttempted: (userId: string) =>
    trackEvent('profile_recovery_attempted', { user_id: userId }),
} as const;
