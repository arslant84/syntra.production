import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserIdentifier, canViewAllData, canViewDomainData, canViewApprovalData } from '@/lib/api-protection';
import { shouldBypassUserFilter } from '@/lib/universal-user-matching';
import { sql } from '@/lib/db';

// DEBUG endpoint to help troubleshoot user filtering issues
export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  try {
    const userIdentifier = await getUserIdentifier(session);
    
    // Check user permissions that affect filtering
    const canViewAll = canViewAllData(session);
    const canViewTrf = canViewDomainData(session, 'trf');
    const canViewTransport = canViewApprovalData(session, 'transport');
    const canViewVisa = canViewApprovalData(session, 'visa');
    const canViewClaims = canViewApprovalData(session, 'claims');
    const canViewAccommodation = canViewApprovalData(session, 'accommodation');
    
    // Check if user filtering would be bypassed for different contexts
    const bypassPersonal = shouldBypassUserFilter(session, null); // Personal view (no status)
    const bypassApproval = shouldBypassUserFilter(session, 'Pending'); // Approval queue
    
    // Get user's actual roles and permissions from database
    let userRoles = [];
    let userPermissions = [];
    
    try {
      const rolesQuery = await sql`
        SELECT r.name as role_name, r.id as role_id
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ${session.id}
      `;
      userRoles = rolesQuery;
      
      const permissionsQuery = await sql`
        SELECT DISTINCT p.name as permission_name, p.id as permission_id
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = ${session.id}
      `;
      userPermissions = permissionsQuery;
    } catch (dbError) {
      console.log('Could not fetch user roles/permissions:', dbError.message);
    }
    
    // Get sample of user's requests from each table to verify ownership
    const transportRequests = await sql`
      SELECT id, requestor_name, staff_id, created_by, department, status
      FROM transport_requests 
      WHERE staff_id = ${userIdentifier.staffId} OR created_by = ${session.id} OR requestor_name ILIKE ${`%${session.name}%`}
      ORDER BY submitted_at DESC 
      LIMIT 5
    `;
    
    const trfRequests = await sql`
      SELECT id, requestor_name, staff_id, department, status, travel_type
      FROM travel_requests
      WHERE staff_id = ${userIdentifier.staffId} OR requestor_name ILIKE ${`%${session.name}%`}
      ORDER BY submitted_at DESC 
      LIMIT 5
    `;
    
    const debugInfo = {
      sessionData: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
        department: session.department,
        staffId: session.staffId
      },
      userIdentifier: {
        userId: userIdentifier.userId,
        staffId: userIdentifier.staffId,
        email: userIdentifier.email
      },
      permissions: {
        canViewAllData: canViewAll,
        canViewTrf: canViewTrf,
        canViewTransport: canViewTransport,
        canViewVisa: canViewVisa,
        canViewClaims: canViewClaims,
        canViewAccommodation: canViewAccommodation
      },
      filteringBehavior: {
        bypassPersonalView: bypassPersonal,
        bypassApprovalQueue: bypassApproval,
        reasoning: bypassPersonal 
          ? "PROBLEM: User filtering is bypassed for personal views - this is incorrect!"
          : "CORRECT: User filtering is applied for personal views"
      },
      databaseRolesAndPermissions: {
        roles: userRoles,
        permissions: userPermissions
      },
      sampleRequests: {
        transport: transportRequests.map(r => ({
          id: r.id,
          requestor_name: r.requestor_name,
          staff_id: r.staff_id,
          created_by: r.created_by,
          department: r.department,
          status: r.status,
          matches_user: r.staff_id === userIdentifier.staffId || 
                       r.created_by === session.id || 
                       r.requestor_name?.toLowerCase().includes(session.name?.toLowerCase() || '')
        })),
        trf: trfRequests.map(r => ({
          id: r.id,
          requestor_name: r.requestor_name,
          staff_id: r.staff_id,
          department: r.department,
          status: r.status,
          travel_type: r.travel_type,
          matches_user: r.staff_id === userIdentifier.staffId || 
                       r.requestor_name?.toLowerCase().includes(session.name?.toLowerCase() || '')
        }))
      },
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(debugInfo);
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Debug failed', details: error.message }, { status: 500 });
  }
});