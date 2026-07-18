/**
 * Hunt — My Hunts tab
 *
 * Four sections: In Action, Ready, Completed, Invitations.
 * Includes a visible + Create button for creating Custom Games.
 *
 * Hunt creation is accessible here — NOT hidden in settings or
 * a separate creator dashboard.
 *
 * Full implementation: Build 6 — Hunt Core
 */

import PlaceholderScreen from '@/components/navigation/PlaceholderScreen';

export default function MyHuntsScreen() {
  return (
    <PlaceholderScreen
      mode="hunt"
      screen="My Hunts"
      icon="flag"
      buildStep="Build 6"
      description="In Action, Ready, Completed, and Invitations — plus + Create for Custom Games."
    />
  );
}
