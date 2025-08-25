// src/lib/auth-service.ts
import { getServerSession } from 'next-auth';
import { sql } from '@/lib/db';

// Define type for session user
type SessionUser = {
  email?: string;
  name?: string;
  id?: string;
};

// Define type for session
type Session = {
  user?: SessionUser;
};

/**
 * Checks if the current user has the specified permission
 * @param permissionName The name of the permission to check
 * @returns boolean indicating if the user has the permission
 */
export async function hasPermission(permissionName: string): Promise<boolean> {
  try {
    // Get the current user session
    const session = await getServerSession();
    
    // If no session or no user, return false
    if (!session || !session.user || !session.user.id) {
      return false;
    }
    
    // Get the user's ID from the session
    const userId = session.user.id;
    
    // Query the database to check if the user has the permission
    const result = await sql`
      SELECT p.name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ${userId} AND p.name = ${permissionName}
      LIMIT 1
    `;
    
    // If there's at least one row, the user has the permission
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error checking permission:', error);
    
    // In case of error, deny permission by default for security
    return false;
  }
}

/**
 * Gets all permissions for a user
 * @param userId The ID of the user
 * @returns Array of permission names
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    
    // Query the database for user permissions
    const result = await sql`
      SELECT DISTINCT p.name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ${userId}
      ORDER BY p.name
    `;
    
    return result.rows.map((row: any) => row.name as string);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Gets all roles for a user
 * @param userId The ID of the user
 * @returns Array of role names
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  try {
    
    // Query the database for user roles
    const result = await sql`
      SELECT r.name
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ${userId}
      ORDER BY r.name
    `;
    
    return result.rows.map((row: any) => row.name as string);
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}
