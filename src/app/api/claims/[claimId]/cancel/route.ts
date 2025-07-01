import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request, { params }: { params: { claimId: string } }) {
  const { claimId } = params;
  console.log(`API_CLAIMS_CANCEL_POST (PostgreSQL): Attempting to cancel claim with ID: ${claimId}`);

  if (!sql) {
    console.error("API_CLAIMS_CANCEL_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const result = await sql`
      UPDATE expense_claims
      SET status = 'Cancelled',
          updated_at = NOW()
      WHERE id = ${claimId} AND (status = 'Pending Verification' OR status = 'Pending Approval')
      RETURNING id;
    `;

    if (result.count === 0) {
      console.warn(`API_CLAIMS_CANCEL_POST (PostgreSQL): Claim ${claimId} not found or not in cancellable status.`);
      return NextResponse.json({ error: 'Claim not found or cannot be cancelled (status must be Pending Verification or Pending Approval).' }, { status: 404 });
    }

    console.log(`API_CLAIMS_CANCEL_POST (PostgreSQL): Claim ${claimId} cancelled successfully.`);
    return NextResponse.json({ message: 'Claim cancelled successfully.', claimId: result[0].id });
  } catch (error: any) {
    console.error("API_CLAIMS_CANCEL_POST_ERROR (PostgreSQL): Failed to cancel claim.", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to cancel claim.', details: error.message }, { status: 500 });
  }
}
