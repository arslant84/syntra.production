// src/app/api/accommodation/requests/[requestId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAccommodationRequestById } from '@/lib/accommodation-service';
import { sql } from '@/lib/db';
import type { AccommodationRequestDetails } from '@/types/accommodation';

interface RouteParams {
  params: Promise<{
    requestId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { requestId } = await params;
  console.log(`API_ACCOM_REQ_ID_GET_START: Fetching accommodation request ${requestId}.`);

  try {
    const accommodationRequest = await getAccommodationRequestById(requestId);

    if (!accommodationRequest) {
      return NextResponse.json({ error: 'Accommodation request not found' }, { status: 404 });
    }
    
    return NextResponse.json({ accommodationRequest });
  } catch (error: any) {
    console.error(`API_ACCOM_REQ_ID_GET_ERROR (PostgreSQL) for request ${requestId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch accommodation request details.', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await params;
    const body = await request.json();
    
    const { 
      location, 
      requestedCheckInDate, 
      requestedCheckOutDate, 
      requestedRoomType, 
      specialRequests, 
      flightArrivalTime, 
      flightDepartureTime 
    } = body;

    // Update the accommodation details in trf_accommodation_details table
    await sql`
      UPDATE trf_accommodation_details 
      SET 
        location = ${location},
        check_in_date = ${requestedCheckInDate},
        check_out_date = ${requestedCheckOutDate},
        accommodation_type = ${requestedRoomType},
        check_in_time = ${flightArrivalTime},
        check_out_time = ${flightDepartureTime}
      WHERE trf_id = ${requestId}
    `;

    // Update the travel request with special requests
    await sql`
      UPDATE travel_requests 
      SET 
        additional_comments = ${specialRequests},
        updated_at = NOW()
      WHERE id = ${requestId}
    `;

    const updatedRequest = await getAccommodationRequestById(requestId);
    
    return NextResponse.json({ accommodationRequest: updatedRequest });
  } catch (error: any) {
    console.error('Error updating accommodation request:', error);
    return NextResponse.json(
      { error: 'Failed to update accommodation request', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await params;

    // Delete the accommodation details first (due to foreign key constraints)
    await sql`
      DELETE FROM trf_accommodation_details 
      WHERE trf_id = ${requestId}
    `;

    // Delete the travel request
    await sql`
      DELETE FROM travel_requests 
      WHERE id = ${requestId}
    `;
    
    return NextResponse.json({ message: 'Accommodation request deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting accommodation request:', error);
    return NextResponse.json(
      { error: 'Failed to delete accommodation request', details: error.message },
      { status: 500 }
    );
  }
}
