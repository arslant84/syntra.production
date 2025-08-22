import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/permissions';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage visas (admin view) - using transport/claims permissions for now
    if (!await hasPermission('manage_transport') && !await hasPermission('view_all_transport') && !await hasPermission('manage_claims') && !await hasPermission('view_all_claims')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const url = new URL(request.url);
    const statuses = url.searchParams.get('statuses');
    
    let query;
    let params: any[] = [];
    
    // If specific statuses are requested
    if (statuses) {
      const statusArray = statuses.split(',');
      
      query = sql`
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
      query = sql`
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
}