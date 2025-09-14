// Role-Based Access Control Utilities
// Implements the comprehensive RBAC requirements for the SynTra system

import { getServerSession } from "./auth";
import { hasPermission, getCurrentUserId, getCurrentUserRole } from "./permissions";

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  permissions: string[];
}

// Role definitions based on requirements
export const ROLES = {
  ACCOMMODATION_ADMIN: 'Accommodation Admin',
  TICKETING_ADMIN: 'Ticketing Admin', 
  TRANSPORT_ADMIN: 'Transport Admin',
  VISA_CLERK: 'Visa Clerk',
  FINANCE_CLERK: 'Finance Clerk',
  DEPARTMENT_FOCAL: 'Department Focal',
  LINE_MANAGER: 'Line Manager',
  HOD: 'HOD',
  REQUESTOR: 'Requestor',
  ADMIN: 'Admin',
  SYSTEM_ADMINISTRATOR: 'System Administrator'
} as const;

// Define which roles have approval rights
export const APPROVAL_ROLES = [
  ROLES.DEPARTMENT_FOCAL,
  ROLES.LINE_MANAGER, 
  ROLES.HOD,
  ROLES.FINANCE_CLERK,
  ROLES.ADMIN,
  ROLES.SYSTEM_ADMINISTRATOR
];

// Define which roles can see all requests (not just their own)
export const ADMIN_ROLES = [
  ROLES.ADMIN,
  ROLES.SYSTEM_ADMINISTRATOR,
  ROLES.TICKETING_ADMIN  // Ticketing Admin needs to see all pending flights for processing
];

// Define role-specific sidebar access based on requirements
export const ROLE_SIDEBAR_ACCESS = {
  [ROLES.ACCOMMODATION_ADMIN]: ['Accommodation Admin'],
  [ROLES.TICKETING_ADMIN]: ['Flights admin'],
  [ROLES.TRANSPORT_ADMIN]: ['Transport admin'], 
  [ROLES.VISA_CLERK]: ['Visa admin'],
  [ROLES.FINANCE_CLERK]: ['Claims admin'],
  [ROLES.DEPARTMENT_FOCAL]: ['Approvals menu'],
  [ROLES.LINE_MANAGER]: ['Approvals menu'],
  [ROLES.HOD]: ['Approvals menu'],
  [ROLES.REQUESTOR]: [],
  [ROLES.ADMIN]: ['All menus'],
  [ROLES.SYSTEM_ADMINISTRATOR]: ['All menus']
};

/**
 * Check if user can see all requests or only their own
 */
export async function canViewAllRequests(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role ? ADMIN_ROLES.includes(role as any) : false;
}

/**
 * Check if user has approval rights
 */
export async function hasApprovalRights(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role ? APPROVAL_ROLES.includes(role as any) : false;
}

/**
 * Get the appropriate approval queue items for a user's role
 */
export async function getApprovalQueueFilters(): Promise<{
  roleSpecificStatuses: string[];
  canApprove: boolean;
  roleContext: string;
}> {
  const role = await getCurrentUserRole();
  
  if (!role) {
    return { roleSpecificStatuses: [], canApprove: false, roleContext: '' };
  }

  // Define what statuses each role should see in their approval queue
  const statusFilters: Record<string, string[]> = {
    [ROLES.DEPARTMENT_FOCAL]: [
      'Pending Department Focal',
      'Pending Focal Approval'
    ],
    [ROLES.LINE_MANAGER]: [
      'Pending Line Manager',
      'Pending Line Manager/HOD',
      'Pending Line Approval'
    ],
    [ROLES.HOD]: [
      'Pending HOD',
      'Pending HOD Approval',
      'Pending Line Manager/HOD'
    ],
    [ROLES.FINANCE_CLERK]: [
      'Pending Finance Approval'
    ],
    [ROLES.VISA_CLERK]: [
      'Pending Visa Clerk'
    ],
    [ROLES.TICKETING_ADMIN]: [
      'Approved',  // Ticketing Admin processes all approved TRFs for flight booking
      'Flights Booked'  // Can also view completed flight bookings
    ],
    [ROLES.ADMIN]: [
      'Pending Department Focal',
      'Pending Focal Approval',
      'Pending Line Manager',
      'Pending Line Approval', 
      'Pending Line Manager/HOD',
      'Pending HOD',
      'Pending HOD Approval',
      'Pending Finance Approval',
      'Pending Visa Clerk',
      'Pending Verification'
    ],
    [ROLES.SYSTEM_ADMINISTRATOR]: [
      'Pending Department Focal',
      'Pending Focal Approval',
      'Pending Line Manager',
      'Pending Line Approval',
      'Pending Line Manager/HOD', 
      'Pending HOD',
      'Pending HOD Approval',
      'Pending Finance Approval',
      'Pending Visa Clerk',
      'Pending Verification'
    ]
  };

  return {
    roleSpecificStatuses: statusFilters[role] || [],
    canApprove: APPROVAL_ROLES.includes(role as any),
    roleContext: role
  };
}

