// Debug API endpoint to manually trigger TRF auto-generation
import { NextRequest, NextResponse } from 'next/server';
import { TSRAutoGenerationService } from '@/lib/tsr-auto-generation-service';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';

export const GET = withAuth(async (request: NextRequest, session: any, context: { params: { trfId: string } }) => {
  try {
    const trfId = context.params.trfId;
    
    // Fetch TRF data
    const trfData = await sql`
      SELECT 
        id, requestor_name, staff_id, department, position, purpose, travel_type
      FROM travel_requests 
      WHERE id = ${trfId}
    `;
    
    if (trfData.length === 0) {
      return NextResponse.json({ error: 'TRF not found' }, { status: 404 });
    }
    
    const trf = trfData[0];
    
    // Prepare TSR data for auto-generation
    const tsrData = {
      id: trf.id,
      travelType: trf.travel_type,
      requestorName: trf.requestor_name,
      staffId: trf.staff_id,
      department: trf.department,
      position: trf.position,
      purpose: trf.purpose
    };
    
    console.log(`DEBUG_AUTO_GEN: Manually triggering auto-generation for TRF ${trfId}`);
    console.log(`DEBUG_AUTO_GEN: Using session ID: ${session.id}`);
    console.log(`DEBUG_AUTO_GEN: TRF data:`, tsrData);
    
    // Trigger auto-generation
    const result = await TSRAutoGenerationService.autoGenerateRequests(tsrData, session.id);
    
    return NextResponse.json({
      success: true,
      trfId: trfId,
      generatedRequests: result,
      message: `Generated ${result.transportRequests.length} transport requests and ${result.accommodationRequests.length} accommodation requests`
    });
    
  } catch (error) {
    console.error('DEBUG_AUTO_GEN_ERROR:', error);
    return NextResponse.json({ 
      error: 'Failed to trigger auto-generation',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});