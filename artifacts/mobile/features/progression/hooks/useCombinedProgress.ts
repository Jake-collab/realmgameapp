/**
 * useCombinedProgress — Aggregates achievements, titles, badges, and statistics
 * into one loading/error state for the Achievements hub.
 */

import { useMemo } from 'react';
import { useAchievements }      from './useAchievements';
import { useAchievementHistory } from './useAchievementHistory';
import { useTitles }            from './useTitles';
import { useBadges }            from './useBadges';
import { useStatistics }        from './useStatistics';
import { useProgressOverview }  from './useProgressOverview';

export function useCombinedProgress() {
  const achievements = useAchievements();
  const history      = useAchievementHistory();
  const titles       = useTitles();
  const badges       = useBadges();
  const statistics   = useStatistics();
  const overview     = useProgressOverview();

  const isLoading = useMemo(
    () =>
      achievements.isLoading ||
      titles.isLoading ||
      badges.isLoading ||
      statistics.isLoading ||
      overview.isLoading,
    [achievements.isLoading, titles.isLoading, badges.isLoading, statistics.isLoading, overview.isLoading],
  );

  const isError = useMemo(
    () =>
      achievements.isError ||
      titles.isError ||
      badges.isError ||
      statistics.isError ||
      overview.isError,
    [achievements.isError, titles.isError, badges.isError, statistics.isError, overview.isError],
  );

  return {
    achievements: achievements.data ?? [],
    history,
    titles:       titles.data ?? [],
    badges:       badges.data ?? [],
    statistics:   statistics.data ?? null,
    overview:     overview.data ?? null,
    isLoading,
    isError,
    refetch() {
      achievements.refetch();
      titles.refetch();
      badges.refetch();
      statistics.refetch();
      overview.refetch();
    },
  };
}
