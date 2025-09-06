import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { TransportService } from '@/lib/transport-service';
import { hasPermission } from '@/lib/permissions';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';

interface RouteParams {
  params: Promise<{
    transportId: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage transport requests (for approvals/actions)
    if (!await hasPermission('manage_transport_requests') && !await hasPermission('approve_transport_requests')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const { transportId } = await params;
    const body = await request.json();
    
    const { action, approverRole, approverName, comments } = body;
    
    // Validate required fields
    if (!action || !approverRole || !approverName) {
      return NextResponse.json(
        { error: 'Missing required fields: action, approverRole, approverName' },
        { status: 400 }
      );
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }
    
    // Process the approval action
    const updatedTransportRequest = await TransportService.processApprovalAction(
      transportId,
      action,
      approverRole,
      approverName,
      comments
    );
    
    // Create notifications using enhanced workflow notification system
    try {
      // Get the transport request details including requestor information
      // Try multiple ways to find the actual requestor's email
      const transportDetails = await sql`
        SELECT 
          tr.created_by, 
          tr.requestor_name, 
          tr.department, 
          tr.purpose,
          tr.staff_id,
          tr.email as direct_email,
          u.email as created_by_email,
          u2.email as staff_match_email,
          u3.email as name_match_email,
          COALESCE(tr.email, u.email, u2.email, u3.email) as email,
          COALESCE(tr.created_by, u.id, u2.id, u3.id) as user_id
        FROM transport_requests tr
        LEFT JOIN users u ON tr.created_by = u.id
        LEFT JOIN users u2 ON tr.staff_id IS NOT NULL AND tr.staff_id = u2.staff_id
        LEFT JOIN users u3 ON tr.requestor_name IS NOT NULL AND LOWER(tr.requestor_name) = LOWER(u3.name)
        WHERE tr.id = ${transportId}
      `;

      if (transportDetails.length > 0) {
        const transportInfo = transportDetails[0];
        
        // Debug requestor email resolution
        console.log(`🔍 TRANSPORT_EMAIL_DEBUG: Transport ${transportId}`);
        console.log(`   📧 Direct email: ${transportInfo.direct_email}`);
        console.log(`   📧 Created-by email: ${transportInfo.created_by_email}`);
        console.log(`   📧 Staff match email: ${transportInfo.staff_match_email}`);
        console.log(`   📧 Name match email: ${transportInfo.name_match_email}`);
        console.log(`   📧 Final resolved email: ${transportInfo.email}`);
        console.log(`   👤 Requestor name: ${transportInfo.requestor_name}`);
        console.log(`   🆔 Staff ID: ${transportInfo.staff_id}`);
        console.log(`   🆔 User ID: ${transportInfo.user_id}`);
        
        // Send enhanced workflow notification for status change
        // Send 5-stage workflow notification
        if (action === 'approve') {
          await UnifiedNotificationService.notifyApproval({
            entityType: 'transport',
            entityId: transportId,
            requestorId: transportInfo.user_id,
            requestorName: transportInfo.requestor_name || 'User',
            requestorEmail: transportInfo.email,
            department: transportInfo.department,
            currentStatus: updatedTransportRequest.status,
            previousStatus: 'Pending Approval',
            approverName: approverName,
            approverRole: approverRole,
            entityTitle: `Transport Request - ${transportInfo.purpose || 'Transport Service'}`,
            transportPurpose: transportInfo.purpose || 'Not specified',
            comments: comments
          });
        } else if (action === 'reject') {
          await UnifiedNotificationService.notifyRejection({
            entityType: 'transport',
            entityId: transportId,
            requestorId: transportInfo.user_id,
            requestorName: transportInfo.requestor_name || 'User',
            requestorEmail: transportInfo.email,
            department: transportInfo.department,
            approverName: approverName,
            approverRole: approverRole,
            rejectionReason: comments || 'No reason provided',
            entityTitle: `Transport Request - ${transportInfo.purpose || 'Transport Service'}`,
            transportPurpose: transportInfo.purpose || 'Not specified'
          });
        }

        console.log(`✅ Created enhanced workflow notifications for transport ${transportId} ${action} action`);
      }
    } catch (notificationError) {
      console.error(`❌ Failed to create enhanced workflow notifications for transport ${transportId}:`, notificationError);
      // Don't fail the transport action due to notification errors
    }
    
    return NextResponse.json({ 
      transportRequest: updatedTransportRequest,
      message: `Transport request ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    });
    
  } catch (error) {
    console.error('Error processing transport request action:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process approval action',
        details: error.message
      },
      { status: 500 }
    );
  }
}