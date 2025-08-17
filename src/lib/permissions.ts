import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Check if the current user has the specified permission
 * @param permissionName The permission name to check
 * @returns Boolean indicating if the user has the permission
 */
export async function hasPermission(permissionName: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  
  console.log(`[PERMISSION CHECK] Permission: ${permissionName}`);
  console.log(`[PERMISSION CHECK] Session exists: ${!!session}`);
  console.log(`[PERMISSION CHECK] User exists: ${!!session?.user}`);
  console.log(`[PERMISSION CHECK] User role: ${session?.user?.role}`);
  console.log(`[PERMISSION CHECK] User permissions: ${JSON.stringify(session?.user?.permissions)}`);
  
  if (!session || !session.user) {
    console.log(`[PERMISSION CHECK] DENIED: No session or user`);
    return false;
  }
  
  // Admin roles have all permissions
  if (session.user.role === 'System Administrator' || session.user.role === 'Admin') {
    console.log(`[PERMISSION CHECK] GRANTED: Admin role (${session.user.role})`);
    return true;
  }
  
  // Check if the user has the specific permission
  const hasPermissionInList = session.user.permissions?.includes(permissionName) || false;
  console.log(`[PERMISSION CHECK] Permission in list: ${hasPermissionInList}`);
  console.log(`[PERMISSION CHECK] Result: ${hasPermissionInList ? 'GRANTED' : 'DENIED'}`);
  
  return hasPermissionInList;
}

/**
 * Check if the current user has any of the specified permissions
 * @param permissionNames Array of permission names to check
 * @returns Boolean indicating if the user has any of the permissions
 */
export async function hasAnyPermission(permissionNames: string[]): Promise<boolean> {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return false;
  }
  
  // Admin roles have all permissions
  if (session.user.role === 'System Administrator' || session.user.role === 'Admin') {
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
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return false;
  }
  
  // Admin roles have all permissions
  if (session.user.role === 'System Administrator' || session.user.role === 'Admin') {
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
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

/**
 * Get the current user's role from the session
 * @returns The user role or null if not authenticated
 */
export async function getCurrentUserRole(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.role || null;
}
