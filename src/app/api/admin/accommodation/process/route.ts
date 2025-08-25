import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const POST = withAuth(async function(request: NextRequest) {
  console.log("API_ADMIN_ACCOMMODATION_PROCESS_START: Processing accommodation request.");
  
  const session = (request as any).user;
  
  // Check if user has permission to process accommodation requests
  if (!hasPermission(session, 'approve_accommodation_requests')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    console.error("API_ADMIN_ACCOMMODATION_PROCESS_CRITICAL_ERROR: SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const { requestId, processingDetails, action } = await request.json();
    
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    console.log(`API_ADMIN_ACCOMMODATION_PROCESS: Starting to ${action} accommodation request ${requestId}`);

    // Determine the new status based on action
    const newStatus = action === 'process' ? 'Processing Accommodation' : 'Completed';

    await sql.begin(async tx => {
      // Update the main travel request status
      await tx`
        UPDATE travel_requests 
        SET status = ${newStatus}, updated_at = NOW()
        WHERE id = ${requestId} AND travel_type = 'Accommodation'
      `;

      // Update accommodation details with processing information
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

        // Store additional processing details in a JSON column or separate table
        // For now, we'll add it to additional_comments in travel_requests
        const processingInfo = {
          roomNumber: processingDetails.roomNumber,
          bedNumber: processingDetails.bedNumber,
          keyNumber: processingDetails.keyNumber,
          guestInstructions: processingDetails.guestInstructions,
          processedBy: processingDetails.processedBy,
          authorizedBy: processingDetails.authorizedBy,
          processingDate: new Date().toISOString()
        };

        await tx`
          UPDATE travel_requests 
          SET additional_comments = COALESCE(additional_comments, '') || 
                                   CASE WHEN additional_comments IS NOT NULL AND additional_comments != '' 
                                        THEN '\n\nProcessing Details: ' 
                                        ELSE 'Processing Details: ' 
                                   END || ${JSON.stringify(processingInfo)}
          WHERE id = ${requestId}
        `;
      }

      // Add approval step for the processing action
      await tx`
        INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
        VALUES (
          ${requestId}, 
          'Accommodation Admin', 
          ${session.name || session.email}, 
          'Approved', 
          NOW(), 
          ${action === 'process' ? 'Started processing accommodation request' : 'Completed processing accommodation request'}
        )
      `;
    });

    console.log(`API_ADMIN_ACCOMMODATION_PROCESS: Successfully ${action}ed accommodation request ${requestId}`);

    return NextResponse.json({ 
      message: `Accommodation request ${action === 'process' ? 'processing started' : 'completed'} successfully`,
      requestId,
      newStatus
    }, { status: 200 });

  } catch (error: any) {
    console.error("API_ADMIN_ACCOMMODATION_PROCESS_ERROR:", error.message, error.stack);
    return NextResponse.json({ 
      error: `Failed to ${action || 'process'} accommodation request: ${error.message}` 
    }, { status: 500 });
  }
});