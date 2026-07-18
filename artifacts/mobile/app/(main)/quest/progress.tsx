/**
 * Quest — Progress tab
 *
 * Three sections: Leaderboards, In Action, Completed.
 * The player's own point total and rank are visually prominent.
 *
 * Full implementation: Build 7 — Progress & Profiles
 */

import PlaceholderScreen from '@/components/navigation/PlaceholderScreen';

export default function QuestProgressScreen() {
  return (
    <PlaceholderScreen
      mode="quest"
      screen="Progress"
      icon="bar-chart-2"
      buildStep="Build 7"
      description="Leaderboards, active quests, and completed quest history."
    />
  );
}
