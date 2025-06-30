// src/app/api/claims/[claimId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { format } from 'date-fns';
import type { ExpenseClaim } from '@/types/claims';

export async function GET(request: NextRequest, { params }: { params: { claimId: string } }) {
  // Ensure params is awaited before accessing its properties
  const resolvedParams = await Promise.resolve(params);
  const claimId = resolvedParams.claimId;
  console.log(`API_CLAIMS_ID_GET_START (PostgreSQL): Fetching claim ${claimId}.`);
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const [claimData] = await sql`SELECT * FROM expense_claims WHERE id = ${claimId}`;
    if (!claimData) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const expenseItems = await sql`SELECT *, item_date as date, claim_or_travel_details as "claimOrTravelDetails", official_mileage_km as "officialMileageKM", hotel_accommodation_allowance as "hotelAccommodationAllowance", out_station_allowance_meal as "outStationAllowanceMeal", miscellaneous_allowance_10_percent as "miscellaneousAllowance10Percent", other_expenses as "otherExpenses" FROM expense_claim_items WHERE claim_id = ${claimId} ORDER BY item_date ASC`;
    const fxRates = await sql`SELECT *, fx_date as date, type_of_currency as "typeOfCurrency", selling_rate_tt_od as "sellingRateTTOD" FROM expense_claim_fx_rates WHERE claim_id = ${claimId} ORDER BY fx_date ASC`;

    const result: ExpenseClaim = {
      id: claimData.id,
      headerDetails: {
        documentType: claimData.document_type,
        documentNumber: claimData.document_number,
        claimForMonthOf: claimData.claim_for_month_of ? new Date(claimData.claim_for_month_of) : null,
        staffName: claimData.staff_name,
        staffNo: claimData.staff_no,
        gred: claimData.gred,
        staffType: claimData.staff_type,
        executiveStatus: claimData.executive_status,
        departmentCode: claimData.department_code,
        deptCostCenterCode: claimData.dept_cost_center_code,
        location: claimData.location,
        telExt: claimData.tel_ext,
        startTimeFromHome: claimData.start_time_from_home,
        timeOfArrivalAtHome: claimData.time_of_arrival_at_home,
      },
      bankDetails: {
        bankName: claimData.bank_name,
        accountNumber: claimData.account_number,
        purposeOfClaim: claimData.purpose_of_claim,
      },
      medicalClaimDetails: {
        isMedicalClaim: claimData.is_medical_claim,
        applicableMedicalType: claimData.applicable_medical_type,
        isForFamily: claimData.is_for_family,
        familyMemberSpouse: claimData.family_member_spouse,
        familyMemberChildren: claimData.family_member_children,
        familyMemberOther: claimData.family_member_other,
      },
      expenseItems: expenseItems.map(item => ({
        id: item.id,
        date: item.date ? new Date(item.date) : null,
        claimOrTravelDetails: item.claimOrTravelDetails,
        officialMileageKM: Number(item.officialMileageKM) || 0,
        transport: Number(item.transport) || 0,
        hotelAccommodationAllowance: Number(item.hotelAccommodationAllowance) || 0,
        outStationAllowanceMeal: Number(item.outStationAllowanceMeal) || 0,
        miscellaneousAllowance10Percent: Number(item.miscellaneousAllowance10Percent) || 0,
        otherExpenses: Number(item.otherExpenses) || 0,
      })),
      informationOnForeignExchangeRate: fxRates.map(fx => ({
        id: fx.id,
        date: fx.date ? new Date(fx.date) : null,
        typeOfCurrency: fx.typeOfCurrency,
        sellingRateTTOD: Number(fx.sellingRateTTOD) || 0,
      })),
      financialSummary: {
        totalAdvanceClaimAmount: claimData.total_advance_claim_amount,
        lessAdvanceTaken: claimData.less_advance_taken,
        lessCorporateCreditCardPayment: claimData.less_corporate_credit_card_payment,
        balanceClaimRepayment: claimData.balance_claim_repayment,
        chequeReceiptNo: claimData.cheque_receipt_no,
      },
      declaration: {
        iDeclare: claimData.i_declare,
        date: claimData.declaration_date ? new Date(claimData.declaration_date) : null,
      },
      status: claimData.status || 'Pending Verification',
      submittedAt: claimData.submitted_at ? format(new Date(claimData.submitted_at), "yyyy-MM-dd'T'HH:mm:ss'Z'") : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'")
    };
    
    console.log(`API_CLAIMS_ID_GET (PostgreSQL): Claim ${claimId} details fetched.`);
    return NextResponse.json({ claimData: result });
  } catch (error: any) {
    console.error(`API_CLAIMS_ID_GET_ERROR (PostgreSQL) for claim ${claimId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch claim details.', details: error.message }, { status: 500 });
  }
}

// Placeholder for PUT (Update Claim)
export async function PUT(request: NextRequest, { params }: { params: { claimId: string } }) {
    // Ensure params is awaited before accessing its properties
    const resolvedParams = await Promise.resolve(params);
    const claimId = resolvedParams.claimId;
    console.warn(`API_CLAIMS_ID_PUT (PostgreSQL): Update for claim ${claimId} - NOT IMPLEMENTED YET`);
    return NextResponse.json({ error: 'Update claim not implemented for PostgreSQL yet.' }, { status: 501 });
}
