import { useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  buyRevenueCatPackage,
  configureRevenueCat,
  getRevenueCatPackages,
  logoutRevenueCat,
  packageForCode,
  packageForOrder,
  restoreRevenueCatPurchases,
  type StorePackage,
} from '../services/revenueCat';

export function useRevenueCatIdentity() {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      void configureRevenueCat(userId);
    } else {
      void logoutRevenueCat();
    }
  }, [userId]);
}

export function useRevenueCatOfferings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['revenue', 'offerings', user?.id],
    queryFn: async () => {
      if (!user?.id || !await configureRevenueCat(user.id)) {
        throw new Error('Purchases are not available in this build.');
      }
      return getRevenueCatPackages();
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
}

export function useRevenueCatPurchase() {
  return useMutation({
    mutationFn: ({ pkg, orderId }: { pkg: StorePackage; orderId?: string }) => buyRevenueCatPackage(pkg, orderId),
  });
}

export function useRevenueCatRestore() {
  return useMutation({
    mutationFn: restoreRevenueCatPurchases,
  });
}

export function usePackageForCode(packages: StorePackage[] | undefined, code: string) {
  return useMemo(() => packageForCode(packages ?? [], code), [packages, code]);
}

export function usePackageForOrder(packages: StorePackage[] | undefined, grossMinor: number, currency: string) {
  return useMemo(() => packageForOrder(packages ?? [], grossMinor, currency), [packages, grossMinor, currency]);
}