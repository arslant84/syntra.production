import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  // Check if user has permission to manage visas
  if (!hasPermission(session, 'process_visa_applications') && !hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions for visa admin' }, { status: 403 });
  }

  console.log(`API_ADMIN_VISA_GET: Admin ${session.role} (${session.email}) accessing visa data`);

  try {
    const url = new URL(request.url);
    const statuses = url.searchParams.get('statuses');
    
    // Ensure we have a valid SQL connection
    const { getSql } = await import('@/lib/db');
    const sqlInstance = getSql();
    
    let query;
    
    // If specific statuses are requested
    if (statuses) {
      const statusArray = statuses.split(',');
      
      query = sqlInstance`
        SELECT 
          va.id,
          va.requestor_name as requestorName,
          va.staff_id as staffId,
          va.travel_purpose as purpose,
          va.destination,
          va.status,
          va.submitted_date as submittedAt,
          va.trf_reference_number as tsrReference,
          va.processing_details as processingDetails
        FROM visa_applications va
        WHERE va.status = ANY(${statusArray})
        ORDER BY va.submitted_date DESC
      `;
    } else {
      // Default behavior - return all visas summary
      query = sqlInstance`
        SELECT 
          va.id,
          va.requestor_name as requestorName,
          va.staff_id as staffId,
          va.travel_purpose as purpose,
          va.destination,
          va.status,
          va.submitted_date as submittedAt,
          va.trf_reference_number as tsrReference,
          va.processing_details as processingDetails
        FROM visa_applications va
        ORDER BY va.submitted_date DESC
      `;
    }
    
    const result = await query;
    
    // Process summary response
    const processedResult = result.map((visa: any) => ({
      id: visa.id,
      requestorName: visa.requestorname || visa.requestor_name,
      staffId: visa.staffid || visa.staff_id,
      purpose: visa.purpose || visa.travel_purpose,
      destination: visa.destination,
      status: visa.status,
      submittedAt: visa.submittedat?.toISOString?.() || visa.submitted_date?.toISOString?.() || visa.submitted_date,
      tsrReference: visa.tsrreference || visa.trf_reference_number,
      processingDetails: visa.processingdetails || visa.processing_details ? 
        JSON.parse(visa.processingdetails || visa.processing_details) : null
    }));
    
    return NextResponse.json(processedResult);
    
  } catch (error) {
    console.error('Error fetching admin visas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visas' },
      { status: 500 }
    );
  }
});