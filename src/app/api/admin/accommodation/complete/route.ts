import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const POST = withAuth(async function(request: NextRequest) {
  console.log("API_ADMIN_ACCOMMODATION_COMPLETE_START: Completing accommodation request.");
  
  const session = (request as any).user;
  
  // Check if user has permission to complete accommodation requests
  if (!hasPermission(session, 'approve_accommodation_requests')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    console.error("API_ADMIN_ACCOMMODATION_COMPLETE_CRITICAL_ERROR: SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const { requestId, processingDetails, action } = await request.json();
    
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    console.log(`API_ADMIN_ACCOMMODATION_COMPLETE: Completing accommodation request ${requestId}`);

    await sql.begin(async tx => {
      // Update the main travel request status to completed
      await tx`
        UPDATE travel_requests 
        SET status = 'Completed', updated_at = NOW()
        WHERE id = ${requestId} AND travel_type = 'Accommodation'
      `;

      // Update accommodation details with final processing information
      if (processingDetails) {
        await tx`
          UPDATE trf_accommodation_details 
          SET 
            place_of_stay = COALESCE(${processingDetails.staffHouse}, place_of_stay),
            address = COALESCE(${processingDetails.location}, address),
            check_in_time = COALESCE(${processingDetails.checkInTime}, check_in_time),
            check_out_time = COALESCE(${processingDetails.checkOutTime}, check_out_time),
            remarks = COALESCE(${processingDetails.processingNotes}, remarks),
            updated_at = NOW()
          WHERE trf_id = ${requestId}
        `;

        // Store completion details
        const completionInfo = {
          roomNumber: processingDetails.roomNumber,
          bedNumber: processingDetails.bedNumber,
          keyNumber: processingDetails.keyNumber,
          actualCheckInTime: processingDetails.checkInTime,
          actualCheckOutTime: processingDetails.checkOutTime,
          guestInstructions: processingDetails.guestInstructions,
          processedBy: processingDetails.processedBy,
          authorizedBy: processingDetails.authorizedBy,
          completedDate: new Date().toISOString()
        };

        await tx`
          UPDATE travel_requests 
          SET additional_comments = COALESCE(additional_comments, '') || 
                                   '\n\nCompletion Details: ' || ${JSON.stringify(completionInfo)}
          WHERE id = ${requestId}
        `;
      }

      // Add final approval step
      await tx`
        INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
        VALUES (
          ${requestId}, 
          'Accommodation Admin', 
          ${session.name || session.email}, 
          'Completed', 
          NOW(), 
          'Completed accommodation request processing'
        )
      `;
    });

    console.log(`API_ADMIN_ACCOMMODATION_COMPLETE: Successfully completed accommodation request ${requestId}`);

    return NextResponse.json({ 
      message: 'Accommodation request completed successfully',
      requestId,
      newStatus: 'Completed'
    }, { status: 200 });

  } catch (error: any) {
    console.error("API_ADMIN_ACCOMMODATION_COMPLETE_ERROR:", error.message, error.stack);
    return NextResponse.json({ 
      error: `Failed to complete accommodation request: ${error.message}` 
    }, { status: 500 });
  }
});