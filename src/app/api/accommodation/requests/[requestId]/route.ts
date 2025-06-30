// src/app/api/accommodation/requests/[requestId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAccommodationRequestById } from '@/lib/accommodation-service';
import type { AccommodationRequestDetails } from '@/types/accommodation';


export async function GET(request: NextRequest, { params }: { params: { requestId: string } }) {
  const { requestId } = params;
  console.log(`API_ACCOM_REQ_ID_GET_START: Fetching accommodation request ${requestId}.`);

  try {
    const accommodationRequest = await getAccommodationRequestById(requestId);

    if (!accommodationRequest) {
      return NextResponse.json({ error: 'Accommodation request not found' }, { status: 404 });
    }
    
    return NextResponse.json({ accommodationRequest });
  } catch (error: any) {
    console.error(`API_ACCOM_REQ_ID_GET_ERROR (PostgreSQL) for request ${requestId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch accommodation request details.', details: error.message }, { status: 500 });
  }
}
