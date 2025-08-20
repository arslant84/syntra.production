// Test endpoint to manually create a notification for focal users
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can create test notifications
    if (!await hasPermission('manage_users')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { testType = 'approval' } = body;

    let notificationsCreated = 0;
    const results = [];

    // Find all users with focal permission
    const focalUsers = await sql`
      SELECT u.id, u.name, u.email, u.department
      FROM users u
      INNER JOIN role_permissions rp ON u.role_id = rp.role_id
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE p.name = 'approve_trf_focal'
        AND u.status = 'Active'
      ORDER BY u.department, u.name
    `;

    if (focalUsers.length === 0) {
      return NextResponse.json({ 
        error: 'No users found with approve_trf_focal permission',
        focalUsers: []
      });
    }

    for (const user of focalUsers) {
      try {
        let notificationId;
        
        if (testType === 'approval') {
          notificationId = await NotificationService.createApprovalRequest({
            approverId: user.id,
            requestorName: 'Test User',
            entityType: 'trf',
            entityId: 'TEST-001',
            entityTitle: 'Test Travel Request'
          });
        } else {
          notificationId = await NotificationService.createNotification({
            userId: user.id,
            title: 'Test Notification',
            message: 'This is a test notification to verify the system is working.',
            type: 'system',
            category: 'system_alert',
            priority: 'normal'
          });
        }

        results.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          department: user.department,
          notificationId,
          success: true
        });
        notificationsCreated++;

      } catch (error) {
        results.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          department: user.department,
          error: error.message,
          success: false
        });
      }
    }

    return NextResponse.json({
      message: `Created ${notificationsCreated} test notifications`,
      testType,
      notificationsCreated,
      totalFocalUsers: focalUsers.length,
      results
    });

  } catch (error) {
    console.error('Error creating test notifications:', error);
    return NextResponse.json({ error: 'Failed to create test notifications', details: error.message }, { status: 500 });
  }
}