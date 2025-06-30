// src/app/api/accommodation/admin/assign/[requestId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';

const assignSchema = z.object({
  assignedRoomInfo: z.string().min(1, "Assigned room information is required."),
  // In a real system: assignedRoomId, assignedStaffHouseId
});

export async function POST(request: NextRequest, context: { params: { requestId: string } }) {
  const { params } = context;
  const { requestId } = params; // This is actually TRF ID from current frontend
  const trfId = requestId; 
  console.log(`API_ACCOM_ADMIN_ASSIGN_POST_START (PostgreSQL): Assigning for TRF ${trfId}.`);
   if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = assignSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { assignedRoomInfo } = validationResult.data;

    const [currentTrf] = await sql`SELECT id, status, travel_type, requestor_name FROM travel_requests WHERE id = ${trfId}`;
    if (!currentTrf) {
      return NextResponse.json({ error: "TRF not found" }, { status: 404 });
    }
    if (currentTrf.status !== 'Processing Accommodation') {
      return NextResponse.json({ error: `Cannot assign accommodation for TRF with status: ${currentTrf.status}` }, { status: 400 });
    }

    let nextStatus = "TRF Processed"; // Default after accommodation
    if (currentTrf.travel_type === 'Overseas' || currentTrf.travel_type === 'Home Leave Passage') {
        nextStatus = "Awaiting Visa";
    }

    const [updatedTrf] = await sql.begin(async tx => {
        const [trf] = await tx`
            UPDATE travel_requests 
            SET status = ${nextStatus}, 
                additional_comments = COALESCE(additional_comments || E'\n\n', '') || ${'Accommodation Assigned by Admin: ' + assignedRoomInfo},
                updated_at = NOW()
            WHERE id = ${trfId} RETURNING *`;
        
        // Add to accommodation_requests if needed, or update existing one
        // For now, we just update the TRF status and log in TRF approval steps.
        // A more complete system would link this to a specific accommodation_requests record.

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
}
