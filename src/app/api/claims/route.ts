// src/app/api/claims/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db'; // Assuming PostgreSQL setup
import { formatISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { NotificationService } from '@/lib/notification-service';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';
import { generateUniversalUserFilter, generateUniversalUserFilterSQL, shouldBypassUserFilter } from '@/lib/universal-user-matching';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { generateRequestFingerprint, checkAndMarkRequest, markRequestCompleted } from '@/lib/request-deduplication';

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
      sellingRateTTOD: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative().optional()),
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


export const POST = withRateLimit(RATE_LIMITS.API_WRITE)(withAuth(async function(request: NextRequest) {
  console.log("API_CLAIMS_POST_START (PostgreSQL): Creating expense claim.");
  
  const session = (request as any).user;
  
  // Check if user has permission to create claims
  if (!hasPermission(session, 'create_claims')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    console.error("API_CLAIMS_POST_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  let requestFingerprint: string | undefined;

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
    
    // Check for duplicate submission using request deduplication
    requestFingerprint = generateRequestFingerprint(
      session.id,
      'claims_submission',
      {
        staffName: headerDetails.staffName,
        documentType: headerDetails.documentType,
        purposeOfClaim: bankDetails.purposeOfClaim,
        claimForMonthOf: headerDetails.claimForMonthOf.toISOString(),
        totalAmount: financialSummary.totalAdvanceClaimAmount
      }
    );

    const deduplicationResult = checkAndMarkRequest(requestFingerprint, 30000); // 30 seconds TTL
    if (deduplicationResult.isDuplicate) {
      console.warn(`API_CLAIMS_POST_DUPLICATE: Duplicate claims submission detected for user ${session.id}. Time remaining: ${deduplicationResult.timeRemaining}s`);
      return NextResponse.json({ 
        error: 'Duplicate submission detected', 
        message: `Please wait ${deduplicationResult.timeRemaining} seconds before submitting again.`,
        details: 'You recently submitted a similar expense claim. To prevent duplicates, please wait before trying again.'
      }, { status: 429 });
    }
    
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
          i_declare, declaration_date, status, submitted_at, created_at, updated_at, created_by
        ) VALUES (
          ${trfId || null}, ${headerDetails.documentType || null}, ${claimRequestId}, ${formatISO(headerDetails.claimForMonthOf, {representation: 'date'})},
          ${headerDetails.staffName}, ${headerDetails.staffNo}, ${headerDetails.gred}, ${headerDetails.staffType || null},
          ${headerDetails.executiveStatus || null}, ${headerDetails.departmentCode}, ${headerDetails.deptCostCenterCode},
          ${headerDetails.location}, ${headerDetails.telExt}, ${headerDetails.startTimeFromHome},
          ${headerDetails.timeOfArrivalAtHome}, ${bankDetails.bankName}, ${bankDetails.accountNumber},
          ${bankDetails.purposeOfClaim}, ${medicalClaimDetails.isMedicalClaim}, ${medicalClaimDetails.applicableMedicalType || null},
          ${medicalClaimDetails.isForFamily}, ${medicalClaimDetails.familyMemberSpouse}, ${medicalClaimDetails.familyMemberChildren},
          ${medicalClaimDetails.familyMemberOther || null}, ${financialSummary.totalAdvanceClaimAmount === null ? null : Number(financialSummary.totalAdvanceClaimAmount)},
          ${financialSummary.lessAdvanceTaken === null ? null : Number(financialSummary.lessAdvanceTaken)}, ${financialSummary.lessCorporateCreditCardPayment === null ? null : Number(financialSummary.lessCorporateCreditCardPayment)},
          ${financialSummary.balanceClaimRepayment === null ? null : Number(financialSummary.balanceClaimRepayment)}, ${financialSummary.chequeReceiptNo || null},
          ${declaration.iDeclare}, ${formatISO(declaration.date, {representation: 'date'})}, 'Pending Department Focal', NOW(), NOW(), NOW(), ${session.id || session.email}
        ) RETURNING id
      `;

      const claimId = claim.id;

      if (expenseItems && expenseItems.length > 0) {
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
          
          return {
            claim_id: claimId,
            item_date: item.date ? formatISO(item.date, { representation: 'date' }) : null,
            claim_or_travel_details: claimDetails || '',
            official_mileage_km: item.officialMileageKM === null || item.officialMileageKM === undefined ? null : Number(item.officialMileageKM),
            transport: item.transport === null || item.transport === undefined ? null : Number(item.transport),
            hotel_accommodation_allowance: item.hotelAccommodationAllowance === null || item.hotelAccommodationAllowance === undefined ? null : Number(item.hotelAccommodationAllowance),
            out_station_allowance_meal: item.outStationAllowanceMeal === null || item.outStationAllowanceMeal === undefined ? null : Number(item.outStationAllowanceMeal),
            miscellaneous_allowance_10_percent: item.miscellaneousAllowance10Percent === null || item.miscellaneousAllowance10Percent === undefined ? null : Number(item.miscellaneousAllowance10Percent),
            other_expenses: item.otherExpenses === null || item.otherExpenses === undefined ? null : Number(item.otherExpenses),
          };
        });
        await tx`INSERT INTO expense_claim_items ${tx(itemsToInsert, 'claim_id', 'item_date', 'claim_or_travel_details', 'official_mileage_km', 'transport', 'hotel_accommodation_allowance', 'out_station_allowance_meal', 'miscellaneous_allowance_10_percent', 'other_expenses')}`;
      }

      if (informationOnForeignExchangeRate && informationOnForeignExchangeRate.length > 0) {
        const fxToInsert = informationOnForeignExchangeRate.map(fx => ({
          claim_id: claimId,
          fx_date: fx.date ? formatISO(fx.date, { representation: 'date' }) : null,
          type_of_currency: fx.typeOfCurrency,
          selling_rate_tt_od: fx.sellingRateTTOD === null ? null : Number(fx.sellingRateTTOD),
        }));
        await tx`INSERT INTO expense_claim_fx_rates ${tx(fxToInsert, 'claim_id', 'fx_date', 'type_of_currency', 'selling_rate_tt_od')}`;
      }
      
      // Create initial approval step (matches TSR pattern)
      const requestorNameVal = data.headerDetails.staffName || 'Unknown';
      console.log("API_CLAIMS_POST (PostgreSQL): Inserting initial approval step for Claim ID:", claimId);
      await tx`
        INSERT INTO claims_approval_steps (claim_id, step_role, step_name, status, step_date, comments)
        VALUES (${claimId}, 'Requestor', ${requestorNameVal}, 'Submitted', NOW(), 'Submitted expense claim.')
      `;
      
      return claimId;
    });

    // Mark deduplication request as completed (successful submission)
    markRequestCompleted(requestFingerprint);
    
    console.log("API_CLAIMS_POST (PostgreSQL): Expense claim created successfully:", newClaim);
    console.log("API_CLAIMS_POST (PostgreSQL): Generated claim ID:", claimRequestId);
    
    // Return response immediately, then process notifications asynchronously
    const response = NextResponse.json({ 
      message: 'Expense claim submitted successfully!', 
      claimId: newClaim,
      requestId: claimRequestId 
    }, { status: 201 });

    // Process notifications asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🔔 CLAIMS_NOTIFICATION: Starting async notification process for claim ${claimRequestId}`);
        
        await UnifiedNotificationService.notifySubmission({
          entityType: 'claims',
          entityId: claimRequestId,
          requestorId: session.id,
          requestorName: data.headerDetails.staffName,
          requestorEmail: session.email,
          department: data.headerDetails.departmentCode,
          entityTitle: `${data.headerDetails.documentType} - ${data.bankDetails.purposeOfClaim}`,
          entityAmount: data.financialSummary.totalAdvanceClaimAmount.toString(),
          entityDates: formatISO(data.headerDetails.claimForMonthOf, {representation: 'date'})
        });
        
        console.log(`✅ CLAIMS_NOTIFICATION: Sent async workflow notifications for claim ${claimRequestId}`);
      } catch (notificationError) {
        console.error(`❌ CLAIMS_NOTIFICATION: Error sending async notifications for claim ${claimRequestId}:`, notificationError);
        // Notification failures don't affect the submitted claim
      }
    });

    console.log("API_CLAIMS_POST (PostgreSQL): Claims submission completed successfully:", claimRequestId);
    return response;
  } catch (error: any) {
    // Clean up deduplication on error
    if (requestFingerprint) {
      markRequestCompleted(requestFingerprint);
    }
    
    console.error("API_CLAIMS_POST_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to create expense claim.', details: error.message }, { status: 500 });
  }
}));

