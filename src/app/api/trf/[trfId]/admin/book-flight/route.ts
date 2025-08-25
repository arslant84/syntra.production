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
    departureDateTime: z.string().optional().nullable().refine(
        (val) => !val || isValid(parseISO(val)),
        { message: "Invalid departure date/time format" }
    ),
    arrivalDateTime: z.string().optional().nullable().refine(
        (val) => !val || isValid(parseISO(val)),
        { message: "Invalid arrival date/time format" }
    ),
    cost: z.preprocess(
        (val) => (typeof val === 'string' && val.trim() === '') ? null : Number(val),
        z.number().positive("Cost must be a positive number").optional().nullable()
    ),
    flightNotes: z.string().optional().nullable(),
});

function getNextStatusAfterFlightBooking(trf: { travel_type?: string | null, has_accommodation_request?: boolean }): string { 
    // After flight booking, TSRs should remain in approved status for accommodation assignment
    // The accommodation workflow should inherit the TSR's approval status, not start a new process
    if (trf.travel_type === 'Overseas' || trf.travel_type === 'Home Leave Passage') {
        return "Awaiting Visa";
    }
    // Keep TSRs in approved status even if they have accommodation - accommodation inherits this status
    return "TRF Processed";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ trfId: string }> }) {
      const { trfId } = await params;
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

  // Parse and split datetime fields for the new table
  let departure_date = null, departure_time = null, arrival_date = null, arrival_time = null;
  if (departureDateTime && isValid(parseISO(departureDateTime))) {
    const depDateObj = parseISO(departureDateTime);
    departure_date = formatISO(depDateObj, { representation: 'date' });
    departure_time = depDateObj.toISOString().substring(11, 16); // 'HH:MM'
  }
  if (arrivalDateTime && isValid(parseISO(arrivalDateTime))) {
    const arrDateObj = parseISO(arrivalDateTime);
    arrival_date = formatISO(arrDateObj, { representation: 'date' });
    arrival_time = arrDateObj.toISOString().substring(11, 16); // 'HH:MM'
  }

  // Validate required fields for flight booking
  if (!flightNumber || !departureAirport || !arrivalAirport) {
    return NextResponse.json({ 
      error: "Missing required flight information",
      details: "Flight number, departure airport, and arrival airport are required"
    }, { status: 400 });
  }

  // Validate that departure is before arrival
  if (departure_date && arrival_date && departure_time && arrival_time) {
    const depDateTime = new Date(`${departure_date}T${departure_time}`);
    const arrDateTime = new Date(`${arrival_date}T${arrival_time}`);
    
    if (depDateTime >= arrDateTime) {
      return NextResponse.json({ 
        error: "Invalid flight times: Departure must be before arrival",
        details: {
          departure: `${departure_date} ${departure_time}`,
          arrival: `${arrival_date} ${arrival_time}`
        }
      }, { status: 400 });
    }
  } else if (!departure_date || !arrival_date || !departure_time || !arrival_time) {
    return NextResponse.json({ 
      error: "Missing flight times",
      details: "Both departure and arrival dates/times are required"
    }, { status: 400 });
  }

  try {
    const [currentTrf] = await sql`
        SELECT 
            tr.id, tr.status, tr.travel_type, tr.requestor_name, tr.external_full_name,
            EXISTS (SELECT 1 FROM trf_accommodation_details tad WHERE tad.trf_id = tr.id) as has_accommodation_request,
            (SELECT json_agg(tmp) FROM trf_meal_provisions tmp WHERE tmp.trf_id = tr.id) as meal_provisions
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
    if(departureDateTime && isValid(parseISO(departureDateTime))) {
        bookingSummary += ` Departs: ${formatISO(parseISO(departureDateTime))}.`;
    }
    if(arrivalDateTime && isValid(parseISO(arrivalDateTime))) {
        bookingSummary += ` Arrives: ${formatISO(parseISO(arrivalDateTime))}.`;
    }
    if(cost) bookingSummary += ` Cost: ${cost}.`;
    bookingSummary += ` Notes: ${flightNotes || 'N/A'}`;
    
    // Insert into trf_flight_bookings
    try {
      await sql`
        INSERT INTO trf_flight_bookings (
          trf_id, flight_number, flight_class, departure_location, arrival_location,
          departure_date, arrival_date, departure_time, arrival_time,
          booking_reference, status, remarks, created_by
        ) VALUES (
          ${trfId},
          ${flightNumber || ''},
          ${'Economy'}, -- Default flight class
          ${departureAirport || ''},
          ${arrivalAirport || ''},
          ${departure_date},
          ${arrival_date},
          ${departure_time},
          ${arrival_time},
          ${pnr || ''},
          ${'Confirmed'},
          ${flightNotes || ''},
          ${adminName}
        )
      `;
      console.log(`API_TRF_ADMIN_BOOKFLIGHT_POST (PostgreSQL): Successfully inserted flight booking for TRF ${trfId}`);
    } catch (insertError: any) {
      console.error(`API_TRF_ADMIN_BOOKFLIGHT_POST_ERROR (PostgreSQL): Failed to insert flight booking:`, insertError.message);
      if (insertError.code === '23514') { // Check constraint violation
        return NextResponse.json({ 
          error: "Invalid flight booking data",
          details: "Flight times violate database constraints. Please check departure and arrival times.",
          constraint: insertError.constraint
        }, { status: 400 });
      }
      throw insertError; // Re-throw other errors
    }

    const updated = await sql.begin(async tx => {
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
