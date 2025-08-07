// src/app/api/trf/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO, parseISO, isValid } from 'date-fns';
import { mapFrontendItineraryToDb } from './itinerary-fix';
import { generateRequestId } from '@/utils/requestIdGenerator';

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
  day: z.string().min(1, "Day is required."),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  etd: z.string().regex(timeRegex, "Invalid ETD (HH:MM)").optional().nullable().or(z.literal("")),
  eta: z.string().regex(timeRegex, "Invalid ETA (HH:MM)").optional().nullable().or(z.literal("")),
  flightNumber: z.string().min(1, "Flight/Rein/Class is required."),
  remarks: z.string().optional().nullable(),
});

const mealProvisionSchemaDb = z.object({
  dateFromTo: z.string().min(1, "Date From/To is required for meal provision."),
  breakfast: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  lunch: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  dinner: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  supper: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
  refreshment: z.coerce.number().int().nonnegative("Must be a non-negative integer").optional().default(0),
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
  placeOfStay: z.string().min(1, "Place of stay is required."),
  estimatedCostPerNight: z.coerce.number().nonnegative("Must be non-negative").optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const companyTransportDetailSchemaDb = z.object({
  id: z.string().optional(),
  date: z.coerce.date({invalid_type_error: "Invalid date format for transport."}).nullable(),
  day: z.string().min(1, "Day is required."),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  btNoRequired: z.string().optional().nullable(),
  accommodationTypeN: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const advanceBankDetailsSchemaDb = z.object({
  bankName: z.string().min(1, "Bank name is required."),
  accountNumber: z.string().min(1, "Account number is required."),
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
  purpose: z.string().min(10, "Purpose of travel must be at least 10 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1, "At least one itinerary segment is required."),
  mealProvision: mealProvisionSchemaDb,
  accommodationDetails: z.array(accommodationDetailSchemaDb).optional().default([]),
  companyTransportDetails: z.array(companyTransportDetailSchemaDb).optional().default([]),
});

const overseasTrfDetailsSchema = z.object({
  purpose: z.string().min(10, "Purpose of travel must be at least 10 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1, "At least one itinerary segment is required."),
  advanceBankDetails: advanceBankDetailsSchemaDb.optional(),  // Make optional to handle different form structures
  advanceAmountRequested: z.array(advanceAmountRequestedItemSchemaDb).min(1, "At least one advance amount item is required.").optional(),  // Make optional to handle different form structures
});

const externalPartiesTrfDetailsSchema = z.object({
  purpose: z.string().min(10, "Purpose of travel must be at least 10 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1, "At least one itinerary segment is required."),
  accommodationDetails: z.array(externalPartyAccommodationDetailSchemaDb).optional().default([]),
  mealProvision: mealProvisionSchemaDb,
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
  baseTrfSchema.extend({ travelType: z.literal("Home Leave Passage"), requestorInfo: requestorInfoSchema, overseasTravelDetails: overseasTrfDetailsSchema }),
  baseTrfSchema.extend({ travelType: z.literal("External Parties"), externalPartyRequestorInfo: externalPartyRequestorInfoSchema, externalPartiesTravelDetails: externalPartiesTrfDetailsSchema }),
]);

export async function POST(request: NextRequest) {
  console.log("API_TRF_POST_START (PostgreSQL): Handler entered.");
  
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
    requestorNameVal = externalFullNameVal; // For approval step log
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
            from_date: acc.fromDate ? formatISO(acc.fromDate, { representation: 'date' }) : null,
            to_date: acc.toDate ? formatISO(acc.toDate, { representation: 'date' }) : null,
            from_location: acc.fromLocation || null,
            to_location: acc.toLocation || null,
            bt_no_required: acc.btNoRequired || null,
            accommodation_type_n: acc.accommodationTypeN || null,
            address: acc.address || null,
            place_of_stay: acc.placeOfStay || null,
            estimated_cost_per_night: acc.estimatedCostPerNight ? Number(acc.estimatedCostPerNight) : null,
            other_type_description: acc.otherTypeDescription || null,
            remarks: acc.remarks || null,
          }));
          await tx`INSERT INTO trf_accommodation_details ${tx(accomInserts, 'trf_id', 'accommodation_type', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time', 'location', 'from_date', 'to_date', 'from_location', 'to_location', 'bt_no_required', 'accommodation_type_n', 'address', 'place_of_stay', 'estimated_cost_per_night', 'other_type_description', 'remarks')}`;
        }
        // Note: Company transport details are handled differently in the database schema
        // We're not inserting them separately as there's no dedicated table for this in the current schema
        if (details.companyTransportDetails && details.companyTransportDetails.length > 0) {
          console.log("API_TRF_POST (PostgreSQL): Company transport details provided but not inserted due to schema limitations");
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
            trf_id: trfId, accommodation_type: 'External Party Provided', // Specific type for clarity
            check_in_date: acc.checkInDate ? formatISO(acc.checkInDate, { representation: 'date' }) : null,
            check_out_date: acc.checkOutDate ? formatISO(acc.checkOutDate, { representation: 'date' }) : null,
            place_of_stay: acc.placeOfStay, estimated_cost_per_night: Number(acc.estimatedCostPerNight || 0),
            remarks: acc.remarks || null,
          }));
          await tx`INSERT INTO trf_accommodation_details ${tx(accomInserts, 'trf_id', 'accommodation_type', 'check_in_date', 'check_out_date', 'place_of_stay', 'estimated_cost_per_night', 'remarks')}`;
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

    return NextResponse.json({ 
      message: 'Travel request submitted successfully!', 
      trfId: resultTrfId,
      requestId: trfRequestId 
    }, { status: 201 });

  } catch (error: any) {
    console.error("API_TRF_POST_ERROR (PostgreSQL): Failed to create TRF.", error.message, error.stack, error.code, error.constraint_name);
    return NextResponse.json({ error: `Failed to create TRF: ${error.message}`, details: {
      message: error.message,
      travelType: rawBody?.travelType || 'Unknown',
      errorLocation: error.stack?.split('\n')[1] || 'Unknown location'
    } }, { status: 500 });
  }
} catch (outerError: any) {
  console.error("API_TRF_POST_CRITICAL_ERROR (PostgreSQL): Unhandled exception:", outerError.message, outerError.stack);
  return NextResponse.json({ error: `Critical error processing TRF: ${outerError.message}` }, { status: 500 });
}
}

