/**
 * Hunt — Map tab (PRIMARY screen)
 *
 * The map is the center of the Hunt experience and opens immediately
 * when Hunt mode is selected. It occupies nearly the entire usable screen.
 *
 * Displays: Official Hunts, Custom Games, Active Hunts, Invitations.
 * Tapping a marker opens a HuntPreviewSheet.
 * Floating + Create button always visible.
 *
 * Full implementation: Build 6 — Hunt Core (requires Build 5 Mapbox)
 * Note: Requires a native development build (incompatible with Expo Go).
 */

import PlaceholderScreen from '@/components/navigation/PlaceholderScreen';

export default function HuntMapScreen() {
  return (
    <PlaceholderScreen
      mode="hunt"
      screen="Map"
      icon="map-pin"
      buildStep="Build 6"
      description="Live hunt map — Official Hunts, Custom Games, and Active Hunts displayed as markers."
    />
  );
}
