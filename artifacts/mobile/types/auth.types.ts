/**
 * Authentication types.
 *
 * User roles form a hierarchy:
 *   anonymous < registered < moderator < creator < administrator
 */

export type UserRole =
  | 'anonymous'
  | 'registered'
  | 'moderator'
  | 'creator'
  | 'administrator';

/** Permission helpers based on role hierarchy */
export const roleLevel: Record<UserRole, number> = {
  anonymous: 0,
  registered: 1,
  moderator: 2,
  creator: 3,
  administrator: 4,
};

export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return roleLevel[userRole] >= roleLevel[required];
}

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  username?: string;
}

export interface AuthError {
  code: string;
  message: string;
}
