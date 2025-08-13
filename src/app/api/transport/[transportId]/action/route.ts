import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { TransportService } from '@/lib/transport-service';
import { hasPermission } from '@/lib/permissions';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';

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
    
    // Create notifications for transport action
    try {
      // Get the transport request details
      const transportDetails = await sql`
        SELECT user_id, pickup_location, destination 
        FROM transport_requests 
        WHERE id = ${transportId}
      `;

      if (transportDetails.length > 0) {
        const transportInfo = transportDetails[0];
        
        // Notify the requestor about status update
        const requestorUser = await sql`
          SELECT id, name FROM users 
          WHERE id = ${transportInfo.user_id}
          LIMIT 1
        `;
        
        if (requestorUser.length > 0) {
          await NotificationService.createStatusUpdate({
            requestorId: requestorUser[0].id,
            status: updatedTransportRequest.status,
            entityType: 'transport',
            entityId: transportId,
            approverName: approverName || 'System',
            comments: comments || undefined
          });
        }

        console.log(`Created notifications for transport ${transportId} ${action} action`);
      }
    } catch (notificationError) {
      console.error(`Failed to create notifications for transport ${transportId}:`, notificationError);
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