/**
 * useActiveTitle — Returns the current user's active title (if any).
 * Derived from the full titles list.
 */

import { useMemo } from 'react';
import { useTitles } from './useTitles';
import type { UserTitle } from '../types/progression.types';

export function useActiveTitle(): {
  activeTitle: UserTitle | null;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useTitles();

  const activeTitle = useMemo(
    () => data?.find(t => t.isActive) ?? null,
    [data],
  );

  return { activeTitle, isLoading, isError };
}
