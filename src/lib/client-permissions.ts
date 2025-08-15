/**
 * Client-safe permission utilities
 * These functions work with session data that's already available on the client
 */

export interface ClientUserSession {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  roleId?: string;
  permissions?: string[];
  department?: string;
  staffId?: string;
}

/**
 * Check if user has specific permission (client-safe)
 */
export function hasPermission(session: ClientUserSession | null, permission: string): boolean {
  if (!session) return false;
  
  // Admin roles have all permissions
  const adminRoles = ['System Administrator', 'Admin'];
  if (session.role && adminRoles.includes(session.role)) {
    return true;
  }
  
  return session.permissions?.includes(permission) || false;
}

/**
 * Check if user has any of the specified permissions (client-safe)
 */
export function hasAnyPermission(session: ClientUserSession | null, permissions: string[]): boolean {
  if (!session) return false;
  
  // Admin roles have all permissions
  const adminRoles = ['System Administrator', 'Admin'];
  if (session.role && adminRoles.includes(session.role)) {
    return true;
  }
  
  return permissions.some(p => session.permissions?.includes(p));
}

/**
 * Check if user has specific role (client-safe)
 */
export function hasRole(session: ClientUserSession | null, role: string): boolean {
  if (!session) return false;
  return session.role === role;
}

/**
 * Check if user has any of the specified roles (client-safe)
 */
export function hasAnyRole(session: ClientUserSession | null, roles: string[]): boolean {
  if (!session) return false;
  return session.role ? roles.includes(session.role) : false;
}

/**
 * Get navigation permissions based on user role (client-safe)
 * Based on role matrix from USER_MANAGEMENT_RBAC_ANALYSIS.md
 */
export function getNavigationPermissions(role?: string): {
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
  if (!role) {
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

  // Role-based access according to analysis documents
  const result = {
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

  switch (role) {
    case 'Requestor':
      // Requestors should only see basic request forms and their own reports
      result.canViewReports = true; // Per analysis document
      break;
      
    case 'Department Focal':
    case 'Line Manager':
      // Approver roles see approvals only
      result.canViewApprovals = true;
      break;
      
    case 'HOD':
      // HOD sees approvals and reports
      result.canViewApprovals = true;
      result.canViewReports = true;
      break;
      
    case 'Ticketing Admin':
      // Specialist admin - only their specific area
      result.canViewFlightsAdmin = true;
      break;
      
    case 'Accomodation Admin':
      // Specialist admin - only their specific area
      result.canViewAccommodationAdmin = true;
      break;
      
    case 'Visa Clerk':
      // Specialist admin - only their specific area
      result.canViewVisaAdmin = true;
      break;
      
    case 'Finance Clerk':
      // Specialist admin - only their specific area
      result.canViewClaimsAdmin = true;
      break;
      
    case 'Transport Admin':
      // Specialist admin - only their specific area
      result.canViewTransportAdmin = true;
      break;
      
    case 'System Administrator':
    case 'Admin':
      // Full admin access to everything
      result.canViewAdminMenus = true;
      result.canViewApprovals = true;
      result.canViewReports = true;
      result.canViewUserManagement = true;
      result.canViewSystemSettings = true;
      result.canViewFlightsAdmin = true;
      result.canViewAccommodationAdmin = true;
      result.canViewVisaAdmin = true;
      result.canViewClaimsAdmin = true;
      result.canViewTransportAdmin = true;
      break;
  }

  return result;
}