import { NextResponse } from 'next/server';
import { getAccommodationRequests } from '@/lib/accommodation-service';
import { 
  getServerStaffHouses, 
  getServerStaffGuests, 
  getServerAccommodationBookings
} from '@/lib/server-db';

// API route handler for fetching accommodation data
export async function GET(request: Request) {
  try {
    // Parse URL to get query parameters
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const dataType = searchParams.get('dataType');
    
    // Validate required parameters
    if (dataType === 'bookings' && (!year || !month)) {
      return NextResponse.json(
        { error: 'Year and month are required for bookings' }, 
        { status: 400 }
      );
    }

    // Fetch the requested data
    switch (dataType) {
      case 'staffHouses':
        const staffHouses = await getServerStaffHouses();
        return NextResponse.json({ staffHouses });
      
      case 'staffGuests':
        const staffGuests = await getServerStaffGuests();
        return NextResponse.json({ staffGuests });
      
      case 'bookings':
        const bookings = await getServerAccommodationBookings(
          parseInt(year as string), 
          parseInt(month as string)
        );
        return NextResponse.json({ bookings });
      
      case 'requests':
        const userId = searchParams.get('userId');
        const requests = await getAccommodationRequests(userId || undefined);
        return NextResponse.json({ requests });
      
      default:
        return NextResponse.json(
          { error: 'Invalid data type requested' }, 
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in accommodation API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accommodation data' }, 
      { status: 500 }
    );
  }
}
