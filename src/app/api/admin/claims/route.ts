import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  // Check if user has permission to process claims
  if (!hasPermission(session, 'process_claims') && !hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions for claims admin' }, { status: 403 });
  }

  console.log(`API_ADMIN_CLAIMS_GET: Admin ${session.role} (${session.email}) accessing claims data`);

  try {
    const url = new URL(request.url);
    const statuses = url.searchParams.get('statuses');
    const fullDetails = url.searchParams.get('fullDetails') === 'true';
    
    // Ensure we have a valid SQL connection
    const { getSql } = await import('@/lib/db');
    const sqlInstance = getSql();
    
    let query;
    
    // If specific statuses are requested
    if (statuses) {
      const statusArray = statuses.split(',');
      
      if (fullDetails) {
        // For processing page - fetch full claim details including expense items
        const result = await sqlInstance`
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
        const result = await sqlInstance`
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
      const result = await sqlInstance`
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
});