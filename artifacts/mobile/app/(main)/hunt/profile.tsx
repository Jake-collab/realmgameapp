/**
 * Hunt — Profile tab
 *
 * Shared player profile (same underlying data as Quest's profile tab).
 * Shows hunt-specific stats in the context of the Hunt mode.
 *
 * Access to: account details, interests, notifications settings,
 * privacy settings, safety, help, terms, privacy policy, log out.
 *
 * Do NOT create a separate profile system for Hunt — this renders
 * the same profile data as Quest with hunt-mode stat context.
 *
 * Full implementation: Build 7 — Progress & Profiles
 */

import PlaceholderScreen from '@/components/navigation/PlaceholderScreen';

export default function HuntProfileScreen() {
  return (
    <PlaceholderScreen
      mode="hunt"
      screen="Profile"
      icon="user"
      buildStep="Build 7"
      description="Your player profile, hunt stats, achievements, and account settings."
    />
  );
}
