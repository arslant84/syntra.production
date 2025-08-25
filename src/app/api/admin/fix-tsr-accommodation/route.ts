import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { TSRAutoGenerationService } from '@/lib/tsr-auto-generation-service';

export const POST = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  // Check if user has admin permissions
  if (!hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - admin permissions required' }, { status: 403 });
  }

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    // Find TSRs that have accommodation details but no separate ACCOM requests
    const tsrsWithAccommodation = await sql`
      SELECT DISTINCT
        tr.id,
        tr.requestor_name,
        tr.staff_id,
        tr.department,
        tr.travel_type,
        tr.purpose,
        tr.created_at
      FROM travel_requests tr
      INNER JOIN trf_accommodation_details tad ON tr.id = tad.trf_id
      WHERE tr.id LIKE 'TSR-%'
        AND tr.travel_type != 'Accommodation'
        AND NOT EXISTS (
          SELECT 1 FROM travel_requests accom_tr 
          WHERE accom_tr.additional_comments LIKE '%' || tr.id || '%'
            AND accom_tr.travel_type = 'Accommodation'
            AND accom_tr.id LIKE 'ACCOM-%'
        )
      ORDER BY tr.created_at DESC
    `;

    console.log(`Found ${tsrsWithAccommodation.length} TSRs with accommodation details that need fixing`);

    const results = {
      processed: [] as string[],
      errors: [] as { tsrId: string, error: string }[]
    };

    // Process each TSR
    for (const tsr of tsrsWithAccommodation) {
      try {
        console.log(`Processing TSR ${tsr.id} for accommodation separation`);

        // Use the current session user as the creator
        const userId = session.id;

        // Create TSR data object for auto-generation service
        const tsrData = {
          id: tsr.id,
          travelType: tsr.travel_type,
          requestorName: tsr.requestor_name,
          staffId: tsr.staff_id,
          department: tsr.department,
          purpose: tsr.purpose || 'Auto-separated accommodation from TSR'
        };

        // Call auto-generation service to create separate ACCOM requests
        const generatedRequests = await TSRAutoGenerationService.autoGenerateRequests(tsrData, userId);

        if (generatedRequests.accommodationRequests.length > 0) {
          results.processed.push(tsr.id);
          console.log(`Successfully processed TSR ${tsr.id}: created ${generatedRequests.accommodationRequests.length} ACCOM request(s)`);
        } else {
          results.errors.push({
            tsrId: tsr.id,
            error: 'No accommodation requests were generated'
          });
        }
      } catch (error) {
        console.error(`Error processing TSR ${tsr.id}:`, error);
        results.errors.push({
          tsrId: tsr.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: 'TSR accommodation separation completed',
      totalFound: tsrsWithAccommodation.length,
      processed: results.processed.length,
      errors: results.errors.length,
      details: results
    });

  } catch (error: any) {
    console.error('Error fixing TSR accommodation separation:', error);
    return NextResponse.json(
      { error: 'Failed to fix TSR accommodation separation', details: error.message },
      { status: 500 }
    );
  }
});