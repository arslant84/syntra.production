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
  // System Administrator, Admin, and Ticketing Admin can see all data
  // Ticketing Admin needs to see all pending flights for processing
  const adminRoles = ['System Administrator', 'Admin', 'Ticketing Admin'];
  return adminRoles.includes(session.role);
}

/**
 * Check if user can view all requests in their domain (for specialist admins)
 * Now uses database permissions instead of hardcoded role checks
 */
export function canViewDomainData(session: any, domain: string): boolean {
  if (!session) return false;
  
  switch (domain) {
    case 'trf':
      return hasPermission(session, 'view_all_trf');
    case 'claims':
      return hasPermission(session, 'view_all_claims');
    case 'visa':
      return hasPermission(session, 'process_visa_applications');
    case 'transport':
      return hasAnyPermission(session, ['view_all_transport', 'manage_transport_requests']);
    case 'accommodation':
      return hasPermission(session, 'manage_accommodation_bookings');
    default:
      return canViewAllData(session);
  }
}

/**
 * Check if user can view requests pending their approval (for approval roles like HOD)
 * Now uses database permissions instead of hardcoded role checks
 */
export function canViewApprovalData(session: any, domain: string): boolean {
  if (!session) return false;
  
  switch (domain) {
    case 'trf':
      return hasAnyPermission(session, ['approve_trf_focal', 'approve_trf_manager', 'approve_trf_hod']);
    case 'accommodation':
      return hasAnyPermission(session, ['approve_accommodation_requests', 'approve_trf_focal', 'approve_trf_manager', 'approve_trf_hod', 'manage_accommodation_bookings']);
    case 'transport':
      return hasAnyPermission(session, ['approve_transport_requests', 'approve_trf_focal', 'approve_trf_manager', 'approve_trf_hod']);
    case 'claims':
      return hasAnyPermission(session, ['approve_claims_focal', 'approve_claims_manager', 'approve_claims_hod', 'process_claims']);
    case 'visa':
      return hasAnyPermission(session, ['process_visa_applications', 'approve_visa_requests', 'approve_trf_focal', 'approve_trf_manager', 'approve_trf_hod']);
    default:
      return false;
  }
}

/**
 * Get user identifier for filtering user-specific data
 */
export async function getUserIdentifier(session: any): Promise<{
  userId: string;
  staffId?: string;
  email: string;
}> {
  let staffId = session.staffId;
  
  // If staffId is not in session, get it from database
  if (!staffId && session.id) {
    try {
      const { sql } = await import('./db');
      const userResult = await sql`
        SELECT staff_id FROM users WHERE id = ${session.id} LIMIT 1
      `;
      if (userResult.length > 0) {
        staffId = userResult[0].staff_id;
      }
    } catch (error) {
      console.error('Error fetching staffId from database:', error);
    }
  }
  
  return {
    userId: session.id,
    staffId,
    email: session.email
  };
}