export const GET = withRateLimit(RATE_LIMITS.API_READ)(withAuth(async function(request: NextRequest) {
  console.log("API_CLAIMS_GET_START (PostgreSQL): Fetching claims.");
  
  const session = (request as any).user;
  
  // Role-based access control - authenticated users can access claims (they'll see filtered data based on role)
  console.log(`API_CLAIMS_GET: User ${session.role} (${session.email}) accessing claims data`);
  
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  
  // Parse query parameters for filtering
  const { searchParams } = new URL(request.url);
  const statusesParam = searchParams.get('statuses');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  try {
    console.log("Executing SQL query to fetch claims");
    let query;
    
    // Build query with conditions  
    const userIdentifier = getUserIdentifier(session);
    
    console.log("Session data:", { 
      role: session.role, 
      name: session.name, 
      userId: userIdentifier.userId,
      staffId: userIdentifier.staffId, 
      email: userIdentifier.email 
    });
    
    if (statusesParam) {
      // Split the comma-separated statuses and filter claims
      const statusesArray = statusesParam.split(',').map(s => s.trim());
      console.log("Filtering claims by statuses:", statusesArray);
      
      if (shouldBypassUserFilter(session, statusesParam)) {
        console.log(`API_CLAIMS_GET (PostgreSQL): Admin ${session.role} viewing approval queue - no user filter`);
        query = sql`
          SELECT id, document_number, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
          FROM expense_claims 
          WHERE status = ANY(${statusesArray})
          ORDER BY submitted_at DESC
          LIMIT ${limit}
        `;
      } else {
        console.log(`API_CLAIMS_GET (PostgreSQL): User ${session.role} viewing own claims with universal filtering`);
        
        // Use a simpler approach with direct condition matching
        if (!session.name && !session.id && !session.email && !userIdentifier.staffId) {
          console.log("No user identifiers available, returning empty result");
          query = sql`
            SELECT id, document_number, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
            FROM expense_claims 
            WHERE FALSE
          `;
        } else {
          // Use a simpler approach with direct condition matching
          query = sql`
            SELECT id, document_number, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
            FROM expense_claims 
            WHERE status = ANY(${statusesArray}) 
              AND (staff_name = ${session.name || ''} 
                   OR created_by = ${session.id || ''} 
                   OR created_by = ${session.email || ''}
                   OR staff_no = ${userIdentifier.staffId || ''})
            ORDER BY submitted_at DESC
            LIMIT ${limit}
          `;
        }
      }
    } else {
      if (shouldBypassUserFilter(session, statusesParam)) {
        console.log(`API_CLAIMS_GET (PostgreSQL): Admin ${session.role} viewing all claims - no user filter`);
        query = sql`
          SELECT id, document_number, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
          FROM expense_claims 
          ORDER BY submitted_at DESC
          LIMIT ${limit}
        `;
      } else {
        console.log(`API_CLAIMS_GET (PostgreSQL): User ${session.role} viewing own claims with universal filtering`);
        
        // Use a simpler approach with direct condition matching
        if (!session.name && !session.id && !session.email && !userIdentifier.staffId) {
          console.log("No user identifiers available, returning empty result");
          query = sql`
            SELECT id, document_number, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
            FROM expense_claims 
            WHERE FALSE
          `;
        } else {
          // Use a simpler approach with direct condition matching
          query = sql`
            SELECT id, document_number, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
            FROM expense_claims 
            WHERE (staff_name = ${session.name || ''} 
                   OR created_by = ${session.id || ''} 
                   OR created_by = ${session.email || ''}
                   OR staff_no = ${userIdentifier.staffId || ''})
            ORDER BY submitted_at DESC
            LIMIT ${limit}
          `;
        }
      }
    }
    
    const claims = await query;
    
    console.log(`Found ${claims.length} claims in database`);
    if (claims.length > 0) {
      console.log('First raw claim from DB:', JSON.stringify(claims[0], null, 2));
    }
    
    const formattedClaims = claims.map(claim => ({
        id: claim.id,
        document_number: claim.document_number, // Include document_number in the response
        requestor: claim.staff_name, // For consistency with admin claims page display
        purpose: claim.purpose_of_claim,
        amount: Number(claim.total_advance_claim_amount) || 0, // Ensure it's a number
        status: claim.status || 'Pending Verification',
        submittedDate: claim.submitted_at ? formatISO(new Date(claim.submitted_at)) : formatISO(new Date()),
    }));
    
    console.log('Formatted claims for response:', JSON.stringify(formattedClaims, null, 2));
    
    // For consistency with the Unified Approval Queue, return both formats
    if (statusesParam) {
      // When filtering by status (for Unified Approval Queue), wrap in claims object
      return NextResponse.json({ claims: formattedClaims });
    } else {
      // Default behavior for backward compatibility
      return NextResponse.json(formattedClaims);
    }
  } catch (error: any) {
    console.error("API_CLAIMS_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch claims.', details: error.message }, { status: 500 });
  }
}));
