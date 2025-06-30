// src/app/api/claims/[claimId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';

// Placeholder for claim actions
const claimActionSchema = z.object({
  action: z.enum(["verify", "approve_hod", "approve_finance", "reject", "process_payment", "approve"]),
  comments: z.string().optional().nullable(),
  approverRole: z.string().optional(),
  approverName: z.string().optional()
});

export async function POST(request: NextRequest, { params }: { params: { claimId: string } }) {
  // Ensure params is awaited before accessing its properties
  const resolvedParams = await Promise.resolve(params);
  const { claimId } = resolvedParams;
  console.log(`API_CLAIMS_ACTION_POST_START (PostgreSQL): Action for claim ${claimId}.`);
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = claimActionSchema.safeParse(body);
    if (!validationResult.success) {
        return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten()}, { status: 400 });
    }
    const { action, comments } = validationResult.data;

    const [currentClaim] = await sql`SELECT id, status FROM expense_claims WHERE id = ${claimId}`;
    if (!currentClaim) {
        return NextResponse.json({ error: "Claim not found"}, { status: 404 });
    }

    let nextStatus = currentClaim.status;
    let effectiveAction = action;
    
    // Handle generic 'approve' action by mapping it to the appropriate specific action based on the current status
    if (action === "approve") {
      if (currentClaim.status === "Pending Verification") effectiveAction = "verify";
      else if (currentClaim.status === "Pending HOD Approval") effectiveAction = "approve_hod";
      else if (currentClaim.status === "Pending Finance Approval") effectiveAction = "approve_finance";
      else if (currentClaim.status === "Approved") effectiveAction = "process_payment";
      else {
        return NextResponse.json({ error: `Cannot approve claim in status '${currentClaim.status}'`}, {status: 400});
      }
    }
    
    // Simplified workflow for mock
    if (effectiveAction === "verify" && currentClaim.status === "Pending Verification") nextStatus = "Pending HOD Approval";
    else if (effectiveAction === "approve_hod" && currentClaim.status === "Pending HOD Approval") nextStatus = "Pending Finance Approval"; // Or "Approved" if no finance step
    else if (effectiveAction === "approve_finance" && currentClaim.status === "Pending Finance Approval") nextStatus = "Approved";
    else if (effectiveAction === "process_payment" && currentClaim.status === "Approved") nextStatus = "Processed";
    else if (effectiveAction === "reject") nextStatus = "Rejected";
    else {
        // Invalid action for current status
        return NextResponse.json({ error: `Action '${effectiveAction}' not allowed for current status '${currentClaim.status}'`}, {status: 400});
    }

    const [updatedClaim] = await sql`
        UPDATE expense_claims 
        SET status = ${nextStatus}, updated_at = NOW() 
        WHERE id = ${claimId}
        RETURNING *
    `;
    // TODO: Log action in an audit/approval_steps table for claims

    console.log(`API_CLAIMS_ACTION_POST (PostgreSQL): Claim ${claimId} action '${action}' processed. New status: ${updatedClaim.status}`);
    return NextResponse.json({ message: `Claim action '${action}' processed.`, claim: updatedClaim });

  } catch (error: any) {
    console.error(`API_CLAIMS_ACTION_POST_ERROR (PostgreSQL) for claim ${claimId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process claim action.', details: error.message }, { status: 500 });
  }
}
