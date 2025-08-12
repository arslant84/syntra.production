import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  role: string;
  permissions: string[];
}

/**
 * Get authenticated user from request
 * @param request - Next.js request object (optional, uses headers from middleware if available)
 * @returns Promise<AuthenticatedUser | null>
 */
export async function getAuthenticatedUser(request?: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || '',
      roleId: session.user.roleId,
      role: session.user.role,
      permissions: session.user.permissions || []
    };
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Require authentication for an API endpoint
 * @returns Promise<AuthenticatedUser> - Throws error if not authenticated
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  
  return user;
}

/**
 * Require specific permissions for an API endpoint
 * @param requiredPermissions - Array of required permission names
 * @returns Promise<AuthenticatedUser> - Throws error if not authorized
 */
export async function requirePermissions(requiredPermissions: string[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  
  const hasPermission = requiredPermissions.some(permission => 
    user.permissions.includes(permission)
  );
  
  if (!hasPermission) {
    throw new Error('FORBIDDEN');
  }
  
  return user;
}

/**
 * Require specific roles for an API endpoint
 * @param allowedRoles - Array of allowed role names
 * @returns Promise<AuthenticatedUser> - Throws error if not authorized
 */
export async function requireRoles(allowedRoles: string[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  
  if (!allowedRoles.includes(user.role)) {
    throw new Error('FORBIDDEN');
  }
  
  return user;
}

/**
 * Check if user has specific permission
 * @param user - Authenticated user
 * @param permission - Permission to check
 * @returns boolean
 */
export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

/**
 * Check if user has any of the specified roles
 * @param user - Authenticated user  
 * @param roles - Array of roles to check
 * @returns boolean
 */
export function hasRole(user: AuthenticatedUser, roles: string[]): boolean {
  return roles.includes(user.role);
}

/**
 * Create standardized error responses for authentication/authorization failures
 */
export function createAuthError(type: 'UNAUTHORIZED' | 'FORBIDDEN') {
  const errors = {
    UNAUTHORIZED: {
      message: 'Authentication required',
      status: 401
    },
    FORBIDDEN: {
      message: 'Insufficient permissions',
      status: 403
    }
  };
  
  return errors[type];
}