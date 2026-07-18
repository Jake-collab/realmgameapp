/**
 * TanStack Query client configuration.
 *
 * Centralised here so the same QueryClient instance is reused
 * across the app (mounted in app/_layout.tsx via QueryClientProvider).
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Keep data fresh for 5 minutes before re-fetching */
      staleTime: 5 * 60 * 1000,
      /** Keep inactive queries in cache for 10 minutes */
      gcTime: 10 * 60 * 1000,
      /** Retry failed queries up to 2 times */
      retry: 2,
      /** Retry delay: 1s, 2s */
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      /** Re-fetch when the window regains focus */
      refetchOnWindowFocus: false,
      /** Do not re-fetch on network reconnect automatically */
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
