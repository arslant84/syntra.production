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

export async function PUT(request: NextRequest, { params }: { params: { claimId: string } }) {
    const resolvedParams = await Promise.resolve(params);
    const claimId = resolvedParams.claimId;
    console.log(`API_CLAIMS_ID_PUT_START (PostgreSQL): Updating claim ${claimId}.`);
    
    if (!sql) {
        return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
    }
    
    try {
        const [existingClaim] = await sql`SELECT id, status FROM expense_claims WHERE id = ${claimId}`;
        if (!existingClaim) {
            return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
        }
        
        const editableStatuses = ['Pending Verification', 'Draft', 'Rejected'];
        if (!editableStatuses.includes(existingClaim.status)) {
            return NextResponse.json({ 
                error: 'Claim cannot be edited in its current status', 
                details: `Status '${existingClaim.status}' is not editable` 
            }, { status: 403 });
        }
        
        const claimData: ExpenseClaim = await request.json();
        
        try {
            await sql`BEGIN`;
            
            await sql`
                UPDATE expense_claims SET
                    document_type = ${claimData.headerDetails.documentType},
                    document_number = ${claimData.headerDetails.documentNumber},
                    claim_for_month_of = ${claimData.headerDetails.claimForMonthOf},
                    staff_name = ${claimData.headerDetails.staffName},
                    staff_no = ${claimData.headerDetails.staffNo},
                    gred = ${claimData.headerDetails.gred},
                    staff_type = ${claimData.headerDetails.staffType},
                    executive_status = ${claimData.headerDetails.executiveStatus},
                    department_code = ${claimData.headerDetails.departmentCode},
                    dept_cost_center_code = ${claimData.headerDetails.deptCostCenterCode},
                    location = ${claimData.headerDetails.location},
                    tel_ext = ${claimData.headerDetails.telExt},
                    start_time_from_home = ${claimData.headerDetails.startTimeFromHome},
                    time_of_arrival_at_home = ${claimData.headerDetails.timeOfArrivalAtHome},
                    bank_name = ${claimData.bankDetails.bankName},
                    account_number = ${claimData.bankDetails.accountNumber},
                    purpose_of_claim = ${claimData.bankDetails.purposeOfClaim},
                    is_medical_claim = ${claimData.medicalClaimDetails.isMedicalClaim},
                    applicable_medical_type = ${claimData.medicalClaimDetails.applicableMedicalType || null},
                    is_for_family = ${claimData.medicalClaimDetails.isForFamily},
                    family_member_spouse = ${claimData.medicalClaimDetails.familyMemberSpouse},
                    family_member_children = ${claimData.medicalClaimDetails.familyMemberChildren},
                    family_member_other = ${claimData.medicalClaimDetails.familyMemberOther || null},
                    total_advance_claim_amount = ${claimData.financialSummary.totalAdvanceClaimAmount},
                    less_advance_taken = ${claimData.financialSummary.lessAdvanceTaken},
                    less_corporate_credit_card_payment = ${claimData.financialSummary.lessCorporateCreditCardPayment},
                    balance_claim_repayment = ${claimData.financialSummary.balanceClaimRepayment},
                    cheque_receipt_no = ${claimData.financialSummary.chequeReceiptNo},
                    i_declare = ${claimData.declaration.iDeclare},
                    declaration_date = ${claimData.declaration.date},
                    updated_at = NOW()
                WHERE id = ${claimId}
            `;
            
            await sql`DELETE FROM expense_claim_items WHERE claim_id = ${claimId}`;
            
            for (const item of claimData.expenseItems) {
                await sql`
                    INSERT INTO expense_claim_items (
                        claim_id, item_date, claim_or_travel_details, 
                        official_mileage_km, transport, hotel_accommodation_allowance,
                        out_station_allowance_meal, miscellaneous_allowance_10_percent, other_expenses
                    ) VALUES (
                        ${claimId}, ${item.date}, ${item.claimOrTravelDetails},
                        ${item.officialMileageKM || 0}, ${item.transport || 0}, ${item.hotelAccommodationAllowance || 0},
                        ${item.outStationAllowanceMeal || 0}, ${item.miscellaneousAllowance10Percent || 0}, ${item.otherExpenses || 0}
                    )
                `;
            }
            
            await sql`DELETE FROM expense_claim_fx_rates WHERE claim_id = ${claimId}`;
            
            if (claimData.informationOnForeignExchangeRate && claimData.informationOnForeignExchangeRate.length > 0) {
                for (const fxRate of claimData.informationOnForeignExchangeRate) {
                    await sql`
                        INSERT INTO expense_claim_fx_rates (
                            claim_id, fx_date, type_of_currency, selling_rate_tt_od
                        ) VALUES (
                            ${claimId}, ${fxRate.date}, ${fxRate.typeOfCurrency}, ${fxRate.sellingRateTTOD || 0}
                        )
                    `;
                }
            }
            
            await sql`COMMIT`;
            
            console.log(`API_CLAIMS_ID_PUT_SUCCESS: Claim ${claimId} updated successfully.`);
            return NextResponse.json({ 
                success: true, 
                message: 'Claim updated successfully',
                claimId: claimId
            });
        } catch (error: any) {
            try {
                await sql`ROLLBACK`;
                console.log('Transaction rolled back due to error');
            } catch (rollbackError) {
                console.error('Failed to rollback transaction:', rollbackError);
            }
            
            throw error;
        }
    } catch (error: any) {
        console.error(`API_CLAIMS_ID_PUT_ERROR (PostgreSQL) for claim ${claimId}:`, error.message, error.stack);
        return NextResponse.json({ 
            error: 'Failed to update claim', 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
