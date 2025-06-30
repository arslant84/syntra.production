import { getServerSession } from "./auth";

/**
 * Check if the current user has the specified permission
 * @param permissionName The permission name to check
 * @returns Boolean indicating if the user has the permission
 */
export async function hasPermission(permissionName: string): Promise<boolean> {
  const session = await getServerSession();
  
  if (!session || !session.user) {
    return false;
  }
  
  // Admin role has all permissions
  if (session.user.role === 'admin') {
    return true;
  }
  
  // Check if the user has the specific permission
  return session.user.permissions?.includes(permissionName) || false;
}

/**
 * Check if the current user has any of the specified permissions
 * @param permissionNames Array of permission names to check
 * @returns Boolean indicating if the user has any of the permissions
 */
export async function hasAnyPermission(permissionNames: string[]): Promise<boolean> {
  const session = await getServerSession();
  
  if (!session || !session.user) {
    return false;
  }
  
  // Admin role has all permissions
  if (session.user.role === 'admin') {
    return true;
  }
  
  // Check if the user has any of the specified permissions
  return permissionNames.some(permission => 
    session.user?.permissions?.includes(permission) || false
  );
}

/**
 * Check if the current user has all of the specified permissions
 * @param permissionNames Array of permission names to check
 * @returns Boolean indicating if the user has all of the permissions
 */
export async function hasAllPermissions(permissionNames: string[]): Promise<boolean> {
  const session = await getServerSession();
  
  if (!session || !session.user) {
    return false;
  }
  
  // Admin role has all permissions
  if (session.user.role === 'admin') {
    return true;
  }
  
  // Check if the user has all of the specified permissions
  return permissionNames.every(permission => 
    session.user?.permissions?.includes(permission) || false
  );
}

/**
 * Get the current user's ID from the session
 * @returns The user ID or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.id || null;
}

/**
 * Get the current user's role from the session
 * @returns The user role or null if not authenticated
 */
export async function getCurrentUserRole(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.role || null;
}
