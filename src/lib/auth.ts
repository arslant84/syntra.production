// Authentication module
import { sql } from "./db";
import bcrypt from 'bcryptjs';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface Session {
  user: AuthUser | null;
}

/**
 * Get the current user session
 * This is a simplified version that doesn't require next-auth
 */
export async function getServerSession(): Promise<Session | null> {
  try {
    // In a real app, you would verify a JWT token from cookies
    // For this demo, we'll assume the user is authenticated and has admin role
    
    // For demo purposes, just use a fixed admin user ID
    const userId = 'admin-user';
    
    // For demo purposes, return a mock admin user
    return {
      user: {
        id: userId,
        email: 'admin@syntra.com',
        name: 'Admin User',
        role: 'admin',
        permissions: [
          'manage_accommodation',
          'view_accommodation',
          'edit_accommodation',
          'delete_accommodation'
        ]
      }
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Authenticate a user with email and password
 */
export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    // Get user from database
    const users = await sql`
      SELECT id, email, name, password, role_id as "roleId"
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    
    // Compare hashed passwords using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    // Get user roles and permissions
    const roles = await sql`
      SELECT r.name
      FROM roles r
      WHERE r.id = ${user.roleId}
    `;

    const permissions = await sql`
      SELECT p.name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ${user.roleId}
    `;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roles.length > 0 ? roles[0].name : '',
      permissions: permissions.map(p => p.name)
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

