/**
 * useMapFilters — Worlds
 *
 * Manages the active filter state for the Quest Map.
 * Filters persist for the duration of the map session (not across app restarts).
 */

import { useState, useCallback } from 'react';
import type { GeoQuestMapFilter } from '../types/questMap.types';
import { DEFAULT_GEO_QUEST_FILTER, countActiveFilters } from '../types/questMap.types';

export interface UseMapFiltersResult {
  filter: GeoQuestMapFilter;
  activeFilterCount: number;
  setFilter: (filter: GeoQuestMapFilter) => void;
  updateFilter: (partial: Partial<GeoQuestMapFilter>) => void;
  clearFilters: () => void;
}

export function useMapFilters(): UseMapFiltersResult {
  const [filter, setFilterState] = useState<GeoQuestMapFilter>(DEFAULT_GEO_QUEST_FILTER);

  const setFilter = useCallback((f: GeoQuestMapFilter) => {
    setFilterState(f);
  }, []);

  const updateFilter = useCallback((partial: Partial<GeoQuestMapFilter>) => {
    setFilterState(prev => ({ ...prev, ...partial }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState(DEFAULT_GEO_QUEST_FILTER);
  }, []);

  return {
    filter,
    activeFilterCount: countActiveFilters(filter),
    setFilter,
    updateFilter,
    clearFilters,
  };
}
