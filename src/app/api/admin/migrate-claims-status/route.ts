// Migration endpoint to update claims from "Pending Verification" to "Pending Department Focal"
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can run migrations
    if (!await hasPermission('manage_users')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const results: any = {};

    // 1. Find all claims with "Pending Verification" status
    const pendingVerificationClaims = await sql`
      SELECT id, staff_name, status, department_code, submitted_at
      FROM expense_claims
      WHERE status = 'Pending Verification'
      ORDER BY submitted_at DESC
    `;

    results.claimsFound = pendingVerificationClaims.length;
    results.claimsToUpdate = pendingVerificationClaims;

    if (pendingVerificationClaims.length === 0) {
      return NextResponse.json({
        message: 'No claims with "Pending Verification" status found',
        results
      });
    }

    // 2. Update claims to use "Pending Department Focal" status
    const updatedClaims = await sql`
      UPDATE expense_claims
      SET 
        status = 'Pending Department Focal',
        updated_at = NOW()
      WHERE status = 'Pending Verification'
      RETURNING id, staff_name, status
    `;

    results.claimsUpdated = updatedClaims.length;
    results.updatedClaims = updatedClaims;

    // 3. Update any approval steps that reference "Verifier" role to "Department Focal"
    const updatedSteps = await sql`
      UPDATE claims_approval_steps
      SET 
        step_role = 'Department Focal',
        updated_at = NOW()
      WHERE step_role = 'Verifier' OR step_role = 'Verification'
      RETURNING claim_id, step_role, step_name
    `;

    results.approvalStepsUpdated = updatedSteps.length;
    results.updatedApprovalSteps = updatedSteps;

    // 4. Update any pending approval steps that were marked as "Pending" for verification
    const pendingStepsUpdated = await sql`
      UPDATE claims_approval_steps cas
      SET 
        step_name = 'Department Focal Approval Required',
        comments = COALESCE(comments, 'Waiting for Department Focal approval'),
        updated_at = NOW()
      FROM expense_claims ec
      WHERE cas.claim_id = ec.id
        AND ec.status = 'Pending Department Focal'
        AND cas.step_role = 'Department Focal'
        AND cas.status = 'Pending'
      RETURNING cas.claim_id, cas.step_name
    `;

    results.pendingStepsUpdated = pendingStepsUpdated.length;

    // 5. Create any missing approval steps for claims now in "Pending Department Focal" status
    const claimsNeedingApprovalSteps = await sql`
      SELECT ec.id, ec.staff_name
      FROM expense_claims ec
      WHERE ec.status = 'Pending Department Focal'
        AND NOT EXISTS (
          SELECT 1 FROM claims_approval_steps cas
          WHERE cas.claim_id = ec.id
            AND cas.step_role = 'Department Focal'
        )
    `;

    let newStepsCreated = 0;
    for (const claim of claimsNeedingApprovalSteps) {
      await sql`
        INSERT INTO claims_approval_steps (
          claim_id, step_role, step_name, status, step_date, comments, created_at, updated_at
        )
        VALUES (
          ${claim.id}, 'Department Focal', 'Awaiting Department Focal Approval', 'Pending', NOW(),
          'Automatically created during status migration', NOW(), NOW()
        )
      `;
      newStepsCreated++;
    }

    results.newApprovalStepsCreated = newStepsCreated;

    return NextResponse.json({
      message: `Successfully migrated ${updatedClaims.length} claims from "Pending Verification" to "Pending Department Focal"`,
      results
    });

  } catch (error) {
    console.error('Error migrating claims status:', error);
    return NextResponse.json({ 
      error: 'Failed to migrate claims status', 
      details: error.message 
    }, { status: 500 });
  }
}