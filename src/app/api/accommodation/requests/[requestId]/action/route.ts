// src/app/api/accommodation/requests/[requestId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional(),
  approverRole: z.string(),
  approverName: z.string(),
});

export async function POST(request: NextRequest, { params }: { params: { requestId: string } }) {
  const { requestId } = params;
  console.log(`API_ACCOM_REQ_ACTION_POST_START (PostgreSQL): Processing action for accommodation request ${requestId}.`);
  
  if (!sql) {
    console.error("API_ACCOM_REQ_ACTION_POST_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }
  
  try {
    const body = await request.json();
    const validationResult = actionSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("API_ACCOM_REQ_ACTION_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const { action, comments, approverRole, approverName } = validationResult.data;
    
    // First, get the accommodation request to find the associated TRF ID
    const accommodationRequests = await sql`
      SELECT tad.trf_id
      FROM trf_accommodation_details tad
      WHERE tad.id = ${requestId}
    `;
    
    if (accommodationRequests.length === 0) {
      return NextResponse.json({ error: `Accommodation request with ID ${requestId} not found.` }, { status: 404 });
    }
    
    const trfId = accommodationRequests[0].trf_id;
    
    // Update the status of the travel request based on the action
    const newStatus = action === 'approve' 
      ? 'Approved' 
      : 'Rejected';
    
    await sql`
      UPDATE travel_requests
      SET 
        status = ${newStatus},
        updated_at = NOW()
      WHERE id = ${trfId}
    `;
    
    // Add an approval step record
    await sql`
      INSERT INTO trf_approval_steps (
        trf_id, step_number, step_role, step_name, status, step_date, 
        approver_id, approver_name, comments, created_at, updated_at
      ) VALUES (
        ${trfId},
        (SELECT COALESCE(MAX(step_number), 0) + 1 FROM trf_approval_steps WHERE trf_id = ${trfId}),
        ${approverRole},
        ${action === 'approve' ? 'Accommodation Approval' : 'Accommodation Rejection'},
        ${newStatus},
        NOW(),
        NULL, -- approver_id would come from authenticated user
        ${approverName},
        ${comments || (action === 'approve' ? 'Accommodation request approved.' : 'Accommodation request rejected.')},
        NOW(),
        NOW()
      )
    `;
    
    console.log(`API_ACCOM_REQ_ACTION_POST (PostgreSQL): Successfully ${action}d accommodation request ${requestId}.`);
    
    return NextResponse.json({ 
      message: `Accommodation request ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
      status: newStatus
    });
    
  } catch (error: any) {
    console.error(`API_ACCOM_REQ_ACTION_POST_ERROR (PostgreSQL) for request ${requestId}:`, error.message, error.stack);
    return NextResponse.json({ error: `Failed to process accommodation request.`, details: error.message }, { status: 500 });
  }
}
