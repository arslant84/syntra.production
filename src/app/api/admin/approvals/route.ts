import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { withAuth } from '@/lib/api-protection';
import { getApprovalQueueFilters } from '@/lib/client-rbac-utils';

export const GET = withAuth(async function(request: NextRequest) {
  console.log("API_ADMIN_APPROVALS_GET_START: Fetching unified approval items for admin.");
  
  const session = (request as any).user;
  
  console.log(`API_ADMIN_APPROVALS_GET: Admin ${session.role} (${session.email}) accessing unified approval data`);
  
  if (!sql) {
    console.error('Database client is null - checking initialization...');
    return NextResponse.json({ 
      error: 'Database client not initialized.',
      items: []
    }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20', 10) || 20));
  const itemType = searchParams.get('type'); // 'trf', 'claim', 'visa', 'accommodation', 'transport'

  const offset = Math.max(0, (page - 1) * limit);

  try {
    // Get role-based approval filters
    const { roleSpecificStatuses, canApprove } = getApprovalQueueFilters(session.role);
    
    if (!canApprove || roleSpecificStatuses.length === 0) {
      return NextResponse.json({
        items: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        message: 'No approval rights for current role'
      });
    }

    console.log(`API_ADMIN_APPROVALS_GET: User role: ${session.role}`);
    console.log(`API_ADMIN_APPROVALS_GET: Fetching items for statuses: [${roleSpecificStatuses.join(', ')}]`);
    console.log(`API_ADMIN_APPROVALS_GET: canApprove: ${canApprove}, roleSpecificStatuses length: ${roleSpecificStatuses.length}`);

    // System Administrator should see only approval workflow statuses, not completed requests
    const isSystemAdmin = session.role === 'System Administrator';

    let allItems: any[] = [];
    
    // Define the queries for each item type
    const queries = [];
    
    // 1. TRFs (TSRs)
    if (!itemType || itemType === 'trf') {
      try {
        const trfQuery = sql`
          SELECT
            tr.id,
            tr.requestor_name as "requestorName",
            'TSR' as "itemType",
            tr.purpose,
            tr.status,
            tr.submitted_at as "submittedAt",
            tr.travel_type as "travelType",
            '' as "destination"
          FROM travel_requests tr
          WHERE status IN ${sql(roleSpecificStatuses)}
            AND tr.travel_type != 'Accommodation'
          ORDER BY tr.submitted_at DESC
        `;
        queries.push({ type: 'TSR', query: trfQuery });
      } catch (error: any) {
        console.warn('Error adding TRF query:', error);
      }
    }
    
    // 2. Claims
    if (!itemType || itemType === 'claim') {
      try {
        const claimQuery = sql`
          SELECT
            c.id,
            c.staff_name as "requestorName",
            'Claim' as "itemType",
            COALESCE(c.purpose_of_claim, 'Expense Claim') as "purpose",
            c.status,
            COALESCE(c.submitted_at, c.created_at) as "submittedAt",
            COALESCE(c.total_advance_claim_amount, 0) as "amount",
            COALESCE(c.document_number, c.id) as "documentNumber",
            c.department_code as "department"
          FROM expense_claims c
          WHERE status IN ${sql(roleSpecificStatuses)}
          ORDER BY COALESCE(c.submitted_at, c.created_at) DESC
        `;
        queries.push({ type: 'Claim', query: claimQuery });
      } catch (error: any) {
        console.warn('Error adding Claims query:', error);
      }
    }
    
    // 3. Visa Applications
    if (!itemType || itemType === 'visa') {
      try {
        const visaQuery = sql`
          SELECT
            v.id,
            v.requestor_name as "requestorName",
            'Visa' as "itemType",
            COALESCE(v.travel_purpose, 'Visa Application') as "purpose",
            v.status,
            v.submitted_date as "submittedAt",
            v.visa_type as "visaType",
            v.destination
          FROM visa_applications v
          WHERE status IN ${sql(roleSpecificStatuses)}
          ORDER BY v.submitted_date DESC
        `;
        queries.push({ type: 'Visa', query: visaQuery });
      } catch (error: any) {
        console.warn('Error adding Visa query:', error);
      }
    }
    
    // 4. Accommodation Requests
    if (!itemType || itemType === 'accommodation') {
      console.log(`API_ADMIN_APPROVALS_GET: Processing accommodation requests. isSystemAdmin: ${isSystemAdmin}`);
      try {
        const accommodationQuery = sql`
          SELECT
            tr.id,
            tr.requestor_name as "requestorName",
            'Accommodation' as "itemType",
            COALESCE(tr.purpose, 'Accommodation Request') as "purpose",
            tr.status,
            tr.submitted_at as "submittedAt",
            tr.travel_type as "travelType",
            COALESCE(ad.location, 'Location TBD') as "location",
            ad.check_in_date as "checkInDate",
            ad.check_out_date as "checkOutDate"
          FROM travel_requests tr
          LEFT JOIN trf_accommodation_details ad ON tr.id = ad.trf_id
          WHERE tr.status IN ${sql(roleSpecificStatuses)}
            AND tr.travel_type = 'Accommodation'
          ORDER BY tr.submitted_at DESC
        `;
        queries.push({ type: 'Accommodation', query: accommodationQuery });
        console.log('API_ADMIN_APPROVALS_GET: Added Accommodation query to queries array');
      } catch (error: any) {
        console.error('Error adding Accommodation query:', error);
      }
    }
    
    // 5. Transport Requests
    if (!itemType || itemType === 'transport') {
      try {
        const transportQuery = sql`
          SELECT
            t.id,
            t.requestor_name as "requestorName",
            'Transport' as "itemType",
            t.purpose,
            t.status,
            COALESCE(t.submitted_at, t.created_at) as "submittedAt",
            t.department
          FROM transport_requests t
          WHERE status IN ${sql(roleSpecificStatuses)}
          ORDER BY COALESCE(t.submitted_at, t.created_at) DESC
        `;
        queries.push({ type: 'Transport', query: transportQuery });
      } catch (error: any) {
        console.warn('Error adding Transport query:', error);
      }
    }
    
    // Execute all queries concurrently
    const results = await Promise.allSettled(
      queries.map(async ({ type, query }) => {
        try {
          console.log(`API_ADMIN_APPROVALS_GET: Executing ${type} query...`);
          const result = await query;
          console.log(`API_ADMIN_APPROVALS_GET: ${type} query returned ${result.length} items`);

          // Debug accommodation results specifically
          if (type === 'Accommodation') {
            console.log(`API_ADMIN_APPROVALS_GET: Accommodation results details:`, result.map((r: any) => ({ id: r.id, status: r.status })));
          }

          // Special logging for accommodation requests
          if (type === 'Accommodation' && result.length > 0) {
            console.log(`API_ADMIN_APPROVALS_GET: First 5 accommodation IDs:`, result.slice(0, 5).map((r: any) => r.id));
          }

          return { type, items: result };
        } catch (error: any) {
          console.error(`Error executing ${type} query:`, error);
          return { type, items: [] };
        }
      })
    );
    
    // Combine all results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        console.log(`API_ADMIN_APPROVALS_GET: Adding ${result.value.items.length} ${result.value.type} items to combined results`);

        // Special logging for accommodation items being added
        if (result.value.type === 'Accommodation' && result.value.items.length > 0) {
          console.log(`API_ADMIN_APPROVALS_GET: Adding accommodation IDs:`, result.value.items.slice(0, 5).map((r: any) => r.id));
          console.log(`API_ADMIN_APPROVALS_GET: Total items before adding accommodation:`, allItems.length);
        }

        allItems = [...allItems, ...result.value.items];

        // Log total after adding this type
        console.log(`API_ADMIN_APPROVALS_GET: Total items after adding ${result.value.type}:`, allItems.length);
      } else {
        console.error(`API_ADMIN_APPROVALS_GET: Promise rejected for query:`, result.reason);
      }
    }
    
    // Sort all items by submission date (newest first)
    allItems.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    // Log accommodation items in sorted array
    const accommodationItems = allItems.filter(item => item.itemType === 'Accommodation');
    console.log(`API_ADMIN_APPROVALS_GET: After sorting - accommodation items count: ${accommodationItems.length}`);
    if (accommodationItems.length > 0) {
      console.log(`API_ADMIN_APPROVALS_GET: First 5 accommodation IDs after sorting:`, accommodationItems.slice(0, 5).map(r => r.id));
    }

    // Apply pagination to combined results
    const paginatedItems = allItems.slice(offset, offset + limit);

    // Log accommodation items in paginated array
    const paginatedAccommodationItems = paginatedItems.filter(item => item.itemType === 'Accommodation');
    console.log(`API_ADMIN_APPROVALS_GET: After pagination - accommodation items count: ${paginatedAccommodationItems.length}`);
    if (paginatedAccommodationItems.length > 0) {
      console.log(`API_ADMIN_APPROVALS_GET: Paginated accommodation IDs:`, paginatedAccommodationItems.map(r => r.id));
    }
    
    console.log(`API_ADMIN_APPROVALS_GET: Fetched ${paginatedItems.length} approval items from ${allItems.length} total`);

    // Debug: Log breakdown by type
    const itemsByType = allItems.reduce((acc, item) => {
      acc[item.itemType] = (acc[item.itemType] || 0) + 1;
      return acc;
    }, {});
    console.log('API_ADMIN_APPROVALS_GET: Items by type:', itemsByType);
    
    // Format items for client
    const itemsForClient = paginatedItems.map((item: any) => ({
      ...item,
      id: String(item.id),
      submittedAt: item.submittedAt ? formatISO(new Date(item.submittedAt)) : null,
      checkInDate: item.checkInDate ? formatISO(new Date(item.checkInDate)) : null,
      checkOutDate: item.checkOutDate ? formatISO(new Date(item.checkOutDate)) : null,
      amount: item.amount !== null && item.amount !== undefined ? Number(item.amount) : null,
    }));

    console.log('API_ADMIN_APPROVALS_GET: Final response summary:');
    console.log(`  - Total items found: ${allItems.length}`);
    console.log(`  - Items after pagination: ${paginatedItems.length}`);
    console.log(`  - Items for client: ${itemsForClient.length}`);
    console.log(`  - Final response item count: ${itemsForClient.length}`);

    return NextResponse.json({
      items: itemsForClient,
      totalCount: allItems.length,
      totalPages: Math.ceil(allItems.length / limit),
      currentPage: page,
    });
  } catch (error: any) {
    console.error("API_ADMIN_APPROVALS_GET_ERROR:", error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to fetch approval items from database.', 
      details: error.message,
      items: []
    }, { status: 500 });
  }
});