export async function GET(request: NextRequest) {
  console.log("API_TRF_GET_START (PostgreSQL): Fetching TRFs.");
  if (!sql) {
    console.error("API_TRF_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const searchTerm = searchParams.get('search')?.trim();
  const statusFilter = searchParams.get('status')?.trim();
  const travelTypeFilter = searchParams.get('travelType')?.trim();
  const excludeTravelType = searchParams.get('excludeTravelType')?.trim();
  const sortBy = searchParams.get('sortBy') || 'submitted_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const statusesToFetch = searchParams.get('statuses')?.split(',').map(s => s.trim()).filter(Boolean);


  const offset = (page - 1) * limit;

  const whereClauses: any[] = [];
  console.log(`API_TRF_GET (PostgreSQL): Filters - Search: '${searchTerm}', Status: '${statusFilter}', Type: '${travelTypeFilter}', Exclude Type: '${excludeTravelType}', Statuses: '${statusesToFetch}'`);

  if (searchTerm) {
    whereClauses.push(sql`(
      LOWER(id) LIKE LOWER(${'%' + searchTerm + '%'}) OR 
      LOWER(COALESCE(requestor_name, external_full_name)) LIKE LOWER(${'%' + searchTerm + '%'}) OR
      LOWER(purpose) LIKE LOWER(${'%' + searchTerm + '%'})
    )`);
  }
  if (statusFilter) {
    whereClauses.push(sql`status = ${statusFilter}`);
  }
  if (travelTypeFilter) {
    whereClauses.push(sql`travel_type = ${travelTypeFilter}`);
  }
  if (excludeTravelType) {
    whereClauses.push(sql`travel_type != ${excludeTravelType}`);
  }
  if (statusesToFetch && statusesToFetch.length > 0) {
    whereClauses.push(sql`status IN ${sql(statusesToFetch)}`);
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
    id: 'id', requestorName: 'COALESCE(requestor_name, external_full_name)', travelType: 'travel_type',
    purpose: 'purpose', status: 'status', submitted_at: 'submitted_at',
  };
  const dbSortColumn = allowedSortColumns[sortBy] || 'submitted_at';
  const dbSortOrder = sortOrder.toLowerCase() === 'desc' ? sql`DESC` : sql`ASC`;

  try {
    console.log("API_TRF_GET (PostgreSQL): Attempting to query TRFs.");
    const trfsQuery = sql`
      SELECT 
        id, 
        COALESCE(requestor_name, external_full_name) AS "requestorName", 
        travel_type AS "travelType", 
        purpose, 
        status, 
        submitted_at AS "submittedAt"
      FROM travel_requests
      ${whereClause}
      ORDER BY ${sql(dbSortColumn)} ${dbSortOrder} NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const trfsFromDb = await trfsQuery;

    const countQuery = sql`
      SELECT COUNT(*) AS count
      FROM travel_requests
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
}
