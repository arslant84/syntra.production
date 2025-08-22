import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { EnhancedWorkflowNotificationService } from '@/lib/enhanced-workflow-notification-service';

const processTransportSchema = z.object({
  action: z.enum(["process", "complete"]),
  bookingDetails: z.object({
    vehicleType: z.string().optional(),
    vehicleNumber: z.string().optional(), 
    driverName: z.string().optional(),
    driverContact: z.string().optional(),
    pickupTime: z.string().optional(),
    dropoffTime: z.string().optional(),
    actualRoute: z.string().optional(),
    bookingReference: z.string().optional(),
    additionalNotes: z.string().optional()
  }).optional(),
  comments: z.string().optional()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ transportId: string }> }) {
  const { transportId } = await params;
  console.log(`API_TRANSPORT_ADMIN_PROCESS_POST_START: Processing transport ${transportId}.`);
  
  // Check if user has permission to process transport requests
  if (!await hasPermission('process_transport_requests')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = processTransportSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_TRANSPORT_ADMIN_PROCESS_POST_VALIDATION_ERROR:", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for transport processing", details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const { action, bookingDetails, comments } = validationResult.data;

    const [currentTransport] = await sql`SELECT id, status, requestor_name FROM transport_requests WHERE id = ${transportId}`;
    if (!currentTransport) {
      return NextResponse.json({ error: "Transport request not found" }, { status: 404 });
    }

    // Only allow processing if status is "Approved"
    if (currentTransport.status !== 'Approved' && currentTransport.status !== 'Processing with Transport Admin') {
      return NextResponse.json({ error: `Cannot process transport request with status: ${currentTransport.status}` }, { status: 400 });
    }

    let nextStatus = currentTransport.status;
    let stepStatus = "Processed";
    let notificationMessage = "";

    if (action === "process") {
      // Transport admin starts processing
      nextStatus = "Processing with Transport Admin";
      stepStatus = "Processing";
      notificationMessage = `Your transport request (${transportId}) is now being processed by Transport Admin.`;
    } else if (action === "complete") {
      // Transport admin completes processing with booking details
      if (!bookingDetails) {
        return NextResponse.json({ error: "Booking details are required when completing transport processing" }, { status: 400 });
      }
      nextStatus = "Completed";
      stepStatus = "Completed";
      notificationMessage = `Your transport request (${transportId}) has been completed. Transport details have been finalized.`;
    }

    const result = await sql.begin(async tx => {
      // Update transport request status
      const updateFields: any = {
        status: nextStatus,
        updated_at: 'NOW()'
      };

      // If completing, update booking details
      if (action === "complete" && bookingDetails) {
        const bookingDetailsJson = JSON.stringify(bookingDetails);
        const [updatedTransport] = await tx`
          UPDATE transport_requests
          SET status = ${nextStatus}, updated_at = NOW(), booking_details = ${bookingDetailsJson}
          WHERE id = ${transportId}
          RETURNING *
        `;
        
        // Add approval step
        await tx`
          INSERT INTO transport_approval_steps (transport_request_id, role, name, status, date, comments)
          VALUES (${transportId}, 'Transport Admin', 'Transport Admin', ${stepStatus}, NOW(), ${comments || `Transport ${action}ed with booking details`})
        `;
        
        return updatedTransport;
      } else {
        const [updatedTransport] = await tx`
          UPDATE transport_requests
          SET status = ${nextStatus}, updated_at = NOW()
          WHERE id = ${transportId}
          RETURNING *
        `;
        
        // Add approval step
        await tx`
          INSERT INTO transport_approval_steps (transport_request_id, role, name, status, date, comments)
          VALUES (${transportId}, 'Transport Admin', 'Transport Admin', ${stepStatus}, NOW(), ${comments || `Transport ${action}ed`})
        `;
        
        return updatedTransport;
      }
    });

    const updated = result && result.length > 0 ? result[0] : result;
    
    if (!updated) {
      console.error(`API_TRANSPORT_ADMIN_PROCESS_POST_ERROR: Failed to update transport request ${transportId}`);
      return NextResponse.json({ error: 'Failed to update transport request' }, { status: 500 });
    }
    
    // Send enhanced workflow notifications
    try {
      // Get transport request details including requestor information
      const transportDetails = await sql`
        SELECT tr.created_by, tr.requestor_name, tr.department, tr.purpose, u.email, u.id as user_id
        FROM transport_requests tr
        LEFT JOIN users u ON tr.created_by = u.id
        WHERE tr.id = ${transportId}
      `;

      if (transportDetails.length > 0) {
        const transportInfo = transportDetails[0];
        
        // Send enhanced workflow notification for status change
        await EnhancedWorkflowNotificationService.sendStatusChangeNotification({
          entityType: 'transport',
          entityId: transportId,
          requestorName: transportInfo.requestor_name || 'User',
          requestorEmail: transportInfo.email,
          requestorId: transportInfo.user_id,
          department: transportInfo.department,
          purpose: transportInfo.purpose,
          newStatus: updated.status,
          approverName: 'Transport Admin',
          comments: comments
        });

        console.log(`✅ Created enhanced workflow notifications for transport ${transportId} ${action} by Transport Admin`);
      }
    } catch (notificationError) {
      console.error(`❌ Failed to create enhanced workflow notifications for transport ${transportId}:`, notificationError);
      // Don't fail the transport action due to notification errors
    }

    console.log(`API_TRANSPORT_ADMIN_PROCESS_POST: Transport ${transportId} ${action} processed. New status: ${updated.status}`);
    
    return NextResponse.json({ 
      message: `Transport request ${action}ed successfully.`, 
      transport: updated,
      bookingDetails: action === "complete" ? bookingDetails : undefined
    });

  } catch (error: any) {
    console.error(`API_TRANSPORT_ADMIN_PROCESS_POST_ERROR for transport ${transportId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process transport request.', details: error.message }, { status: 500 });
  }
}