/**
 * usePlaceSearch — Worlds
 *
 * Debounced place search using Mapbox Geocoding API.
 * Restricted to US for Build 1.
 *
 * Rules:
 * - Debounced to avoid excessive API calls during typing.
 * - Does not store search history permanently.
 * - Access token is client-safe (pk.*) — not a secret key.
 * - Geographic restriction via SEARCH_BBOX_US in config.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { searchPlaces } from '../repositories/questMap.repository';
import type { PlaceSuggestion } from '../types/questMap.types';
import { SEARCH_DEBOUNCE_MS } from '../../maps/config/mapConfig';
import { isMapboxConfigured } from '../../maps/config/mapConfig';

export interface UsePlaceSearchResult {
  query: string;
  suggestions: PlaceSuggestion[];
  isSearching: boolean;
  hasError: boolean;
  setQuery: (text: string) => void;
  clearSearch: () => void;
  selectSuggestion: (suggestion: PlaceSuggestion) => void;
  selectedPlace: PlaceSuggestion | null;
}

export function usePlaceSearch(): UsePlaceSearchResult {
  const [query, setQueryState] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (!isMapboxConfigured()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    // Cancel any in-flight search
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsSearching(true);
    setHasError(false);

    try {
      const results = await searchPlaces(text);
      setSuggestions(results);
    } catch {
      setHasError(true);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const setQuery = useCallback((text: string) => {
    setQueryState(text);
    setSelectedPlace(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(text);
    }, SEARCH_DEBOUNCE_MS);
  }, [performSearch]);

  const clearSearch = useCallback(() => {
    setQueryState('');
    setSuggestions([]);
    setIsSearching(false);
    setHasError(false);
    setSelectedPlace(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const selectSuggestion = useCallback((suggestion: PlaceSuggestion) => {
    setSelectedPlace(suggestion);
    setQueryState(suggestion.placeName);
    setSuggestions([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return {
    query,
    suggestions,
    isSearching,
    hasError,
    setQuery,
    clearSearch,
    selectSuggestion,
    selectedPlace,
  };
}
