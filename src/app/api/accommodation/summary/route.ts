// src/app/api/accommodation/summary/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // Use the working database connection
import { format, subMonths, addMonths, parseISO, isWithinInterval } from 'date-fns';

export async function GET(request: Request) {
  try {
    console.log('API_ACCOMMODATION_SUMMARY: Fetching accommodation summary data');
    
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
    const occupancyByMonth = months.map(m => ({
      month: m.month,
      occupied: 0,
      available: 0
    }));
    
    try {
      // Check if trf_accommodation_details table exists
      const tableExistsQuery = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'trf_accommodation_details'
        ) as exists
      `;
      
      console.log('Table exists query result:', tableExistsQuery);
      
      if (tableExistsQuery[0]?.exists) {
        console.log('Accommodation table exists, fetching data...');
        
        try {
          // Format dates for SQL query - use strings instead of Date objects
          const startDate = months[0].startDate;
          const endDate = months[months.length - 1].endDate;
          
          // Format as YYYY-MM-DD for SQL
          const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
          const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          
          console.log('Date range for query:', startDateStr, 'to', endDateStr);
          
          // Fetch accommodation bookings within the specified date range
          const accommodations = await sql`
            SELECT 
              tad.id,
              tad.trf_id,
              tad.check_in_date,
              tad.check_out_date,
              tad.accommodation_type,
              tad.location,
              tr.status
            FROM 
              trf_accommodation_details tad
            LEFT JOIN 
              travel_requests tr ON tad.trf_id = tr.id
            WHERE 
              tad.check_in_date IS NOT NULL
              AND (
                (tad.check_in_date >= ${startDateStr} AND tad.check_in_date <= ${endDateStr})
                OR (tad.check_out_date >= ${startDateStr} AND tad.check_out_date <= ${endDateStr})
                OR (tad.check_in_date <= ${startDateStr} AND tad.check_out_date >= ${endDateStr})
              )
            ORDER BY 
              tad.check_in_date DESC
          `;
          
          console.log(`Found ${accommodations.length} accommodation records total`);
          
          // Process accommodations and aggregate by month
          console.log('Raw accommodation data:', JSON.stringify(accommodations, null, 2));
          
          // Debug: Log the months we're looking for
          console.log('Months we are looking for:', months.map(m => `${m.month} ${m.year} (${m.monthNum})`));
          
          // First, count all accommodations regardless of month to verify we have data
          let totalAccommodationsFound = 0;
          let accommodationsOutsideRange = 0;
          
          // Also fetch total available rooms per month (assuming a fixed number for now)
          // In a real system, this would come from a rooms or capacity table
          const totalRoomsAvailable = 50; // Placeholder value
          
          accommodations.forEach((accommodation: any) => {
            if (!accommodation.check_in_date) {
              console.log(`Accommodation ${accommodation.id} has no check_in_date, skipping`);
              return;
            }
            
            totalAccommodationsFound++;
            
            // Parse the check_in_date - handle both string and Date formats
            let accommodationDate;
            try {
              // If it's already a Date object
              if (accommodation.check_in_date instanceof Date) {
                accommodationDate = accommodation.check_in_date;
              } 
              // If it's a string (most likely case from DB)
              else if (typeof accommodation.check_in_date === 'string') {
                accommodationDate = new Date(accommodation.check_in_date);
              } 
              // If it's a timestamp
              else if (typeof accommodation.check_in_date === 'number') {
                accommodationDate = new Date(accommodation.check_in_date);
              }
              // Fallback to current date if parsing fails
              else {
                console.warn(`Unable to parse date for accommodation ${accommodation.id}, using current date`);
                accommodationDate = new Date();
              }
            } catch (dateError) {
              console.error(`Error parsing date for accommodation ${accommodation.id}:`, dateError);
              accommodationDate = new Date(); // Fallback to current date
            }
            
            console.log(`Processing accommodation: ${accommodation.id}`);
            console.log(`  - Check-in Date: ${accommodationDate.toISOString()}`);
            console.log(`  - Status: ${accommodation.status || 'Unknown'}`);
            console.log(`  - Type: ${accommodation.accommodation_type || 'Unknown'}`);
            console.log(`  - Location: ${accommodation.location || 'Unknown'}`);
            
            // Find which month this accommodation belongs to
            console.log(`Checking accommodation date: ${accommodationDate.toISOString()} - Month: ${accommodationDate.getMonth()}, Year: ${accommodationDate.getFullYear()}`);
            
            // IMPORTANT: Match by month only to ensure accommodations from any year are included
            const monthIndex = months.findIndex(m => m.monthNum === accommodationDate.getMonth());
            
            if (monthIndex !== -1) {
              console.log(`✅ MATCH FOUND: Accommodation from ${accommodationDate.toISOString()} matches to ${months[monthIndex].month} ${months[monthIndex].year}`);
              
              // Only count approved/confirmed accommodations as occupied
              const status = (accommodation.status?.toLowerCase() || '').trim();
              
              if (status.includes('approved') || status.includes('confirmed')) {
                occupancyByMonth[monthIndex].occupied++;
                console.log(`  - Counted as OCCUPIED in ${months[monthIndex].month}`);
              }
            } else {
              accommodationsOutsideRange++;
              console.log(`  - Accommodation date outside of reporting range: ${accommodationDate.toISOString()}`);
            }
          });
          
          // Set available rooms for each month (total rooms minus occupied)
          occupancyByMonth.forEach((month, index) => {
            month.available = totalRoomsAvailable - month.occupied;
            if (month.available < 0) month.available = 0; // Ensure we don't have negative available rooms
          });
          
          console.log(`Total accommodations processed: ${totalAccommodationsFound}`);
          console.log(`Accommodations outside date range: ${accommodationsOutsideRange}`);
          console.log('Final aggregated data:', JSON.stringify(occupancyByMonth, null, 2));
        } catch (queryError) {
          console.error('Error in accommodation data query:', queryError);
          // Continue with empty data
        }
      } else {
        console.log('Accommodation table does not exist, returning empty data');
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue with empty data
    }
    
    // Always return the occupancy data, even if empty
    // Use bookingsByMonth as the key to match what the reports page expects
    return NextResponse.json({ bookingsByMonth: occupancyByMonth });
  } catch (error: any) {
    console.error('API_ACCOMMODATION_SUMMARY_ERROR:', error);
    // Return empty data structure instead of error
    const emptyData = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), i);
      return {
        month: format(date, 'MMM'),
        occupied: 0,
        available: 0
      };
    }).reverse();
    
    return NextResponse.json({ bookingsByMonth: emptyData });
  }
}
