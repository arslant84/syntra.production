// src/app/api/trf/[trfId]/admin/assign-accommodation/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';

const assignAccommodationSchema = z.object({
    assignedRoomInfo: z.string().min(1, "Assigned room information is required."),
    // Potentially add assigned_room_id, assigned_staff_house_id if integrating with real room inventory
});

function getNextStatusAfterAccommodation(trf: { travel_type?: string | null }): string {
    if (trf.travel_type === 'Overseas' || trf.travel_type === 'Home Leave Passage') {
        return "Awaiting Visa";
    }
    return "TRF Processed";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ trfId: string }> }) {
      const { trfId } = await params;
  console.log(`API_TRF_ADMIN_ASSIGNACCOM_POST_START (PostgreSQL): Assigning accommodation for TRF ${trfId}.`);
  if (!sql) {
    console.error("API_TRF_ADMIN_ASSIGNACCOM_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  
  let body;
  try {
      body = await request.json();
  } catch (error) {
      console.error("API_TRF_ADMIN_ASSIGNACCOM_POST (PostgreSQL): Invalid JSON payload", error);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validationResult = assignAccommodationSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("API_TRF_ADMIN_ASSIGNACCOM_POST (PostgreSQL): Validation failed", validationResult.error.flatten());
    return NextResponse.json({ error: "Validation failed for accommodation assignment", details: validationResult.error.flatten() }, { status: 400 });
  }
  const { assignedRoomInfo } = validationResult.data;

  try {
    const [currentTrf] = await sql`SELECT id, status, travel_type, requestor_name, external_full_name FROM travel_requests WHERE id = ${trfId}`;

    if (!currentTrf) {
      return NextResponse.json({ error: "TRF not found" }, { status: 404 });
    }
    if (currentTrf.status !== 'Processing Accommodation') {
      return NextResponse.json({ error: `Accommodation can only be assigned for TRFs with status 'Processing Accommodation'. Current status: ${currentTrf.status}` }, { status: 400 });
    }

    const nextStatus = getNextStatusAfterAccommodation(currentTrf);
    const adminRole = "Accommodation Admin"; 
    const adminName = "System Accommodation"; // Placeholder

    // TODO: Update actual assigned_room_name, assigned_staff_house_name in travel_requests if those columns are added
    
    const [updated] = await sql.begin(async tx => {
        const [updatedTrfResult] = await tx`
            UPDATE travel_requests
            SET status = ${nextStatus}, 
                additional_comments = COALESCE(additional_comments || E'\n\n', '') || ${'Accommodation Assigned: ' + assignedRoomInfo},
                updated_at = NOW()
            WHERE id = ${trfId}
            RETURNING *
        `;
        await tx`
            INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
            VALUES (${trfId}, ${adminRole}, ${adminName}, 'Accommodation Assigned', NOW(), ${'Assigned: ' + assignedRoomInfo})
        `;
        return updatedTrfResult;
    });

    const requestorNameVal = currentTrf.requestor_name || currentTrf.external_full_name || "Requestor";
    const notificationLog = `Placeholder: Send Notification - TRF ${trfId} - Accommodation Assigned by ${adminName}. New Status: ${nextStatus}. Details: ${assignedRoomInfo}. To Requestor: ${requestorNameVal}.`;
    console.log(notificationLog);
     if (nextStatus === 'Awaiting Visa') {
        console.log(`Placeholder: Notify Visa Clerk/Requestor - TRF ${trfId} accommodation assigned, proceed with visa if pending.`);
    }
    // TODO: If location is Kiyanly, conceptual notification to Kiyanly Reception

    return NextResponse.json({ message: 'Accommodation assignment processed successfully.', trf: updated });
  } catch (error: any) {
    console.error(`API_TRF_ADMIN_ASSIGNACCOM_POST_ERROR (PostgreSQL) for TRF ${trfId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process accommodation assignment.', details: error.message }, { status: 500 });
  }
}
