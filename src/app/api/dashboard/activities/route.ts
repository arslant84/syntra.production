import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { format } from 'date-fns';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
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
  staff_id: string;
};

type VisaApplication = {
  id: string;
  purpose: string;
  status: string;
  created_at: string;
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

// Helper function to get status variant for badges
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('approved') || statusLower.includes('completed') || statusLower.includes('confirmed')) {
    return 'default';
  } else if (statusLower.includes('pending') || statusLower.includes('draft')) {
    return 'secondary';
  } else if (statusLower.includes('rejected') || statusLower.includes('cancelled') || statusLower.includes('blocked')) {
    return 'destructive';
  }
  return 'outline';
}

// Helper function to format dates
function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'Invalid date';
  }
}

// Helper function to get date info for display
function getDateInfo(item: { status: string; created_at?: string; updated_at?: string; submitted_date?: string }): string {
  const { status, created_at, updated_at, submitted_date } = item;
  
  if (status.toLowerCase().includes('draft')) {
    return `Created: ${formatDate(created_at || '')}`;
  } else if (status.toLowerCase().includes('submitted') || status.toLowerCase().includes('pending')) {
    return `Submitted: ${formatDate(submitted_date || updated_at || created_at || '')}`;
  } else {
    return `Updated: ${formatDate(updated_at || '')}`;
  }
}

// Helper function to validate if a TRF exists
async function validateTRFExists(trfId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT id FROM travel_requests WHERE id = ${trfId}
    `;
    return result && result.length > 0;
  } catch (error) {
    console.error('Error validating TRF:', error);
    return false;
  }
}

// Helper function to validate if a claim exists
async function validateClaimExists(claimId: string): Promise<boolean> {
  try {
    // Check both expense_claims and claims tables
    const expenseClaimsResult = await sql`
      SELECT id FROM expense_claims WHERE id = ${claimId}
    `;
    if (expenseClaimsResult && expenseClaimsResult.length > 0) {
      return true;
    }
    
    const claimsResult = await sql`
      SELECT id FROM claims WHERE id = ${claimId}
    `;
    return claimsResult && claimsResult.length > 0;
  } catch (error) {
    console.error('Error validating claim:', error);
    return false;
  }
}

// Helper function to validate if a visa application exists
async function validateVisaExists(visaId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT id FROM visa_applications WHERE id = ${visaId}
    `;
    return result && result.length > 0;
  } catch (error) {
    console.error('Error validating visa application:', error);
    return false;
  }
}

// Helper function to validate if an accommodation request exists
async function validateAccommodationExists(accommodationId: string): Promise<boolean> {
  try {
    // Check if this is a travel request with accommodation details
    const result = await sql`
      SELECT tr.id 
      FROM travel_requests tr
      INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
      WHERE tr.id = ${accommodationId}
    `;
    return result && result.length > 0;
  } catch (error) {
    console.error('Error validating accommodation request:', error);
    return false;
  }
}

