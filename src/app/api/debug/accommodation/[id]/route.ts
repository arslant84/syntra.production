import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    console.log(`DEBUG: Looking for accommodation request with ID: ${id}`);
    
    // Check travel_requests table
    const trfResults = await sql`
      SELECT id, travel_type, status, requestor_name, submitted_at 
      FROM travel_requests 
      WHERE id ILIKE ${`%${id}%`}
      LIMIT 10
    `;
    
    // Check trf_accommodation_details table
    const tadResults = await sql`
      SELECT trf_id, location, check_in_date, check_out_date 
      FROM trf_accommodation_details 
      WHERE trf_id ILIKE ${`%${id}%`}
      LIMIT 10
    `;
    
    // Check for partial matches
    const partialMatches = await sql`
      SELECT tr.id, tr.travel_type, tr.status, tr.requestor_name, tr.submitted_at
      FROM travel_requests tr
      WHERE tr.id SIMILAR TO '%ACCOM%'
      ORDER BY tr.submitted_at DESC
      LIMIT 20
    `;
    
    return NextResponse.json({
      searchId: id,
      exact_trf_matches: trfResults,
      exact_tad_matches: tadResults,
      recent_accommodation_requests: partialMatches,
      debug_info: {
        trf_count: trfResults.length,
        tad_count: tadResults.length,
        recent_accom_count: partialMatches.length
      }
    });
  } catch (error: any) {
    console.error('Debug accommodation error:', error);
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error.message,
      searchId: id 
    }, { status: 500 });
  }
}