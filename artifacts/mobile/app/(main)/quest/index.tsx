/**
 * Quest — Home tab
 *
 * Displays the player's active quest prominently, with compact summaries
 * for Daily, Monthly, and Geo-Quest below.
 *
 * Full implementation: Build 4 — Quest Core
 */

import PlaceholderScreen from '@/components/navigation/PlaceholderScreen';

export default function QuestHomeScreen() {
  return (
    <PlaceholderScreen
      mode="quest"
      screen="Home"
      icon="home"
      buildStep="Build 4"
      description="Your active quest + daily, monthly & geo-quest summaries will appear here."
    />
  );
}
