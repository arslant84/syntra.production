// src/app/api/claims/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db'; // Assuming PostgreSQL setup
import { formatISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const expenseClaimCreateSchema = z.object({
  headerDetails: z.object({
    documentType: z.enum(["TR01", "TB35", "TB05", ""], { required_error: "Document type is required."}).refine(val => val !== "", "Document type is required."),
    documentNumber: z.string().min(1).optional(), // Made optional since we'll generate it
    claimForMonthOf: z.coerce.date(),
    staffName: z.string().min(1),
    staffNo: z.string().min(1),
    gred: z.string().min(1),
    staffType: z.enum(["PERMANENT STAFF", "CONTRACT STAFF", ""]),
    executiveStatus: z.enum(["EXECUTIVE", "NON-EXECUTIVE", ""]),
    departmentCode: z.string().min(1),
    deptCostCenterCode: z.string().min(1),
    location: z.string().min(1),
    telExt: z.string().min(1),
    startTimeFromHome: z.string().regex(timeRegex),
    timeOfArrivalAtHome: z.string().regex(timeRegex),
  }),
  bankDetails: z.object({
    bankName: z.string().min(1),
    accountNumber: z.string().min(1),
    purposeOfClaim: z.string().min(1),
  }),
  medicalClaimDetails: z.object({
    isMedicalClaim: z.boolean().default(false),
    applicableMedicalType: z.enum(["Inpatient", "Outpatient", ""]).optional(),
    isForFamily: z.boolean().default(false),
    familyMemberSpouse: z.boolean().default(false),
    familyMemberChildren: z.boolean().default(false),
    familyMemberOther: z.string().optional(),
  }),
  expenseItems: z.array(
    z.object({
      date: z.coerce.date(),
      claimOrTravelDetails: z.string().min(1),
      officialMileageKM: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
      transport: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
      hotelAccommodationAllowance: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
      outStationAllowanceMeal: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
      miscellaneousAllowance10Percent: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
      otherExpenses: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
    })
  ).min(1),
  informationOnForeignExchangeRate: z.array(
    z.object({
      date: z.coerce.date(),
      typeOfCurrency: z.string().min(1),
      sellingRateTTOD: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative()),
    })
  ).optional(),
  financialSummary: z.object({
    totalAdvanceClaimAmount: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative()),
    lessAdvanceTaken: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
    lessCorporateCreditCardPayment: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
    balanceClaimRepayment: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().optional()),
    chequeReceiptNo: z.string().optional().nullable(),
  }),
  declaration: z.object({
    iDeclare: z.boolean().refine(val => val === true, { message: "Declaration is required." }),
    date: z.coerce.date(),
  }),
  trfId: z.string().optional().nullable(), // For linking to a TRF
});


