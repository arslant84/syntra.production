// Debug endpoint to check current user's notifications
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NotificationService } from '@/lib/notification-service';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const debugInfo: any = {};

    // Current user info
    debugInfo.currentUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role
    };

    // Get user's permissions
    try {
      const userPermissions = await sql`
        SELECT p.name
        FROM users u
        INNER JOIN role_permissions rp ON u.role_id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = ${session.user.id}
        ORDER BY p.name
      `;
      debugInfo.userPermissions = userPermissions.map(p => p.name);
    } catch (error) {
      debugInfo.userPermissions = { error: error.message };
    }

    // Get notification counts using the service
    try {
      const counts = await NotificationService.getNotificationCounts(session.user.id);
      debugInfo.notificationCounts = counts;
    } catch (error) {
      debugInfo.notificationCounts = { error: error.message };
    }

    // Get notifications using the service
    try {
      const notifications = await NotificationService.getUserNotifications(session.user.id, { limit: 10 });
      debugInfo.notifications = notifications;
    } catch (error) {
      debugInfo.notifications = { error: error.message };
    }

    // Get all notifications for this user directly from database
    try {
      const allNotifications = await sql`
        SELECT *
        FROM user_notifications
        WHERE user_id = ${session.user.id}
        ORDER BY created_at DESC
      `;
      debugInfo.allNotificationsFromDB = allNotifications;
    } catch (error) {
      debugInfo.allNotificationsFromDB = { error: error.message };
    }

    // Check if user should have approval notifications
    try {
      const approvalRequests = await sql`
        SELECT 
          'trf' as type,
          tr.id,
          tr.requestor_name,
          tr.status,
          tr.department
        FROM travel_requests tr
        WHERE tr.status = 'Pending Department Focal' 
          AND tr.department = (SELECT department FROM users WHERE id = ${session.user.id})
        
        UNION ALL
        
        SELECT 
          'claim' as type,
          ec.id,
          ec.staff_name as requestor_name,
          ec.status,
          ec.department_code as department
        FROM expense_claims ec
        WHERE ec.status = 'Pending Department Focal'
          AND ec.department_code = (SELECT department FROM users WHERE id = ${session.user.id})
        
        UNION ALL
        
        SELECT 
          'visa' as type,
          va.id,
          va.requestor_name,
          va.status,
          COALESCE(u.department, 'Unknown') as department
        FROM visa_applications va
        LEFT JOIN users u ON va.staff_id = u.staff_id
        WHERE va.status = 'Pending Department Focal'
          AND COALESCE(u.department, 'Unknown') = (SELECT department FROM users WHERE id = ${session.user.id})
      `;
      debugInfo.pendingApprovalsInUserDepartment = approvalRequests;
    } catch (error) {
      debugInfo.pendingApprovalsInUserDepartment = { error: error.message };
    }

    return NextResponse.json(debugInfo);

  } catch (error) {
    console.error('Error in my notifications debug:', error);
    return NextResponse.json({ error: 'Failed to fetch user notification debug info', details: error.message }, { status: 500 });
  }
}