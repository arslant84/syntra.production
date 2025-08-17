import { getServerSession as nextAuthGetServerSession } from "next-auth";

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId: string;
  permissions: string[];
  department?: string;
  staffId?: string;
}

/**
 * Get the current authenticated user session with enhanced RBAC support
 * Note: This function should only be called on the server side
 */
export async function getCurrentUserSession(): Promise<UserSession | null> {
  try {
    // Dynamic import to avoid issues with client-side rendering
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const session = await nextAuthGetServerSession(authOptions);
    
    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email || '',
      name: session.user.name || '',
      role: session.user.role || '',
      roleId: session.user.roleId || '',
      permissions: session.user.permissions || [],
      department: session.user.department,
      staffId: session.user.staffId
    };
  } catch (error) {
    console.error('Session error:', error);
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(): Promise<UserSession> {
  try {
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const session = await nextAuthGetServerSession(authOptions);
    
    if (!session?.user) {
      throw new Error('UNAUTHORIZED');
    }

    return {
      id: session.user.id,
      email: session.user.email || '',
      name: session.user.name || '',
      role: session.user.role || '',
      roleId: session.user.roleId || '',
      permissions: session.user.permissions || [],
      department: session.user.department,
      staffId: session.user.staffId
    };
  } catch (error) {
    console.error('Auth error:', error);
    throw new Error('UNAUTHORIZED');
  }
}

/**
 * Require specific permission - throws error if not authorized
 */
export async function requirePermission(permission: string): Promise<UserSession> {
  const session = await requireAuth();
  if (!session.permissions.includes(permission)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}

/**
 * Require specific role - throws error if not authorized
 */
export async function requireRole(allowedRoles: string[]): Promise<UserSession> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(session: UserSession | null, permission: string): boolean {
  if (!session) return false;
  
  // Admin roles have all permissions
  const adminRoles = ['System Administrator', 'Admin'];
  if (adminRoles.includes(session.role)) {
    return true;
  }
  
  return session.permissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(session: UserSession | null, permissions: string[]): boolean {
  if (!session) return false;
  
  // Admin roles have all permissions
  const adminRoles = ['System Administrator', 'Admin'];
  if (adminRoles.includes(session.role)) {
    return true;
  }
  
  return permissions.some(p => session.permissions.includes(p));
}

/**
 * Check if user has specific role
 */
export function hasRole(session: UserSession | null, role: string): boolean {
  if (!session) return false;
  return session.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(session: UserSession | null, roles: string[]): boolean {
  if (!session) return false;
  return roles.includes(session.role);
}

/**
 * Get navigation permissions based on user session and database permissions
 * Now uses database permissions instead of hardcoded role logic
 */
export function getNavigationPermissions(session: UserSession): {
  canViewAdminMenus: boolean;
  canViewApprovals: boolean;
  canViewReports: boolean;
  canViewUserManagement: boolean;
  canViewSystemSettings: boolean;
  canViewFlightsAdmin: boolean;
  canViewAccommodationAdmin: boolean;
  canViewVisaAdmin: boolean;
  canViewClaimsAdmin: boolean;
  canViewTransportAdmin: boolean;
} {
  if (!session) {
    return {
      canViewAdminMenus: false,
      canViewApprovals: false,
      canViewReports: false,
      canViewUserManagement: false,
      canViewSystemSettings: false,
      canViewFlightsAdmin: false,
      canViewAccommodationAdmin: false,
      canViewVisaAdmin: false,
      canViewClaimsAdmin: false,
      canViewTransportAdmin: false,
    };
  }

  // Use database permissions instead of hardcoded role checks
  return {
    canViewAdminMenus: hasPermission(session, 'view_system_settings') || hasPermission(session, 'manage_users'),
    canViewApprovals: hasAnyPermission(session, [
      'approve_trf_focal', 'approve_trf_manager', 'approve_trf_hod',
      'approve_claims_focal', 'approve_claims_manager', 'approve_claims_hod',
      'approve_transport_requests', 'approve_accommodation_requests', 'approve_visa_requests'
    ]),
    canViewReports: hasAnyPermission(session, ['generate_admin_reports', 'view_visa_reports', 'export_data']),
    canViewUserManagement: hasPermission(session, 'manage_users'),
    canViewSystemSettings: hasPermission(session, 'view_system_settings'),
    canViewFlightsAdmin: hasPermission(session, 'process_flights'),
    canViewAccommodationAdmin: hasPermission(session, 'manage_accommodation_bookings'),
    canViewVisaAdmin: hasPermission(session, 'process_visa_applications'),
    canViewClaimsAdmin: hasPermission(session, 'process_claims'),
    canViewTransportAdmin: hasPermission(session, 'manage_transport_requests'),
  };
}