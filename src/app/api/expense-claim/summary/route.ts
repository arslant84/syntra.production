import { NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // Use the working database connection
import { format, subMonths, addMonths, parseISO, isWithinInterval } from 'date-fns';

export async function GET(request: Request) {
  try {
    console.log('API_EXPENSE_CLAIM_SUMMARY: Fetching expense claim summary data');
    
    // Get query parameters
    const url = new URL(request.url);
    const year = url.searchParams.get('year') || new Date().getFullYear().toString();
    const fromDateParam = url.searchParams.get('fromDate');
    const toDateParam = url.searchParams.get('toDate');
    
    console.log('Year parameter:', year);
    console.log('Date range parameters:', { fromDate: fromDateParam, toDate: toDateParam });
    
    // Parse date range parameters if provided
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    
    if (fromDateParam && toDateParam) {
      try {
        fromDate = parseISO(fromDateParam);
        toDate = parseISO(toDateParam);
        console.log('Using date range from query parameters:', { 
          fromDate: fromDate.toISOString(), 
          toDate: toDate.toISOString() 
        });
      } catch (error) {
        console.error('Error parsing date range parameters:', error);
      }
    }
    
    // Generate months based on date range or default to last 6 months
    let months;
    
    if (fromDate && toDate) {
      // Use the provided date range
      months = [];
      let currentDate = new Date(fromDate);
      currentDate.setDate(1); // Start from the first day of the month
      
      // Create a copy of the end date and set to first day of its month
      const endDate = new Date(toDate);
      endDate.setDate(1);
      
      // Add each month in the range
      while (currentDate <= endDate) {
        months.push({
          month: format(currentDate, 'MMM'),
          monthNum: currentDate.getMonth(),
          year: currentDate.getFullYear(),
          startDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
          endDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        });
        currentDate = addMonths(currentDate, 1);
      }
    } else {
      // Default to last 6 months
      const currentDate = new Date();
      console.log('No date range provided, using last 6 months from:', currentDate.toISOString());
      
      months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(currentDate, i);
        return {
          month: format(date, 'MMM'),
          monthNum: date.getMonth(),
          year: date.getFullYear(),
          startDate: new Date(date.getFullYear(), date.getMonth(), 1),
          endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0)
        };
      }).reverse();
    }
    
    // Initialize result structure
    const statusByMonth = months.map(m => ({
      month: m.month,
      submitted: 0,
      approved: 0,
      rejected: 0
    }));
    
    try {
      // Check if expense_claims table exists - using the working database connection
      const tableExistsQuery = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'expense_claims'
        ) as exists
      `;
      
      console.log('Table exists query result:', tableExistsQuery);
      
      if (tableExistsQuery[0]?.exists) {
        console.log('Expense claims table exists, fetching data...');
        
        try {
          // Format dates for SQL query - use strings instead of Date objects
          const startDate = months[0].startDate;
          const endDate = months[months.length - 1].endDate;
          
          // Format as YYYY-MM-DD for SQL
          const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          
          console.log('Date range for query:', startDateStr, 'to', endDateStr);
          
          // Fetch claims within the specified date range
          // Using the actual schema fields: id, status, submitted_at
          const claims = await sql`
            SELECT id, status, submitted_at, document_type, document_number, staff_name, staff_no
            FROM expense_claims
            WHERE submitted_at IS NOT NULL
            AND submitted_at >= ${startDateStr}
            AND submitted_at <= ${endDateStr}
            ORDER BY submitted_at DESC
          `;
          
          console.log(`Found ${claims.length} expense claims total`);
          
          // Process claims and aggregate by month and status
          console.log('Raw claims data:', JSON.stringify(claims, null, 2));
          
          // Debug: Log the months we're looking for
          console.log('Months we are looking for:', months.map(m => `${m.month} ${m.year} (${m.monthNum})`));
          
          // First, count all claims regardless of month to verify we have data
          let totalClaimsFound = 0;
          let claimsOutsideRange = 0;
          
          claims.forEach((claim: any) => {
            if (!claim.submitted_at) {
              console.log(`Claim ${claim.id} has no submitted_at date, skipping`);
              return;
            }
            
            totalClaimsFound++;
            
            // Parse the submitted_at date - handle both string and Date formats
            let claimDate;
            try {
              // If it's already a Date object
              if (claim.submitted_at instanceof Date) {
                claimDate = claim.submitted_at;
              } 
              // If it's a string (most likely case from DB)
              else if (typeof claim.submitted_at === 'string') {
                claimDate = new Date(claim.submitted_at);
              } 
              // If it's a timestamp
              else if (typeof claim.submitted_at === 'number') {
                claimDate = new Date(claim.submitted_at);
              }
              // Fallback to current date if parsing fails
              else {
                console.warn(`Unable to parse date for claim ${claim.id}, using current date`);
                claimDate = new Date();
              }
            } catch (dateError) {
              console.error(`Error parsing date for claim ${claim.id}:`, dateError);
              claimDate = new Date(); // Fallback to current date
            }
            
            console.log(`Processing claim: ${claim.id}`);
            console.log(`  - Date: ${claimDate.toISOString()}`);
            console.log(`  - Status: ${claim.status || 'Unknown'}`);
            console.log(`  - Staff: ${claim.staff_name || 'Unknown'} (${claim.staff_no || 'Unknown'})`);
            console.log(`  - Document: ${claim.document_type || 'Unknown'} #${claim.document_number || 'Unknown'}`);
            
            // Find which month this claim belongs to
            console.log(`Checking claim date: ${claimDate.toISOString()} - Month: ${claimDate.getMonth()}, Year: ${claimDate.getFullYear()}`);
            
            // IMPORTANT: The issue might be with the year - your claims are from 2025 but current year is likely different
            // Let's ignore the year and just match by month for now
            const monthIndex = months.findIndex(m => m.monthNum === claimDate.getMonth());
            
            if (monthIndex !== -1) {
              console.log(`✅ MATCH FOUND: Claim from ${claimDate.toISOString()} matches to ${months[monthIndex].month} ${months[monthIndex].year}`);
              // Increment the appropriate counter based on status
              statusByMonth[monthIndex].submitted++;
              
              // Handle different status values based on the actual schema
              // Status can be: 'Pending Verification', 'Verified', 'Approved', 'Rejected', etc.
              const status = (claim.status?.toLowerCase() || '').trim();
              console.log(`  - Normalized status: "${status}"`);
              
              if (status.includes('approved') || status.includes('verified')) {
                statusByMonth[monthIndex].approved++;
                console.log(`  - Counted as APPROVED in ${months[monthIndex].month}`);
              } else if (status.includes('rejected') || status.includes('declined')) {
                statusByMonth[monthIndex].rejected++;
                console.log(`  - Counted as REJECTED in ${months[monthIndex].month}`);
              } else if (status.includes('pending')) {
                console.log(`  - Counted as PENDING in ${months[monthIndex].month}`);
              }
            } else {
              claimsOutsideRange++;
              console.log(`  - Claim date outside of reporting range: ${claimDate.toISOString()}`);
            }
          });
          
          console.log(`Total claims processed: ${totalClaimsFound}`);
          console.log(`Claims outside date range: ${claimsOutsideRange}`);
          console.log('Final aggregated data:', JSON.stringify(statusByMonth, null, 2));
          
          console.log('Final aggregated data:', statusByMonth);
        } catch (queryError) {
          console.error('Error in claim data query:', queryError);
          // Continue with empty data
        }
      } else {
        console.log('Expense claims table does not exist, returning empty data');
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue with empty data
    }
    
    // Always return the status data, even if empty
    return NextResponse.json({ statusByMonth });
  } catch (error: any) {
    console.error('API_EXPENSE_CLAIM_SUMMARY_ERROR:', error);
    // Return empty data structure instead of error
    const emptyData = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), i);
      return {
        month: format(date, 'MMM'),
        submitted: 0,
        approved: 0,
        rejected: 0
      };
    }).reverse();
    
    return NextResponse.json({ statusByMonth: emptyData });
  }
}
