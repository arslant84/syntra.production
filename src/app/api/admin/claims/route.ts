import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/permissions';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage claims (admin view)
    if (!await hasPermission('manage_claims') && !await hasPermission('view_all_claims')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const url = new URL(request.url);
    const statuses = url.searchParams.get('statuses');
    const fullDetails = url.searchParams.get('fullDetails') === 'true';
    
    let query;
    let params: any[] = [];
    
    // If specific statuses are requested
    if (statuses) {
      const statusArray = statuses.split(',');
      
      if (fullDetails) {
        // For processing page - fetch full claim details including expense items
        const result = await sql`
          SELECT 
            ec.*,
            ARRAY_AGG(
              CASE WHEN eci.id IS NOT NULL THEN
                JSON_BUILD_OBJECT(
                  'id', eci.id,
                  'date', eci.item_date,
                  'claimOrTravelDetails', eci.claim_or_travel_details,
                  'officialMileageKM', eci.official_mileage_km,
                  'transport', eci.transport,
                  'hotelAccommodationAllowance', eci.hotel_accommodation_allowance,
                  'outStationAllowanceMeal', eci.out_station_allowance_meal,
                  'miscellaneousAllowance10Percent', eci.miscellaneous_allowance_10_percent,
                  'otherExpenses', eci.other_expenses
                )
              ELSE NULL END
            ) FILTER (WHERE eci.id IS NOT NULL) as expense_items
          FROM expense_claims ec
          LEFT JOIN expense_claim_items eci ON ec.id = eci.claim_id
          WHERE ec.status = ANY(${statusArray})
          GROUP BY ec.id
          ORDER BY ec.created_at DESC
        `;
        
        // Process fullDetails response
        const processedResult = result.map((claim: any) => ({
          ...claim,
          documentNumber: claim.document_number,
          requestorName: claim.staff_name,
          department: claim.department_code,
          purpose: claim.purpose_of_claim,
          expenseItems: claim.expense_items || [],
          reimbursementDetails: claim.reimbursement_details ? 
            (typeof claim.reimbursement_details === 'object' ? 
              claim.reimbursement_details : 
              JSON.parse(claim.reimbursement_details)) : null,
          submittedAt: claim.created_at?.toISOString?.() || claim.created_at
        }));
        
        return NextResponse.json(processedResult);
      } else {
        // For admin listing - fetch summary data
        const result = await sql`
          SELECT 
            ec.id,
            ec.document_number,
            ec.staff_name as requestorName,
            ec.department_code as department,
            ec.purpose_of_claim as purpose,
            ec.status,
            ec.created_at as submittedAt,
            ec.total_advance_claim_amount,
            ec.balance_claim_repayment
          FROM expense_claims ec
          WHERE ec.status = ANY(${statusArray})
          ORDER BY ec.created_at DESC
        `;
        
        // Process summary response
        const processedResult = result.map((claim: any) => ({
          id: claim.id,
          documentNumber: claim.document_number,
          requestorName: claim.requestorname || claim.staff_name,
          department: claim.department || claim.department_code,
          purpose: claim.purpose || claim.purpose_of_claim,
          status: claim.status,
          submittedAt: claim.submittedat?.toISOString?.() || claim.created_at?.toISOString?.() || claim.created_at,
          totalAdvanceClaimAmount: claim.total_advance_claim_amount,
          balanceClaimRepayment: claim.balance_claim_repayment
        }));
        
        return NextResponse.json(processedResult);
      }
    } else {
      // Default behavior - return all claims summary
      const result = await sql`
        SELECT 
          ec.id,
          ec.document_number,
          ec.staff_name as requestorName,
          ec.department_code as department,
          ec.purpose_of_claim as purpose,
          ec.status,
          ec.created_at as submittedAt,
          ec.total_advance_claim_amount,
          ec.balance_claim_repayment
        FROM expense_claims ec
        ORDER BY ec.created_at DESC
      `;
      
      // Process summary response
      const processedResult = result.map((claim: any) => ({
        id: claim.id,
        documentNumber: claim.document_number,
        requestorName: claim.requestorname || claim.staff_name,
        department: claim.department || claim.department_code,
        purpose: claim.purpose || claim.purpose_of_claim,
        status: claim.status,
        submittedAt: claim.submittedat?.toISOString?.() || claim.created_at?.toISOString?.() || claim.created_at,
        totalAdvanceClaimAmount: claim.total_advance_claim_amount,
        balanceClaimRepayment: claim.balance_claim_repayment
      }));
      
      return NextResponse.json(processedResult);
    }
  } catch (error) {
    console.error('Error fetching admin claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}