/**
 * Filter requests based on user's role and visibility permissions
 */
export async function filterRequestsByUserRole<T extends { 
  requestorId?: string;
  userId?: string; 
  staff_id?: string;
  staff_no?: string;
}>(requests: T[]): Promise<T[]> {
  const canViewAll = await canViewAllRequests();
  
  if (canViewAll) {
    return requests; // Admin roles see everything
  }

  // Regular users see only their own requests
  const currentUserId = await getCurrentUserId();
  const session = await getServerSession();
  
  if (!currentUserId || !session?.user) {
    return [];
  }

  // Filter to show only user's own requests
  return requests.filter(request => {
    // Try different fields that might contain user identifier
    return request.requestorId === currentUserId ||
           request.userId === currentUserId ||
           request.staff_id === session.user?.id ||
           request.staff_no === session.user?.staffId ||
           request.staff_id === session.user?.email; // Fallback for email-based matching
  });
}

/**
 * Get navigation menu items based on user role
 */
export async function getRoleBasedNavigation(): Promise<{
  topNavbar: string[];
  leftSidebar: string[];
  hasReports: boolean;
}> {
  const role = await getCurrentUserRole();
  
  if (!role) {
    return { topNavbar: [], leftSidebar: [], hasReports: false };
  }

  // All roles have access to basic request types in top navbar
  const baseNavItems = ['TSR', 'Transport', 'Visa', 'Accomodation', 'Claims'];
  
  // Determine additional access
  const hasReports = [ROLES.HOD, ROLES.REQUESTOR, ROLES.ADMIN, ROLES.SYSTEM_ADMINISTRATOR].includes(role as any);
  const topNavbar = hasReports ? [...baseNavItems, 'Reports'] : baseNavItems;
  
  // Get role-specific sidebar access
  const leftSidebar = ROLE_SIDEBAR_ACCESS[role as keyof typeof ROLE_SIDEBAR_ACCESS] || [];

  return {
    topNavbar,
    leftSidebar: leftSidebar,
    hasReports
  };
}

/**
 * Check if user should receive notifications for a specific entity
 */
export async function shouldReceiveNotification(
  entityType: string,
  entityId: string,
  notificationType: 'own_request' | 'approval_needed' | 'system_activity',
  entityOwnerId?: string
): Promise<boolean> {
  const role = await getCurrentUserRole();
  const currentUserId = await getCurrentUserId();
  
  if (!role || !currentUserId) {
    return false;
  }

  // Admin roles get all notifications
  if (ADMIN_ROLES.includes(role as any)) {
    return true;
  }

  switch (notificationType) {
    case 'own_request':
      // All roles get notifications for their own requests
      return entityOwnerId === currentUserId;

    case 'approval_needed':
      // Only roles with approval rights get approval notifications
      if (!APPROVAL_ROLES.includes(role as any)) {
        return false;
      }
      
      // Additional logic could check if this specific entity needs this role's approval
      return true;

    case 'system_activity':
      // Only admin roles get system activity notifications
      return ADMIN_ROLES.includes(role as any);

    default:
      return false;
  }
}

/**
 * Get user's department for department-specific filtering
 */
export async function getCurrentUserDepartment(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.department || null;
}

/**
 * Check if user can perform specific actions based on role
 */
export async function canPerformAction(action: string, entityType: string): Promise<boolean> {
  const role = await getCurrentUserRole();
  
  if (!role) {
    return false;
  }

  // Admin roles can perform all actions
  if (ADMIN_ROLES.includes(role as any)) {
    return true;
  }

  // Define role-specific action permissions
  const actionPermissions: Record<string, Record<string, boolean>> = {
    [ROLES.FINANCE_CLERK]: {
      'process_claims': true,
      'approve_claims_finance': true
    },
    [ROLES.DEPARTMENT_FOCAL]: {
      'approve_tsr': true,
      'approve_claims': true,
      'approve_visa': true,
      'approve_transport': true,
      'approve_accommodation': true
    },
    [ROLES.LINE_MANAGER]: {
      'approve_tsr': true,
      'approve_claims': true,
      'approve_visa': true,
      'approve_transport': true,
      'approve_accommodation': true
    },
    [ROLES.HOD]: {
      'approve_tsr': true,
      'approve_claims_hod': true,
      'approve_visa': true,
      'approve_transport': true,
      'approve_accommodation': true
    },
    [ROLES.VISA_CLERK]: {
      'process_visa': true
    }
  };

  return actionPermissions[role]?.[action] || false;
}