export async function GET() {
  console.log('Activities API: Starting request');
  
  // Check if user has permission to view dashboard activities
  if (!await hasPermission('view_dashboard_summary')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
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

    // Get recent TRFs with validation
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
        LIMIT 20
      `;
      
      // Validate each TRF exists before adding to activities
      for (const trf of trfQuery || []) {
        const isValid = await validateTRFExists(trf.id);
        if (isValid) {
          const dateInfo = getDateInfo({
            status: trf.status,
            created_at: trf.created_at,
            updated_at: trf.updated_at
          });
          
          trfs.push({
            id: trf.id,
            type: 'TRF',
            title: `TRF: ${trf.purpose || 'Travel Request'}`,
            status: trf.status,
            dateInfo,
            link: `/trf/view/${trf.id}`,
            statusVariant: getStatusVariant(trf.status),
            icon: 'FileText',
            staff_id: trf.staff_id
          });
        } else {
          console.log(`Skipping invalid TRF: ${trf.id}`);
        }
      }
      
      console.log(`Found ${trfs.length} valid TRFs out of ${trfQuery?.length || 0} total`);
    } catch (err) {
      console.error('Error fetching TRFs:', err);
      // Continue execution even if this query fails
    }

    // Get recent claims with validation
    try {
      console.log('Fetching recent claims...');
      
      // Check if expense_claims table exists first
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'expense_claims'
        ) as exists
      `;
      
      if (tableCheck[0]?.exists) {
        const claimsQuery = await sql`
          SELECT 
            id, 
            purpose_of_claim as purpose, 
            status, 
            created_at, 
            updated_at,
            staff_id
          FROM expense_claims 
          ORDER BY updated_at DESC
          LIMIT 10
        `;
        
        // Validate each claim exists before adding to activities
        for (const claim of claimsQuery || []) {
          const isValid = await validateClaimExists(claim.id);
          if (isValid) {
            const dateInfo = getDateInfo({
              status: claim.status,
              created_at: claim.created_at,
              updated_at: claim.updated_at
            });
            
            claims.push({
              id: claim.id,
              type: 'Claim',
              title: `Claim: ${claim.purpose || 'Expense Claim'}`,
              status: claim.status,
              dateInfo,
              link: `/claims/view/${claim.id}`,
              statusVariant: getStatusVariant(claim.status),
              icon: 'ReceiptText',
              staff_id: claim.staff_id
            });
          } else {
            console.log(`Skipping invalid claim: ${claim.id}`);
          }
        }
      }
      
      console.log(`Found ${claims.length} valid claims`);
    } catch (err) {
      console.error('Error fetching claims:', err);
      // Continue execution even if this query fails
    }

    // Get recent visa applications with validation
    try {
      console.log('Fetching recent visa applications...');
      const visaQuery = await sql`
        SELECT 
          id, 
          travel_purpose as purpose, 
          status, 
          created_at, 
          updated_at,
          requestor_name
        FROM visa_applications 
        ORDER BY updated_at DESC
        LIMIT 10
      `;
      
      // Validate each visa application exists before adding to activities
      for (const visa of visaQuery || []) {
        const isValid = await validateVisaExists(visa.id);
        if (isValid) {
          const dateInfo = getDateInfo({
            status: visa.status,
            created_at: visa.created_at,
            updated_at: visa.updated_at
          });
          
          visas.push({
            id: visa.id,
            type: 'Visa',
            title: `Visa: ${visa.purpose || 'Visa Application'}`,
            status: visa.status,
            dateInfo,
            link: `/visa/view/${visa.id}`,
            statusVariant: getStatusVariant(visa.status),
            icon: 'StickyNote',
            staff_id: visa.requestor_name
          });
        } else {
          console.log(`Skipping invalid visa application: ${visa.id}`);
        }
      }
      
      console.log(`Found ${visas.length} valid visa applications`);
    } catch (err) {
      console.error('Error fetching visa applications:', err);
      // Continue execution even if this query fails
    }

    // Get recent accommodation requests with validation
    try {
      console.log('Fetching recent accommodation requests...');
      
      // Get travel requests that have accommodation details
      const accommodationQuery = await sql`
        SELECT DISTINCT ON (tr.id)
          tr.id, 
          tr.purpose, 
          tr.status, 
          tr.created_at, 
          tr.updated_at,
          tr.staff_id
        FROM travel_requests tr
        INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
        ORDER BY tr.id, tr.updated_at DESC
        LIMIT 10
      `;
      
      // Validate each accommodation request exists before adding to activities
      for (const accommodation of accommodationQuery || []) {
        const isValid = await validateAccommodationExists(accommodation.id);
        if (isValid) {
          const dateInfo = getDateInfo({
            status: accommodation.status,
            created_at: accommodation.created_at,
            updated_at: accommodation.updated_at
          });
          
          accommodationBookings.push({
            id: accommodation.id,
            type: 'Accommodation',
            title: `Accommodation: ${accommodation.purpose || 'Booking Request'}`,
            status: accommodation.status,
            dateInfo,
            link: `/accommodation/view/${accommodation.id}`,
            statusVariant: getStatusVariant(accommodation.status),
            icon: 'BedDouble',
            staff_id: accommodation.staff_id
          });
        } else {
          console.log(`Skipping invalid accommodation request: ${accommodation.id}`);
        }
      }
      
      console.log(`Found ${accommodationBookings.length} valid accommodation requests`);
    } catch (err) {
      console.error('Error fetching accommodation requests:', err);
      // Continue execution even if this query fails
    }

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
    console.log(`Returning ${result.length} validated activities`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in activities API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
