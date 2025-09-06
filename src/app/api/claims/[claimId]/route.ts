// src/app/api/claims/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db'; // Assuming PostgreSQL setup
import { formatISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const expenseClaimCreateSchema = z.object({
  headerDetails: z.object({
    documentType: z.enum(["TR01", "TB35", "TB05", ""]),
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
      claimOrTravelDetails: z.union([
        z.string().min(1),
        z.object({
          from: z.string().optional(),
          to: z.string().optional(),
          placeOfStay: z.string().optional(),
        })
      ]),
      officialMileageKM: z.preprocess(val => val === '' || val === null || val === undefined ? null : Number(val), z.number().nonnegative().nullable().optional()),
      transport: z.preprocess(val => val === '' || val === null || val === undefined ? null : Number(val), z.number().nonnegative().nullable().optional()),
      hotelAccommodationAllowance: z.preprocess(val => val === '' || val === null || val === undefined ? null : Number(val), z.number().nonnegative().nullable().optional()),
      outStationAllowanceMeal: z.preprocess(val => val === '' || val === null || val === undefined ? null : Number(val), z.number().nonnegative().nullable().optional()),
      miscellaneousAllowance10Percent: z.preprocess(val => val === '' || val === null || val === undefined ? null : Number(val), z.number().nonnegative().nullable().optional()),
      otherExpenses: z.preprocess(val => val === '' || val === null || val === undefined ? null : Number(val), z.number().nonnegative().nullable().optional()),
    })
  ).min(1),
  informationOnForeignExchangeRate: z.array(
    z.object({
      date: z.coerce.date(),
      typeOfCurrency: z.string().min(1),
      sellingRateTTOD: z.preprocess(val => val === '' || val === null || val === undefined ? null : Number(val), z.number().nonnegative().nullable().optional()),
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  console.log(`API_CLAIMS_GET_BY_ID_START (PostgreSQL): Fetching claim details for ID: ${claimId}`);
  
  if (!sql) {
    console.error("API_CLAIMS_GET_BY_ID_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  
  try {
    // Get main claim data
    const claimResult = await sql`
      SELECT * FROM expense_claims WHERE id = ${claimId}
    `;
    
    if (claimResult.length === 0) {
      return NextResponse.json({ error: `Claim with ID ${claimId} not found.` }, { status: 404 });
    }
    
    const claim = claimResult[0];
    
    // Get expense items
    const expenseItems = await sql`
      SELECT * FROM expense_claim_items WHERE claim_id = ${claimId} ORDER BY item_date ASC
    `;
    
    // Get foreign exchange rates
    const fxRates = await sql`
      SELECT * FROM expense_claim_fx_rates WHERE claim_id = ${claimId} ORDER BY fx_date ASC
    `;
    
    // Transform the data to match frontend expectations
    const claimData = {
      id: claim.id,
      headerDetails: {
        documentType: claim.document_type,
        documentNumber: claim.document_number,
        claimForMonthOf: claim.claim_for_month_of,
        staffName: claim.staff_name,
        staffNo: claim.staff_no,
        gred: claim.gred,
        staffType: claim.staff_type,
        executiveStatus: claim.executive_status,
        departmentCode: claim.department_code,
        deptCostCenterCode: claim.dept_cost_center_code,
        location: claim.location,
        telExt: claim.tel_ext,
        startTimeFromHome: claim.start_time_from_home,
        timeOfArrivalAtHome: claim.time_of_arrival_at_home
      },
      bankDetails: {
        bankName: claim.bank_name,
        accountNumber: claim.account_number,
        purposeOfClaim: claim.purpose_of_claim
      },
      medicalClaimDetails: {
        isMedicalClaim: claim.is_medical_claim,
        applicableMedicalType: claim.applicable_medical_type,
        isForFamily: claim.is_for_family,
        familyMemberSpouse: claim.family_member_spouse,
        familyMemberChildren: claim.family_member_children,
        familyMemberOther: claim.family_member_other
      },
      expenseItems: expenseItems.map(item => ({
        id: item.id,
        date: item.item_date,
        claimOrTravelDetails: item.claim_or_travel_details,
        officialMileageKM: item.official_mileage_km,
        transport: item.transport,
        hotelAccommodationAllowance: item.hotel_accommodation_allowance,
        outStationAllowanceMeal: item.out_station_allowance_meal,
        miscellaneousAllowance10Percent: item.miscellaneous_allowance_10_percent,
        otherExpenses: item.other_expenses
      })),
      informationOnForeignExchangeRate: fxRates.map(fx => ({
        id: fx.id,
        date: fx.fx_date,
        typeOfCurrency: fx.type_of_currency,
        sellingRateTTOD: fx.selling_rate_tt_od
      })),
      financialSummary: {
        totalAdvanceClaimAmount: claim.total_advance_claim_amount,
        lessAdvanceTaken: claim.less_advance_taken,
        lessCorporateCreditCardPayment: claim.less_corporate_credit_card_payment,
        balanceClaimRepayment: claim.balance_claim_repayment,
        chequeReceiptNo: claim.cheque_receipt_no
      },
      declaration: {
        iDeclare: claim.i_declare,
        date: claim.declaration_date
      },
      status: claim.status,
      submittedAt: claim.submitted_at,
      reimbursementDetails: claim.reimbursement_details ? 
        (typeof claim.reimbursement_details === 'object' ? 
          claim.reimbursement_details : 
          JSON.parse(claim.reimbursement_details)) : null
    };

    // Get approval steps for this claim
    const completedApprovalSteps = await sql`
      SELECT 
        id,
        step_role as "stepRole", 
        step_name as "stepName",
        status,
        step_date as "stepDate",
        comments,
        created_at
      FROM claims_approval_steps
      WHERE claim_id = ${claimId}
      ORDER BY created_at ASC
    `;

    // Generate the complete approval workflow including expected pending steps
    const fullApprovalWorkflow = generateFullClaimApprovalWorkflow(
      claim.status,
      completedApprovalSteps,
      claim.requestor_name || claim.staff_name || 'Unknown'
    );

    claimData.approvalWorkflow = fullApprovalWorkflow;
    
    console.log(`API_CLAIMS_GET_BY_ID (PostgreSQL): Successfully fetched claim ${claimId}`);
    return NextResponse.json({ claimData });
    
  } catch (error: any) {
    console.error(`API_CLAIMS_GET_BY_ID_ERROR (PostgreSQL) for claim ${claimId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch claim details.', details: error.message }, { status: 500 });
  }
}

// Generate full approval workflow including pending steps (using TSR pattern)
function generateFullClaimApprovalWorkflow(
  currentStatus: string,
  completedSteps: any[],
  requestorName?: string
): any[] {
  // Define the expected workflow sequence for Claims (unified with other request types)
  const expectedWorkflow = [
    { role: 'Requestor', name: requestorName || 'System', status: 'Submitted' as const },
    { role: 'Department Focal', name: 'TBD', status: 'Pending' as const },
    { role: 'HOD', name: 'TBD', status: 'Pending' as const },
    { role: 'Finance', name: 'TBD', status: 'Pending' as const }
  ];

  // Map completed steps by role for easy lookup
  const completedByRole = completedSteps.reduce((acc: any, step: any) => {
    acc[step.stepRole] = step;
    return acc;
  }, {});

  // Generate the full workflow
  const fullWorkflow: any[] = [];

  for (const expectedStep of expectedWorkflow) {
    const completedStep = completedByRole[expectedStep.role];
    
    if (completedStep) {
      // Use the completed step data
      fullWorkflow.push({
        role: completedStep.stepRole || expectedStep.role,
        name: completedStep.stepName || expectedStep.name,
        status: completedStep.status as "Current" | "Pending" | "Approved" | "Rejected" | "Not Started" | "Cancelled" | "Submitted",
        date: completedStep.stepDate ? new Date(completedStep.stepDate) : undefined,
        comments: completedStep.comments || undefined
      });
    } else {
      // Determine status based on current request status and role
      let stepStatus: "Current" | "Pending" | "Approved" | "Rejected" | "Not Started" | "Cancelled" | "Submitted" = 'Pending';
      
      // Handle the initial requestor step
      if (expectedStep.role === 'Requestor') {
        stepStatus = 'Submitted';
      } else if (currentStatus === 'Pending Department Focal' && expectedStep.role === 'Department Focal') {
        stepStatus = 'Current';
      } else if (currentStatus === 'Pending Verification' && expectedStep.role === 'Department Focal') {
        stepStatus = 'Current'; // Legacy support for existing claims
      } else if (currentStatus === 'Pending HOD Approval' && expectedStep.role === 'HOD') {
        stepStatus = 'Current';
      } else if (currentStatus === 'Pending Finance Approval' && expectedStep.role === 'Finance') {
        stepStatus = 'Current';
      } else if (currentStatus === 'Rejected') {
        stepStatus = 'Pending'; // Keep as Pending for not-yet-reached steps
      } else if (currentStatus === 'Cancelled') {
        stepStatus = 'Cancelled'; // Mark all steps as cancelled for cancelled claims
      } else if (currentStatus === 'Approved' || currentStatus === 'Processed') {
        // For approved/processed claims, all approval steps should be marked as approved
        // since the claim went through the full approval process to reach this status
        if (expectedStep.role !== 'Requestor') {
          stepStatus = 'Approved';
        } else {
          stepStatus = 'Submitted';
        }
      } else {
        stepStatus = 'Pending';
      }

      // For approved/processed claims, provide more realistic names instead of "To be assigned"
      let stepName = expectedStep.name;
      if (stepName === 'TBD' && (currentStatus === 'Approved' || currentStatus === 'Processed')) {
        switch (expectedStep.role) {
          case 'Department Focal':
            stepName = 'Department Focal';
            break;
          case 'HOD':
            stepName = 'Head of Department';
            break;
          case 'Finance':
            stepName = 'Finance Department';
            break;
          default:
            stepName = 'To be assigned';
        }
      } else if (stepName === 'TBD') {
        stepName = 'To be assigned';
      }

      fullWorkflow.push({
        role: expectedStep.role,
        name: stepName,
        status: stepStatus,
        date: undefined,
        comments: stepStatus === 'Approved' ? 'Approved during workflow processing' : undefined
      });
    }
  }

  // Add any cancellation steps to the end of the workflow
  const cancellationSteps = completedSteps.filter(step => step.stepRole === 'Cancelled By');
  for (const cancelStep of cancellationSteps) {
    fullWorkflow.push({
      role: cancelStep.stepRole,
      name: cancelStep.stepName || 'User',
      status: 'Cancelled',
      date: cancelStep.stepDate ? new Date(cancelStep.stepDate) : undefined,
      comments: cancelStep.comments || 'Claim was cancelled'
    });
  }

  return fullWorkflow;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  console.log("API_CLAIMS_PUT_START (PostgreSQL): Revising expense claim.");
  if (!sql) {
    console.error("API_CLAIMS_PUT_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  console.log("API_CLAIMS_PUT: SQL client is initialized.");

  try {
    console.log("API_CLAIMS_PUT: Processing claim ID:", claimId);

    if (!claimId) {
      console.error("API_CLAIMS_PUT_ERROR: Missing claim ID");
      return NextResponse.json({ error: 'Claim ID is required for revision.' }, { status: 400 });
    }

    // Check if claim exists before attempting update
    const [existingClaim] = await sql`SELECT id FROM expense_claims WHERE id = ${claimId}`;
    if (!existingClaim) {
      console.error(`API_CLAIMS_PUT_ERROR: Claim with ID ${claimId} not found`);
      return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
    }
    console.log("API_CLAIMS_PUT: Claim exists, proceeding with update");

    let body;
    try {
      body = await request.json();
      console.log("API_CLAIMS_PUT: Request body parsed successfully");
    } catch (parseError) {
      console.error("API_CLAIMS_PUT_ERROR: Failed to parse request body:", parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }
    
    console.log("API_CLAIMS_PUT (PostgreSQL): Received raw body for revision:", JSON.stringify(body).substring(0, 500) + "...");
    
    // Use the same schema for validation as POST, but make documentNumber optional for PUT
    const expenseClaimUpdateSchema = expenseClaimCreateSchema.extend({
      headerDetails: expenseClaimCreateSchema.shape.headerDetails.extend({
        documentNumber: z.string().optional(), // Document number might not be sent for update
      }),
    });

    const validationResult = expenseClaimUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_CLAIMS_PUT_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const data = validationResult.data;
    const { headerDetails, bankDetails, medicalClaimDetails, expenseItems, informationOnForeignExchangeRate, financialSummary, declaration, trfId } = data;

    console.log("API_CLAIMS_PUT: Starting database transaction");
    await sql.begin(async tx => {
      try {
        console.log("API_CLAIMS_PUT: Updating main expense_claims table");
        // Update main expense_claims table
        const [updatedClaim] = await tx`
          UPDATE expense_claims
          SET
            trf_id = ${trfId || null},
            document_type = ${headerDetails.documentType || null},
            claim_for_month_of = ${formatISO(headerDetails.claimForMonthOf, {representation: 'date'})},
            staff_name = ${headerDetails.staffName},
            staff_no = ${headerDetails.staffNo},
            gred = ${headerDetails.gred},
            staff_type = ${headerDetails.staffType || null},
            executive_status = ${headerDetails.executiveStatus || null},
            department_code = ${headerDetails.departmentCode},
            dept_cost_center_code = ${headerDetails.deptCostCenterCode},
            location = ${headerDetails.location},
            tel_ext = ${headerDetails.telExt},
            start_time_from_home = ${headerDetails.startTimeFromHome},
            time_of_arrival_at_home = ${headerDetails.timeOfArrivalAtHome},
            bank_name = ${bankDetails.bankName},
            account_number = ${bankDetails.accountNumber},
            purpose_of_claim = ${bankDetails.purposeOfClaim},
            is_medical_claim = ${medicalClaimDetails.isMedicalClaim},
            applicable_medical_type = ${medicalClaimDetails.applicableMedicalType || null},
            is_for_family = ${medicalClaimDetails.isForFamily},
            family_member_spouse = ${medicalClaimDetails.familyMemberSpouse},
            family_member_children = ${medicalClaimDetails.familyMemberChildren},
            family_member_other = ${medicalClaimDetails.familyMemberOther || null},
            total_advance_claim_amount = ${financialSummary.totalAdvanceClaimAmount === null ? null : Number(financialSummary.totalAdvanceClaimAmount)},
            less_advance_taken = ${financialSummary.lessAdvanceTaken === null ? null : Number(financialSummary.lessAdvanceTaken)},
            less_corporate_credit_card_payment = ${financialSummary.lessCorporateCreditCardPayment === null ? null : Number(financialSummary.lessCorporateCreditCardPayment)},
            balance_claim_repayment = ${financialSummary.balanceClaimRepayment === null ? null : Number(financialSummary.balanceClaimRepayment)},
            cheque_receipt_no = ${financialSummary.chequeReceiptNo || null},
            i_declare = ${declaration.iDeclare},
            declaration_date = ${formatISO(declaration.date, {representation: 'date'})},
            updated_at = NOW()
          WHERE id = ${claimId}
          RETURNING id;
        `;
        console.log("API_CLAIMS_PUT: Main claim update result:", updatedClaim);

        if (!updatedClaim || updatedClaim.length === 0) {
          throw new Error('Claim not found or not updated.');
        }

        // Delete existing expense items and insert new ones
        console.log("API_CLAIMS_PUT: Deleting existing expense items for claim ID:", claimId);
        await tx`DELETE FROM expense_claim_items WHERE claim_id = ${claimId}`;
        
        if (expenseItems && expenseItems.length > 0) {
          console.log("API_CLAIMS_PUT: Inserting", expenseItems.length, "expense items");
          const itemsToInsert = expenseItems.map(item => {
            // Handle claimOrTravelDetails - convert object to string if needed
            let claimDetails = item.claimOrTravelDetails;
            if (typeof claimDetails === 'object' && claimDetails !== null) {
              const parts = [];
              if (claimDetails.from) parts.push(claimDetails.from);
              if (claimDetails.to) parts.push(claimDetails.to);
              if (claimDetails.placeOfStay) parts.push(claimDetails.placeOfStay);
              claimDetails = parts.join(' - ');
            }
            
            // Ensure all numeric values are properly converted to numbers
            const officialMileageKM = item.officialMileageKM === null || item.officialMileageKM === undefined ? null : Number(item.officialMileageKM);
            const transport = item.transport === null || item.transport === undefined ? null : Number(item.transport);
            const hotelAccommodationAllowance = item.hotelAccommodationAllowance === null || item.hotelAccommodationAllowance === undefined ? null : Number(item.hotelAccommodationAllowance);
            const outStationAllowanceMeal = item.outStationAllowanceMeal === null || item.outStationAllowanceMeal === undefined ? null : Number(item.outStationAllowanceMeal);
            const miscellaneousAllowance10Percent = item.miscellaneousAllowance10Percent === null || item.miscellaneousAllowance10Percent === undefined ? null : Number(item.miscellaneousAllowance10Percent);
            const otherExpenses = item.otherExpenses === null || item.otherExpenses === undefined ? null : Number(item.otherExpenses);
            
            return {
              claim_id: claimId,
              item_date: item.date ? formatISO(item.date, { representation: 'date' }) : null,
              claim_or_travel_details: claimDetails || '',
              official_mileage_km: officialMileageKM,
              transport: transport,
              hotel_accommodation_allowance: hotelAccommodationAllowance,
              out_station_allowance_meal: outStationAllowanceMeal,
              miscellaneous_allowance_10_percent: miscellaneousAllowance10Percent,
              other_expenses: otherExpenses,
            };
          });
          console.log("API_CLAIMS_PUT: First expense item sample:", JSON.stringify(itemsToInsert[0]).substring(0, 200));
          await tx`INSERT INTO expense_claim_items ${tx(itemsToInsert, 'claim_id', 'item_date', 'claim_or_travel_details', 'official_mileage_km', 'transport', 'hotel_accommodation_allowance', 'out_station_allowance_meal', 'miscellaneous_allowance_10_percent', 'other_expenses')}`;
          console.log("API_CLAIMS_PUT: Expense items inserted successfully");
        } else {
          console.log("API_CLAIMS_PUT: No expense items to insert");
        }

        // Delete existing FX rates and insert new ones
        console.log("API_CLAIMS_PUT: Deleting existing FX rates for claim ID:", claimId);
        await tx`DELETE FROM expense_claim_fx_rates WHERE claim_id = ${claimId}`;
        
        if (informationOnForeignExchangeRate && informationOnForeignExchangeRate.length > 0) {
          console.log("API_CLAIMS_PUT: Inserting", informationOnForeignExchangeRate.length, "FX rates");
          const fxToInsert = informationOnForeignExchangeRate.map(fx => ({
            claim_id: claimId,
            fx_date: fx.date ? formatISO(fx.date, { representation: 'date' }) : null,
            type_of_currency: fx.typeOfCurrency,
            selling_rate_tt_od: fx.sellingRateTTOD === null ? null : Number(fx.sellingRateTTOD),
          }));
          await tx`INSERT INTO expense_claim_fx_rates ${tx(fxToInsert, 'claim_id', 'fx_date', 'type_of_currency', 'selling_rate_tt_od')}`;
          console.log("API_CLAIMS_PUT: FX rates inserted successfully");
        } else {
          console.log("API_CLAIMS_PUT: No FX rates to insert");
        }
        
        // Add "Edited" approval step to track the revision (matches TSR pattern)
        const requestorNameVal = headerDetails.staffName || 'Unknown';
        console.log("API_CLAIMS_PUT: Clearing non-requestor approval steps and adding 'Edited' step");
        await tx`DELETE FROM claims_approval_steps WHERE claim_id = ${claimId} AND step_role != 'Requestor'`;
        await tx`
          INSERT INTO claims_approval_steps (claim_id, step_role, step_name, status, step_date, comments)
          VALUES (${claimId}, 'Requestor', ${requestorNameVal}, 'Edited', NOW(), 'Claim Edited and Resubmitted.')
        `;
        
        console.log("API_CLAIMS_PUT: Transaction completed successfully");
      } catch (txError) {
        console.error("API_CLAIMS_PUT_TX_ERROR:", txError);
        throw txError; // Re-throw to be caught by the outer try-catch
      }
    });
    
    console.log("API_CLAIMS_PUT (PostgreSQL): Expense claim revised successfully:", claimId);
    return NextResponse.json({ message: 'Expense claim revised successfully!', claimId: claimId }, { status: 200 });
  } catch (error: any) {
    console.error("API_CLAIMS_PUT_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to revise expense claim.', details: error.message }, { status: 500 });
  }
}

// DELETE /api/claims/[claimId] - Delete a claim
export async function DELETE(request: NextRequest, { params }: { params: { claimId: string } }) {
  const { claimId } = params;
  
  if (!claimId) {
    return NextResponse.json({ error: 'Claim ID is required' }, { status: 400 });
  }

  console.log("API_CLAIMS_DELETE: Deleting claim with ID:", claimId);

  try {
    // Use transaction to ensure all related data is deleted atomically
    await sql.begin(async tx => {
      // First check if claim exists and get its status
      const claimCheck = await tx`
        SELECT id, status, document_number FROM expense_claims WHERE id = ${claimId}
      `;

      if (claimCheck.length === 0) {
        throw new Error(`Claim with ID ${claimId} not found`);
      }

      const claim = claimCheck[0];
      
      // Only allow deletion of certain statuses (same as DELETABLE_STATUSES in frontend)
      const deletableStatuses = ['Draft', 'Pending Department Focal', 'Pending Verification', 'Rejected'];
      if (!deletableStatuses.includes(claim.status)) {
        throw new Error(`Cannot delete claim with status: ${claim.status}. Only drafts, pending verification, and rejected claims can be deleted.`);
      }

      console.log(`API_CLAIMS_DELETE: Deleting claim ${claim.document_number} with status ${claim.status}`);

      // Delete related records first (foreign key constraints)
      await tx`DELETE FROM expense_claim_fx_rates WHERE claim_id = ${claimId}`;
      await tx`DELETE FROM expense_claim_items WHERE claim_id = ${claimId}`;
      await tx`DELETE FROM claims_approval_steps WHERE claim_id = ${claimId}`;
      
      // Finally delete the main claim record
      await tx`DELETE FROM expense_claims WHERE id = ${claimId}`;
      
      console.log("API_CLAIMS_DELETE: Claim and all related data deleted successfully");
    });

    return NextResponse.json({ 
      message: 'Claim deleted successfully',
      claimId: claimId 
    }, { status: 200 });

  } catch (error: any) {
    console.error("API_CLAIMS_DELETE_ERROR:", error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to delete claim', 
      details: error.message 
    }, { status: 500 });
  }
}
