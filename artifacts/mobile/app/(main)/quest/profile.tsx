/**
 * Quest — Profile tab
 *
 * Shared player profile (same data as Hunt's profile tab).
 * Shows quest-specific stats in the context of the Quest mode.
 *
 * Access to: account details, interests, notifications settings,
 * privacy settings, safety, help, terms, privacy policy, log out.
 *
 * Settings are accessed through this profile — not through a separate
 * bottom-nav Settings tab.
 *
 * Full implementation: Build 7 — Progress & Profiles
 */

import PlaceholderScreen from '@/components/navigation/PlaceholderScreen';

export default function QuestProfileScreen() {
  return (
    <PlaceholderScreen
      mode="quest"
      screen="Profile"
      icon="user"
      buildStep="Build 7"
      description="Your player profile, quest stats, achievements, and account settings."
    />
  );
}
