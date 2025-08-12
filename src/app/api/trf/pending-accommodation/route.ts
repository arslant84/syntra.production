import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log('Fetching pending accommodation requests...');
    
    // Query for accommodation requests that don't have assigned rooms yet
    // This uses the trf_accommodation_details table which stores specific accommodation requests
    const result = await sql`
      SELECT 
        tad.id as "accommodationId",
        tad.trf_id as "trfId",
        tad.check_in_date as "checkInDate",
        tad.check_out_date as "checkOutDate",
        tad.accommodation_type as "roomType",
        tad.location,
        tad.check_in_time as "checkInTime",
        tad.check_out_time as "checkOutTime",
        tad.created_at as "createdAt",
        tr.id,
        tr.requestor_name as "requestorName",
        tr.staff_id as "staffId",
        tr.department,
        tr.status,
        tr.purpose,
        tr.additional_comments as "specialRequests"
      FROM 
        trf_accommodation_details tad
      JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      LEFT JOIN 
        accommodation_bookings ab ON ab.trf_id = tr.id 
          AND ab.status IN ('Confirmed', 'Checked-in', 'Checked-out')
      WHERE 
        tr.status IN ('Approved', 'Pending')
        AND ab.id IS NULL
      ORDER BY 
        tad.created_at DESC
    `;
    
    console.log(`Found ${result.length} pending accommodation requests`);
    
    // Transform the data to match the expected AdminTrfForAccommodation interface
    const transformedRequests = result.map(req => {
      return {
        id: req.id, // Use req.id (the actual travel request ID) instead of req.trfId
        accommodationId: req.accommodationId,
        requestorName: req.requestorName,
        staffId: req.staffId,
        department: req.department,
        location: req.location,
        gender: req.staffId?.endsWith('1') ? 'Male' : req.staffId?.endsWith('2') ? 'Female' : 'Male', // Derive gender from staff ID if possible
        status: req.status,
        requestedCheckInDate: req.checkInDate,
        requestedCheckOutDate: req.checkOutDate,
        requestedRoomType: req.roomType,
        specialRequests: req.specialRequests || req.purpose
      };
    });

    return NextResponse.json({ 
      requests: transformedRequests,
      count: transformedRequests.length
    });
  } catch (error: any) {
    console.error('Error fetching pending accommodation requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending accommodation requests' }, 
      { status: 500 }
    );
  }
}
