import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { revenueKeys } from '../queries/revenueKeys';
import {
  claimFreeCollectible,
  createCollectiblePurchaseIntent,
  fetchRevenueSummary,
} from '../repositories/revenue.repository';

export function useRevenueSummary() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: revenueKeys.summary(userId),
    queryFn: fetchRevenueSummary,
    enabled: Boolean(userId) && isSupabaseConfigured(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useClaimFreeCollectible() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimFreeCollectible,
    onSuccess: () => {
      if (user?.id) void queryClient.invalidateQueries({ queryKey: revenueKeys.summary(user.id) });
    },
  });
}

export function useCreateCollectiblePurchaseIntent() {
  return useMutation({
    mutationFn: ({ findBadgeId, idempotencyKey }: { findBadgeId: string; idempotencyKey: string }) =>
      createCollectiblePurchaseIntent(findBadgeId, idempotencyKey),
  });
}