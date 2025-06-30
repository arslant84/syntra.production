import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { format } from 'date-fns';
import { sql } from '@/lib/db';
// For development, we'll use a mock user

// Define types for our data
type TravelRequest = {
  id: string;
  purpose: string;
  status: string;
  created_at: string;
  updated_at: string;
  staff_id: string;
};

type Claim = {
  id: string;
  purpose: string;
  status: string;
  created_at: string;
  updated_at: string;
  staff_name: string;
};

type VisaApplication = {
  id: string;
  destination: string;
  travel_purpose: string;
  status: string;
  submitted_date: string;
  updated_at: string;
  requestor_name: string;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  dateInfo: string;
  link: string;
  statusVariant: string;
  icon: string;
  staff_id?: string;
};

type DateInfoInput = {
  status: string;
  created_at?: string;
  updated_at?: string;
  submitted_date?: string;
};

// Helper function to format date
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    return dateString;
  }
}

// Helper function to get status variant
function getStatusVariant(status: string): 'default' | 'outline' {
  if (status === 'Approved') {
    return 'default';
  } else {
    return 'outline';
  }
}

// Helper function to get date info based on status and timestamps
function getDateInfo(item: { status: string; created_at?: string; updated_at?: string; submitted_date?: string }): string {
  const { status, created_at, updated_at, submitted_date } = item;
  
  if (status === 'Approved') {
    return `Approved: ${formatDate(updated_at || '')}`;
  } else if (status === 'Rejected') {
    return `Rejected: ${formatDate(updated_at || '')}`;
  } else if (status === 'Draft') {
    return `Last saved: ${formatDate(updated_at || '')}`;
  } else if (status.includes('Pending')) {
    return `Submitted: ${formatDate(submitted_date || created_at || '')}`;
  } else {
    return `Updated: ${formatDate(updated_at || '')}`;
  }
}

