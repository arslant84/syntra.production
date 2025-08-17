// Client-side Role-Based Access Control Utilities
// For use in React components ("use client")

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
  ROLES.SYSTEM_ADMINISTRATOR
];

/**
 * Get the appropriate approval queue items for a user's role (client-side)
 */
export function getApprovalQueueFilters(userRole: string | null): {
  roleSpecificStatuses: string[];
  canApprove: boolean;
  roleContext: string;
} {
  if (!userRole) {
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
    roleSpecificStatuses: statusFilters[userRole] || [],
    canApprove: APPROVAL_ROLES.includes(userRole as any),
    roleContext: userRole
  };
}

/**
 * Check if user can see all requests or only their own (client-side)
 */
export function canViewAllRequests(userRole: string | null): boolean {
  return userRole ? ADMIN_ROLES.includes(userRole as any) : false;
}

/**
 * Check if user has approval rights (client-side)
 */
export function hasApprovalRights(userRole: string | null): boolean {
  return userRole ? APPROVAL_ROLES.includes(userRole as any) : false;
}

/**
 * Filter requests based on user role - determines what data user should see
 * This is for filtering request lists based on role permissions
 */
export function shouldShowRequest(userRole: string | null, request: any, userId: string | null): boolean {
  if (!userRole || !userId) return false;
  
  // Admins can see everything
  if (ADMIN_ROLES.includes(userRole as any)) {
    return true;
  }
  
  // Specialist admins can see all requests in their domain
  const specialistDomains: Record<string, string[]> = {
    [ROLES.FINANCE_CLERK]: ['claim', 'claims', 'expense'],
    [ROLES.VISA_CLERK]: ['visa'],
    [ROLES.TICKETING_ADMIN]: ['flight', 'flights', 'trf'],
    [ROLES.ACCOMMODATION_ADMIN]: ['accommodation', 'booking'],
    [ROLES.TRANSPORT_ADMIN]: ['transport']
  };
  
  const userDomains = specialistDomains[userRole];
  if (userDomains) {
    const requestType = request.type || request.itemType || '';
    return userDomains.some(domain => requestType.toLowerCase().includes(domain));
  }
  
  // Approvers can see requests pending their approval + their own requests
  if (APPROVAL_ROLES.includes(userRole as any)) {
    const { roleSpecificStatuses } = getApprovalQueueFilters(userRole);
    const isPendingTheirApproval = roleSpecificStatuses.includes(request.status);
    const isTheirOwnRequest = request.requestorId === userId || request.userId === userId;
    
    return isPendingTheirApproval || isTheirOwnRequest;
  }
  
  // Regular users can only see their own requests
  return request.requestorId === userId || request.userId === userId;
}