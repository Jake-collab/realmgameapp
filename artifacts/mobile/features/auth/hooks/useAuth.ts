/**
 * useAuth hook — primary way to access auth state in components.
 *
 * Re-exports useAuthContext with a friendlier name and
 * optional role-based permission helpers.
 *
 * Example:
 *   const { user, isAuthenticated, signOut } = useAuth();
 *   const canModerate = useHasRole('moderator');
 */

import { useAuthContext } from '@/features/auth/AuthProvider';
import { hasRole } from '@/types/auth.types';
import type { UserRole } from '@/types/auth.types';

export function useAuth() {
  return useAuthContext();
}

/** Returns true if the current user has at least the given role */
export function useHasRole(required: UserRole): boolean {
  const { user } = useAuth();
  if (!user) return required === 'anonymous';
  return hasRole(user.role, required);
}
