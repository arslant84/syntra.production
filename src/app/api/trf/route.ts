// src/app/api/trf/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO, parseISO, isValid } from 'date-fns';
import { mapFrontendItineraryToDb } from './itinerary-fix';
import { generateRequestId } from '@/utils/requestIdGenerator';
import { TSRAutoGenerationService } from '@/lib/tsr-auto-generation-service';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { NotificationService } from '@/lib/notification-service';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';
import { hasPermission } from '@/lib/session-utils';
import { generateUniversalUserFilterSQL, shouldBypassUserFilter } from '@/lib/universal-user-matching';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { generateRequestFingerprint, checkAndMarkRequest, markRequestCompleted } from '@/lib/request-deduplication';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Schemas for validating specific parts of the TRF data
const requestorInfoSchema = z.object({
    requestorName: z.string().min(1, "Full name is required"),
    staffId: z.string().min(1, "Staff ID is required").optional().nullable(),
    department: z.string().min(1, "Department is required").optional().nullable(),
    position: z.string().optional().nullable(),
    costCenter: z.string().min(1, "Cost Center is required").optional().nullable(),
    telEmail: z.string().min(1, "Tel/Email is required").optional().nullable(),
    email: z.string().email("Invalid email format").optional().nullable().or(z.literal('')),
});

const externalPartyRequestorInfoSchema = z.object({
    externalFullName: z.string().min(1, "Full name is required"),
    externalOrganization: z.string().min(1, "Organization is required"),
    externalRefToAuthorityLetter: z.string().min(1, "Authority letter reference is required"),
    externalCostCenter: z.string().min(1, "Cost center is required"),
});

const itinerarySegmentSchemaDb = z.object({
  id: z.string().optional(),
  date: z.coerce.date({invalid_type_error: "Invalid date format for itinerary segment."}).nullable(),
  day: z.string().optional().transform(val => val || ""),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  etd: z.string().regex(timeRegex, "Invalid ETD (HH:MM)").optional().nullable().or(z.literal("")),
  eta: z.string().regex(timeRegex, "Invalid ETA (HH:MM)").optional().nullable().or(z.literal("")),
  flightNumber: z.string().optional().transform(val => val || ""),
  remarks: z.string().optional().nullable(),
});

const dailyMealSelectionSchema = z.object({
  id: z.string().optional(),
  trf_id: z.string().optional(),
  meal_date: z.coerce.date({invalid_type_error: "Invalid meal date format."}),
  breakfast: z.boolean().default(false),
  lunch: z.boolean().default(false),
  dinner: z.boolean().default(false),
  supper: z.boolean().default(false),
  refreshment: z.boolean().default(false),
});

const mealProvisionSchemaDb = z.object({
  dateFromTo: z.string().optional().transform(val => val || ""),
  breakfast: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  lunch: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  dinner: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  supper: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  refreshment: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  // Daily meal selections (no longer using toggle)
  dailyMealSelections: z.array(dailyMealSelectionSchema).optional().default([]),
});

const accommodationDetailSchemaDb = z.object({
  id: z.string().optional(),
  accommodationType: z.enum(['Hotel/Отели', 'Staff House/PKC Kampung/Kiyanly camp', 'Other'], { required_error: "Accommodation type is required." }),
  otherTypeDescription: z.string().optional().nullable(),
  checkInDate: z.coerce.date({invalid_type_error: "Invalid check-in date format."}).nullable(),
  checkInTime: z.string().regex(timeRegex, "Invalid Check-in Time (HH:MM)").optional().nullable().or(z.literal("")),
  checkOutDate: z.coerce.date({invalid_type_error: "Invalid check-out date format."}).nullable(),
  checkOutTime: z.string().regex(timeRegex, "Invalid Check-out Time (HH:MM)").optional().nullable().or(z.literal("")),
  remarks: z.string().optional().nullable(),
  // Additional fields from DB schema
  location: z.string().optional().nullable(),
  fromDate: z.coerce.date().optional().nullable(),
  toDate: z.coerce.date().optional().nullable(),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().optional().nullable(),
  btNoRequired: z.string().optional().nullable(),
  accommodationTypeN: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  placeOfStay: z.string().optional().nullable(),
  estimatedCostPerNight: z.union([z.string(), z.number()]).optional().nullable(),
}).refine(data => data.accommodationType !== 'Other' || (data.accommodationType === 'Other' && data.otherTypeDescription && data.otherTypeDescription.trim().length > 0), {
  message: "Description for 'Other' accommodation type is required.",
  path: ["otherTypeDescription"],
});

