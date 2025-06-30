// src/app/api/trf/[trfId]/admin/book-flight/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO, parseISO, isValid } from 'date-fns';

const bookFlightSchema = z.object({
    pnr: z.string().optional().nullable(),
    airline: z.string().optional().nullable(),
    flightNumber: z.string().optional().nullable(),
    departureAirport: z.string().optional().nullable(),
    arrivalAirport: z.string().optional().nullable(),
    departureDateTime: z.string().datetime({ message: "Invalid departure date/time format" }).optional().nullable(),
    arrivalDateTime: z.string().datetime({ message: "Invalid arrival date/time format" }).optional().nullable(),
    cost: z.preprocess(
        (val) => (typeof val === 'string' && val.trim() === '') ? null : Number(val),
        z.number().positive("Cost must be a positive number").optional().nullable()
    ),
    flightNotes: z.string().optional().nullable(),
});

function getNextStatusAfterFlightBooking(trf: { travel_type?: string | null, has_accommodation_request?: boolean }): string { // Assuming has_accommodation_request is a boolean indicating if accomm details were part of TRF
    if (trf.has_accommodation_request) {
        return "Processing Accommodation";
    }
    if (trf.travel_type === 'Overseas' || trf.travel_type === 'Home Leave Passage') {
        return "Awaiting Visa";
    }
    return "TRF Processed";
}

export async function POST(request: NextRequest, { params }: { params: { trfId: string } }) {
  const { trfId } = params;
  console.log(`API_TRF_ADMIN_BOOKFLIGHT_POST_START (PostgreSQL): Booking flight for TRF ${trfId}.`);
  if (!sql) {
    console.error("API_TRF_ADMIN_BOOKFLIGHT_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  
  let body;
  try {
      body = await request.json();
  } catch (error) {
      console.error("API_TRF_ADMIN_BOOKFLIGHT_POST (PostgreSQL): Invalid JSON payload", error);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validationResult = bookFlightSchema.safeParse(body);
  if (!validationResult.success) {
    console.error("API_TRF_ADMIN_BOOKFLIGHT_POST (PostgreSQL): Validation failed", validationResult.error.flatten());
    return NextResponse.json({ error: "Validation failed for flight booking details", details: validationResult.error.flatten() }, { status: 400 });
  }
  const { pnr, airline, flightNumber, departureAirport, arrivalAirport, departureDateTime, arrivalDateTime, cost, flightNotes } = validationResult.data;

  try {
    const [currentTrf] = await sql`
        SELECT 
            tr.id, tr.status, tr.travel_type, tr.requestor_name, tr.external_full_name,
            EXISTS (SELECT 1 FROM trf_accommodation_details tad WHERE tad.trf_id = tr.id) as has_accommodation_request
        FROM travel_requests tr
        WHERE tr.id = ${trfId}
    `;

    if (!currentTrf) {
      return NextResponse.json({ error: "TRF not found" }, { status: 404 });
    }
    if (currentTrf.status !== 'Approved') {
      return NextResponse.json({ error: `Flights can only be booked for TRFs with status 'Approved'. Current status: ${currentTrf.status}` }, { status: 400 });
    }

    const nextStatus = getNextStatusAfterFlightBooking(currentTrf);
    const adminRole = "Ticketing Admin"; 
    const adminName = "System Ticketing"; // Placeholder

    let bookingSummary = `Flight Booked: PNR ${pnr || 'N/A'}.`;
    if(airline) bookingSummary += ` Airline: ${airline}.`;
    if(flightNumber) bookingSummary += ` FlightNo: ${flightNumber}.`;
    if(departureAirport && arrivalAirport) bookingSummary += ` Route: ${departureAirport}-${arrivalAirport}.`;
    if(departureDateTime) bookingSummary += ` Departs: ${formatISO(parseISO(departureDateTime))}.`;
    if(arrivalDateTime) bookingSummary += ` Arrives: ${formatISO(parseISO(arrivalDateTime))}.`;
    if(cost) bookingSummary += ` Cost: ${cost}.`;
    bookingSummary += ` Notes: ${flightNotes || 'N/A'}`;
    
    // TODO: Save actual flight details to a new table `trf_flight_bookings` linked to trfId

    const [updated] = await sql.begin(async tx => {
        const [updatedTrfResult] = await tx`
            UPDATE travel_requests
            SET status = ${nextStatus}, 
                additional_comments = COALESCE(additional_comments || E'\n\n', '') || ${bookingSummary},
                updated_at = NOW()
            WHERE id = ${trfId}
            RETURNING *
        `;
        await tx`
            INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
            VALUES (${trfId}, ${adminRole}, ${adminName}, 'Flights Booked', NOW(), ${bookingSummary})
        `;
        return updatedTrfResult;
    });
    
    const requestorNameVal = currentTrf.requestor_name || currentTrf.external_full_name || "Requestor";
    const notificationLog = `Placeholder: Send Notification - TRF ${trfId} - Flights Booked by ${adminName}. New Status: ${nextStatus}. Details: ${bookingSummary}. To Requestor: ${requestorNameVal}.`;
    console.log(notificationLog);
    if (nextStatus === 'Processing Accommodation') {
        console.log(`Placeholder: Notify Accommodation Admin - TRF ${trfId} flights booked, proceed with accommodation.`);
    } else if (nextStatus === 'Awaiting Visa') {
        console.log(`Placeholder: Notify Visa Clerk/Requestor - TRF ${trfId} flights booked, proceed with visa if pending.`);
    }

    return NextResponse.json({ message: 'Flight booking processed successfully.', trf: updated });
  } catch (error: any) {
    console.error(`API_TRF_ADMIN_BOOKFLIGHT_POST_ERROR (PostgreSQL) for TRF ${trfId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process flight booking.', details: error.message }, { status: 500 });
  }
}
