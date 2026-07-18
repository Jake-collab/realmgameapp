/**
 * Quest — Map tab
 *
 * Mapbox map showing quest waypoints and geo-quest zones near the player.
 * Tapping a marker opens a bottom sheet with quest info.
 *
 * Full implementation: Build 5 — Mapbox
 * Note: Requires a native development build (incompatible with Expo Go).
 */

import PlaceholderScreen from '@/components/navigation/PlaceholderScreen';

export default function QuestMapScreen() {
  return (
    <PlaceholderScreen
      mode="quest"
      screen="Map"
      icon="map"
      buildStep="Build 5"
      description="Quest waypoints and geo-quest zones on a live Mapbox map."
    />
  );
}