export async function GET() {
  console.log('Activities API: Starting request');
  try {
    // For development, use a mock user
    // In production, you would implement proper authentication
    const mockUser = {
      email: 'dev@example.com',
      name: 'Development User'
    };
    
    // Use email as staff_id
    const staffId = mockUser.email;

    // Initialize arrays to store activities
    let trfs: ActivityItem[] = [];
    let claims: ActivityItem[] = [];
    let visas: ActivityItem[] = [];
    let accommodationBookings: ActivityItem[] = [];

    // Get recent TRFs
    try {
      console.log('Fetching recent TRFs...');
      const trfQuery = await sql`
        SELECT 
          id, 
          purpose, 
          status, 
          created_at, 
          updated_at,
          staff_id
        FROM travel_requests 
        ORDER BY updated_at DESC
        LIMIT 10
      `;
      
      trfs = trfQuery?.map((trf: any) => {
        const dateInfo = getDateInfo({
          status: trf.status,
          created_at: trf.created_at,
          updated_at: trf.updated_at
        });
        
        return {
          id: trf.id,
          type: 'TRF',
          title: `TRF: ${trf.purpose || 'Travel Request'}`,
          status: trf.status,
          dateInfo,
          link: `/trf/view/${trf.id}`,
          statusVariant: getStatusVariant(trf.status),
          icon: 'FileText',
          staff_id: trf.staff_id
        };
      }) || [];
      
      console.log(`Found ${trfs.length} TRFs`);
    } catch (err) {
      console.error('Error fetching TRFs:', err);
      // Continue execution even if this query fails
    }

    // Get recent claims - try/catch in case table doesn't exist
    try {
      console.log('Checking expense_claims table...');
      // Check if expense_claims table exists (new schema)
      const expenseClaimsExistQuery = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'expense_claims'
        ) as exists
      `;
      
      if (expenseClaimsExistQuery[0]?.exists) {
        console.log('Found expense_claims table, checking schema first');
        try {
          // Check the schema of expense_claims table
          const schemaQuery = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'expense_claims'
            ORDER BY ordinal_position
          `;
          
          console.log('Expense claims table schema:', schemaQuery.map((col: any) => col.column_name));
          
          // Adjust query based on available columns
          const hasDescription = schemaQuery.some((col: any) => col.column_name === 'description');
          const hasPurpose = schemaQuery.some((col: any) => col.column_name === 'purpose');
          const hasPurposeOfClaim = schemaQuery.some((col: any) => col.column_name === 'purpose_of_claim');
          const hasStaffName = schemaQuery.some((col: any) => col.column_name === 'staff_name');
          const hasStaffId = schemaQuery.some((col: any) => col.column_name === 'staff_id');
          
          console.log('Found expense_claims table, fetching recent claims with adjusted columns');
          const claimsResults = await sql`
            SELECT 
              id, 
              ${hasPurposeOfClaim ? sql`purpose_of_claim AS purpose,` : hasPurpose ? sql`purpose,` : hasDescription ? sql`description AS purpose,` : sql`'Expense Claim' AS purpose,`}
              status, 
              created_at, 
              updated_at,
              ${hasStaffName ? sql`staff_name` : hasStaffId ? sql`staff_id AS staff_name` : sql`'Staff' AS staff_name`}
            FROM expense_claims 
            WHERE status = 'Draft' OR status = 'Pending' OR status IS NULL
            ORDER BY updated_at DESC
            LIMIT 10
          `;
          
          console.log(`Found ${claimsResults?.length || 0} claims in expense_claims table`);
          if (claimsResults?.length > 0) {
            console.log('Sample claim:', claimsResults[0]);
          }
          
          claims = claimsResults?.map((claim: any) => {
            const dateInfo = getDateInfo({
              status: claim.status || 'Draft',
              created_at: claim.created_at,
              updated_at: claim.updated_at
            });
            
            return {
              id: claim.id,
              type: 'Claim',
              title: `Claim: ${claim.purpose || 'Expense Claim'}`,
              status: claim.status || 'Draft',
              dateInfo,
              link: `/claims/view/${claim.id}`,
              statusVariant: getStatusVariant(claim.status || 'Draft'),
              icon: 'Receipt'
            };
          }) || [];
          
          // If no draft claims found, try any status
          if (claims.length === 0) {
            console.log('No draft claims found, trying any status...');
            const anyClaimsQuery = await sql`
              SELECT 
                id, 
                ${hasPurposeOfClaim ? sql`purpose_of_claim AS purpose,` : hasPurpose ? sql`purpose,` : hasDescription ? sql`description AS purpose,` : sql`'Expense Claim' AS purpose,`}
                status, 
                created_at, 
                updated_at,
                ${hasStaffName ? sql`staff_name` : hasStaffId ? sql`staff_id AS staff_name` : sql`'Staff' AS staff_name`}
              FROM expense_claims 
              ORDER BY updated_at DESC
              LIMIT 10
            `;
            
            console.log(`Found ${anyClaimsQuery?.length || 0} claims with broader status filter`);
            
            claims = anyClaimsQuery?.map((claim: any) => {
              const dateInfo = getDateInfo({
                status: claim.status,
                created_at: claim.created_at,
                updated_at: claim.updated_at
              });
              
              return {
                id: claim.id,
                type: 'Claim',
                title: `Claim: ${claim.purpose || 'Expense Claim'}`,
                status: claim.status,
                dateInfo,
                link: `/claims/view/${claim.id}`,
                statusVariant: getStatusVariant(claim.status),
                icon: 'Receipt'
              };
            }) || [];
          }
        } catch (schemaErr) {
          console.error('Error with expense_claims schema:', schemaErr);
        }
      } else {
        // Fall back to old claims table if it exists
        console.log('expense_claims table not found, checking claims table...');
        const claimsExistQuery = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'claims'
          ) as exists
        `;
        
        if (claimsExistQuery[0]?.exists) {
          console.log('Found claims table, fetching recent claims');
          try {
            const claimsResults = await sql`
              SELECT 
                id, 
                purpose, 
                status, 
                created_at, 
                updated_at,
                staff_name
              FROM claims 
              WHERE status = 'Draft'
              ORDER BY updated_at DESC
              LIMIT 10
            `;
            
            console.log(`Found ${claimsResults?.length || 0} claims in claims table`);
            
            claims = claimsResults?.map((claim: any) => {
              const dateInfo = getDateInfo({
                status: claim.status,
                created_at: claim.created_at,
                updated_at: claim.updated_at
              });
              
              return {
                id: claim.id,
                type: 'Claim',
                title: `Claim: ${claim.purpose || 'Expense Claim'}`,
                status: claim.status,
                dateInfo,
                link: `/claims/view/${claim.id}`,
                statusVariant: getStatusVariant(claim.status),
                icon: 'FileText'
              };
            }) || [];
          } catch (schemaErr) {
            console.error('Error with claims schema:', schemaErr);
          }
        } else {
          console.log('claims table not found either');
        }
      }
    } catch (err) {
      console.error('Error checking claims tables:', err);
      // Continue execution even if claims table doesn't exist
    }

    // Get recent visa applications - try/catch in case table doesn't exist
    try {
      console.log('Checking visa_applications table...');
      // Check if visa_applications table exists
      const visaQuery = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'visa_applications'
        ) as exists
      `;
      
      if (visaQuery[0]?.exists) {
        console.log('visa_applications table exists, fetching data...');
        try {
          const visaResults = await sql`
            SELECT 
              id, 
              destination, 
              travel_purpose, 
              status, 
              submitted_date, 
              updated_at,
              requestor_name
            FROM visa_applications 
            WHERE status = 'Pending Department Focal'
            ORDER BY updated_at DESC
            LIMIT 10
          `;
          
          console.log(`Found ${visaResults?.length || 0} visa applications`);
          
          visas = visaResults?.map((visa: any) => {
            const dateInfo = getDateInfo({
              status: visa.status,
              submitted_date: visa.submitted_date,
              updated_at: visa.updated_at
            });
            
            return {
              id: visa.id,
              type: 'Visa',
              title: `Visa: ${visa.destination} - ${visa.travel_purpose || 'Travel'}`,
              status: visa.status,
              dateInfo,
              link: `/visa/view/${visa.id}`,
              statusVariant: getStatusVariant(visa.status),
              icon: 'Plane'
            };
          }) || [];
        } catch (schemaErr) {
          console.error('Error with visa_applications schema:', schemaErr);
        }
      } else {
        console.log('visa_applications table does not exist');
      }
    } catch (err) {
      console.error('Error checking visa_applications table:', err);
      // Continue execution even if visa_applications table doesn't exist
    }

    // Get recent accommodation bookings - try/catch in case table doesn't exist
    try {
      console.log('Checking accommodation_bookings table...');
      // Check if accommodation_bookings table exists
      const bookingsQuery = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'accommodation_bookings'
        )
      `;
      
      if (bookingsQuery[0]?.exists) {
    console.log('accommodation_bookings table exists, fetching data...');
    try {
      // Join with staff houses and rooms to get names
      const bookingsResults = await sql`
        SELECT 
          ab.id, 
          ab.status, 
          ab.date,
          ab.created_at, 
          ab.updated_at,
          ash.address as house_address,
          ar.name as room_name
        FROM accommodation_bookings ab
        LEFT JOIN accommodation_staff_houses ash ON ab.staff_house_id = ash.id
        LEFT JOIN accommodation_rooms ar ON ab.room_id = ar.id
        WHERE ab.status = 'Pending' OR ab.status = 'Reserved'
        ORDER BY ab.updated_at DESC
        LIMIT 10
      `;
      
      console.log(`Found ${bookingsResults?.length || 0} accommodation bookings`);
      
      // If no bookings found with Pending or Reserved status, try any status
      if (!bookingsResults || bookingsResults.length === 0) {
        console.log('No pending/reserved bookings found, trying any status...');
        const anyBookingsResults = await sql`
          SELECT 
            ab.id, 
            ab.status, 
            ab.date,
            ab.created_at, 
            ab.updated_at,
            ash.address as house_address,
            ar.name as room_name
          FROM accommodation_bookings ab
          LEFT JOIN accommodation_staff_houses ash ON ab.staff_house_id = ash.id
          LEFT JOIN accommodation_rooms ar ON ab.room_id = ar.id
          ORDER BY ab.updated_at DESC
          LIMIT 10
        `;
        
        console.log(`Found ${anyBookingsResults?.length || 0} accommodation bookings with any status`);
        
        accommodationBookings = anyBookingsResults?.map((booking: any) => {
          const dateInfo = getDateInfo({
            status: booking.status,
            created_at: booking.created_at,
            updated_at: booking.updated_at
          });
          const location = booking.house_address ? 
            `${booking.house_address}${booking.room_name ? ` - ${booking.room_name}` : ''}` : 
            'Accommodation';
          
          return {
            id: booking.id,
            type: 'Accommodation',
            title: `Booking: ${location}`,
            status: booking.status,
            dateInfo,
            link: `/accommodation/view/${booking.id}`,
            statusVariant: getStatusVariant(booking.status),
            icon: 'Home'
          };
        }) || [];
      } else {
        accommodationBookings = bookingsResults?.map((booking: any) => {
          const dateInfo = getDateInfo({
            status: booking.status,
            created_at: booking.created_at,
            updated_at: booking.updated_at
          });
          const location = booking.house_address ? 
            `${booking.house_address}${booking.room_name ? ` - ${booking.room_name}` : ''}` : 
            'Accommodation';
          
          return {
            id: booking.id,
            type: 'Accommodation',
            title: `Booking: ${location}`,
            status: booking.status,
            dateInfo,
            link: `/accommodation/view/${booking.id}`,
            statusVariant: getStatusVariant(booking.status),
            icon: 'Home'
          };
        });
      }
    } catch (schemaErr) {
      console.error('Error with accommodation_bookings schema:', schemaErr);
    }
  } else {
    console.log('accommodation_bookings table does not exist');
  }
} catch (err) {
  console.error('Error checking accommodation_bookings table:', err);
  // Continue execution even if accommodation_bookings table doesn't exist
}

    // Combine all activities
    console.log(`Activities found - TRFs: ${trfs.length}, Claims: ${claims.length}, Visas: ${visas.length}, Accommodation: ${accommodationBookings.length}`);
    let allActivities = [...trfs, ...claims, ...visas, ...accommodationBookings];
    
    // Sort by date (most recent first)
    allActivities.sort((a, b) => {
      // Extract date from dateInfo string if possible
      const getDateFromInfo = (info: string) => {
        const dateMatch = info.match(/\w+:\s(.+)/);
        if (dateMatch && dateMatch[1]) {
          try {
            return new Date(dateMatch[1]).getTime();
          } catch (e) {
            console.error('Error parsing date from info:', info, e);
            return 0;
          }
        }
        return 0;
      };
      
      const dateA = getDateFromInfo(a.dateInfo);
      const dateB = getDateFromInfo(b.dateInfo);
      
      return dateB - dateA;
    });
    
    // Return the top 10 most recent activities
    const result = allActivities.slice(0, 10);
    console.log(`Returning ${result.length} activities`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in activities API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
