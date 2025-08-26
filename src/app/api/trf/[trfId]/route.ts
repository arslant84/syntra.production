// src/app/api/trf/[trfId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { formatISO, parseISO, isValid } from "date-fns";
// Local helper function to map database itinerary segment to frontend format
function mapDbItineraryToFrontend(dbSegment: any): ItinerarySegment {
  return {
    id: dbSegment.id,
    date: dbSegment.segment_date,
    day: dbSegment.day_of_week,
    from: dbSegment.from_location,
    to: dbSegment.to_location,
    etd: dbSegment.departure_time,
    eta: dbSegment.arrival_time,
    flightNumber: dbSegment.flight_number,
    flightClass: dbSegment.flight_class,
    remarks: dbSegment.remarks || null, // Pass null if remarks is empty or null
  };
}

// Local helper function to map frontend itinerary segment to database format
function mapFrontendItineraryToDb(frontendSegment: any, trfId: string) {
  return {
    trf_id: trfId,
    segment_date: frontendSegment.date
      ? formatISO(frontendSegment.date, { representation: "date" })
      : null,
    day_of_week: frontendSegment.day,
    from_location: frontendSegment.from,
    to_location: frontendSegment.to,
    departure_time: frontendSegment.etd || null,
    arrival_time: frontendSegment.eta || null,
    flight_number: frontendSegment.flightNumber || null,
    flight_class: frontendSegment.flightClass || null,
    remarks: frontendSegment.remarks || null, // Pass null if remarks is empty or null
  };
}
import { z } from "zod"; // For PUT validation
import type { TravelRequestForm } from "@/types/trf";
import { TSRAutoGenerationService } from '@/lib/tsr-auto-generation-service';

// Helper function to safely parse dates
function safeParseISO(dateString: any): Date | null {
  if (!dateString) return null;

  // Handle non-string inputs
  if (typeof dateString !== "string") {
    // If it's already a Date object, return it
    if (dateString instanceof Date) return dateString;
    // Try to convert to string
    try {
      dateString = String(dateString);
    } catch (e) {
      console.error(`Error converting date to string: ${dateString}`, e);
      return null;
    }
  }

  try {
    const parsedDate = parseISO(dateString);
    // Check if the parsed date is valid
    if (!isValid(parsedDate)) {
      console.error(`Invalid date after parsing: ${dateString}`);
      return null;
    }
    return parsedDate;
  } catch (error) {
    console.error(`Error parsing date: ${dateString}`, error);
    // Fallback: try to create a new Date object directly
    try {
      const fallbackDate = new Date(dateString);
      if (isValid(fallbackDate)) {
        return fallbackDate;
      }
    } catch (e) {
      // Ignore fallback error
    }
    return null;
  }
}

// Define missing types to fix TypeScript errors
type MealProvisionDetails = {
  dateFromTo: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  supper: number;
  refreshment: number;
};

// Updated to match the actual database schema
type ExternalPartyAccommodationDetail = {
  id?: string;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  placeOfStay: string; // This is actually accommodation_type in the database
  estimatedCostPerNight?: number | null; // This might not exist in the database
  remarks?: string | null;
};

// Define type for advance bank details for overseas travel
type AdvanceBankDetails = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  swiftCode: string;
  iban: string;
  branchAddress: string;
  currency: string;
  amount: number | null;
};

// Define type for advance amount requested items for overseas travel
type AdvanceAmountRequestedItem = {
  id: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  lh: number;
  ma: number;
  oa: number;
  tr: number;
  oe: number;
  usd: number;
  remarks: string;
};

// Re-using schemas from POST /api/trf/route.ts for validation in PUT
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const requestorInfoSchema = z
  .object({
    requestorName: z.string().optional().default(""), // No min length requirement
    staffId: z.string().optional().nullable(), // No min length requirement
    department: z.string().optional().nullable(), // No min length requirement
    position: z.string().optional().nullable(),
    costCenter: z.string().optional().nullable(), // No min length requirement
    telEmail: z.string().optional().nullable(), // No min length requirement
    email: z.string().email().optional().nullable().or(z.literal("")),
  })
  .optional()
  .default({}); // Make the entire object optional with default empty object
const externalPartyRequestorInfoSchema = z
  .object({
    externalFullName: z.string().optional().default(""),
    externalOrganization: z.string().optional().default(""),
    externalRefToAuthorityLetter: z.string().optional().default(""),
    externalCostCenter: z.string().optional().default(""),
  })
  .optional()
  .default({});
const itinerarySegmentSchemaDb = z.object({
  id: z.string().optional(),
  date: z.coerce.date().nullable(),
  day: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  etd: z.string().regex(timeRegex).optional().nullable().or(z.literal("")),
  eta: z.string().regex(timeRegex).optional().nullable().or(z.literal("")),
  flightNumber: z.string().optional(),
  flightClass: z.string().optional(),
  remarks: z.string().optional().nullable(),
});
const mealProvisionSchemaDb = z.object({
  dateFromTo: z.string().min(1),
  breakfast: z.coerce.number().int().default(0),
  lunch: z.coerce.number().int().default(0),
  dinner: z.coerce.number().int().default(0),
  supper: z.coerce.number().int().default(0),
  refreshment: z.coerce.number().int().default(0),
});
const accommodationDetailSchemaDb = z.object({
  id: z.string().optional(),
  accommodationType: z.enum([
    "Hotel/Отели",
    "Staff House/PKC Kampung/Kiyanly camp",
    "Other",
  ]),
  checkInDate: z.coerce.date().nullable(),
  checkInTime: z
    .string()
    .regex(timeRegex)
    .optional()
    .nullable()
    .or(z.literal("")),
  checkOutDate: z.coerce.date().nullable(),
  checkOutTime: z
    .string()
    .regex(timeRegex)
    .optional()
    .nullable()
    .or(z.literal("")),
  remarks: z.string().optional().nullable(),
  otherTypeDescription: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  placeOfStay: z.string().optional().nullable(),
  estimatedCostPerNight: z.coerce.number().optional().nullable(),
  fromDate: z.coerce.date().optional().nullable(),
  toDate: z.coerce.date().optional().nullable(),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().optional().nullable(),
  btNoRequired: z.string().optional().nullable(),
  accommodationTypeN: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});
const externalPartyAccommodationDetailSchemaDb = z.object({
  id: z.string().optional(),
  checkInDate: z.coerce.date().nullable(),
  checkOutDate: z.coerce.date().nullable(),
  placeOfStay: z.string().optional(),
  estimatedCostPerNight: z.coerce.number().optional().nullable(),
  remarks: z.string().optional().nullable(),
});
const companyTransportDetailSchemaDb = z.object({
  id: z.string().optional(),
  date: z.coerce.date().nullable(),
  day: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  btNoRequired: z.string().optional().nullable(),
  accommodationTypeN: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});