export async function POST(request: NextRequest) {
  console.log("API_CLAIMS_POST_START (PostgreSQL): Creating expense claim.");
  if (!sql) {
    console.error("API_CLAIMS_POST_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    console.log("API_CLAIMS_POST (PostgreSQL): Received raw body:", JSON.stringify(body).substring(0, 500) + "...");
    const validationResult = expenseClaimCreateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_CLAIMS_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const data = validationResult.data;
    const { headerDetails, bankDetails, medicalClaimDetails, expenseItems, informationOnForeignExchangeRate, financialSummary, declaration, trfId } = data;
    
    // Generate a unified request ID for the claim
    // Use the claim purpose as context (first word or first few characters)
    const purposeWords = bankDetails.purposeOfClaim.split(' ');
    const contextWord = purposeWords[0].length > 5 ? purposeWords[0].substring(0, 5) : purposeWords[0];
    const claimRequestId = generateRequestId('CLM', contextWord.toUpperCase());

    const newClaim = await sql.begin(async tx => {
      const [claim] = await tx`
        INSERT INTO expense_claims (
          trf_id, document_type, document_number, claim_for_month_of, staff_name, staff_no, gred,
          staff_type, executive_status, department_code, dept_cost_center_code, location, tel_ext,
          start_time_from_home, time_of_arrival_at_home, bank_name, account_number, purpose_of_claim,
          is_medical_claim, applicable_medical_type, is_for_family, family_member_spouse,
          family_member_children, family_member_other, total_advance_claim_amount, less_advance_taken,
          less_corporate_credit_card_payment, balance_claim_repayment, cheque_receipt_no,
          i_declare, declaration_date, status, submitted_at, created_at, updated_at
        ) VALUES (
          ${trfId || null}, ${headerDetails.documentType || null}, ${claimRequestId}, ${formatISO(headerDetails.claimForMonthOf, {representation: 'date'})},
          ${headerDetails.staffName}, ${headerDetails.staffNo}, ${headerDetails.gred}, ${headerDetails.staffType || null},
          ${headerDetails.executiveStatus || null}, ${headerDetails.departmentCode}, ${headerDetails.deptCostCenterCode},
          ${headerDetails.location}, ${headerDetails.telExt}, ${headerDetails.startTimeFromHome},
          ${headerDetails.timeOfArrivalAtHome}, ${bankDetails.bankName}, ${bankDetails.accountNumber},
          ${bankDetails.purposeOfClaim}, ${medicalClaimDetails.isMedicalClaim}, ${medicalClaimDetails.applicableMedicalType || null},
          ${medicalClaimDetails.isForFamily}, ${medicalClaimDetails.familyMemberSpouse}, ${medicalClaimDetails.familyMemberChildren},
          ${medicalClaimDetails.familyMemberOther || null}, ${Number(financialSummary.totalAdvanceClaimAmount)},
          ${Number(financialSummary.lessAdvanceTaken || 0)}, ${Number(financialSummary.lessCorporateCreditCardPayment || 0)},
          ${Number(financialSummary.balanceClaimRepayment || 0)}, ${financialSummary.chequeReceiptNo || null},
          ${declaration.iDeclare}, ${formatISO(declaration.date, {representation: 'date'})}, 'Pending Verification', NOW(), NOW(), NOW()
        ) RETURNING id
      `;

      const claimId = claim.id;

      if (expenseItems && expenseItems.length > 0) {
        const itemsToInsert = expenseItems.map(item => ({
          claim_id: claimId,
          item_date: item.date ? formatISO(item.date, { representation: 'date' }) : null,
          claim_or_travel_details: item.claimOrTravelDetails,
          official_mileage_km: Number(item.officialMileageKM || 0),
          transport: Number(item.transport || 0),
          hotel_accommodation_allowance: Number(item.hotelAccommodationAllowance || 0),
          out_station_allowance_meal: Number(item.outStationAllowanceMeal || 0),
          miscellaneous_allowance_10_percent: Number(item.miscellaneousAllowance10Percent || 0),
          other_expenses: Number(item.otherExpenses || 0),
        }));
        await tx`INSERT INTO expense_claim_items ${tx(itemsToInsert, 'claim_id', 'item_date', 'claim_or_travel_details', 'official_mileage_km', 'transport', 'hotel_accommodation_allowance', 'out_station_allowance_meal', 'miscellaneous_allowance_10_percent', 'other_expenses')}`;
      }

      if (informationOnForeignExchangeRate && informationOnForeignExchangeRate.length > 0) {
        const fxToInsert = informationOnForeignExchangeRate.map(fx => ({
          claim_id: claimId,
          fx_date: fx.date ? formatISO(fx.date, { representation: 'date' }) : null,
          type_of_currency: fx.typeOfCurrency,
          selling_rate_tt_od: Number(fx.sellingRateTTOD || 0),
        }));
        await tx`INSERT INTO expense_claim_fx_rates ${tx(fxToInsert, 'claim_id', 'fx_date', 'type_of_currency', 'selling_rate_tt_od')}`;
      }
      return claimId;
    });
    
    console.log("API_CLAIMS_POST (PostgreSQL): Expense claim created successfully:", newClaim);
    console.log("API_CLAIMS_POST (PostgreSQL): Generated claim ID:", claimRequestId);
     // TODO: Notification
    return NextResponse.json({ 
      message: 'Expense claim submitted successfully!', 
      claimId: newClaim,
      requestId: claimRequestId 
    }, { status: 201 });
  } catch (error: any) {
    console.error("API_CLAIMS_POST_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to create expense claim.', details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log("API_CLAIMS_GET_START (PostgreSQL): Fetching claims.");
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  try {
    console.log("Executing SQL query to fetch claims");
    const claims = await sql`
      SELECT id, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
      FROM expense_claims 
      ORDER BY submitted_at DESC
    `;
    
    console.log(`Found ${claims.length} claims in database`);
    if (claims.length > 0) {
      console.log('First raw claim from DB:', JSON.stringify(claims[0], null, 2));
    }
    
    const formattedClaims = claims.map(claim => ({
        id: claim.id,
        requestor: claim.staff_name, // For consistency with admin claims page display
        purpose: claim.purpose_of_claim,
        amount: Number(claim.total_advance_claim_amount) || 0, // Ensure it's a number
        status: claim.status || 'Pending Verification',
        submittedDate: claim.submitted_at ? formatISO(new Date(claim.submitted_at)) : formatISO(new Date()),
    }));
    
    console.log('Formatted claims for response:', JSON.stringify(formattedClaims, null, 2));
    console.log('Response structure type:', 'Array of claims directly');
    
    // Return the formatted claims directly as an array for consistency
    return NextResponse.json(formattedClaims);
  } catch (error: any) {
    console.error("API_CLAIMS_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch claims.', details: error.message }, { status: 500 });
  }
}
