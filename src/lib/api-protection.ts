import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserSession, hasPermission, hasAnyPermission } from './session-utils';

/**
 * Higher-order function to protect API routes with authentication
 */
export function withAuth(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      const session = await getCurrentUserSession();
      if (!session) {
        return NextResponse.json({ 
          error: 'Unauthorized', 
          message: 'Authentication required' 
        }, { status: 401 });
      }
      
      // Add session to request for handler use
      (request as any).user = session;
      return await handler(request, ...args);
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json({ 
        error: 'Authentication failed', 
        message: 'Invalid session' 
      }, { status: 401 });
    }
  };
}

/**
 * Higher-order function to protect API routes with specific permission requirement
 */
export function withPermission(permission: string) {
  return function(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      try {
        const session = await getCurrentUserSession();
        if (!session) {
          return NextResponse.json({ 
            error: 'Unauthorized', 
            message: 'Authentication required' 
          }, { status: 401 });
        }
        
        if (!hasPermission(session, permission)) {
          return NextResponse.json({ 
            error: 'Forbidden', 
            message: `Permission required: ${permission}` 
          }, { status: 403 });
        }
        
        (request as any).user = session;
        return await handler(request, ...args);
      } catch (error) {
        console.error('Authorization error:', error);
        return NextResponse.json({ 
          error: 'Authorization failed', 
          message: 'Permission check failed' 
        }, { status: 403 });
      }
    };
  };
}

/**
 * Higher-order function to protect API routes with any of the specified permissions
 */
export function withAnyPermission(permissions: string[]) {
  return function(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      try {
        const session = await getCurrentUserSession();
        if (!session) {
          return NextResponse.json({ 
            error: 'Unauthorized', 
            message: 'Authentication required' 
          }, { status: 401 });
        }
        
        if (!hasAnyPermission(session, permissions)) {
          return NextResponse.json({ 
            error: 'Forbidden', 
            message: `One of these permissions required: ${permissions.join(', ')}` 
          }, { status: 403 });
        }
        
        (request as any).user = session;
        return await handler(request, ...args);
      } catch (error) {
        console.error('Authorization error:', error);
        return NextResponse.json({ 
          error: 'Authorization failed', 
          message: 'Permission check failed' 
        }, { status: 403 });
      }
    };
  };
}

/**
 * Higher-order function to protect API routes with role requirement
 */
export function withRole(allowedRoles: string[]) {
  return function(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      try {
        const session = await getCurrentUserSession();
        if (!session) {
          return NextResponse.json({ 
            error: 'Unauthorized', 
            message: 'Authentication required' 
          }, { status: 401 });
        }
        
        if (!allowedRoles.includes(session.role)) {
          return NextResponse.json({ 
            error: 'Forbidden', 
            message: `Role required: one of [${allowedRoles.join(', ')}]` 
          }, { status: 403 });
        }
        
        (request as any).user = session;
        return await handler(request, ...args);
      } catch (error) {
        console.error('Authorization error:', error);
        return NextResponse.json({ 
          error: 'Authorization failed', 
          message: 'Role check failed' 
        }, { status: 403 });
      }
    };
  };
}

/**
 * Check if user can view all data or only their own based on role
 * Based on role matrix from USER_MANAGEMENT_RBAC_ANALYSIS.md
 */
export function canViewAllData(session: any): boolean {
  // Only System Administrator and Admin can see all data
  // HOD might see department-wide data but not all data
  const adminRoles = ['System Administrator', 'Admin'];
  return adminRoles.includes(session.role);
}

/**
 * Check if user can view all requests in their domain (for specialist admins)
 */
export function canViewDomainData(session: any, domain: string): boolean {
  const role = session.role;
  
  switch (domain) {
    case 'trf':
      return ['System Administrator', 'Admin', 'HOD'].includes(role);
    case 'claims':
      return ['System Administrator', 'Admin', 'Finance Clerk', 'HOD'].includes(role);
    case 'visa':
      return ['System Administrator', 'Admin', 'Visa Clerk'].includes(role);
    case 'transport':
      return ['System Administrator', 'Admin', 'Transport Admin'].includes(role);
    case 'accommodation':
      return ['System Administrator', 'Admin', 'Accomodation Admin'].includes(role);
    default:
      return canViewAllData(session);
  }
}

/**
 * Get user identifier for filtering user-specific data
 */
export function getUserIdentifier(session: any): {
  userId: string;
  staffId?: string;
  email: string;
} {
  return {
    userId: session.id,
    staffId: session.staffId,
    email: session.email
  };
}