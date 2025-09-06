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

    console.log(`API_ADMIN_APPROVALS_GET: Fetching items for statuses: [${roleSpecificStatuses.join(', ')}]`);
    
    const statusFilter = sql`status IN ${sql(roleSpecificStatuses)}`;
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
          WHERE ${statusFilter}
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
            c.balance_claim_repayment as "amount",
            COALESCE(c.document_number, c.id) as "documentNumber"
          FROM expense_claims c
          WHERE ${statusFilter}
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
          WHERE ${statusFilter}
          ORDER BY v.submitted_date DESC
        `;
        queries.push({ type: 'Visa', query: visaQuery });
      } catch (error: any) {
        console.warn('Error adding Visa query:', error);
      }
    }
    
    // 4. Accommodation Requests  
    if (!itemType || itemType === 'accommodation') {
      try {
        const accommodationQuery = sql`
          (
            SELECT 
              tr.id,
              tr.requestor_name as "requestorName",
              'Accommodation' as "itemType",
              COALESCE(ad.remarks, tr.purpose, 'Accommodation Request') as "purpose",
              tr.status,
              tr.submitted_at as "submittedAt",
              ad.location,
              ad.check_in_date as "checkInDate",
              ad.check_out_date as "checkOutDate"
            FROM travel_requests tr
            LEFT JOIN trf_accommodation_details ad ON tr.id = ad.trf_id
            WHERE ${statusFilter}
              AND tr.travel_type = 'Accommodation'
              AND ad.trf_id IS NOT NULL
          )
          UNION ALL
          (
            SELECT 
              ar.id,
              ar.requestor_name as "requestorName",
              'Accommodation' as "itemType",
              'Accommodation Request' as "purpose",
              ar.status,
              COALESCE(ar.submitted_at, ar.created_at) as "submittedAt",
              'Location TBD' as "location",
              NULL as "checkInDate",
              NULL as "checkOutDate"
            FROM accommodation_requests ar
            WHERE ${statusFilter}
          )
          ORDER BY "submittedAt" DESC
        `;
        queries.push({ type: 'Accommodation', query: accommodationQuery });
      } catch (error: any) {
        console.warn('Error adding Accommodation query:', error);
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
          WHERE ${statusFilter}
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
          const result = await query;
          return { type, items: result };
        } catch (error: any) {
          console.warn(`Error executing ${type} query:`, error);
          return { type, items: [] };
        }
      })
    );
    
    // Combine all results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems = [...allItems, ...result.value.items];
      }
    }
    
    // Sort all items by submission date (newest first)
    allItems.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    // Apply pagination to combined results
    const paginatedItems = allItems.slice(offset, offset + limit);
    
    console.log(`API_ADMIN_APPROVALS_GET: Fetched ${paginatedItems.length} approval items from ${allItems.length} total`);
    
    // Format items for client
    const itemsForClient = paginatedItems.map((item: any) => ({
      ...item,
      id: String(item.id),
      submittedAt: item.submittedAt ? formatISO(new Date(item.submittedAt)) : null,
      checkInDate: item.checkInDate ? formatISO(new Date(item.checkInDate)) : null,
      checkOutDate: item.checkOutDate ? formatISO(new Date(item.checkOutDate)) : null,
      amount: item.amount ? Number(item.amount) : null,
    }));

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