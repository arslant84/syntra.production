'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, hasAnyPermission, hasRole, hasAnyRole } from '@/lib/client-permissions';

interface ProtectedComponentProps {
  permissions?: string[];
  roles?: string[];
  requireAll?: boolean; // If true, requires ALL permissions/roles, if false (default), requires ANY
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A component that conditionally renders children based on user permissions and roles
 */
export function ProtectedComponent({ 
  permissions = [], 
  roles = [], 
  requireAll = false,
  fallback = null, 
  children 
}: ProtectedComponentProps) {
  const { data: session } = useSession();
  
  if (!session?.user) {
    return <>{fallback}</>;
  }

  let hasRequiredPermissions = true;
  let hasRequiredRoles = true;

  // Check permissions
  if (permissions.length > 0) {
    if (requireAll) {
      // Check if user has ALL required permissions
      hasRequiredPermissions = permissions.every(permission => 
        hasPermission(session.user, permission)
      );
    } else {
      // Check if user has ANY of the required permissions
      hasRequiredPermissions = hasAnyPermission(session.user, permissions);
    }
  }

  // Check roles
  if (roles.length > 0) {
    if (requireAll) {
      // This would be unusual, but check if user has ALL roles (probably not needed)
      hasRequiredRoles = roles.every(role => hasRole(session.user, role));
    } else {
      // Check if user has ANY of the required roles
      hasRequiredRoles = hasAnyRole(session.user, roles);
    }
  }

  // Only render children if user has required permissions AND roles
  if (hasRequiredPermissions && hasRequiredRoles) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Specialized component for admin-only content
 */
export function AdminOnly({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  return (
    <ProtectedComponent 
      roles={['System Administrator', 'Admin']} 
      fallback={fallback}
    >
      {children}
    </ProtectedComponent>
  );
}

/**
 * Specialized component for approver-only content
 */
export function ApproverOnly({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  return (
    <ProtectedComponent 
      roles={['Department Focal', 'Line Manager', 'HOD', 'System Administrator', 'Admin']} 
      fallback={fallback}
    >
      {children}
    </ProtectedComponent>
  );
}

/**
 * Specialized component for requestor content (users who can create requests)
 */
export function RequestorOnly({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  return (
    <ProtectedComponent 
      permissions={['create_trf']} 
      fallback={fallback}
    >
      {children}
    </ProtectedComponent>
  );
}

/**
 * Specialized component for content that should be visible to users with reports access
 */
export function ReportsOnly({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  return (
    <ProtectedComponent 
      roles={['HOD', 'System Administrator', 'Admin', 'Requestor']} 
      fallback={fallback}
    >
      {children}
    </ProtectedComponent>
  );
}

/**
 * Component for role-specific admin menu items
 */
export function SpecificAdminOnly({ 
  adminType,
  children, 
  fallback = null 
}: { 
  adminType: 'flights' | 'accommodation' | 'visa' | 'claims' | 'transport';
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  const roleMapping = {
    flights: ['Ticketing Admin', 'System Administrator', 'Admin'],
    accommodation: ['Accomodation Admin', 'System Administrator', 'Admin'],
    visa: ['Visa Clerk', 'System Administrator', 'Admin'],
    claims: ['Finance Clerk', 'System Administrator', 'Admin'],
    transport: ['Transport Admin', 'System Administrator', 'Admin']
  };

  return (
    <ProtectedComponent 
      roles={roleMapping[adminType]} 
      fallback={fallback}
    >
      {children}
    </ProtectedComponent>
  );
}

/**
 * Higher-order component version for conditional rendering
 */
export function withRoleProtection<T extends object>(
  Component: React.ComponentType<T>,
  requiredRoles: string[],
  fallback?: React.ReactNode
) {
  return function ProtectedComponentWrapper(props: T) {
    return (
      <ProtectedComponent roles={requiredRoles} fallback={fallback}>
        <Component {...props} />
      </ProtectedComponent>
    );
  };
}

/**
 * Hook for checking permissions/roles in component logic
 */
export function usePermissions() {
  const { data: session } = useSession();
  
  return {
    hasPermission: (permission: string) => hasPermission(session?.user || null, permission),
    hasAnyPermission: (permissions: string[]) => hasAnyPermission(session?.user || null, permissions),
    hasRole: (role: string) => hasRole(session?.user || null, role),
    hasAnyRole: (roles: string[]) => hasAnyRole(session?.user || null, roles),
    isAdmin: hasAnyRole(session?.user || null, ['System Administrator', 'Admin']),
    isApprover: hasAnyRole(session?.user || null, ['Department Focal', 'Line Manager', 'HOD', 'System Administrator', 'Admin']),
    canViewReports: hasAnyRole(session?.user || null, ['HOD', 'System Administrator', 'Admin', 'Requestor']),
    session: session?.user || null
  };
}