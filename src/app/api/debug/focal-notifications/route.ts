// Debug endpoint to check focal notification setup
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can access debug info
    if (!await hasPermission('manage_users')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const debugInfo: any = {};

    // 1. Check if there are users with Department Focal role
    const focalUsers = await sql`
      SELECT u.id, u.name, u.email, u.role, u.department, u.status
      FROM users u
      WHERE u.role = 'Department Focal' OR u.role LIKE '%Focal%'
      ORDER BY u.department, u.name
    `;
    debugInfo.focalUsers = focalUsers;

    // 2. Check if focal users have the approve_trf_focal permission
    const usersWithFocalPermission = await sql`
      SELECT u.id, u.name, u.email, u.role, u.department, p.name as permission
      FROM users u
      INNER JOIN role_permissions rp ON u.role_id = rp.role_id
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE p.name = 'approve_trf_focal'
        AND u.status = 'Active'
      ORDER BY u.department, u.name
    `;
    debugInfo.usersWithFocalPermission = usersWithFocalPermission;

    // 3. Check pending requests with 'Pending Department Focal' status
    const pendingFocalRequests = await sql`
      SELECT 
        'trf' as type,
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.department,
        tr.submitted_at
      FROM travel_requests tr
      WHERE tr.status = 'Pending Department Focal'
      
      UNION ALL
      
      SELECT 
        'claim' as type,
        ec.id,
        ec.staff_name as requestor_name,
        ec.status,
        ec.department_code as department,
        ec.submitted_at
      FROM expense_claims ec
      WHERE ec.status = 'Pending Department Focal'
      
      UNION ALL
      
      SELECT 
        'visa' as type,
        va.id,
        va.requestor_name,
        va.status,
        COALESCE(u.department, 'Unknown') as department,
        va.submitted_date as submitted_at
      FROM visa_applications va
      LEFT JOIN users u ON va.staff_id = u.staff_id
      WHERE va.status = 'Pending Department Focal'
      
      ORDER BY submitted_at DESC
    `;
    debugInfo.pendingFocalRequests = pendingFocalRequests;

    // 4. Check existing notifications for focal users
    const focalNotifications = await sql`
      SELECT 
        un.id,
        un.user_id,
        u.name as user_name,
        u.email as user_email,
        un.title,
        un.message,
        un.type,
        un.category,
        un.related_entity_type,
        un.related_entity_id,
        un.is_read,
        un.created_at
      FROM user_notifications un
      INNER JOIN users u ON un.user_id = u.id
      WHERE u.role = 'Department Focal' OR u.role LIKE '%Focal%'
      ORDER BY un.created_at DESC
      LIMIT 20
    `;
    debugInfo.focalNotifications = focalNotifications;

    // 5. Check notification counts for focal users
    const focalNotificationCounts = await sql`
      SELECT 
        u.id as user_id,
        u.name,
        u.email,
        u.department,
        COUNT(*) as total_notifications,
        COUNT(*) FILTER (WHERE un.is_read = FALSE) as unread_notifications,
        COUNT(*) FILTER (WHERE un.category = 'workflow_approval' AND un.is_read = FALSE) as approval_requests
      FROM users u
      LEFT JOIN user_notifications un ON u.id = un.user_id 
        AND un.is_dismissed = FALSE 
        AND (un.expires_at IS NULL OR un.expires_at > NOW())
      WHERE u.role = 'Department Focal' OR u.role LIKE '%Focal%'
      GROUP BY u.id, u.name, u.email, u.department
      ORDER BY u.department, u.name
    `;
    debugInfo.focalNotificationCounts = focalNotificationCounts;

    // 6. Check if permissions table has approve_trf_focal
    const focalPermission = await sql`
      SELECT id, name, description FROM permissions WHERE name = 'approve_trf_focal'
    `;
    debugInfo.focalPermissionExists = focalPermission;

    // 7. Check role permissions for Department Focal role
    const departmentFocalRolePermissions = await sql`
      SELECT 
        r.id as role_id,
        r.name as role_name,
        p.name as permission_name,
        p.description as permission_description
      FROM roles r
      INNER JOIN role_permissions rp ON r.id = rp.role_id
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = 'Department Focal'
      ORDER BY p.name
    `;
    debugInfo.departmentFocalRolePermissions = departmentFocalRolePermissions;

    return NextResponse.json(debugInfo);

  } catch (error) {
    console.error('Error in focal notifications debug:', error);
    return NextResponse.json({ error: 'Failed to fetch debug info', details: error.message }, { status: 500 });
  }
}