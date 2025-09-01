import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { generateUniversalUserFilterSQL, shouldBypassUserFilter } from '@/lib/universal-user-matching';

export const GET = withAuth(async function(request: NextRequest) {
  console.log("API_ADMIN_ACCOMMODATION_GET_START: Fetching accommodation requests for admin.");
  
  const session = (request as any).user;
  
  // Check if user has permission to manage accommodation
  if (!hasPermission(session, 'manage_accommodation_bookings') && !hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions for accommodation admin' }, { status: 403 });
  }
  
  console.log(`API_ADMIN_ACCOMMODATION_GET: Admin ${session.role} (${session.email}) accessing accommodation data`);
  
  if (!sql) {
    console.error('Database client is null - checking initialization...');
    try {
      const { getSql } = await import('@/lib/db');
      const sqlInstance = getSql();
      if (!sqlInstance) {
        console.error('Failed to get SQL instance from getSql()');
        return NextResponse.json({ 
          error: 'Database client not initialized.',
          details: 'SQL instance is null after initialization attempt'
        }, { status: 503 });
      }
    } catch (dbError: any) {
      console.error('Database initialization error:', dbError);
      return NextResponse.json({ 
        error: 'Database connection failed.',
        details: dbError.message 
      }, { status: 503 });
    }
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const searchTerm = searchParams.get('search')?.trim();
  const statusFilter = searchParams.get('status')?.trim();
  const statusesToFetch = searchParams.get('statuses')?.split(',').map(s => s.trim()).filter(Boolean);
  const processing = searchParams.get('processing') === 'true';
  const sortBy = searchParams.get('sortBy') || 'submitted_at';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const offset = Math.max(0, (page - 1) * limit);

  const whereClauses: any[] = [];
  
  // Filter for requests that have accommodation details (any travel type with accommodation)
  whereClauses.push(sql`ad.trf_id IS NOT NULL`);
  
  // Admin pages always show ALL accommodation requests without user filtering
  console.log(`API_ADMIN_ACCOMMODATION_GET: Admin ${session.role} viewing all accommodation requests`);
  
  // Apply status filtering if requested
  if (statusesToFetch && statusesToFetch.length > 0) {
    whereClauses.push(sql`tr.status IN ${sql(statusesToFetch)}`);
  }
  
  console.log(`API_ADMIN_ACCOMMODATION_GET: Filters - Search: '${searchTerm}', Status: '${statusFilter}', Statuses: '${statusesToFetch}', Processing: ${processing}`);

  if (searchTerm) {
    whereClauses.push(sql`(
      LOWER(tr.id) LIKE LOWER(${'%' + searchTerm + '%'}) OR 
      LOWER(tr.requestor_name) LIKE LOWER(${'%' + searchTerm + '%'}) OR
      LOWER(tr.purpose) LIKE LOWER(${'%' + searchTerm + '%'})
    )`);
  }
  if (statusFilter) {
    whereClauses.push(sql`tr.status = ${statusFilter}`);
  }

  // Construct WHERE clause
  let whereClause = sql``;
  if (whereClauses.length > 0) {
    whereClause = sql`WHERE ${ whereClauses[0] }`;
    for (let i = 1; i < whereClauses.length; i++) {
      whereClause = sql`${whereClause} AND ${whereClauses[i]}`;
    }
  }

  const allowedSortColumns: Record<string, string> = {
    id: 'tr.id', requestorName: 'tr.requestor_name', status: 'tr.status', 
    submitted_at: 'tr.submitted_at', submittedAt: 'tr.submitted_at'
  };
  const dbSortColumn = allowedSortColumns[sortBy] || 'tr.submitted_at';
  const dbSortOrder = sortOrder.toLowerCase() === 'desc' ? sql`DESC` : sql`ASC`;

  try {
    console.log("API_ADMIN_ACCOMMODATION_GET: Attempting to query accommodation requests.");
    
    // Ensure we have a valid SQL connection
    const { getSql } = await import('@/lib/db');
    const sqlInstance = getSql();
    
    let accommodationRequests;
    try {
      const accommodationQuery = sqlInstance`
        SELECT 
          tr.id, 
          tr.requestor_name AS "requestorName", 
          tr.staff_id AS "staffId",
          tr.department,
          tr.status, 
          tr.submitted_at AS "submittedAt",
          tr.purpose,
          ad.accommodation_type AS "accommodationType",
          ad.check_in_date AS "checkInDate",
          ad.check_out_date AS "checkOutDate",
          ad.location,
          ad.check_in_time AS "checkInTime",
          ad.check_out_time AS "checkOutTime",
          ad.place_of_stay AS "placeOfStay",
          ad.estimated_cost_per_night AS "estimatedCostPerNight",
          ad.remarks,
          COALESCE(booking_counts.booking_count, 0) AS "bookingCount",
          booking_counts.assigned_room_info AS "assignedRoomInfo"
        FROM travel_requests tr
        LEFT JOIN trf_accommodation_details ad ON tr.id = ad.trf_id
        LEFT JOIN (
          SELECT 
            ab.trf_id,
            COUNT(*) AS booking_count,
            STRING_AGG(DISTINCT COALESCE(ash.name, '') || ' - ' || COALESCE(ar.name, ''), ', ') AS assigned_room_info
          FROM accommodation_bookings ab
          LEFT JOIN accommodation_rooms ar ON ab.room_id = ar.id
          LEFT JOIN accommodation_staff_houses ash ON ab.staff_house_id = ash.id
          WHERE ab.status != 'Cancelled'
          GROUP BY ab.trf_id
        ) booking_counts ON tr.id = booking_counts.trf_id
        ${whereClause}
        ORDER BY ${sqlInstance(dbSortColumn)} ${dbSortOrder} NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      accommodationRequests = await accommodationQuery;
    } catch (queryError: any) {
      console.error('Error executing accommodation query:', queryError);
      
      // Check if it's a table missing error
      if (queryError.message && queryError.message.includes('relation') && queryError.message.includes('does not exist')) {
        console.log('Missing accommodation tables, returning empty result');
        return NextResponse.json({
          requests: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          error: 'Database table not found',
          details: 'Required accommodation tables do not exist'
        });
      }
      
      // Fallback query without complex joins
      try {
        console.log('Attempting fallback query without complex joins...');
        accommodationRequests = await sqlInstance`
          SELECT 
            tr.id, 
            tr.requestor_name AS "requestorName", 
            tr.staff_id AS "staffId",
            tr.department,
            tr.status, 
            tr.submitted_at AS "submittedAt",
            tr.purpose,
            ad.accommodation_type AS "accommodationType",
            ad.check_in_date AS "checkInDate",
            ad.check_out_date AS "checkOutDate",
            ad.location,
            ad.place_of_stay AS "placeOfStay",
            ad.estimated_cost_per_night AS "estimatedCostPerNight",
            ad.remarks
          FROM travel_requests tr
          LEFT JOIN trf_accommodation_details ad ON tr.id = ad.trf_id
          ${whereClause}
          ORDER BY ${sqlInstance(dbSortColumn)} ${dbSortOrder} NULLS LAST
          LIMIT ${limit} OFFSET ${offset}
        `;
      } catch (fallbackError: any) {
        console.error('Fallback query also failed:', fallbackError);
        return NextResponse.json({
          requests: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          error: 'Failed to fetch accommodation requests',
          details: fallbackError.message
        });
      }
    }

    let totalCount = 0;
    try {
      const countQuery = sqlInstance`
        SELECT COUNT(*) AS count
        FROM travel_requests tr
        LEFT JOIN trf_accommodation_details ad ON tr.id = ad.trf_id
        ${whereClause}
      `;
      const totalCountResult = await countQuery;
      totalCount = Number(totalCountResult[0]?.count || 0);
    } catch (countError: any) {
      console.error('Error executing count query:', countError);
      totalCount = accommodationRequests.length; // Fallback to actual results length
    }

    console.log(`API_ADMIN_ACCOMMODATION_GET: Fetched ${accommodationRequests.length} accommodation requests. Total matched: ${totalCount}`);
    
    const accommodationForClient = accommodationRequests.map((req: any) => ({
      ...req,
      id: String(req.id),
      submittedAt: req.submittedAt ? formatISO(new Date(req.submittedAt)) : null,
      checkInDate: req.checkInDate ? formatISO(new Date(req.checkInDate)) : null,
      checkOutDate: req.checkOutDate ? formatISO(new Date(req.checkOutDate)) : null,
      bookingCount: Number(req.bookingCount || 0),
      estimatedCostPerNight: req.estimatedCostPerNight ? Number(req.estimatedCostPerNight) : null,
    }));

    // If processing flag is set, return just the array
    if (processing) {
      return NextResponse.json(accommodationForClient);
    }

    return NextResponse.json({
      requests: accommodationForClient,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error: any) {
    console.error("API_ADMIN_ACCOMMODATION_GET_ERROR:", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch accommodation requests from database.', details: error.message }, { status: 500 });
  }
});