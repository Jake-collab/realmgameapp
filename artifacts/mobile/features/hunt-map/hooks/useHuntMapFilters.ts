/**
 * useHuntMapFilters — Worlds
 *
 * Local state for Hunt map filters.
 * Filters persist while the user remains on the Hunt Map tab.
 * Cleared when the tab is unmounted.
 */

import { useState, useCallback } from 'react';
import {
  DEFAULT_HUNT_MAP_FILTER,
  countActiveHuntFilters,
} from '../types/huntMap.types';
import type { HuntMapFilter } from '../types/huntMap.types';

export interface UseHuntMapFiltersReturn {
  filter: HuntMapFilter;
  activeFilterCount: number;
  setFilter: (f: HuntMapFilter) => void;
  clearFilters: () => void;
}

export function useHuntMapFilters(): UseHuntMapFiltersReturn {
  const [filter, setFilterState] = useState<HuntMapFilter>(DEFAULT_HUNT_MAP_FILTER);

  const setFilter = useCallback((f: HuntMapFilter) => {
    setFilterState(f);
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState(DEFAULT_HUNT_MAP_FILTER);
  }, []);

  return {
    filter,
    activeFilterCount: countActiveHuntFilters(filter),
    setFilter,
    clearFilters,
  };
}
