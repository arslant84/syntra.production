import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  console.log(`API_CLAIMS_CANCEL_POST (PostgreSQL): Attempting to cancel claim with ID: ${claimId}`);

  if (!sql) {
    console.error("API_CLAIMS_CANCEL_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    // Parse request body to get cancellation details
    const body = await request.json().catch(() => ({}));
    const { comments = "Cancelled by user.", cancelledBy = "User" } = body;

    const result = await sql.begin(async tx => {
      // Update claim status to cancelled
      const [updatedClaim] = await tx`
        UPDATE expense_claims
        SET status = 'Cancelled',
            updated_at = NOW()
        WHERE id = ${claimId} AND (status = 'Pending Verification' OR status = 'Pending Approval' OR status = 'Pending Department Focal' OR status = 'Pending Line Manager' OR status = 'Pending HOD')
        RETURNING *;
      `;

      if (!updatedClaim) {
        throw new Error('Claim not found or cannot be cancelled');
      }

      // Add cancellation step to approval workflow
      await tx`
        INSERT INTO claims_approval_steps (claim_id, step_role, step_name, status, step_date, comments)
        VALUES (${claimId}, 'Cancelled By', ${cancelledBy}, 'Cancelled', NOW(), ${comments})
      `;

      return updatedClaim;
    });

    console.log(`API_CLAIMS_CANCEL_POST (PostgreSQL): Claim ${claimId} cancelled successfully.`);
    return NextResponse.json({ 
      message: 'Claim cancelled successfully.', 
      claim: result,
      claimId: result.id 
    });
  } catch (error: any) {
    console.error("API_CLAIMS_CANCEL_POST_ERROR (PostgreSQL): Failed to cancel claim.", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to cancel claim.', details: error.message }, { status: 500 });
  }
}