const externalPartyAccommodationDetailSchemaDb = z.object({
  id: z.string().optional(),
  checkInDate: z.coerce.date({invalid_type_error: "Invalid check-in date format."}).nullable(),
  checkOutDate: z.coerce.date({invalid_type_error: "Invalid check-out date format."}).nullable(),
  placeOfStay: z.string().optional().transform(val => val || ""),
  estimatedCostPerNight: z.coerce.number().nonnegative("Must be non-negative").optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const companyTransportDetailSchemaDb = z.object({
  id: z.string().optional(),
  date: z.coerce.date({invalid_type_error: "Invalid date format for transport."}),
  day: z.string().optional().transform(val => val || ""),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  btNoRequired: z.string().optional().nullable(),
  accommodationTypeN: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const advanceBankDetailsSchemaDb = z.object({
  bankName: z.string().optional().transform(val => val || ""),
  accountNumber: z.string().optional().transform(val => val || ""),
});

const advanceAmountRequestedItemSchemaDb = z.object({
  id: z.string().optional(),
  dateFrom: z.coerce.date({invalid_type_error: "Invalid Date From format."}).nullable(),
  dateTo: z.coerce.date({invalid_type_error: "Invalid Date To format."}).nullable(),
  lh: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
  ma: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
  oa: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
  tr: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
  oe: z.coerce.number().nonnegative("Must be non-negative").optional().default(0),
  usd: z.coerce.number().nonnegative("USD amount must be non-negative").optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const domesticTrfDetailsSchema = z.object({
  purpose: z.string().min(5, "Purpose of travel must be at least 5 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1, "At least one itinerary segment is required."),
  mealProvision: mealProvisionSchemaDb,
  accommodationDetails: z.array(accommodationDetailSchemaDb).optional().default([]),
  companyTransportDetails: z.array(companyTransportDetailSchemaDb).optional().default([]),
});

const overseasTrfDetailsSchema = z.object({
  purpose: z.string().min(5, "Purpose of travel must be at least 5 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1, "At least one itinerary segment is required."),
  advanceBankDetails: advanceBankDetailsSchemaDb.optional(),  // Make optional to handle different form structures
  advanceAmountRequested: z.array(advanceAmountRequestedItemSchemaDb).optional().refine(
    (arr) => !arr || arr.length > 0, 
    "If advance amount is provided, at least one item is required."
  ),
});

const homeLeaveDetailsSchema = z.object({
  purpose: z.string().min(5, "Purpose of travel must be at least 5 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1, "At least one itinerary segment is required."),
  advanceBankDetails: advanceBankDetailsSchemaDb.optional(),  // Optional for home leave
  advanceAmountRequested: z.array(advanceAmountRequestedItemSchemaDb).optional(),  // Optional and no minimum requirement
});

const externalPartiesTrfDetailsSchema = z.object({
  purpose: z.string().min(5, "Purpose of travel must be at least 5 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1, "At least one itinerary segment is required."),
  accommodationDetails: z.array(externalPartyAccommodationDetailSchemaDb).optional().default([]),
  mealProvision: mealProvisionSchemaDb.optional(),
});

const baseTrfSchema = z.object({
  additionalComments: z.string().optional().nullable(),
  confirmPolicy: z.boolean().refine(val => val === true, { message: "Policy confirmation is required."}),
  confirmManagerApproval: z.boolean().refine(val => val === true, { message: "Manager approval confirmation is required."}),
  confirmTermsAndConditions: z.boolean().optional(),
  estimatedCost: z.number().optional().default(0),
});

const trfSubmissionSchema = z.discriminatedUnion("travelType", [
  baseTrfSchema.extend({ travelType: z.literal("Domestic"), requestorInfo: requestorInfoSchema, domesticTravelDetails: domesticTrfDetailsSchema }),
  baseTrfSchema.extend({ travelType: z.literal("Overseas"), requestorInfo: requestorInfoSchema, overseasTravelDetails: overseasTrfDetailsSchema }),
  baseTrfSchema.extend({ travelType: z.literal("Home Leave Passage"), requestorInfo: requestorInfoSchema, overseasTravelDetails: homeLeaveDetailsSchema }),
  baseTrfSchema.extend({ travelType: z.literal("External Parties"), externalPartyRequestorInfo: externalPartyRequestorInfoSchema, externalPartiesTravelDetails: externalPartiesTrfDetailsSchema }),
]);

export const POST = withRateLimit(RATE_LIMITS.API_WRITE)(withAuth(async function(request: NextRequest) {
  console.log("API_TRF_POST_START (PostgreSQL): Handler entered.");
  
  const session = (request as any).user;
  
  // Check if user has permission to create TRF
  if (!hasPermission(session, 'create_trf')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  let requestFingerprint: string | undefined;
  
  try {
    if (!sql) {
      console.error("API_TRF_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
      return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
    }
    
    let rawBody;
    try {
      rawBody = await request.json();
      console.log("API_TRF_POST (PostgreSQL): Received raw body:", JSON.stringify(rawBody).substring(0, 500) + "...");
      console.log("API_TRF_POST (PostgreSQL): estimatedCostPerNight in rawBody:", rawBody.externalPartiesTravelDetails?.accommodationDetails?.map((acc: any) => acc.estimatedCostPerNight));
    } catch (error) {
      console.error("API_TRF_POST_ERROR (PostgreSQL): Error parsing request body:", error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    // Log the initial travel type
    console.log(`API_TRF_POST (PostgreSQL): Processing ${rawBody.travelType} travel request`);

  // Check if the data needs restructuring (if it has top-level requestorName but no requestorInfo)
  let processedBody = rawBody;

  // Ensure requestorInfo is always an object
  processedBody.requestorInfo = processedBody.requestorInfo || {};
  // Move top-level requestor properties into requestorInfo
  processedBody.requestorInfo.requestorName = processedBody.requestorName || processedBody.requestorInfo.requestorName || '';
  processedBody.requestorInfo.staffId = processedBody.staffId || processedBody.requestorInfo.staffId || null;
  processedBody.requestorInfo.department = processedBody.department || processedBody.requestorInfo.department || null;
  processedBody.requestorInfo.position = processedBody.position || processedBody.requestorInfo.position || null;
  processedBody.requestorInfo.costCenter = processedBody.costCenter || processedBody.requestorInfo.costCenter || null;
  processedBody.requestorInfo.telEmail = processedBody.telEmail || processedBody.requestorInfo.telEmail || null;
  processedBody.requestorInfo.email = processedBody.email || processedBody.requestorInfo.email || '';

  // Ensure externalPartyRequestorInfo is always an object
  processedBody.externalPartyRequestorInfo = processedBody.externalPartyRequestorInfo || {};
  // Move top-level external party requestor properties into externalPartyRequestorInfo
  processedBody.externalPartyRequestorInfo.externalFullName = processedBody.externalFullName || processedBody.externalPartyRequestorInfo.externalFullName || '';
  processedBody.externalPartyRequestorInfo.externalOrganization = processedBody.externalOrganization || processedBody.externalPartyRequestorInfo.externalOrganization || '';
  processedBody.externalPartyRequestorInfo.externalRefToAuthorityLetter = processedBody.externalRefToAuthorityLetter || processedBody.externalPartyRequestorInfo.externalRefToAuthorityLetter || '';
  processedBody.externalPartyRequestorInfo.externalCostCenter = processedBody.externalCostCenter || processedBody.externalPartyRequestorInfo.externalCostCenter || '';

  // Handle travel details based on type
  if (processedBody.travelType === "Domestic") {
    processedBody.domesticTravelDetails = processedBody.domesticTravelDetails || {};
    processedBody.domesticTravelDetails.purpose = processedBody.purpose || processedBody.domesticTravelDetails.purpose || "";
    processedBody.domesticTravelDetails.itinerary = processedBody.itinerary || processedBody.domesticTravelDetails.itinerary || [];
    processedBody.domesticTravelDetails.mealProvision = processedBody.mealProvision || processedBody.domesticTravelDetails.mealProvision || {};
    processedBody.domesticTravelDetails.accommodationDetails = processedBody.accommodationDetails || processedBody.domesticTravelDetails.accommodationDetails || [];
    processedBody.domesticTravelDetails.companyTransportDetails = processedBody.companyTransportDetails || processedBody.domesticTravelDetails.companyTransportDetails || [];
  } else if (processedBody.travelType === "Overseas" || processedBody.travelType === "Home Leave Passage") {
    processedBody.overseasTravelDetails = processedBody.overseasTravelDetails || {};
    processedBody.overseasTravelDetails.purpose = processedBody.purpose || processedBody.overseasTravelDetails.purpose || "";
    processedBody.overseasTravelDetails.itinerary = processedBody.itinerary || processedBody.overseasTravelDetails.itinerary || [];
    processedBody.overseasTravelDetails.advanceBankDetails = processedBody.advanceBankDetails || processedBody.overseasTravelDetails.advanceBankDetails || {};
    processedBody.overseasTravelDetails.advanceAmountRequested = processedBody.advanceAmountRequested || processedBody.overseasTravelDetails.advanceAmountRequested || [];
  } else if (processedBody.travelType === "External Parties") {
    processedBody.externalPartiesTravelDetails = processedBody.externalPartiesTravelDetails || {};
    processedBody.externalPartiesTravelDetails.purpose = processedBody.purpose || processedBody.externalPartiesTravelDetails.purpose || "";
    processedBody.externalPartiesTravelDetails.itinerary = processedBody.itinerary || processedBody.externalPartiesTravelDetails.itinerary || [];
    processedBody.externalPartiesTravelDetails.accommodationDetails = processedBody.accommodationDetails || processedBody.externalPartiesTravelDetails.accommodationDetails || [];
    processedBody.externalPartiesTravelDetails.mealProvision = processedBody.mealProvision || processedBody.externalPartiesTravelDetails.mealProvision || {};
  }

  // Remove top-level properties that were moved into nested objects
  delete processedBody.requestorName;
  delete processedBody.staffId;
  delete processedBody.department;
  delete processedBody.position;
  delete processedBody.costCenter;
  delete processedBody.telEmail;
  delete processedBody.email;
  delete processedBody.externalFullName;
  delete processedBody.externalOrganization;
  delete processedBody.externalRefToAuthorityLetter;
  delete processedBody.externalCostCenter;
  delete processedBody.purpose;
  delete processedBody.itinerary;
  delete processedBody.advanceBankDetails;
  delete processedBody.advanceAmountRequested;
  delete processedBody.mealProvision;
  delete processedBody.accommodationDetails;
  delete processedBody.companyTransportDetails;

  // Log the processed body structure before validation
  console.log("API_TRF_POST (PostgreSQL): Processed body structure:", 
    JSON.stringify({
      travelType: processedBody.travelType,
      hasRequestorInfo: !!processedBody.requestorInfo,
      hasOverseasTravelDetails: !!processedBody.overseasTravelDetails,
      hasDomesticTravelDetails: !!processedBody.domesticTravelDetails,
      hasExternalPartyRequestorInfo: !!processedBody.externalPartyRequestorInfo,
      hasExternalPartiesTravelDetails: !!processedBody.externalPartiesTravelDetails
    }));

  const validationResult = trfSubmissionSchema.safeParse(processedBody);

  if (!validationResult.success) {
    console.error("API_TRF_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
    // Log more details about the validation error
    const errorDetails = validationResult.error.flatten();
    console.error("API_TRF_POST_VALIDATION_ERROR_DETAILS (PostgreSQL):", {
      formErrors: errorDetails.formErrors,
      fieldErrorKeys: Object.keys(errorDetails.fieldErrors),
      requestorInfoPresent: !!processedBody.requestorInfo,
      travelType: processedBody.travelType
    });
    return NextResponse.json({ error: "Validation failed", details: errorDetails }, { status: 400 });
  }
  console.log("API_TRF_POST (PostgreSQL): Validation successful.");
  const validatedData = validationResult.data;

  let requestorNameVal: string | null = null;
  let staffIdVal: string | null = null;
  let departmentVal: string | null = null;
  let positionVal: string | null = null;
  let costCenterVal: string | null = null;
  let telEmailVal: string | null = null;
  let emailVal: string | null = null;

  let externalFullNameVal: string | null = null;
  let externalOrganizationVal: string | null = null;
  let externalRefToAuthorityLetterVal: string | null = null;
  let externalCostCenterVal: string | null = null;
  
  let purposeVal: string = "";

  if (validatedData.travelType === "Domestic" || validatedData.travelType === "Overseas" || validatedData.travelType === "Home Leave Passage") {
    requestorNameVal = validatedData.requestorInfo.requestorName;
    staffIdVal = validatedData.requestorInfo.staffId || null;
    departmentVal = validatedData.requestorInfo.department || null;
    positionVal = validatedData.requestorInfo.position || null;
    costCenterVal = validatedData.requestorInfo.costCenter || null;
    telEmailVal = validatedData.requestorInfo.telEmail || null;
    emailVal = validatedData.requestorInfo.email || null;
    purposeVal = validatedData.travelType === "Domestic" ? validatedData.domesticTravelDetails.purpose : validatedData.overseasTravelDetails.purpose;
  } else if (validatedData.travelType === "External Parties") {
    externalFullNameVal = validatedData.externalPartyRequestorInfo.externalFullName;
    externalOrganizationVal = validatedData.externalPartyRequestorInfo.externalOrganization;
    externalRefToAuthorityLetterVal = validatedData.externalPartyRequestorInfo.externalRefToAuthorityLetter;
    externalCostCenterVal = validatedData.externalPartyRequestorInfo.externalCostCenter;
    purposeVal = validatedData.externalPartiesTravelDetails.purpose;
    // Use the submitting user's information for filtering purposes, not external party name
    requestorNameVal = session.name || session.email || 'External Party Submitter';
    staffIdVal = session.staffId || session.id || null;
    departmentVal = session.department || null;
  }

  // Check for duplicate submission using request deduplication
  requestFingerprint = generateRequestFingerprint(
    session.id,
    'trf_submission',
    {
      travelType: validatedData.travelType,
      requestorName: requestorNameVal,
      purpose: purposeVal,
      department: departmentVal,
      estimatedCost: validatedData.estimatedCost
    }
  );

  const deduplicationResult = checkAndMarkRequest(requestFingerprint, 30000); // 30 seconds TTL
  if (deduplicationResult.isDuplicate) {
    console.warn(`API_TRF_POST_DUPLICATE: Duplicate TRF submission detected for user ${session.id}. Time remaining: ${deduplicationResult.timeRemaining}s`);
    return NextResponse.json({ 
      error: 'Duplicate submission detected', 
      message: `Please wait ${deduplicationResult.timeRemaining} seconds before submitting again.`,
      details: 'You recently submitted a similar travel request. To prevent duplicates, please wait before trying again.'
    }, { status: 429 });
  }

  // Generate a unified request ID for the TRF
  // Use the destination from the first itinerary segment as context
  let contextForTrfId = 'TRF';
  if (validatedData.travelType === "Domestic") {
    const itinerary = validatedData.domesticTravelDetails.itinerary;
    if (itinerary && itinerary.length > 0 && itinerary[0].to) {
      contextForTrfId = itinerary[0].to.substring(0, 3).toUpperCase();
    }
  } else if (validatedData.travelType === "Overseas" || validatedData.travelType === "Home Leave Passage") {
    const itinerary = validatedData.overseasTravelDetails.itinerary;
    if (itinerary && itinerary.length > 0 && itinerary[0].to) {
      contextForTrfId = itinerary[0].to.substring(0, 3).toUpperCase();
    }
  } else if (validatedData.travelType === "External Parties") {
    const itinerary = validatedData.externalPartiesTravelDetails.itinerary;
    if (itinerary && itinerary.length > 0 && itinerary[0].to) {
      contextForTrfId = itinerary[0].to.substring(0, 3).toUpperCase();
    }
  }
  
  const trfRequestId = generateRequestId('TSR', contextForTrfId);
  console.log("API_TRF_POST (PostgreSQL): Generated TSR ID:", trfRequestId);
  
  try {
    console.log("API_TRF_POST (PostgreSQL): Starting database transaction for TRF ID:", trfRequestId);
    const resultTrfId = await sql.begin(async tx => {
      // Insert main TRF record
      console.log("API_TRF_POST (PostgreSQL): Inserting main TRF record.");
      const [mainTrf] = await tx`
        INSERT INTO travel_requests (
          id, requestor_name, staff_id, department, position, cost_center, tel_email, email,
          travel_type, status, purpose, additional_comments,
          external_full_name, external_organization, external_ref_to_authority_letter, external_cost_center,
          submitted_at, created_at, updated_at
        ) VALUES (
          ${trfRequestId}, ${requestorNameVal}, ${staffIdVal}, ${departmentVal}, ${positionVal}, ${costCenterVal}, ${telEmailVal}, ${emailVal},
          ${validatedData.travelType}, 'Pending Department Focal', ${purposeVal}, ${validatedData.additionalComments || null},
          ${externalFullNameVal}, ${externalOrganizationVal}, ${externalRefToAuthorityLetterVal}, ${externalCostCenterVal},
          NOW(), NOW(), NOW()
        ) RETURNING id
      `;
      const trfId = mainTrf.id;
      console.log("API_TRF_POST (PostgreSQL): Inserted into travel_requests, ID:", trfId);

      // Itinerary (common part)
      let itineraryToSave: any[] = [];
      if (validatedData.travelType === "Domestic") itineraryToSave = validatedData.domesticTravelDetails.itinerary;
      else if (validatedData.travelType === "Overseas" || validatedData.travelType === "Home Leave Passage") itineraryToSave = validatedData.overseasTravelDetails.itinerary;
      else if (validatedData.travelType === "External Parties") itineraryToSave = validatedData.externalPartiesTravelDetails.itinerary;

      // Insert itinerary segments
      console.log(`API_TRF_POST (PostgreSQL): Inserting ${itineraryToSave.length} itinerary segments.`);
      // Use our helper function to map frontend fields to database columns
      const itineraryInserts = itineraryToSave.map(segment => {
        // Format the date properly if it exists
        const segmentWithFormattedDate = {
          ...segment,
          date: segment.date ? formatISO(segment.date, { representation: 'date' }) : null
        };
        return mapFrontendItineraryToDb(segmentWithFormattedDate, trfId);
      });
      
      // Log the first itinerary segment to debug
      if (itineraryInserts.length > 0) {
        console.log(`API_TRF_POST (PostgreSQL): First itinerary segment fields:`, Object.keys(itineraryInserts[0]).join(', '));
      }
      
      await tx`INSERT INTO trf_itinerary_segments ${tx(itineraryInserts, 'trf_id', 'segment_date', 'day_of_week', 'from_location', 'to_location', 'departure_time', 'arrival_time', 'flight_number', 'purpose', 'flight_class')}`;
      console.log(`API_TRF_POST (PostgreSQL): Successfully inserted ${itineraryInserts.length} itinerary segments.`);
      
      // Handle meal provisions for all travel types that have them
      let mealProvisionData: any = null;
      if (validatedData.travelType === "Domestic") {
        mealProvisionData = validatedData.domesticTravelDetails.mealProvision;
      } else if (validatedData.travelType === "External Parties") {
        mealProvisionData = validatedData.externalPartiesTravelDetails.mealProvision;
      }
      
      if (mealProvisionData) {
        console.log("API_TRF_POST (PostgreSQL): Inserting meal provisions for TRF ID:", trfId);
        
        // Insert the main meal provision record
        await tx`INSERT INTO trf_meal_provisions (
          trf_id, 
          date_from_to, 
          breakfast, 
          lunch, 
          dinner, 
          supper, 
          refreshment
        ) VALUES (
          ${trfId}, 
          ${mealProvisionData.dateFromTo || ''}, 
          ${Number(mealProvisionData.breakfast || 0)}, 
          ${Number(mealProvisionData.lunch || 0)}, 
          ${Number(mealProvisionData.dinner || 0)}, 
          ${Number(mealProvisionData.supper || 0)}, 
          ${Number(mealProvisionData.refreshment || 0)}
        )`;
        
        // Insert daily meal selections if available
        if (mealProvisionData.dailyMealSelections && mealProvisionData.dailyMealSelections.length > 0) {
          console.log("API_TRF_POST (PostgreSQL): Inserting daily meal selections for TRF ID:", trfId);
          
          const dailyMealInserts = mealProvisionData.dailyMealSelections.map((selection: any) => ({
            trf_id: trfId,
            meal_date: formatISO(new Date(selection.meal_date), { representation: "date" }),
            breakfast: Boolean(selection.breakfast),
            lunch: Boolean(selection.lunch),
            dinner: Boolean(selection.dinner),
            supper: Boolean(selection.supper),
            refreshment: Boolean(selection.refreshment)
          }));
          
          await tx`INSERT INTO trf_daily_meal_selections ${tx(dailyMealInserts, "trf_id", "meal_date", "breakfast", "lunch", "dinner", "supper", "refreshment")}`;
          console.log("API_TRF_POST (PostgreSQL): Successfully inserted daily meal selections.");
        }
        
        console.log("API_TRF_POST (PostgreSQL): Successfully inserted meal provisions.");
      }
      
      // Type-specific details
      if (validatedData.travelType === "Domestic") {
        const details = validatedData.domesticTravelDetails;
        console.log("API_TRF_POST (PostgreSQL): Inserting domestic details for TRF ID:", trfId);
        if (details.accommodationDetails && details.accommodationDetails.length > 0) {
          const accomInserts = details.accommodationDetails.map(acc => ({
            trf_id: trfId, 
            accommodation_type: acc.accommodationType,
            check_in_date: acc.checkInDate ? formatISO(acc.checkInDate, { representation: 'date' }) : null,
            check_in_time: acc.checkInTime || null,
            check_out_date: acc.checkOutDate ? formatISO(acc.checkOutDate, { representation: 'date' }) : null,
            check_out_time: acc.checkOutTime || null,
            location: acc.location || null,
            address: acc.address || null,
            place_of_stay: acc.placeOfStay || null,
            estimated_cost_per_night: acc.estimatedCostPerNight ? Number(acc.estimatedCostPerNight) : null,
            other_type_description: acc.otherTypeDescription || null,
            remarks: acc.remarks || null,
          }));
          await tx`INSERT INTO trf_accommodation_details ${tx(accomInserts, 'trf_id', 'accommodation_type', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time', 'location', 'address', 'place_of_stay', 'estimated_cost_per_night', 'other_type_description', 'remarks')}`;
        }
        // Insert company transport details
        if (details.companyTransportDetails && details.companyTransportDetails.length > 0) {
          const transportInserts = details.companyTransportDetails.map(transport => ({
            trf_id: trfId,
            transport_date: transport.date ? formatISO(transport.date, { representation: 'date' }) : null,
            day_of_week: transport.day || null,
            from_location: transport.from || null,
            to_location: transport.to || null,
            bt_no_required: transport.btNoRequired || null,
            accommodation_type_n: transport.accommodationTypeN || null,
            address: transport.address || null,
            remarks: transport.remarks || null,
          }));
          await tx`INSERT INTO trf_company_transport_details ${tx(transportInserts, 'trf_id', 'transport_date', 'day_of_week', 'from_location', 'to_location', 'bt_no_required', 'accommodation_type_n', 'address', 'remarks')}`;
          console.log("API_TRF_POST (PostgreSQL): Successfully inserted company transport details.");
        }
      } else if (validatedData.travelType === "Overseas" || validatedData.travelType === "Home Leave Passage") {
        const details = validatedData.overseasTravelDetails;
        console.log("API_TRF_POST (PostgreSQL): Inserting overseas details for TRF ID:", trfId);
        
        try {
          // Define the interface for advance bank details
          interface AdvanceBankDetails {
            bankName: string;
            accountNumber: string;
            accountName?: string;
            swiftCode?: string;
            iban?: string;
            branchAddress?: string;
            currency?: string;
            amount?: number | null;
          }
          
          // Insert bank details if available
          if (details.advanceBankDetails) {
            console.log("API_TRF_POST (PostgreSQL): Inserting advance bank details");
            
            // Safely access properties with type checking
            const bankDetails = details.advanceBankDetails as AdvanceBankDetails;
            
            await tx`INSERT INTO trf_advance_bank_details (
              trf_id, 
              bank_name, 
              account_number, 
              account_name, 
              swift_code, 
              iban, 
              branch_address, 
              currency, 
              amount
            ) VALUES (
              ${trfId}, 
              ${bankDetails.bankName || ''}, 
              ${bankDetails.accountNumber || ''}, 
              ${bankDetails.accountName || ''}, 
              ${bankDetails.swiftCode || ''}, 
              ${bankDetails.iban || ''}, 
              ${bankDetails.branchAddress || ''}, 
              ${bankDetails.currency || ''}, 
              ${bankDetails.amount || null}
            )`;
          } else {
            // Insert empty bank details to ensure the record exists
            console.log("API_TRF_POST (PostgreSQL): No advance bank details provided");
          }
        } catch (error) {
          console.error("API_TRF_POST_ERROR (PostgreSQL): Error inserting advance bank details:", error);
          // Continue with the rest of the insertion process
        }
        
        // Handle advance amount requested items
        try {
          // Insert advance amount requested items if available
          if (details.advanceAmountRequested && details.advanceAmountRequested.length > 0) {
            // Check if the table exists first
            const tableExists = await tx`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'trf_advance_amount_requested_items'
              ) as exists
            `;
            
            if (tableExists[0]?.exists) {
              console.log("API_TRF_POST (PostgreSQL): Inserting advance amount requested items");
              const advanceInserts = details.advanceAmountRequested.map(item => ({
                trf_id: trfId, 
                date_from: item.dateFrom ? formatISO(item.dateFrom, { representation: 'date' }) : null,
                date_to: item.dateTo ? formatISO(item.dateTo, { representation: 'date' }) : null,
                lh: Number(item.lh||0), 
                ma: Number(item.ma||0), 
                oa: Number(item.oa||0), 
                tr: Number(item.tr||0), 
                oe: Number(item.oe||0),
                usd: Number(item.usd||0), 
                remarks: item.remarks || null,
              }));
              await tx`INSERT INTO trf_advance_amount_requested_items ${tx(advanceInserts, 'trf_id', 'date_from', 'date_to', 'lh', 'ma', 'oa', 'tr', 'oe', 'usd', 'remarks')}`;
            } else {
              console.log("API_TRF_POST (PostgreSQL): trf_advance_amount_requested_items table doesn't exist. Storing summary in travel_requests table.");
              // Create a summary of the advance amount requested
              const advanceSummary = details.advanceAmountRequested.map(item => {
                return `Date: ${item.dateFrom || 'N/A'} to ${item.dateTo || 'N/A'}, LH: ${item.lh || 0}, MA: ${item.ma || 0}, OA: ${item.oa || 0}, TR: ${item.tr || 0}, OE: ${item.oe || 0}, USD: ${item.usd || 0}, Remarks: ${item.remarks || 'N/A'}`;
              }).join('\n');
              
              // Update the travel_requests table with the summary
              await tx`
                UPDATE travel_requests
                SET additional_comments = COALESCE(additional_comments, '') || '\n\nAdvance Amount Requested:\n' || ${advanceSummary}
                WHERE id = ${trfId}
              `;
            }
          }
        } catch (error) {
          console.error("API_TRF_POST_ERROR (PostgreSQL): Error handling advance amount requested items:", error);
          // Continue with the rest of the insertion process
        }
      } else if (validatedData.travelType === "External Parties") {
        const details = validatedData.externalPartiesTravelDetails;
        console.log("API_TRF_POST (PostgreSQL): Inserting external party details for TRF ID:", trfId);
         if (details.accommodationDetails && details.accommodationDetails.length > 0) {
          const accomInserts = details.accommodationDetails.map(acc => ({
            trf_id: trfId, 
            accommodation_type: 'External Party Provided', // Specific type for clarity
            check_in_date: acc.checkInDate ? formatISO(acc.checkInDate, { representation: 'date' }) : null,
            check_in_time: '', // Default empty string
            check_out_date: acc.checkOutDate ? formatISO(acc.checkOutDate, { representation: 'date' }) : null,
            check_out_time: '', // Default empty string
            location: '', // Default empty string
            address: '', // Default empty string
            place_of_stay: acc.placeOfStay || '', 
            estimated_cost_per_night: Number(acc.estimatedCostPerNight || 0),
            other_type_description: null, // Default null
            remarks: acc.remarks || null,
          }));
          await tx`INSERT INTO trf_accommodation_details ${tx(accomInserts, 'trf_id', 'accommodation_type', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time', 'location', 'address', 'place_of_stay', 'estimated_cost_per_night', 'other_type_description', 'remarks')}`;
        }
      }

      // Initial approval step
      console.log("API_TRF_POST (PostgreSQL): Inserting initial approval step for TRF ID:", trfId);
      await tx`
        INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
        VALUES (${trfId}, 'Requestor', ${requestorNameVal}, 'Approved', NOW(), 'Submitted request.')
      `;
      
      console.log("API_TRF_POST (PostgreSQL): Transaction committed for TRF ID:", trfId);
      return trfId;
    });

    const notificationLog = `Placeholder: Send Notification - New TRF Submitted - ID: ${resultTrfId}. To Requestor: ${requestorNameVal}. To Dept Focal: [Dept Focal Email/User ID]`;
    console.log(notificationLog);

    // Auto-generate Transport and Accommodation requests if applicable
    let autoGeneratedRequests = { transportRequests: [], accommodationRequests: [] };
    try {
      const tsrData = {
        id: resultTrfId,
        travelType: validatedData.travelType,
        requestorName: requestorNameVal || 'Unknown',
        staffId: validatedData.travelType === "External Parties" ? null : (validatedData as any).requestorInfo?.staffId,
        department: validatedData.travelType === "External Parties" ? null : (validatedData as any).requestorInfo?.department,
        position: validatedData.travelType === "External Parties" ? null : (validatedData as any).requestorInfo?.position,
        purpose: purposeVal,
        domesticTravelDetails: validatedData.domesticTravelDetails,
        externalPartiesTravelDetails: validatedData.externalPartiesTravelDetails,
        overseasTravelDetails: validatedData.overseasTravelDetails
      };

      autoGeneratedRequests = await TSRAutoGenerationService.autoGenerateRequests(tsrData, session.id);
      
      if (autoGeneratedRequests.transportRequests.length > 0 || autoGeneratedRequests.accommodationRequests.length > 0) {
        console.log(`API_TRF_POST: Auto-generated ${autoGeneratedRequests.transportRequests.length} transport requests and ${autoGeneratedRequests.accommodationRequests.length} accommodation requests for TSR ${resultTrfId}`);
      }
    } catch (autoGenError) {
      console.error(`API_TRF_POST_AUTO_GEN_ERROR: Failed to auto-generate requests for TSR ${resultTrfId}:`, autoGenError);
      // Don't fail the entire TSR submission due to auto-generation errors
    }

    // Mark deduplication request as completed (successful submission)
    if (requestFingerprint) {
      markRequestCompleted(requestFingerprint);
    }

    // Return response immediately, then process notifications asynchronously
    const response = NextResponse.json({ 
      message: 'Travel request submitted successfully!', 
      trfId: resultTrfId,
      requestId: trfRequestId,
      autoGenerated: autoGeneratedRequests
    }, { status: 201 });

    // Process notifications asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🔔 TRF_NOTIFICATION: Starting async notification process for TRF ${trfRequestId}`);
        console.log(`🔔 TRF_NOTIFICATION: Session ID: ${session.id}, Session user: ${JSON.stringify(session)}`);
        
        // Use requestor email from session (avoid database query)
        const requestorEmail = session.email;
        
        console.log(`🔔 TRF_NOTIFICATION: Using session email: ${requestorEmail}`);

        // Log the department value being used for notification
        console.log(`🔔 TRF_NOTIFICATION: Notification parameters:`);
        console.log(`  - TRF ID: ${trfRequestId}`);
        console.log(`  - Requestor: ${requestorNameVal}`);
        console.log(`  - Department: ${departmentVal}`);
        console.log(`  - Purpose: ${purposeVal}`);
        console.log(`  - Requestor Email: ${requestorEmail}`);
        console.log(`  - Requestor ID: ${session.id}`);
        
        console.log(`🔔 TRF_NOTIFICATION: Calling UnifiedNotificationService.sendWorkflowNotification`);
        
        // Send workflow notification using unified notification system
        await UnifiedNotificationService.sendWorkflowNotification({
          eventType: 'trf_submitted',
          entityType: 'trf',
          entityId: trfRequestId,
          requestorName: requestorNameVal || 'User',
          requestorEmail,
          requestorId: session.id,
          department: departmentVal || 'Unknown',
          currentStatus: 'Pending Department Focal',
          entityTitle: `Travel Request - ${purposeVal || 'Business Travel'}`
        });

        console.log(`✅ TRF_NOTIFICATION: Successfully created enhanced workflow notifications for TRF ${trfRequestId}`);
      } catch (notificationError) {
        console.error(`❌ TRF_NOTIFICATION: Failed to create enhanced workflow notifications for TRF ${trfRequestId}`);
        console.error(`❌ TRF_NOTIFICATION: Error type: ${notificationError.constructor.name}`);
        console.error(`❌ TRF_NOTIFICATION: Error message: ${notificationError.message}`);
        console.error(`❌ TRF_NOTIFICATION: Error stack:`, notificationError.stack);
        // Notification failures don't affect the submitted TRF
      }
    });

    return response;

  } catch (error: any) {
    // Clean up deduplication on error
    if (requestFingerprint) {
      markRequestCompleted(requestFingerprint);
    }
    
    console.error("API_TRF_POST_ERROR (PostgreSQL): Failed to create TRF.", error.message, error.stack, error.code, error.constraint_name);
    return NextResponse.json({ error: `Failed to create TRF: ${error.message}`, details: {
      message: error.message,
      travelType: rawBody?.travelType || 'Unknown',
      errorLocation: error.stack?.split('\n')[1] || 'Unknown location'
    } }, { status: 500 });
  }
} catch (outerError: any) {
  // Clean up deduplication on critical error
  if (requestFingerprint) {
    markRequestCompleted(requestFingerprint);
  }
  
  console.error("API_TRF_POST_CRITICAL_ERROR (PostgreSQL): Unhandled exception:", outerError.message, outerError.stack);
  return NextResponse.json({ error: `Critical error processing TRF: ${outerError.message}` }, { status: 500 });
}
}));

export const GET = withRateLimit(RATE_LIMITS.API_READ)(withAuth(async function(request: NextRequest) {
  console.log("API_TRF_GET_START (PostgreSQL): Fetching TRFs.");
  
  const session = (request as any).user;
  
  // Role-based access control - authenticated users can access TRFs (they'll see filtered data based on role)
  // This allows all authenticated users to access the endpoint, but data filtering is applied in the query
  console.log(`API_TRF_GET: User ${session.role} (${session.email}) accessing TRF data`);
  
  if (!sql) {
    console.error("API_TRF_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10) || 10));
  const searchTerm = searchParams.get('search')?.trim();
  const statusFilter = searchParams.get('status')?.trim();
  const travelTypeFilter = searchParams.get('travelType')?.trim();
  const excludeTravelType = searchParams.get('excludeTravelType')?.trim();
  const sortBy = searchParams.get('sortBy') || 'submitted_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const statusesToFetch = searchParams.get('statuses')?.split(',').map(s => s.trim()).filter(Boolean);
  const summary = searchParams.get('summary');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');


  const offset = Math.max(0, (page - 1) * limit);

  // Handle summary request for reports
  if (summary === 'true') {
    try {
      console.log("API_TRF_GET: Processing summary request");
      
      // Universal filtering for summary - only system admins see all data
      const canViewAll = canViewAllData(session);
      const canViewTrf = canViewDomainData(session, 'trf');
      let userId = null;
      
      if (canViewAll || canViewTrf) {
        console.log(`API_TRF_GET: Admin ${session.role} can view all TRFs for summary`);
      } else {
        // All other users see only their own requests - use universal matching
        const userIdentifier = getUserIdentifier(session);
        userId = userIdentifier.userId;
        console.log(`API_TRF_GET: User ${session.role} viewing own TRFs summary with universal filtering`);
        // Note: The summary endpoints will need to be updated to use universal filtering too
      }

      let allTrfs;
      if (fromDate && toDate) {
        // Fetch TRFs by date range
        const whereConditions = ['submitted_at >= $1', 'submitted_at <= $2'];
        const params = [fromDate, toDate];
        
        if (userId) {
          // Use comprehensive user filtering for summary
          whereConditions.push('(tr.staff_id = $3 OR tr.requestor_name ILIKE $4)');
          params.push(userId);
          params.push(`%${session.name || ''}%`);
        }
        
        allTrfs = await sql.unsafe(`
          SELECT tr.status, tr.submitted_at 
          FROM travel_requests tr
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY tr.submitted_at DESC
        `, params);
      } else {
        // Fetch all TRFs
        if (userId) {
          // Use comprehensive user filtering for non-date-range summary
          allTrfs = await sql`
            SELECT status, submitted_at 
            FROM travel_requests tr
            WHERE (tr.staff_id = ${userId} OR tr.requestor_name ILIKE ${`%${session.name || ''}%`})
            ORDER BY tr.submitted_at DESC
          `;
        } else {
          allTrfs = await sql`
            SELECT status, submitted_at 
            FROM travel_requests 
            ORDER BY submitted_at DESC
          `;
        }
      }

      // Group by month and status
      const statusByMonth: { [key: string]: { month: string; pending: number; approved: number; rejected: number } } = {};

      allTrfs.forEach((trf) => {
        const month = new Date(trf.submitted_at).toLocaleString('default', { month: 'short' });
        if (!statusByMonth[month]) {
          statusByMonth[month] = { month, pending: 0, approved: 0, rejected: 0 };
        }
        
        const status = trf.status?.toLowerCase() || '';
        if (status.includes('pending') || status.includes('submitted')) {
          statusByMonth[month].pending++;
        } else if (status.includes('approved') || status.includes('completed')) {
          statusByMonth[month].approved++;
        } else if (status.includes('rejected') || status.includes('denied')) {
          statusByMonth[month].rejected++;
        }
      });

      // Sort months in chronological order
      const sortedMonths = Object.values(statusByMonth).sort((a, b) => {
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      });

      console.log(`API_TRF_GET: Returning summary with ${sortedMonths.length} months of data`);
      return NextResponse.json({ statusByMonth: sortedMonths });
    } catch (error) {
      console.error("API_TRF_GET: Error processing summary request:", error);
      return NextResponse.json({ error: 'Failed to fetch TRF summary data' }, { status: 500 });
    }
  }

  const whereClauses: any[] = [];
  
  // Universal user filtering system  
  if (shouldBypassUserFilter(session, statusesToFetch ? statusesToFetch.join(',') : null)) {
    console.log(`API_TRF_GET (PostgreSQL): Admin ${session.role} viewing approval queue - no user filter`);
    // Admins viewing approval queue see all requests with specified statuses
    if (statusesToFetch && statusesToFetch.length > 0) {
      whereClauses.push(sql`tr.status IN ${sql(statusesToFetch)}`);
    }
  } else {
    // Use universal user filtering - works for ALL users regardless of role
    console.log(`API_TRF_GET (PostgreSQL): User ${session.role} viewing own TRFs with universal filtering`);
    const userFilter = generateUniversalUserFilterSQL(session, sql, 'tr', {
      staffIdField: 'staff_id',
      nameField: 'requestor_name', 
      emailField: 'email',
      userIdField: null  // TRF table doesn't have user_id column
    });
    whereClauses.push(userFilter);
    
    // If there are status filters for personal pages, apply them too
    if (statusesToFetch && statusesToFetch.length > 0) {
      whereClauses.push(sql`tr.status IN ${sql(statusesToFetch)}`);
    }
  }
  
  console.log(`API_TRF_GET (PostgreSQL): Filters - Search: '${searchTerm}', Status: '${statusFilter}', Type: '${travelTypeFilter}', Exclude Type: '${excludeTravelType}', Statuses: '${statusesToFetch}', Role: '${session.role}'`);

  if (searchTerm) {
    whereClauses.push(sql`(
      LOWER(tr.id) LIKE LOWER(${'%' + searchTerm + '%'}) OR 
      LOWER(COALESCE(tr.requestor_name, tr.external_full_name)) LIKE LOWER(${'%' + searchTerm + '%'}) OR
      LOWER(tr.purpose) LIKE LOWER(${'%' + searchTerm + '%'})
    )`);
  }
  if (statusFilter) {
    whereClauses.push(sql`tr.status = ${statusFilter}`);
  }
  if (travelTypeFilter) {
    whereClauses.push(sql`tr.travel_type = ${travelTypeFilter}`);
  }
  if (excludeTravelType) {
    whereClauses.push(sql`tr.travel_type != ${excludeTravelType}`);
  }


  // Construct WHERE clause manually without using sql.join which doesn't exist
  let whereClause = sql``;
  if (whereClauses.length > 0) {
    whereClause = sql`WHERE ${ whereClauses[0] }`;
    for (let i = 1; i < whereClauses.length; i++) {
      whereClause = sql`${whereClause} AND ${whereClauses[i]}`;
    }
  }

  const allowedSortColumns: Record<string, string> = {
    id: 'tr.id', requestorName: 'COALESCE(tr.requestor_name, tr.external_full_name)', travelType: 'tr.travel_type',
    purpose: 'tr.purpose', status: 'tr.status', submitted_at: 'tr.submitted_at',
  };
  const dbSortColumn = allowedSortColumns[sortBy] || 'tr.submitted_at';
  const dbSortOrder = sortOrder.toLowerCase() === 'desc' ? sql`DESC` : sql`ASC`;

  try {
    console.log("API_TRF_GET (PostgreSQL): Attempting to query TRFs.");
    const trfsQuery = sql`
      SELECT 
        tr.id, 
        COALESCE(tr.requestor_name, tr.external_full_name) AS "requestorName", 
        tr.travel_type AS "travelType", 
        tr.purpose, 
        tr.status, 
        tr.submitted_at AS "submittedAt",
        tr.staff_id AS "staffId",
        tr.department,
        COALESCE(u.gender, 'Male') AS gender
      FROM travel_requests tr
      LEFT JOIN users u ON tr.staff_id = u.staff_id
      ${whereClause}
      ORDER BY ${sql(dbSortColumn)} ${dbSortOrder} NULLS LAST
      LIMIT ${BigInt(limit)} OFFSET ${BigInt(offset)}
    `;
    
    const trfsFromDb = await trfsQuery;

    const countQuery = sql`
      SELECT COUNT(*) AS count
      FROM travel_requests tr
      LEFT JOIN users u ON tr.staff_id = u.staff_id
      ${whereClause}
    `;
    const totalCountResult = await countQuery;
    const totalCount = Number(totalCountResult[0]?.count || 0);

    console.log(`API_TRF_GET (PostgreSQL): Fetched ${trfsFromDb.length} TRFs. Total matched: ${totalCount}`);
    
    const trfsForClient = trfsFromDb.map((trf: any) => ({
      ...trf,
      submittedAt: trf.submittedAt ? formatISO(new Date(trf.submittedAt)) : null,
    }));

    return NextResponse.json({
      trfs: trfsForClient,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error: any) {
    console.error("API_TRF_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch TRFs from database.', details: error.message }, { status: 500 });
  }
}));
