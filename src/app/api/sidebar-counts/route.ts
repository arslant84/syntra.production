import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { requireAuth, createAuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication completely removed for testing
    console.log('Sidebar Counts: Authentication bypassed for testing');
  
    // Object to store all counts
    const counts = {
      approvals: 0,
      claims: 0,
      visas: 0,
      flights: 0,
      accommodation: 0,
    };

    // Get total approvals count (sum of TRFs, Claims, Visas, and Accommodation)
    try {
      // Count pending TRFs
      const trfQuery = await sql`
        SELECT COUNT(*) AS count FROM travel_requests
        WHERE status LIKE 'Pending%' OR status = 'Pending'
      `;
      const pendingTRFs = parseInt(trfQuery[0]?.count || '0');
      
      // Count pending claims
      let pendingClaims = 0;
      // Check if expense_claims table exists
      const claimsTableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'expense_claims'
        ) as exists
      `;
      
      if (claimsTableCheck[0]?.exists) {
        const claimsQuery = await sql`
          SELECT COUNT(*) AS count FROM expense_claims
          WHERE status = 'Pending Verification' OR status = 'Pending Approval'
        `;
        pendingClaims = parseInt(claimsQuery[0]?.count || '0');
      } else {
        // Fallback to older claims table if it exists
        const oldTableCheck = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'claims'
          ) as exists
        `;
        
        if (oldTableCheck[0]?.exists) {
          const claimsQuery = await sql`
            SELECT COUNT(*) as count FROM claims 
            WHERE status = 'Pending Verification' OR status = 'Pending Approval'
          `;
          pendingClaims = parseInt(claimsQuery[0]?.count || '0');
        }
      }
      
      // Count pending visa applications
      let pendingVisas = 0;
      const visaQuery = await sql`
        SELECT COUNT(*) AS count FROM visa_applications
        WHERE status LIKE 'Pending%'
      `;
      pendingVisas = parseInt(visaQuery[0]?.count || '0');
      
      // Count pending accommodation bookings
      let pendingAccommodation = 0;
      const bookingsTableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'accommodation_bookings'
        ) as exists
      `;
      
      if (bookingsTableCheck[0]?.exists) {
        const bookingsQuery = await sql`
          SELECT COUNT(*) AS count FROM accommodation_bookings
          WHERE status = 'Pending'
        `;
        pendingAccommodation = parseInt(bookingsQuery[0]?.count || '0');
      }
      
      // Store individual counts
      counts.claims = pendingClaims;
      counts.visas = pendingVisas;
      counts.accommodation = pendingAccommodation;
      
      // Calculate total approvals count
      counts.approvals = pendingTRFs + pendingClaims + pendingVisas + pendingAccommodation;
      
      // Count pending flights (if applicable)
      try {
        const flightsTableCheck = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'flight_bookings'
          ) as exists
        `;
        
        if (flightsTableCheck[0]?.exists) {
          const flightsQuery = await sql`
            SELECT COUNT(*) AS count FROM flight_bookings
            WHERE status = 'Pending'
          `;
          counts.flights = parseInt(flightsQuery[0]?.count || '0');
        }
      } catch (err) {
        console.error('Error fetching flight bookings:', err);
      }
      
    } catch (err) {
      console.error('Error calculating approval counts:', err);
    }

    return NextResponse.json(counts);
  } catch (error: any) {
    // Authentication errors bypassed for testing

    console.error('Error in sidebar counts API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sidebar counts' },
      { status: 500 }
    );
  }
}
