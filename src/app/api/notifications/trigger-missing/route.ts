// API endpoint to trigger missing notifications for existing pending requests
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

    // Only admins can trigger missing notifications
    if (!await hasPermission('manage_users')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    let notificationsCreated = 0;

    // Find pending requests waiting for focal approval without notifications
    const pendingFocalRequests = await sql`
      SELECT 
        'trf' as entity_type,
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.department
      FROM travel_requests tr
      WHERE tr.status = 'Pending Department Focal'
        AND NOT EXISTS (
          SELECT 1 FROM user_notifications un 
          WHERE un.related_entity_id = tr.id 
            AND un.related_entity_type = 'trf'
            AND un.type = 'approval_request'
        )
      
      UNION ALL
      
      SELECT 
        'claim' as entity_type,
        ec.id,
        ec.staff_name as requestor_name,
        ec.status,
        ec.department_code as department
      FROM expense_claims ec
      WHERE ec.status = 'Pending Department Focal'
        AND NOT EXISTS (
          SELECT 1 FROM user_notifications un 
          WHERE un.related_entity_id = ec.id 
            AND un.related_entity_type = 'claim'
            AND un.type = 'approval_request'
        )
      
      UNION ALL
      
      SELECT 
        'visa' as entity_type,
        va.id,
        va.requestor_name,
        va.status,
        COALESCE(u.department, 'Unknown') as department
      FROM visa_applications va
      LEFT JOIN users u ON va.staff_id = u.staff_id
      WHERE va.status = 'Pending Department Focal'
        AND NOT EXISTS (
          SELECT 1 FROM user_notifications un 
          WHERE un.related_entity_id = va.id 
            AND un.related_entity_type = 'visa'
            AND un.type = 'approval_request'
        )
    `;

    // Create notifications for focal users
    for (const request of pendingFocalRequests) {
      // Find Department Focals in the same department
      const focalUsers = await sql`
        SELECT u.id, u.name 
        FROM users u
        INNER JOIN role_permissions rp ON u.role_id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = 'approve_trf_focal'
          AND u.department = ${request.department || 'Unknown'}
          AND u.status = 'Active'
      `;

      for (const focal of focalUsers) {
        await NotificationService.createApprovalRequest({
          approverId: focal.id,
          requestorName: request.requestor_name,
          entityType: request.entity_type as any,
          entityId: request.id,
          entityTitle: `${request.entity_type.toUpperCase()} Request`
        });
        notificationsCreated++;
      }
    }

    // Find pending expense claims without notifications
    const pendingClaims = await sql`
      SELECT 
        ec.id,
        ec.staff_name,
        ec.status,
        ec.department_code
      FROM expense_claims ec
      WHERE ec.status = 'Pending HOD Approval'
        AND NOT EXISTS (
          SELECT 1 FROM user_notifications un 
          WHERE un.related_entity_id = ec.id 
            AND un.related_entity_type = 'claim'
            AND un.type = 'approval_request'
        )
    `;

    // Create notifications for HODs
    for (const claim of pendingClaims) {
      // Find all HODs (department-agnostic)
      const hodUsers = await sql`
        SELECT u.id, u.name 
        FROM users u
        INNER JOIN role_permissions rp ON u.role_id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = 'approve_claims_hod'
          AND u.status = 'Active'
      `;

      for (const hod of hodUsers) {
        await NotificationService.createApprovalRequest({
          approverId: hod.id,
          requestorName: claim.staff_name,
          entityType: 'claim',
          entityId: claim.id,
          entityTitle: `Expense Claim`
        });
        notificationsCreated++;
      }
    }

    // Find pending TRFs without notifications  
    const pendingTrfs = await sql`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.department
      FROM travel_requests tr
      WHERE tr.status = 'Pending HOD'
        AND NOT EXISTS (
          SELECT 1 FROM user_notifications un 
          WHERE un.related_entity_id = tr.id 
            AND un.related_entity_type = 'trf'
            AND un.type = 'approval_request'
        )
    `;

    // Create notifications for HODs for pending TRFs
    for (const trf of pendingTrfs) {
      // Find all HODs (department-agnostic)
      const hodUsers = await sql`
        SELECT u.id, u.name 
        FROM users u
        INNER JOIN role_permissions rp ON u.role_id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = 'approve_trf_hod'
          AND u.status = 'Active'
      `;

      for (const hod of hodUsers) {
        await NotificationService.createApprovalRequest({
          approverId: hod.id,
          requestorName: trf.requestor_name,
          entityType: 'trf',
          entityId: trf.id,
          entityTitle: `Travel Request`
        });
        notificationsCreated++;
      }
    }

    return NextResponse.json({ 
      message: `Successfully created ${notificationsCreated} missing notifications`,
      notificationsCreated
    });

  } catch (error) {
    console.error('Error triggering missing notifications:', error);
    return NextResponse.json({ error: 'Failed to trigger missing notifications' }, { status: 500 });
  }
}