const advanceBankDetailsSchemaDb = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
});
const advanceAmountRequestedItemSchemaDb = z.object({
  id: z.string().optional(),
  dateFrom: z.coerce.date().nullable(),
  dateTo: z.coerce.date().nullable(),
  lh: z.coerce.number().default(0),
  ma: z.coerce.number().default(0),
  oa: z.coerce.number().default(0),
  tr: z.coerce.number().default(0),
  oe: z.coerce.number().default(0),
  usd: z.coerce.number().optional().nullable(),
  remarks: z.string().optional().nullable(),
});
const domesticTrfDetailsSchema = z.object({
  purpose: z.string().min(5, "Purpose of travel must be at least 5 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1),
  mealProvision: mealProvisionSchemaDb.optional(),
  accommodationDetails: z
    .array(accommodationDetailSchemaDb)
    .optional()
    .default([]),
  companyTransportDetails: z
    .array(companyTransportDetailSchemaDb)
    .optional()
    .default([]),
});
const overseasTrfDetailsSchema = z.object({
  purpose: z.string().min(5, "Purpose of travel must be at least 5 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1),
  advanceBankDetails: advanceBankDetailsSchemaDb.optional(),
  advanceAmountRequested: z.array(advanceAmountRequestedItemSchemaDb).optional(),
});
const externalPartiesTrfDetailsSchema = z.object({
  purpose: z.string().min(5, "Purpose of travel must be at least 5 characters."),
  itinerary: z.array(itinerarySegmentSchemaDb).min(1),
  accommodationDetails: z
    .array(externalPartyAccommodationDetailSchemaDb)
    .optional()
    .default([]),
  mealProvision: mealProvisionSchemaDb.optional(),
});
const baseTrfSchema = z.object({
  additionalComments: z.string().optional().nullable(),
  confirmPolicy: z.boolean().refine((val) => val === true),
  confirmManagerApproval: z.boolean().refine((val) => val === true),
  confirmTermsAndConditions: z.boolean().optional(),
  estimatedCost: z.number().optional().default(0),
});
const trfSubmissionSchema = z.discriminatedUnion("travelType", [
  baseTrfSchema.extend({
    travelType: z.literal("Domestic"),
    requestorInfo: requestorInfoSchema,
    domesticTravelDetails: domesticTrfDetailsSchema,
  }),
  baseTrfSchema.extend({
    travelType: z.literal("Overseas"),
    requestorInfo: requestorInfoSchema,
    overseasTravelDetails: overseasTrfDetailsSchema,
  }),
  baseTrfSchema.extend({
    travelType: z.literal("Home Leave Passage"),
    requestorInfo: requestorInfoSchema,
    overseasTravelDetails: overseasTrfDetailsSchema,
  }),
  baseTrfSchema.extend({
    travelType: z.literal("External Parties"),
    externalPartyRequestorInfo: externalPartyRequestorInfoSchema,
    externalPartiesTravelDetails: externalPartiesTrfDetailsSchema,
  }),
]);

export async function GET(
  request: NextRequest,
  { params }: { params: { trfId: string } },
) {
  // Properly await params to fix the Next.js warning
  const { trfId } = await Promise.resolve(params);
  console.log(`API_TRF_TRFID_GET_START (PostgreSQL): Fetching TRF ${trfId}.`);
  if (!sql) {
    console.error(
      "API_TRF_TRFID_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.",
    );
    return NextResponse.json(
      { error: "Database client not initialized." },
      { status: 503 },
    );
  }

  try {
    // Validate that the request ID is for a TSR, not accommodation or other request types
    if (trfId.startsWith('ACCOM-')) {
      console.log(`API_TRF_TRFID_GET (PostgreSQL): Rejecting accommodation request ${trfId}.`);
      return NextResponse.json(
        { 
          error: "This is an accommodation request, not a TSR.", 
          details: "Accommodation requests should be accessed through the accommodation API, not the TSR API.",
          redirectTo: `/accommodation/view/${trfId}`
        }, 
        { status: 400 }
      );
    }

    // Wrap the main query in a try-catch to provide more specific error information
    let mainTrfData;
    try {
      const result =
        await sql`SELECT * FROM travel_requests WHERE id = ${trfId} AND travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')`;
      [mainTrfData] = result;
      if (!mainTrfData) {
        // Check if it exists in the table but is not a valid TSR type
        const checkResult = await sql`SELECT id, travel_type FROM travel_requests WHERE id = ${trfId}`;
        if (checkResult.length > 0) {
          const record = checkResult[0];
          return NextResponse.json(
            { 
              error: `Invalid request type: ${record.travel_type}`, 
              details: `This API only handles TSR (Travel Service Request) records. Request type '${record.travel_type}' is not supported.`,
            }, 
            { status: 400 }
          );
        }
        return NextResponse.json({ error: "TSR not found" }, { status: 404 });
      }
      console.log("API_TRF_TRFID_GET (PostgreSQL): Main TSR data fetched.");
    } catch (dbError: any) {
      console.error(
        `API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching main TRF data:`,
        dbError,
      );
      return NextResponse.json(
        {
          error: "Database error while fetching TRF main data.",
          details: dbError.message || "Unknown database error",
        },
        { status: 500 },
      );
    }

    // Define types for database results
    type ItinerarySegment = {
      id: string;
      date: string;
      day: string;
      from: string;
      to: string;
      etd: string;
      eta: string;
      flightNumber: string;
      remarks?: string;
      [key: string]: any; // For any other properties
    };

    type ApprovalStep = {
      role: string;
      name: string;
      status: string;
      date: string;
      comments?: string;
      [key: string]: any; // For any other properties
    };

    // Query itinerary segments with the correct column names based on the actual database schema
    let itinerary: ItinerarySegment[] = [];
    let approvalWorkflow: ApprovalStep[] = [];

    try {
      // Fixed query to match the actual database schema
      itinerary = await sql`
        SELECT 
          id,
          segment_date,
          day_of_week,
          from_location,
          to_location,
          departure_time,
          arrival_time,
          flight_number,
          flight_class,
          remarks,
          created_at
        FROM trf_itinerary_segments 
        WHERE trf_id = ${trfId}
      `;
      console.log(
        `API_TRF_TRFID_GET (PostgreSQL): Fetched ${itinerary.length} itinerary segments.`,
      );

      // Log the first itinerary segment to debug
      if (itinerary.length > 0) {
        console.log(
          `API_TRF_TRFID_GET (PostgreSQL): First itinerary segment fields:`,
          Object.keys(itinerary[0]).join(", "),
        );
      }
    } catch (dbError: any) {
      console.error(
        `API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching itinerary:`,
        dbError,
      );
      // Continue execution but with empty itinerary
    }

    try {
      const completedApprovalSteps =
        await sql`SELECT step_role as role, step_name as name, status, step_date as date, comments FROM trf_approval_steps WHERE trf_id = ${trfId} ORDER BY created_at ASC`;
      console.log(
        `API_TRF_TRFID_GET (PostgreSQL): Fetched ${completedApprovalSteps.length} approval steps.`,
      );
      
      // Generate the complete approval workflow including expected pending steps
      approvalWorkflow = generateFullTrfApprovalWorkflow(
        mainTrfData.status, 
        completedApprovalSteps,
        mainTrfData.requestor_name || 'Unknown'
      );
    } catch (dbError: any) {
      console.error(
        `API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching approval workflow:`,
        dbError,
      );
      // Continue execution but with empty approval workflow
    }

    // Create the TRF data object with proper type casting to handle TypeScript errors
    let trfData: any = {
      ...mainTrfData,
      requestorName: mainTrfData.requestor_name, // Map db field to type field
      staffId: mainTrfData.staff_id,
      costCenter: mainTrfData.cost_center,
      telEmail: mainTrfData.tel_email,
      travelType: mainTrfData.travel_type,
      additionalComments: mainTrfData.additional_comments,
      // Dates need conversion
      submittedAt: mainTrfData.submitted_at
        ? formatISO(new Date(mainTrfData.submitted_at))
        : undefined,
      createdAt: mainTrfData.created_at
        ? formatISO(new Date(mainTrfData.created_at))
        : undefined,
      updatedAt: mainTrfData.updated_at
        ? formatISO(new Date(mainTrfData.updated_at))
        : undefined,
      // Format the approval workflow with proper date parsing
      approvalWorkflow: approvalWorkflow.map((step) => ({
        role: step.role || "",
        name: step.name || "",
        status: step.status || "",
        date: safeParseISO(step.date),
        comments: step.comments || "",
      })),
    };

    if (mainTrfData.travel_type === "Domestic") {
      // Define type for meal provision data
      type MealProvisionData = {
        dateFromTo: string;
        breakfast: number;
        lunch: number;
        dinner: number;
        supper: number;
        refreshment: number;
        [key: string]: any; // For any other properties
      };

      // Get meal provision data from the trf_meal_provisions table
      let mealProvisionData: MealProvisionData[] = [];
      try {
        // Check if the table exists first to avoid errors
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'trf_meal_provisions'
          ) as exists
        `;

        if (tableExists[0]?.exists) {
          mealProvisionData = await sql`
            SELECT 
              date_from_to as "dateFromTo",
              breakfast,
              lunch,
              dinner,
              supper,
              refreshment
            FROM trf_meal_provisions 
            WHERE trf_id = ${trfId}
          `;
          console.log(
            `API_TRF_TRFID_GET (PostgreSQL): Fetched meal provision data from trf_meal_provisions table.`,
          );
        } else {
          // Fallback to getting meal provision data from itinerary segments if table doesn't exist
          mealProvisionData = await sql`
            SELECT 
              CONCAT(MIN(segment_date), ' to ', MAX(segment_date)) as "dateFromTo",
              0 as breakfast,
              0 as lunch,
              0 as dinner,
              0 as supper,
              0 as refreshment
            FROM trf_itinerary_segments 
            WHERE trf_id = ${trfId}
          `;
          console.log(
            `API_TRF_TRFID_GET (PostgreSQL): trf_meal_provisions table does not exist. Fetched meal provision data from itinerary segments as fallback.`,
          );
        }
      } catch (dbError: any) {
        console.error(
          `API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching meal provision data:`,
          dbError,
        );
        // Continue execution with empty meal provision data
      }
      const [mealProvision] =
        mealProvisionData.length > 0
          ? mealProvisionData
          : [
              {
                dateFromTo: "",
                breakfast: 0,
                lunch: 0,
                dinner: 0,
                supper: 0,
                refreshment: 0,
              },
            ];
      console.log(`API_TRF_TRFID_GET (PostgreSQL): Domestic meal provision data length: ${mealProvisionData.length}, Final meal provision:`, mealProvision);
      
      // Fetch daily meal selections if they exist
      let dailyMealSelections: any[] = [];
      try {
        const dailyMealTableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'trf_daily_meal_selections'
          ) as exists
        `;

        if (dailyMealTableExists[0]?.exists) {
          dailyMealSelections = await sql`
            SELECT 
              id,
              trf_id,
              meal_date,
              breakfast,
              lunch,
              dinner,
              supper,
              refreshment
            FROM trf_daily_meal_selections 
            WHERE trf_id = ${trfId}
            ORDER BY meal_date ASC
          `;
          console.log(`API_TRF_TRFID_GET (PostgreSQL): Fetched ${dailyMealSelections.length} daily meal selections.`);
        }
      } catch (dbError: any) {
        console.error(`API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching daily meal selections:`, dbError);
      }

      // Add daily meal selections to meal provision if they exist
      if (dailyMealSelections.length > 0) {
        mealProvision.dailyMealSelections = dailyMealSelections.map((selection) => ({
          id: selection.id,
          trf_id: selection.trf_id,
          meal_date: selection.meal_date,
          breakfast: Boolean(selection.breakfast),
          lunch: Boolean(selection.lunch),
          dinner: Boolean(selection.dinner),
          supper: Boolean(selection.supper),
          refreshment: Boolean(selection.refreshment)
        }));
      } else {
        mealProvision.dailyMealSelections = [];
      }
      
      // If meal provision data is empty and TRF is approved, try to generate from itinerary
      if (mealProvisionData.length === 0 && mainTrfData.status === 'Approved' && itinerary.length > 0) {
        console.log(`API_TRF_TRFID_GET (PostgreSQL): Generating meal provision data for approved TRF from itinerary`);
        const firstDate = itinerary[0].segment_date;
        const lastDate = itinerary[itinerary.length - 1].segment_date;
        mealProvision.dateFromTo = `${firstDate} to ${lastDate}`;
        // Set default meal values for approved TRFs
        mealProvision.breakfast = 1;
        mealProvision.lunch = 1;
        mealProvision.dinner = 1;
        mealProvision.supper = 0;
        mealProvision.refreshment = 1;
      }

      // Get accommodation details with the correct column names based on the actual database schema
      const accommodationDetails = await sql`
        SELECT 
          id,
          accommodation_type as "accommodationType", 
          check_in_date as "checkInDate", 
          check_in_time as "checkInTime",
          check_out_date as "checkOutDate", 
          check_out_time as "checkOutTime",
          other_type_description as "otherTypeDescription",
          location,
          remarks,
          address,
          place_of_stay as "placeOfStay",
          estimated_cost_per_night as "estimatedCostPerNight"
        FROM trf_accommodation_details 
        WHERE trf_id = ${trfId}
      `;

      // Company transport details may not exist in the database schema
      // Using a try-catch to handle potential errors
      type CompanyTransportDetail = {
        id?: string;
        date: Date | null;
        day: string;
        from: string;
        to: string;
        btNoRequired?: string | null;
        accommodationTypeN?: string | null;
        address?: string | null;
        remarks?: string | null;
      };

      // Company transport details - this table might not exist in the database schema yet
      // We'll handle it gracefully by providing an empty array if the table doesn't exist
      let companyTransportDetails: any[] = [];
      try {
        // Check if the table exists first to avoid errors
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'trf_company_transport_details'
          ) as exists
        `;

        if (tableExists[0]?.exists) {
          companyTransportDetails = await sql`
            SELECT 
              id,
              transport_date as "transportDate", 
              day_of_week as "dayOfWeek", 
              from_location as "fromLocation", 
              to_location as "toLocation", 
              bt_no_required as "btNoRequired", 
              accommodation_type_n as "accommodationTypeN",
              address,
              remarks
            FROM trf_company_transport_details 
            WHERE trf_id = ${trfId}
          `;
        } else {
          console.log(
            `API_TRF_TRFID_GET (PostgreSQL): trf_company_transport_details table does not exist. Using empty array.`,
          );

          // If the table doesn't exist but we need to show transport details, try to extract from itinerary
          if (mainTrfData.travel_type === "Domestic") {
            // Generate transport details from itinerary segments as a fallback
            companyTransportDetails = itinerary.map((seg, index) => {
              // Use our helper function to map database columns to frontend fields
              const mappedSeg = mapDbItineraryToFrontend(seg);
              return {
                id: `generated-${index}`,
                transportDate: mappedSeg.date || null,
                dayOfWeek: mappedSeg.day || "",
                fromLocation: mappedSeg.from || "",
                toLocation: mappedSeg.to || "",
                btNoRequired: "N/A",
                accommodationTypeN: "N/A",
                address: "",
                remarks: mappedSeg.remarks || null, // Use mappedSeg.remarks
              };
            });
            console.log(
              `API_TRF_TRFID_GET (PostgreSQL): Generated ${companyTransportDetails.length} company transport details from itinerary.`,
            );
          }
        }
      } catch (error) {
        console.warn(
          "API_TRF_TRFID_GET_ERROR (PostgreSQL): Error with company transport details:",
          error,
        );
      }
      // Map domestic travel details with proper typing for all fields
      console.log(`API_TRF_TRFID_GET (PostgreSQL): Mapping itinerary segments:`, itinerary);
      console.log(`API_TRF_TRFID_GET (PostgreSQL): Final meal provision for domestic:`, mealProvision);
      
      // Process itinerary segments and add default remarks for approved TRFs if empty
      const processedItinerary = itinerary.map((seg) => {
        const mappedSeg = mapDbItineraryToFrontend(seg);
        // If TRF is approved and remarks are empty, add a default remark
        if (mainTrfData.status === 'Approved' && (!mappedSeg.remarks || mappedSeg.remarks === '')) {
          mappedSeg.remarks = 'Approved for travel';
        }
        return mappedSeg;
      });
      
      trfData.domesticTravelDetails = {
        purpose: mainTrfData.purpose || "",
        itinerary: processedItinerary,
        mealProvision: mealProvision,
        accommodationDetails: accommodationDetails.map((acc) => ({
          id: acc.id || "",
          accommodationType: acc.accommodationType || "Hotel/Otels",
          checkInDate: safeParseISO(acc.checkInDate),
          checkInTime: acc.checkInTime || "",
          checkOutDate: safeParseISO(acc.checkOutDate),
          checkOutTime: acc.checkOutTime || "",
          otherTypeDescription: acc.otherTypeDescription || "",
          location: acc.location || "",
          remarks: acc.remarks || null,
          placeOfStay: acc.placeOfStay || null, // Ensure placeOfStay is passed
          estimatedCostPerNight: acc.estimatedCostPerNight || null, // Ensure estimatedCostPerNight is passed
        })),
        companyTransportDetails: companyTransportDetails.map((trans) => ({
          id: trans.id || "",
          date: safeParseISO(trans.transportDate),
          day: trans.dayOfWeek || "",
          from: trans.fromLocation || "",
          to: trans.toLocation || "",
          btNoRequired: trans.btNoRequired || "",
          accommodationTypeN: trans.accommodationTypeN || "",
          address: trans.address || "",
          remarks: trans.remarks || null,
        })),
      };

      // Set requestor info
      trfData.requestorInfo = {
        requestorName: mainTrfData.requestor_name || "",
        staffId: mainTrfData.staff_id || "",
        department: mainTrfData.department || "",
        position: mainTrfData.position || "",
        costCenter: mainTrfData.cost_center || "",
        telEmail: mainTrfData.tel_email || "",
        email: mainTrfData.email || "",
      };
    } else if (
      mainTrfData.travel_type === "Overseas" ||
      mainTrfData.travel_type === "Home Leave Passage"
    ) {
      // Handle overseas travel details
      console.log(
        `API_TRF_TRFID_GET (PostgreSQL): Processing ${mainTrfData.travel_type} travel details.`,
      );

      // Fetch advance bank details
      let advanceBankDetails: AdvanceBankDetails = {
        bankName: "",
        accountNumber: "",
        accountName: "",
        swiftCode: "",
        iban: "",
        branchAddress: "",
        currency: "",
        amount: null,
      };

      try {
        // Check if the table exists first to avoid errors
        const bankTableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'trf_advance_bank_details'
          ) as exists
        `;

        if (bankTableExists[0]?.exists) {
          const bankDetailsResult = await sql`
            SELECT 
              id,
              bank_name,
              account_number,
              account_name,
              swift_code,
              iban,
              branch_address,
              currency,
              amount
            FROM trf_advance_bank_details 
            WHERE trf_id = ${trfId}
            LIMIT 1
          `;

          if (bankDetailsResult && bankDetailsResult.length > 0) {
            const bankData = bankDetailsResult[0];
            advanceBankDetails = {
              bankName: bankData.bank_name || "",
              accountNumber: bankData.account_number || "",
              accountName: bankData.account_name || "",
              swiftCode: bankData.swift_code || "",
              iban: bankData.iban || "",
              branchAddress: bankData.branch_address || "",
              currency: bankData.currency || "",
              amount: bankData.amount,
            };
            console.log(
              `API_TRF_TRFID_GET (PostgreSQL): Fetched advance bank details.`,
            );
          } else {
            console.log(
              `API_TRF_TRFID_GET (PostgreSQL): No advance bank details found in database.`,
            );

            // Try to extract from additional_data JSON if available
            if (mainTrfData.additional_data) {
              try {
                const additionalData =
                  typeof mainTrfData.additional_data === "string"
                    ? JSON.parse(mainTrfData.additional_data)
                    : mainTrfData.additional_data;

                if (additionalData && additionalData.advanceBankDetails) {
                  advanceBankDetails = {
                    bankName: additionalData.advanceBankDetails.bankName || "",
                    accountNumber:
                      additionalData.advanceBankDetails.accountNumber || "",
                    accountName:
                      additionalData.advanceBankDetails.accountName || "",
                    swiftCode:
                      additionalData.advanceBankDetails.swiftCode || "",
                    iban: additionalData.advanceBankDetails.iban || "",
                    branchAddress:
                      additionalData.advanceBankDetails.branchAddress || "",
                    currency: additionalData.advanceBankDetails.currency || "",
                    amount: additionalData.advanceBankDetails.amount || null,
                  };
                  console.log(
                    `API_TRF_TRFID_GET (PostgreSQL): Extracted bank details from additional_data.`,
                  );
                }
              } catch (e) {
                console.error(
                  `API_TRF_TRFID_GET_ERROR (PostgreSQL): Failed to parse additional_data JSON for bank details:`,
                  e,
                );
              }
            }
          }
        }
      } catch (error) {
        console.error(
          `API_TRF_TRFID_GET_ERROR (PostgreSQL): Error fetching advance bank details:`,
          error,
        );
      }

      // Fetch advance amount requested items
      let advanceAmountRequested: AdvanceAmountRequestedItem[] = [];

      try {
        // Check if the table exists first to avoid errors
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'trf_advance_amount_requested_items'
          ) as exists
        `;

        if (tableExists[0]?.exists) {
          const advanceAmountResult = await sql`
            SELECT 
              id, 
              date_from, 
              date_to, 
              lh, 
              ma, 
              oa, 
              tr, 
              oe, 
              usd, 
              remarks
            FROM trf_advance_amount_requested_items 
            WHERE trf_id = ${trfId}
          `;

          if (advanceAmountResult && advanceAmountResult.length > 0) {
            advanceAmountRequested = advanceAmountResult.map((item) => ({
              id: item.id || "",
              dateFrom: safeParseISO(item.date_from),
              dateTo: safeParseISO(item.date_to),
              lh: Number(item.lh || 0),
              ma: Number(item.ma || 0),
              oa: Number(item.oa || 0),
              tr: Number(item.tr || 0),
              oe: Number(item.oe || 0),
              usd: Number(item.usd || 0),
              remarks: item.remarks || "",
            }));
            console.log(
              `API_TRF_TRFID_GET (PostgreSQL): Fetched ${advanceAmountRequested.length} advance amount requested items.`,
            );
          } else {
            console.log(
              `API_TRF_TRFID_GET (PostgreSQL): No advance amount requested items found in database.`,
            );
          }
        } else {
          console.log(
            `API_TRF_TRFID_GET (PostgreSQL): trf_advance_amount_requested_items table does not exist.`,
          );

          // Try to extract from additional_data JSON if available
          if (mainTrfData.additional_data) {
            try {
              const additionalData =
                typeof mainTrfData.additional_data === "string"
                  ? JSON.parse(mainTrfData.additional_data)
                  : mainTrfData.additional_data;

              if (
                additionalData &&
                additionalData.advanceAmountRequested &&
                Array.isArray(additionalData.advanceAmountRequested)
              ) {
                advanceAmountRequested =
                  additionalData.advanceAmountRequested.map((item: any) => ({
                    id: item.id || "",
                    dateFrom: item.dateFrom
                      ? safeParseISO(item.dateFrom)
                      : null,
                    dateTo: item.dateTo ? safeParseISO(item.dateTo) : null,
                    lh: Number(item.lh || 0),
                    ma: Number(item.ma || 0),
                    oa: Number(item.oa || 0),
                    tr: Number(item.tr || 0),
                    oe: Number(item.oe || 0),
                    usd: Number(item.usd || 0),
                    remarks: item.remarks || "",
                  }));
                console.log(
                  `API_TRF_TRFID_GET (PostgreSQL): Extracted ${advanceAmountRequested.length} advance amount requested items from additional_data.`,
                );
              }
            } catch (e) {
              console.error(
                `API_TRF_TRFID_GET_ERROR (PostgreSQL): Failed to parse additional_data JSON for advance amount:`,
                e,
              );
            }
          }

          // Try to extract from additional_comments as a fallback
          if (
            advanceAmountRequested.length === 0 &&
            mainTrfData.additional_comments
          ) {
            try {
              const comments = mainTrfData.additional_comments;
              if (comments.includes("Advance Amount Requested:")) {
                console.log(
                  `API_TRF_TRFID_GET (PostgreSQL): Found advance amount data in additional_comments.`,
                );
                // Try to parse the comments for advance amount data
                const advanceSection = comments.split(
                  "Advance Amount Requested:",
                )[1];
                if (advanceSection) {
                  const lines = advanceSection
                    .split("\n")
                    .filter((line: string) => line.trim().length > 0);
                  const parsedItems = [];

                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.includes("Date:") || line.includes("LH:")) {
                      // Extract date range, amounts, and remarks
                      const dateMatch = line.match(
                        /Date:\s*([^,]+)\s*to\s*([^,]+)/,
                      );
                      const lhMatch = line.match(/LH:\s*([\d.]+)/);
                      const maMatch = line.match(/MA:\s*([\d.]+)/);
                      const oaMatch = line.match(/OA:\s*([\d.]+)/);
                      const trMatch = line.match(/TR:\s*([\d.]+)/);
                      const oeMatch = line.match(/OE:\s*([\d.]+)/);
                      const usdMatch = line.match(/USD:\s*([\d.]+)/);
                      const remarksMatch = line.match(/Remarks:\s*(.+)/);

                      parsedItems.push({
                        id: `parsed-${i}`,
                        dateFrom: dateMatch
                          ? safeParseISO(dateMatch[1].trim())
                          : null,
                        dateTo: dateMatch
                          ? safeParseISO(dateMatch[2].trim())
                          : null,
                        lh: lhMatch ? Number(lhMatch[1]) : 0,
                        ma: maMatch ? Number(maMatch[1]) : 0,
                        oa: oaMatch ? Number(oaMatch[1]) : 0,
                        tr: trMatch ? Number(trMatch[1]) : 0,
                        oe: oeMatch ? Number(oeMatch[1]) : 0,
                        usd: usdMatch ? Number(usdMatch[1]) : 0,
                        remarks: remarksMatch ? remarksMatch[1].trim() : "",
                      });
                    }
                  }

                  if (parsedItems.length > 0) {
                    advanceAmountRequested = parsedItems;
                    console.log(
                      `API_TRF_TRFID_GET (PostgreSQL): Parsed ${advanceAmountRequested.length} advance amount items from additional_comments.`,
                    );
                  }
                }
              }
            } catch (e) {
              console.error(
                `API_TRF_TRFID_GET_ERROR (PostgreSQL): Failed to parse advance amount data from comments:`,
                e,
              );
            }
          }
        }

        // If no data found, create a placeholder item
        if (advanceAmountRequested.length === 0) {
          console.log(
            `API_TRF_TRFID_GET (PostgreSQL): No advance amount data found. Creating placeholder.`,
          );
          advanceAmountRequested = [
            {
              id: "placeholder",
              dateFrom: new Date(),
              dateTo: new Date(),
              lh: 0,
              ma: 0,
              oa: 0,
              tr: 0,
              oe: 0,
              usd: 0,
              remarks: "No data available",
            },
          ];
        }
      } catch (error) {
        console.error(
          `API_TRF_TRFID_GET_ERROR (PostgreSQL): Error fetching advance amount requested items:`,
          error,
        );
        // Create a placeholder item for overseas travel types
        advanceAmountRequested = [
          {
            id: "error-placeholder",
            dateFrom: new Date(),
            dateTo: new Date(),
            lh: 0,
            ma: 0,
            oa: 0,
            tr: 0,
            oe: 0,
            usd: 0,
            remarks: "Error retrieving data",
          },
        ];
      }

      // Map overseas travel details with proper typing for all fields
      trfData.overseasTravelDetails = {
        purpose: mainTrfData.purpose || "",
        itinerary: itinerary.map((seg) => mapDbItineraryToFrontend(seg)),
        advanceBankDetails,
        advanceAmountRequested,
      };

      // Set requestor info
      trfData.requestorInfo = {
        requestorName: mainTrfData.requestor_name || "",
        staffId: mainTrfData.staff_id || "",
        department: mainTrfData.department || "",
        position: mainTrfData.position || "",
        costCenter: mainTrfData.cost_center || "",
        telEmail: mainTrfData.tel_email || "",
        email: mainTrfData.email || "",
      };
    } else if (mainTrfData.travel_type === "External Parties") {
      // Define type for meal provision data (reusing the same type as in Domestic section)
      type MealProvisionData = {
        dateFromTo: string;
        breakfast: number;
        lunch: number;
        dinner: number;
        supper: number;
        refreshment: number;
        [key: string]: any; // For any other properties
      };

      // Get meal provision data from the trf_meal_provisions table
      let mealProvisionData: MealProvisionData[] = [];
      try {
        // Check if the table exists first to avoid errors
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'trf_meal_provisions'
          ) as exists
        `;

        if (tableExists[0]?.exists) {
          mealProvisionData = await sql`
            SELECT 
              date_from_to as "dateFromTo",
              breakfast,
              lunch,
              dinner,
              supper,
              refreshment
            FROM trf_meal_provisions 
            WHERE trf_id = ${trfId}
          `;
          console.log(
            `API_TRF_TRFID_GET (PostgreSQL): Fetched meal provision data from trf_meal_provisions table.`,
          );
        } else {
          // Fallback to getting meal provision data from itinerary segments if table doesn't exist
          mealProvisionData = await sql`
            SELECT 
              CONCAT(MIN(segment_date), ' to ', MAX(segment_date)) as "dateFromTo",
              0 as breakfast,
              0 as lunch,
              0 as dinner,
              0 as supper,
              0 as refreshment
            FROM trf_itinerary_segments 
            WHERE trf_id = ${trfId}
          `;
          console.log(
            `API_TRF_TRFID_GET (PostgreSQL): trf_meal_provisions table does not exist. Fetched meal provision data from itinerary segments as fallback.`,
          );
        }
      } catch (dbError: any) {
        console.error(
          `API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching meal provision data:`,
          dbError,
        );
        // Continue execution with empty meal provision data
      }
      const [mealProvision] =
        mealProvisionData.length > 0
          ? mealProvisionData
          : [
              {
                dateFromTo: "",
                breakfast: 0,
                lunch: 0,
                dinner: 0,
                supper: 0,
                refreshment: 0,
              },
            ];
      console.log(`API_TRF_TRFID_GET (PostgreSQL): External parties meal provision data length: ${mealProvisionData.length}, Final meal provision:`, mealProvision);
      
      // Fetch daily meal selections if they exist for External Parties
      let dailyMealSelections: any[] = [];
      try {
        const dailyMealTableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'trf_daily_meal_selections'
          ) as exists
        `;

        if (dailyMealTableExists[0]?.exists) {
          dailyMealSelections = await sql`
            SELECT 
              id,
              trf_id,
              meal_date,
              breakfast,
              lunch,
              dinner,
              supper,
              refreshment
            FROM trf_daily_meal_selections 
            WHERE trf_id = ${trfId}
            ORDER BY meal_date ASC
          `;
          console.log(`API_TRF_TRFID_GET (PostgreSQL): Fetched ${dailyMealSelections.length} daily meal selections for external parties.`);
        }
      } catch (dbError: any) {
        console.error(`API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching daily meal selections for external parties:`, dbError);
      }

      // Add daily meal selections to meal provision if they exist
      if (dailyMealSelections.length > 0) {
        mealProvision.dailyMealSelections = dailyMealSelections.map((selection) => ({
          id: selection.id,
          trf_id: selection.trf_id,
          meal_date: selection.meal_date,
          breakfast: Boolean(selection.breakfast),
          lunch: Boolean(selection.lunch),
          dinner: Boolean(selection.dinner),
          supper: Boolean(selection.supper),
          refreshment: Boolean(selection.refreshment)
        }));
      } else {
        mealProvision.dailyMealSelections = [];
      }
      
      // If meal provision data is empty and TRF is approved, try to generate from itinerary
      if (mealProvisionData.length === 0 && mainTrfData.status === 'Approved' && itinerary.length > 0) {
        console.log(`API_TRF_TRFID_GET (PostgreSQL): Generating meal provision data for approved external parties TRF from itinerary`);
        const firstDate = itinerary[0].segment_date;
        const lastDate = itinerary[itinerary.length - 1].segment_date;
        mealProvision.dateFromTo = `${firstDate} to ${lastDate}`;
        // Set default meal values for approved TRFs
        mealProvision.breakfast = 1;
        mealProvision.lunch = 1;
        mealProvision.dinner = 1;
        mealProvision.supper = 0;
        mealProvision.refreshment = 1;
      }

      // Define type for accommodation details result
      type AccommodationDetailsResult = {
        id: string;
        check_in_date: string | null;
        check_out_date: string | null;
        accommodation_type: string | null;
        from_location: string | null;
        to_location: string | null;
        remarks: string | null;
        [key: string]: any; // For any other properties
      };

      // Get accommodation details with the correct column names for external parties
      let accommodationDetailsResult: AccommodationDetailsResult[] = [];
      try {
        accommodationDetailsResult = await sql`
          SELECT 
            id,
            check_in_date, 
            check_out_date, 
            accommodation_type, 
            from_location,
            to_location,
            remarks,
            estimated_cost_per_night
          FROM trf_accommodation_details 
          WHERE trf_id = ${trfId}
        `;
        console.log(
          `API_TRF_TRFID_GET (PostgreSQL): Fetched ${accommodationDetailsResult.length} accommodation details for external parties.`,
        );
      } catch (dbError: any) {
        console.error(
          `API_TRF_TRFID_GET_DB_ERROR (PostgreSQL): Error fetching accommodation details for external parties:`,
          dbError,
        );
        // Continue execution with empty accommodation details
      }

      // Format accommodation details with properties needed by the TrfView component
      const accommodationDetails = accommodationDetailsResult.map((acc) => ({
        id: acc.id || "",
        // Properties from the database
        checkInDate: safeParseISO(acc.check_in_date),
        checkOutDate: safeParseISO(acc.check_out_date),
        placeOfStay: acc.from_location || acc.accommodation_type || "",
        remarks: acc.remarks || "",
        // Additional properties needed by the TrfView component
        estimatedCostPerNight: Number(acc.estimated_cost_per_night) || 0,
        // Include snake_case versions for compatibility with the TrfView component
        check_in_date: safeParseISO(acc.check_in_date),
        check_out_date: safeParseISO(acc.check_out_date),
        place_of_stay: acc.from_location || acc.accommodation_type || "",
        estimated_cost_per_night: acc.estimated_cost_per_night || null,
      }));
      console.log(
        `API_TRF_TRFID_GET (PostgreSQL): estimatedCostPerNight after mapping:`,
        accommodationDetails.map((acc) => acc.estimatedCostPerNight),
      );

      // Build external parties travel details with proper structure
      
      // Process itinerary segments and add default remarks for approved TRFs if empty
      const processedExternalItinerary = itinerary.map((seg) => {
        // Use our helper function to map database columns to frontend fields
        const mappedSeg = mapDbItineraryToFrontend(seg);
        // If TRF is approved and remarks are empty, add a default remark
        if (mainTrfData.status === 'Approved' && (!mappedSeg.remarks || mappedSeg.remarks === '')) {
          mappedSeg.remarks = 'Approved for travel';
        }
        // Handle date parsing specifically for the frontend
        return {
          ...mappedSeg,
          date: mappedSeg.date ? safeParseISO(mappedSeg.date) : null,
        };
      });
      
      trfData.externalPartiesTravelDetails = {
        purpose: mainTrfData.purpose || "",
        itinerary: processedExternalItinerary,
        // Include accommodationDetails array with proper format
        accommodationDetails: accommodationDetails,
        // Include mealProvision with both formats
        mealProvision: {
          date_from_to: mealProvision.dateFromTo || "",
          dateFromTo: mealProvision.dateFromTo || "",
          breakfast: Number(mealProvision.breakfast || 0),
          lunch: Number(mealProvision.lunch || 0),
          dinner: Number(mealProvision.dinner || 0),
          supper: Number(mealProvision.supper || 0),
          refreshment: Number(mealProvision.refreshment || 0),
        },
      };

      // Set external party requestor info
      trfData.externalPartyRequestorInfo = {
        externalFullName: mainTrfData.external_full_name || "",
        externalOrganization: mainTrfData.external_organization || "",
        externalRefToAuthorityLetter:
          mainTrfData.external_ref_to_authority_letter || "",
        externalCostCenter: mainTrfData.external_cost_center || "",
      };
    }

    // Estimated cost is not part of the details object in the type but directly on TRF
    if ("estimated_cost" in mainTrfData) {
      (trfData as any).estimatedCost = Number(mainTrfData.estimated_cost) || 0;
    }

    console.log(
      `API_TRF_TRFID_GET (PostgreSQL): TRF ${trfId} data fully assembled.`,
    );
    return NextResponse.json({ trf: trfData as TravelRequestForm });
  } catch (error: any) {
    console.error(
      `API_TRF_TRFID_GET_ERROR (PostgreSQL) for TRF ${trfId}:`,
      error.message,
      error.stack,
    );

    // Check if the error is related to a missing table or column
    const errorMessage = error.message || "";
    if (
      errorMessage.includes("does not exist") ||
      errorMessage.includes("42P01")
    ) {
      // Database schema issue
      console.error(
        `API_TRF_TRFID_GET_SCHEMA_ERROR (PostgreSQL): Schema mismatch detected in the database`,
      );
      return NextResponse.json(
        {
          error: `Database schema issue detected. Please contact the administrator.`,
          details: {
            message:
              "The database schema does not match the expected structure.",
            technicalDetails: errorMessage.substring(0, 200), // Limit the error message length
          },
        },
        { status: 500 },
      );
    } else if (
      errorMessage.includes("dateString.split") ||
      errorMessage.includes("is not a function")
    ) {
      // Date parsing error
      console.error(
        `API_TRF_TRFID_GET_DATE_ERROR (PostgreSQL): Date parsing error`,
      );
      return NextResponse.json(
        {
          error: `Error processing date values in the TRF.`,
          details: {
            message: "There was an error processing date values in the TRF.",
            technicalDetails: errorMessage.substring(0, 200), // Limit the error message length
          },
        },
        { status: 500 },
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: `Failed to fetch TRF details.`,
        details: {
          message: error.message || "Unknown error",
          errorType: error.name || "Error",
          errorCode: error.code || "UNKNOWN",
        },
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { trfId: string } },
) {
  // Fix for NextJS dynamic route params error - must await params
  const { trfId } = await Promise.resolve(params);
  console.log(`API_TRF_TRFID_PUT_START (PostgreSQL): Updating TRF ${trfId}.`);
  if (!sql) {
    console.error(
      "API_TRF_TRFID_PUT_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.",
    );
    return NextResponse.json(
      {
        error: "Database client not initialized.",
      },
      { status: 503 },
    );
  }

  let validatedData: any;
  try {
    const rawBody = await request.json();
    console.log(
      `API_TRF_TRFID_PUT (PostgreSQL): Validating TRF data for ${trfId}`,
    );
    console.log(
      `API_TRF_TRFID_PUT (PostgreSQL): estimatedCostPerNight in rawBody:`,
      rawBody.externalPartiesTravelDetails?.accommodationDetails?.map(
        (acc: any) => acc.estimatedCostPerNight,
      ),
    );

    // Ensure all required objects exist and have default values to prevent validation errors
    console.log(
      `API_TRF_TRFID_PUT (PostgreSQL): Preprocessing request data for ${trfId}`,
    );

    // Ensure requestorInfo is always an object
    rawBody.requestorInfo = rawBody.requestorInfo || {};
    // Move top-level requestor properties into requestorInfo
    rawBody.requestorInfo.requestorName =
      rawBody.requestorName || rawBody.requestorInfo.requestorName || "";
    rawBody.requestorInfo.staffId =
      rawBody.staffId || rawBody.requestorInfo.staffId || null;
    rawBody.requestorInfo.department =
      rawBody.department || rawBody.requestorInfo.department || null;
    rawBody.requestorInfo.position =
      rawBody.position || rawBody.requestorInfo.position || null;
    rawBody.requestorInfo.costCenter =
      rawBody.costCenter || rawBody.requestorInfo.costCenter || null;
    rawBody.requestorInfo.telEmail =
      rawBody.telEmail || rawBody.requestorInfo.telEmail || null;
    rawBody.requestorInfo.email =
      rawBody.email || rawBody.requestorInfo.email || "";

    // Ensure externalPartyRequestorInfo is always an object
    rawBody.externalPartyRequestorInfo =
      rawBody.externalPartyRequestorInfo || {};
    // Move top-level external party requestor properties into externalPartyRequestorInfo
    rawBody.externalPartyRequestorInfo.externalFullName =
      rawBody.externalFullName ||
      rawBody.externalPartyRequestorInfo.externalFullName ||
      "";
    rawBody.externalPartyRequestorInfo.externalOrganization =
      rawBody.externalOrganization ||
      rawBody.externalPartyRequestorInfo.externalOrganization ||
      "";
    rawBody.externalPartyRequestorInfo.externalRefToAuthorityLetter =
      rawBody.externalRefToAuthorityLetter ||
      rawBody.externalPartyRequestorInfo.externalRefToAuthorityLetter ||
      "";
    rawBody.externalPartyRequestorInfo.externalCostCenter =
      rawBody.externalCostCenter ||
      rawBody.externalPartyRequestorInfo.externalCostCenter ||
      "";

    // Handle travel details based on type
    if (rawBody.travelType === "Domestic") {
      rawBody.domesticTravelDetails = rawBody.domesticTravelDetails || {};
      rawBody.domesticTravelDetails.purpose =
        rawBody.purpose || rawBody.domesticTravelDetails.purpose || "";
      rawBody.domesticTravelDetails.itinerary =
        rawBody.itinerary || rawBody.domesticTravelDetails.itinerary || [];
      rawBody.domesticTravelDetails.mealProvision =
        rawBody.mealProvision ||
        rawBody.domesticTravelDetails.mealProvision ||
        {};
      rawBody.domesticTravelDetails.accommodationDetails =
        rawBody.accommodationDetails ||
        rawBody.domesticTravelDetails.accommodationDetails ||
        [];
      rawBody.domesticTravelDetails.companyTransportDetails =
        rawBody.companyTransportDetails ||
        rawBody.domesticTravelDetails.companyTransportDetails ||
        [];
    } else if (
      rawBody.travelType === "Overseas" ||
      rawBody.travelType === "Home Leave Passage"
    ) {
      rawBody.overseasTravelDetails = rawBody.overseasTravelDetails || {};
      rawBody.overseasTravelDetails.purpose =
        rawBody.purpose || rawBody.overseasTravelDetails.purpose || "";
      rawBody.overseasTravelDetails.itinerary =
        rawBody.itinerary || rawBody.overseasTravelDetails.itinerary || [];
      rawBody.overseasTravelDetails.advanceBankDetails =
        rawBody.advanceBankDetails ||
        rawBody.overseasTravelDetails.advanceBankDetails ||
        {};
      rawBody.overseasTravelDetails.advanceAmountRequested =
        rawBody.advanceAmountRequested ||
        rawBody.overseasTravelDetails.advanceAmountRequested ||
        [];
    } else if (rawBody.travelType === "External Parties") {
      rawBody.externalPartiesTravelDetails =
        rawBody.externalPartiesTravelDetails || {};
      rawBody.externalPartiesTravelDetails.purpose =
        rawBody.purpose || rawBody.externalPartiesTravelDetails.purpose || "";
      rawBody.externalPartiesTravelDetails.itinerary =
        rawBody.itinerary ||
        rawBody.externalPartiesTravelDetails.itinerary ||
        [];
      rawBody.externalPartiesTravelDetails.accommodationDetails =
        rawBody.accommodationDetails ||
        rawBody.externalPartiesTravelDetails.accommodationDetails ||
        [];
      rawBody.externalPartiesTravelDetails.mealProvision =
        rawBody.mealProvision ||
        rawBody.externalPartiesTravelDetails.mealProvision ||
        {};
    }

    // Move top-level purpose to appropriate nested detail if not already there
    if (rawBody.purpose && rawBody.travelType) {
      if (rawBody.travelType === "Domestic" && rawBody.domesticTravelDetails) {
        rawBody.domesticTravelDetails.purpose = rawBody.purpose;
      } else if (
        (rawBody.travelType === "Overseas" ||
          rawBody.travelType === "Home Leave Passage") &&
        rawBody.overseasTravelDetails
      ) {
        rawBody.overseasTravelDetails.purpose = rawBody.purpose;
      } else if (
        rawBody.travelType === "External Parties" &&
        rawBody.externalPartiesTravelDetails
      ) {
        rawBody.externalPartiesTravelDetails.purpose = rawBody.purpose;
      }
    }

    // Move top-level itinerary to appropriate nested detail if not already there
    if (rawBody.itinerary && rawBody.travelType) {
      if (rawBody.travelType === "Domestic" && rawBody.domesticTravelDetails) {
        rawBody.domesticTravelDetails.itinerary = rawBody.itinerary;
      } else if (
        (rawBody.travelType === "Overseas" ||
          rawBody.travelType === "Home Leave Passage") &&
        rawBody.overseasTravelDetails
      ) {
        rawBody.overseasTravelDetails.itinerary = rawBody.itinerary;
      } else if (
        rawBody.travelType === "External Parties" &&
        rawBody.externalPartiesTravelDetails
      ) {
        rawBody.externalPartiesTravelDetails.itinerary = rawBody.itinerary;
      }
    }

    // Move top-level advanceBankDetails to appropriate nested detail if not already there
    if (
      rawBody.advanceBankDetails &&
      (rawBody.travelType === "Overseas" ||
        rawBody.travelType === "Home Leave Passage") &&
      rawBody.overseasTravelDetails
    ) {
      rawBody.overseasTravelDetails.advanceBankDetails =
        rawBody.advanceBankDetails;
    }

    // Move top-level advanceAmountRequested to appropriate nested detail if not already there
    if (
      rawBody.advanceAmountRequested &&
      (rawBody.travelType === "Overseas" ||
        rawBody.travelType === "Home Leave Passage") &&
      rawBody.overseasTravelDetails
    ) {
      rawBody.overseasTravelDetails.advanceAmountRequested =
        rawBody.advanceAmountRequested;
    }

    // Move top-level mealProvision to appropriate nested detail if not already there
    if (
      rawBody.mealProvision &&
      (rawBody.travelType === "Domestic" ||
        rawBody.travelType === "External Parties")
    ) {
      if (rawBody.travelType === "Domestic" && rawBody.domesticTravelDetails) {
        rawBody.domesticTravelDetails.mealProvision = rawBody.mealProvision;
      } else if (
        rawBody.travelType === "External Parties" &&
        rawBody.externalPartiesTravelDetails
      ) {
        rawBody.externalPartiesTravelDetails.mealProvision =
          rawBody.mealProvision;
      }
    }

    // Move top-level accommodationDetails to appropriate nested detail if not already there
    if (
      rawBody.accommodationDetails &&
      (rawBody.travelType === "Domestic" ||
        rawBody.travelType === "External Parties")
    ) {
      if (rawBody.travelType === "Domestic" && rawBody.domesticTravelDetails) {
        rawBody.domesticTravelDetails.accommodationDetails =
          rawBody.accommodationDetails;
      } else if (
        rawBody.travelType === "External Parties" &&
        rawBody.externalPartiesTravelDetails
      ) {
        rawBody.externalPartiesTravelDetails.accommodationDetails =
          rawBody.accommodationDetails;
      }
    }

    // Move top-level companyTransportDetails to appropriate nested detail if not already there
    if (
      rawBody.companyTransportDetails &&
      rawBody.travelType === "Domestic" &&
      rawBody.domesticTravelDetails
    ) {
      rawBody.domesticTravelDetails.companyTransportDetails =
        rawBody.companyTransportDetails;
    }

    const validationResult = trfSubmissionSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error(
        "API_TRF_TRFID_PUT_VALIDATION_ERROR (PostgreSQL):",
        validationResult.error.flatten(),
      );
      return NextResponse.json(
        {
          error: "Validation failed for TRF update",
          details: validationResult.error.flatten(),
          message:
            "Please ensure all required fields are filled out correctly.",
        },
        { status: 400 },
      );
    }

    validatedData = validationResult.data;
  } catch (parseError) {
    console.error("API_TRF_TRFID_PUT_PARSE_ERROR (PostgreSQL):", parseError);
    return NextResponse.json(
      {
        error: "Failed to parse request body",
        message: "The request body could not be parsed as valid JSON.",
      },
      { status: 400 },
    );
  }

  try {
    const [existingTrf] =
      await sql`SELECT status FROM travel_requests WHERE id = ${trfId}`;
    if (!existingTrf) {
      return NextResponse.json(
        { error: "TRF not found for update." },
        { status: 404 },
      );
    }
    const editableStatuses = ["Pending Department Focal", "Rejected", "Draft"];
    if (!editableStatuses.includes(existingTrf.status as string)) {
      return NextResponse.json(
        { error: `TRF with status ${existingTrf.status} cannot be edited.` },
        { status: 403 },
      );
    }

    let requestorNameVal: string | null =
      validatedData.requestorInfo?.requestorName || null;
    let staffIdVal: string | null =
      validatedData.requestorInfo?.staffId || null;
    let departmentVal: string | null =
      validatedData.requestorInfo?.department || null;
    let positionVal: string | null =
      validatedData.requestorInfo?.position || null;
    let costCenterVal: string | null =
      validatedData.requestorInfo?.costCenter || null;
    let telEmailVal: string | null =
      validatedData.requestorInfo?.telEmail || null;
    let emailVal: string | null = validatedData.requestorInfo?.email || null;
    let externalFullNameVal: string | null =
      validatedData.externalPartyRequestorInfo?.externalFullName || null;
    let externalOrganizationVal: string | null =
      validatedData.externalPartyRequestorInfo?.externalOrganization || null;
    let externalRefToAuthorityLetterVal: string | null =
      validatedData.externalPartyRequestorInfo?.externalRefToAuthorityLetter ||
      null;
    let externalCostCenterVal: string | null =
      validatedData.externalPartyRequestorInfo?.externalCostCenter || null;
    let purposeVal: string = "";

    if (validatedData.travelType === "Domestic") {
      purposeVal = validatedData.domesticTravelDetails?.purpose || "";
    } else if (
      validatedData.travelType === "Overseas" ||
      validatedData.travelType === "Home Leave Passage"
    ) {
      purposeVal = validatedData.overseasTravelDetails?.purpose || "";
    } else if (validatedData.travelType === "External Parties") {
      purposeVal = validatedData.externalPartiesTravelDetails?.purpose || "";
    }

    // Set requestorNameVal for approval step log, ensuring it's always set
    if (validatedData.travelType === "External Parties") {
      requestorNameVal = externalFullNameVal;
    } else {
      requestorNameVal = validatedData.requestorInfo?.requestorName || null;
    }

    await sql.begin(async (tx) => {
      await tx`
        UPDATE travel_requests
        SET 
          requestor_name = ${requestorNameVal}, staff_id = ${staffIdVal}, department = ${departmentVal}, 
          position = ${positionVal}, cost_center = ${costCenterVal}, tel_email = ${telEmailVal}, email = ${emailVal},
          travel_type = ${validatedData.travelType}, status = 'Pending Department Focal', purpose = ${purposeVal}, 
          additional_comments = ${validatedData.additionalComments || null},
          external_full_name = ${externalFullNameVal}, external_organization = ${externalOrganizationVal}, 
          external_ref_to_authority_letter = ${externalRefToAuthorityLetterVal}, external_cost_center = ${externalCostCenterVal},
          updated_at = NOW()
        WHERE id = ${trfId}
      `;
      console.log(
        "API_TRF_TRFID_PUT (PostgreSQL): Updated travel_requests for ID:",
        trfId,
      );

      // Clear and re-insert related details
      await tx`DELETE FROM trf_itinerary_segments WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM trf_meal_provisions WHERE trf_id = ${trfId}`;
      // Delete daily meal selections if table exists
      const dailyMealTableExists = await tx`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'trf_daily_meal_selections'
        ) as exists
      `;
      if (dailyMealTableExists[0]?.exists) {
        await tx`DELETE FROM trf_daily_meal_selections WHERE trf_id = ${trfId}`;
      }
      await tx`DELETE FROM trf_accommodation_details WHERE trf_id = ${trfId}`;
      // Check if trf_company_transport_details table exists first
      const tableExists = await tx`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'trf_company_transport_details'
        ) as exists
      `;

      if (tableExists[0]?.exists) {
        console.log(
          "API_TRF_TRFID_PUT (PostgreSQL): trf_company_transport_details table exists. Deleting records.",
        );
        await tx`DELETE FROM trf_company_transport_details WHERE trf_id = ${trfId}`;
      } else {
        console.log(
          "API_TRF_TRFID_PUT (PostgreSQL): trf_company_transport_details table does not exist. Skipping delete.",
        );
      }
      await tx`DELETE FROM trf_advance_bank_details WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM trf_advance_amount_requested_items WHERE trf_id = ${trfId}`;
      // Approval history could be preserved or an "Edited" step added
      await tx`DELETE FROM trf_approval_steps WHERE trf_id = ${trfId} AND step_role != 'Requestor'`;
      await tx`
        INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
        VALUES (${trfId}, 'Requestor', ${requestorNameVal}, 'Edited', NOW(), 'TRF Edited and Resubmitted.')
      `;
      console.log(
        "API_TRF_TRFID_PUT (PostgreSQL): Handled related tables deletions and added 'Edited' step for ID:",
        trfId,
      );

      // Re-insert itinerary
      let itineraryToSave: any[] = [];
      if (validatedData.travelType === "Domestic")
        itineraryToSave = validatedData.domesticTravelDetails.itinerary;
      else if (
        validatedData.travelType === "Overseas" ||
        validatedData.travelType === "Home Leave Passage"
      )
        itineraryToSave = validatedData.overseasTravelDetails.itinerary;
      else if (validatedData.travelType === "External Parties")
        itineraryToSave = validatedData.externalPartiesTravelDetails.itinerary;

      if (itineraryToSave.length > 0) {
        const itineraryInserts = itineraryToSave.map((seg) =>
          mapFrontendItineraryToDb(seg, trfId),
        );
        await tx`INSERT INTO trf_itinerary_segments ${tx(itineraryInserts, "trf_id", "segment_date", "day_of_week", "from_location", "to_location", "departure_time", "arrival_time", "flight_number", "flight_class", "remarks")}`;
      }

      // Handle meal provisions for all travel types that have them
      let mealProvisionData: any = null;
      if (validatedData.travelType === "Domestic") {
        mealProvisionData = validatedData.domesticTravelDetails.mealProvision;
      } else if (validatedData.travelType === "External Parties") {
        mealProvisionData = validatedData.externalPartiesTravelDetails.mealProvision;
      }
      
      if (mealProvisionData) {
        console.log("API_TRF_TRFID_PUT (PostgreSQL): Inserting meal provisions for TRF ID:", trfId);
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
        console.log("API_TRF_TRFID_PUT (PostgreSQL): Successfully inserted meal provisions.");

        // Insert daily meal selections if they exist and table is available
        if (mealProvisionData.dailyMealSelections && mealProvisionData.dailyMealSelections.length > 0) {
          if (dailyMealTableExists[0]?.exists) {
            console.log("API_TRF_TRFID_PUT (PostgreSQL): Inserting daily meal selections for TRF ID:", trfId);
            
            for (const selection of mealProvisionData.dailyMealSelections) {
              await tx`INSERT INTO trf_daily_meal_selections (
                trf_id,
                meal_date,
                breakfast,
                lunch,
                dinner,
                supper,
                refreshment
              ) VALUES (
                ${trfId},
                ${selection.meal_date ? formatISO(selection.meal_date, { representation: "date" }) : null},
                ${Boolean(selection.breakfast)},
                ${Boolean(selection.lunch)},
                ${Boolean(selection.dinner)},
                ${Boolean(selection.supper)},
                ${Boolean(selection.refreshment)}
              )`;
            }
            console.log(`API_TRF_TRFID_PUT (PostgreSQL): Successfully inserted ${mealProvisionData.dailyMealSelections.length} daily meal selections.`);
          } else {
            console.log("API_TRF_TRFID_PUT (PostgreSQL): trf_daily_meal_selections table does not exist. Skipping daily meal selections insert.");
          }
        }
      }

      // Re-insert type-specific details
      if (validatedData.travelType === "Domestic") {
        const details = validatedData.domesticTravelDetails;
        if (
          details.accommodationDetails &&
          details.accommodationDetails.length > 0
        ) {
          const accomInserts = details.accommodationDetails.map((acc: any) => ({
            trf_id: trfId,
            accommodation_type: acc.accommodationType,
            other_type_description: acc.otherTypeDescription || null,
            check_in_date: acc.checkInDate
              ? formatISO(acc.checkInDate, { representation: "date" })
              : null,
            check_in_time: acc.checkInTime || null,
            check_out_date: acc.checkOutDate
              ? formatISO(acc.checkOutDate, { representation: "date" })
              : null,
            check_out_time: acc.checkOutTime || null,
            location: acc.location || null,
            remarks: acc.remarks || null,
            estimated_cost_per_night: Number(acc.estimatedCostPerNight || 0),
            address: acc.address || null,
            place_of_stay: acc.placeOfStay || null,
          }));
          await tx`INSERT INTO trf_accommodation_details ${tx(accomInserts, "trf_id", "accommodation_type", "other_type_description", "check_in_date", "check_in_time", "check_out_date", "check_out_time", "location", "remarks", "estimated_cost_per_night", "address", "place_of_stay")}`;
        }
        if (
          details.companyTransportDetails &&
          details.companyTransportDetails.length > 0
        ) {
          const transportInserts = details.companyTransportDetails.map(
            (trans: any) => ({
              trf_id: trfId,
              transport_date: trans.date
                ? formatISO(trans.date, { representation: "date" })
                : null,
              day_of_week: trans.day || "",
              from_location: trans.from || "",
              to_location: trans.to || "",
              bt_no_required: trans.btNoRequired || "",
              accommodation_type_n: trans.accommodationTypeN || "",
              address: trans.address || "",
              remarks: trans.remarks || null,
            }),
          );

          // Check if table exists before attempting insert
          const tableExists = await tx`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'trf_company_transport_details'
            ) as exists
          `;

          if (tableExists[0]?.exists) {
            console.log(
              "API_TRF_TRFID_PUT (PostgreSQL): trf_company_transport_details table exists. Inserting records.",
            );
            try {
              // Insert each record individually to avoid any potential issues
              for (const insert of transportInserts) {
                await tx`
                  INSERT INTO trf_company_transport_details (
                    trf_id, transport_date, day_of_week, from_location, to_location, 
                    bt_no_required, accommodation_type_n, address, remarks
                  ) VALUES (
                    ${insert.trf_id}, ${insert.transport_date}, ${insert.day_of_week}, 
                    ${insert.from_location}, ${insert.to_location}, ${insert.bt_no_required}, 
                    ${insert.accommodation_type_n}, ${insert.address}, ${insert.remarks}
                  )
                `;
              }
              console.log(
                "API_TRF_TRFID_PUT (PostgreSQL): Successfully inserted transport details.",
              );
            } catch (error: any) {
              console.error(
                "API_TRF_TRFID_PUT_ERROR (PostgreSQL): Error inserting transport details:",
                error,
              );
              // Continue with the rest of the update process
            }
          } else {
            console.log(
              "API_TRF_TRFID_PUT (PostgreSQL): trf_company_transport_details table does not exist. Skipping insert.",
            );
          }
        }
      } else if (validatedData.travelType === "External Parties") {
        const details = validatedData.externalPartiesTravelDetails;
        if (
          details.accommodationDetails &&
          details.accommodationDetails.length > 0
        ) {
          const accomInserts = details.accommodationDetails.map((acc: any) => ({
            trf_id: trfId,
            accommodation_type: "External Party Provided",
            check_in_date: acc.checkInDate
              ? formatISO(acc.checkInDate, { representation: "date" })
              : null,
            check_out_date: acc.checkOutDate
              ? formatISO(acc.checkOutDate, { representation: "date" })
              : null,
            place_of_stay: acc.placeOfStay,
            estimated_cost_per_night: Number(acc.estimatedCostPerNight || 0),
            remarks: acc.remarks || null,
          }));
          await tx`INSERT INTO trf_accommodation_details ${tx(accomInserts, "trf_id", "accommodation_type", "check_in_date", "check_out_date", "place_of_stay", "estimated_cost_per_night", "remarks")}`;
        }
      } else if (
        validatedData.travelType === "Overseas" ||
        validatedData.travelType === "Home Leave Passage"
      ) {
        const details = validatedData.overseasTravelDetails;
        if (details.advanceBankDetails) {
          await tx`INSERT INTO trf_advance_bank_details (trf_id, bank_name, account_number) VALUES (${trfId}, ${details.advanceBankDetails.bankName}, ${details.advanceBankDetails.accountNumber})`;
        }
        if (
          details.advanceAmountRequested &&
          details.advanceAmountRequested.length > 0
        ) {
          const advanceAmountInserts = details.advanceAmountRequested.map(
            (item: any) => ({
              trf_id: trfId,
              date_from: item.dateFrom
                ? formatISO(item.dateFrom, { representation: "date" })
                : null,
              date_to: item.dateTo
                ? formatISO(item.dateTo, { representation: "date" })
                : null,
              lh: Number(item.lh || 0),
              ma: Number(item.ma || 0),
              oa: Number(item.oa || 0),
              tr: Number(item.tr || 0),
              oe: Number(item.oe || 0),
              usd: Number(item.usd || 0),
              remarks: item.remarks || null,
            }),
          );
          await tx`INSERT INTO trf_advance_amount_requested_items ${tx(advanceAmountInserts, "trf_id", "date_from", "date_to", "lh", "ma", "oa", "tr", "oe", "usd", "remarks")}`;
        }
      }
      console.log(
        "API_TRF_TRFID_PUT (PostgreSQL): Transaction committed for update of ID:",
        trfId,
      );
    });

    const notificationLog = `Placeholder: Send Notification - TRF Updated - ID: ${trfId}. To Requestor.`;
    console.log(notificationLog);

    // Auto-generate/update Transport and Accommodation requests if applicable
    let autoGeneratedRequests = { transportRequests: [], accommodationRequests: [] };
    try {
      const tsrData = {
        id: trfId,
        travelType: validatedData.travelType,
        requestorName: requestorNameVal || 'Unknown',
        staffId: validatedData.requestorInfo?.staffId,
        department: validatedData.requestorInfo?.department,
        position: validatedData.requestorInfo?.position,
        purpose: purposeVal,
        domesticTravelDetails: validatedData.domesticTravelDetails,
        externalPartiesTravelDetails: validatedData.externalPartiesTravelDetails,
        overseasTravelDetails: validatedData.overseasTravelDetails
      };

      autoGeneratedRequests = await TSRAutoGenerationService.updateAutoGeneratedRequests(tsrData, 'system');
      
      if (autoGeneratedRequests.transportRequests.length > 0 || autoGeneratedRequests.accommodationRequests.length > 0) {
        console.log(`API_TRF_PUT: Auto-generated ${autoGeneratedRequests.transportRequests.length} transport requests and ${autoGeneratedRequests.accommodationRequests.length} accommodation requests for updated TSR ${trfId}`);
      }
    } catch (autoGenError) {
      console.error(`API_TRF_PUT_AUTO_GEN_ERROR: Failed to auto-generate requests for updated TSR ${trfId}:`, autoGenError);
      // Don't fail the entire TSR update due to auto-generation errors
    }

    // Fetch the updated TRF to return it with all joined details
    const [updatedFullTrf] =
      await sql`SELECT * FROM travel_requests WHERE id = ${trfId}`;

    return NextResponse.json({
      message: "TRF updated successfully!",
      trf: { ...updatedFullTrf, id: trfId, status: "Pending Department Focal" },
      autoGenerated: autoGeneratedRequests
    }); // Simplified return
  } catch (error: any) {
    console.error(
      `API_TRF_TRFID_PUT_ERROR (PostgreSQL) for TRF ${trfId}:`,
      error.message,
      error.stack,
    );
    return NextResponse.json(
      { error: "Failed to update TRF.", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { trfId: string } },
) {
  const { trfId } = params;
  console.log(`API_TRF_TRFID_DELETE_START: Deleting TRF ${trfId}.`);

  if (!sql) {
    console.error(
      "API_TRF_TRFID_DELETE_CRITICAL_ERROR: SQL client is not initialized.",
    );
    return NextResponse.json(
      { error: "Database client not initialized." },
      { status: 503 },
    );
  }

  try {
    const [existingTrf] =
      await sql`SELECT status FROM travel_requests WHERE id = ${trfId}`;

    if (!existingTrf) {
      return NextResponse.json(
        { error: "TRF not found for deletion." },
        { status: 404 },
      );
    }

    const deletableStatuses = ["Pending Department Focal", "Rejected", "Draft"];
    if (!deletableStatuses.includes(existingTrf.status as string)) {
      return NextResponse.json(
        { error: `TRF with status ${existingTrf.status} cannot be deleted.` },
        { status: 403 },
      );
    }

    await sql.begin(async (tx) => {
      await tx`DELETE FROM trf_itinerary_segments WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM trf_meal_provisions WHERE trf_id = ${trfId}`;
      // Delete daily meal selections if table exists
      const dailyMealTableExists = await tx`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'trf_daily_meal_selections'
        ) as exists
      `;
      if (dailyMealTableExists[0]?.exists) {
        await tx`DELETE FROM trf_daily_meal_selections WHERE trf_id = ${trfId}`;
      }
      await tx`DELETE FROM trf_accommodation_details WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM trf_company_transport_details WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM trf_advance_bank_details WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM trf_advance_amount_requested_items WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM trf_approval_steps WHERE trf_id = ${trfId}`;
      await tx`DELETE FROM travel_requests WHERE id = ${trfId}`;
    });

    console.log(
      `API_TRF_TRFID_DELETE_SUCCESS: Successfully deleted TRF ${trfId}.`,
    );
    return NextResponse.json({ message: `TRF ${trfId} deleted successfully.` });
  } catch (error: any) {
    console.error(
      `API_TRF_TRFID_DELETE_ERROR for TRF ${trfId}:`,
      error.message,
      error.stack,
    );
    return NextResponse.json(
      { error: "Failed to delete TRF.", details: error.message },
      { status: 500 },
    );
  }
}

// Generate full approval workflow including pending steps (similar to Transport approach)
function generateFullTrfApprovalWorkflow(
  currentStatus: string, 
  completedSteps: any[],
  requestorName?: string
): any[] {
  // Define the expected workflow sequence for TRF
  const expectedWorkflow = [
    { role: 'Requestor', name: requestorName || 'System', status: 'Submitted' as const },
    { role: 'Department Focal', name: 'TBD', status: 'Pending' as const },
    { role: 'Line Manager', name: 'TBD', status: 'Pending' as const },
    { role: 'HOD', name: 'TBD', status: 'Pending' as const }
  ];

  // Map completed steps by role for easy lookup
  const completedByRole = completedSteps.reduce((acc: any, step: any) => {
    acc[step.role] = step;
    return acc;
  }, {});

  // Generate the full workflow
  const fullWorkflow: any[] = [];

  for (const expectedStep of expectedWorkflow) {
    const completedStep = completedByRole[expectedStep.role];
    
    if (completedStep) {
      // Use the completed step data
      fullWorkflow.push({
        role: completedStep.role,
        name: completedStep.name,
        status: completedStep.status,
        date: completedStep.date,
        comments: completedStep.comments
      });
    } else {
      // Determine status based on current request status
      let stepStatus = 'Pending';
      
      if (currentStatus === 'Rejected' || currentStatus === 'Cancelled') {
        stepStatus = 'Not Started';
      } else if (currentStatus === 'Approved') {
        // If approved, all pending steps should show as not started unless they were actually completed
        stepStatus = 'Not Started';
      } else if (currentStatus === `Pending ${expectedStep.role}`) {
        stepStatus = 'Current';
      }

      fullWorkflow.push({
        role: expectedStep.role,
        name: expectedStep.name,
        status: stepStatus,
        date: undefined,
        comments: undefined
      });
    }
  }

  return fullWorkflow;
}
