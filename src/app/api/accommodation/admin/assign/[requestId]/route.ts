// src/app/api/accommodation/admin/assign/[requestId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

const assignSchema = z.object({
  assignedRoomInfo: z.string().min(1, "Assigned room information is required."),
  staffHouseId: z.string().optional(),
  roomId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const GET = withAuth(async function(request: NextRequest) {
  console.log('=== ACCOMMODATION ASSIGNMENT API GET TEST ===');
  return NextResponse.json({ message: 'Assignment endpoint is reachable', method: 'GET' });
});

export const POST = withAuth(async function(request: NextRequest) {
  console.log('=== ACCOMMODATION ASSIGNMENT API CALLED ===');
  const url = new URL(request.url);
  const requestId = url.pathname.split('/').pop() as string;
  const trfId = requestId; 
  console.log(`API_ACCOM_ADMIN_ASSIGN_POST_START (PostgreSQL): Assigning for TRF ${trfId}.`);
  console.log('Request URL:', url.toString());
  console.log('Request method:', request.method);
  
  const session = (request as any).user;
  console.log('Assignment API - Session:', JSON.stringify(session, null, 2));
  
  // Check if user has permission to assign accommodation
  const hasAccommodationPermission = hasPermission(session, 'approve_accommodation_requests');
  console.log('Assignment API - Has permission for approve_accommodation_requests:', hasAccommodationPermission);
  
  if (!hasAccommodationPermission) {
    console.log('Assignment API - Permission denied for user:', session.email, 'role:', session.role);
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions', userRole: session.role, requiredPermission: 'approve_accommodation_requests' }, { status: 403 });
  }
   if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    console.log('Request body received:', body);
    const validationResult = assignSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { assignedRoomInfo, staffHouseId, roomId, startDate, endDate } = validationResult.data;

    const [currentTrf] = await sql`SELECT id, status, travel_type, requestor_name FROM travel_requests WHERE id = ${trfId}`;
    if (!currentTrf) {
      return NextResponse.json({ error: "TRF not found" }, { status: 404 });
    }
    console.log(`Found TRF ${trfId} with status: ${currentTrf.status}, travel_type: ${currentTrf.travel_type}`);
    
    // Allow assignment for accommodation TRFs in appropriate statuses
    const allowedStatuses = ['Processing Accommodation', 'Pending', 'Approved', 'Finance Approved'];
    if (!allowedStatuses.includes(currentTrf.status)) {
      console.log(`Status ${currentTrf.status} not in allowed statuses:`, allowedStatuses);
      return NextResponse.json({ error: `Cannot assign accommodation for TRF with status: ${currentTrf.status}` }, { status: 400 });
    }

    // For accommodation TRFs, the next status should be "Accommodation Assigned"
    let nextStatus = "Accommodation Assigned";
    if (currentTrf.travel_type === 'Accommodation') {
        nextStatus = "Accommodation Assigned";
    } else {
        // For other travel types that include accommodation
        nextStatus = "TRF Processed";
        if (currentTrf.travel_type === 'Overseas' || currentTrf.travel_type === 'Home Leave Passage') {
            nextStatus = "Awaiting Visa";
        }
    }

    const updatedTrf = await sql.begin(async (tx: any) => {
        const [trf] = await tx`
            UPDATE travel_requests 
            SET status = ${nextStatus}, 
                additional_comments = COALESCE(additional_comments || E'\n\n', '') || ${'Accommodation Assigned by Admin: ' + assignedRoomInfo},
                updated_at = NOW()
            WHERE id = ${trfId} RETURNING *`;
        
        // Create accommodation booking records for the date range (if booking details provided)
        if (staffHouseId && roomId && startDate && endDate) {
            try {
                // Delete existing booking records for this TRF to avoid conflicts
                await tx`DELETE FROM accommodation_bookings WHERE trf_id = ${trfId}`;
                
                // Resolve staff_id from TRF data - try to get user UUID from staff_id
                let staffId = null;
                try {
                    const userLookup = await tx`
                        SELECT u.id as user_id
                        FROM travel_requests tr
                        LEFT JOIN users u ON tr.staff_id = u.staff_id
                        WHERE tr.id = ${trfId}
                        LIMIT 1
                    `;
                    if (userLookup.length > 0 && userLookup[0].user_id) {
                        staffId = userLookup[0].user_id;
                        console.log(`Resolved staff_id for TRF ${trfId}: ${staffId}`);
                    } else {
                        console.log(`Could not resolve staff_id for TRF ${trfId}, setting to null`);
                    }
                } catch (lookupError) {
                    console.warn('Failed to lookup staff_id, using null:', lookupError);
                    staffId = null;
                }
                
                // Generate booking records for each date in the range
                const start = new Date(startDate);
                const end = new Date(endDate);
                const bookingRecords = [];
                
                // Fix date iteration to avoid "(intermediate value) is not iterable" error
                const currentDate = new Date(start);
                while (currentDate <= end) {
                    const bookingId = randomUUID();
                    bookingRecords.push({
                        id: bookingId,
                        staff_house_id: staffHouseId,
                        room_id: roomId,
                        staff_id: staffId,
                        date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
                        trf_id: trfId,
                        status: 'Confirmed',
                        notes: `TRF Assignment: ${assignedRoomInfo}`,
                        created_at: 'NOW()',
                        updated_at: 'NOW()'
                    });
                    
                    // Move to next day
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                // Insert all booking records
                console.log(`Attempting to insert ${bookingRecords.length} booking records...`);
                if (bookingRecords.length > 0) {
                    for (const record of bookingRecords) {
                        try {
                            console.log('Inserting booking record:', JSON.stringify(record, null, 2));
                            await tx`
                                INSERT INTO accommodation_bookings (
                                    id, staff_house_id, room_id, staff_id, date, trf_id, status, notes, created_at, updated_at
                                ) VALUES (
                                    ${record.id}, ${record.staff_house_id}, ${record.room_id}, ${record.staff_id}, 
                                    ${record.date}, ${record.trf_id}, ${record.status}, ${record.notes}, NOW(), NOW()
                                )
                            `;
                        } catch (insertError) {
                            console.error(`Failed to insert booking record for ${record.date}:`, insertError);
                            throw insertError; // Re-throw to trigger transaction rollback
                        }
                    }
                    console.log(`Successfully inserted all ${bookingRecords.length} booking records`);
                } else {
                    console.log('No booking records to insert');
                }
                
                console.log(`Created ${bookingRecords.length} booking records for TRF ${trfId} from ${startDate} to ${endDate}`);
                
            } catch (bookingError: any) {
                console.error(`Error creating booking records for TRF ${trfId}:`, bookingError);
                console.error('Booking error details:', {
                    message: bookingError?.message || 'Unknown error',
                    code: bookingError?.code || 'Unknown code',
                    constraint: bookingError?.constraint_name || 'No constraint',
                    detail: bookingError?.detail || 'No details'
                });
                // Rethrow booking errors to ensure transaction rollback
                throw new Error(`Booking creation failed: ${bookingError?.message || 'Unknown booking error'}`);
            }
        } else {
            console.log(`Skipping booking record creation - missing booking details (staffHouseId: ${staffHouseId}, roomId: ${roomId}, startDate: ${startDate}, endDate: ${endDate})`);
        }

        await tx`
            INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
            VALUES (${trfId}, 'Accommodation Admin', 'System Admin', 'Accommodation Assigned', NOW(), ${'Assigned: ' + assignedRoomInfo})
        `;
        return trf;
    });
    
    console.log(`API_ACCOM_ADMIN_ASSIGN_POST (PostgreSQL): Accommodation assigned for TRF ${trfId}. New status: ${updatedTrf.status}`);
    // TODO: Notify requestor, Kiyanly reception if needed
    return NextResponse.json({ message: "Accommodation assigned successfully.", trf: updatedTrf });

  } catch (error: any) {
    console.error(`API_ACCOM_ADMIN_ASSIGN_POST_ERROR (PostgreSQL):`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to assign accommodation.', details: error.message }, { status: 500 });
  }
});
