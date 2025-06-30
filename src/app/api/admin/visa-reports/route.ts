import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  console.log("API_ADMIN_VISA_REPORTS_GET: Fetching visa reports for admin dashboard");
  
  if (!sql) {
    console.error("API_ADMIN_VISA_REPORTS_ERROR: Database client not initialized");
    return NextResponse.json(
      { error: 'Database client not initialized' }, 
      { status: 500 }
    );
  }

  try {
    // Fetch visa applications with their current status
    const visaApplications = await sql`
      SELECT 
        va.id,
        va.requestor_name as "applicantName",
        va.destination,
        va.status,
        va.submitted_date as "submittedDate",
        va.last_updated_date as "lastUpdatedDate",
        va.visa_type as "visaType",
        va.travel_purpose as "travelPurpose",
        va.trip_start_date as "tripStartDate",
        va.trip_end_date as "tripEndDate",
        va.additional_comments as "additionalComments",
        va.staff_id as "employeeId",
        va.department
      FROM visa_applications va
      ORDER BY va.submitted_date DESC
    `;

    // Fetch approval history separately to avoid GROUP BY issues
    const approvalHistories = await sql`
      SELECT 
        visa_application_id,
        json_agg(
          json_build_object(
            'stepName', step_name,
            'status', status,
            'date', step_date
          ) ORDER BY step_date
        ) as approval_history
      FROM visa_approval_steps
      GROUP BY visa_application_id
    `;

    // Create a map of approval histories by visa application ID
    const approvalHistoryMap = approvalHistories.reduce((map, item) => {
      map[item.visa_application_id] = item.approval_history;
      return map;
    }, {});

    // Merge approval histories with visa applications
    const enrichedApplications = visaApplications.map(app => ({
      ...app,
      approvalHistory: approvalHistoryMap[app.id] || []
    }));

    // Calculate summary statistics
    const totalApplications = enrichedApplications.length;
    const statusCounts = enrichedApplications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average processing time (in days)
    const processingTimes = enrichedApplications
      .filter(app => app.status === 'Approved' || app.status === 'Rejected')
      .map(app => {
        const submitted = new Date(app.submittedDate);
        const updated = new Date(app.lastUpdatedDate);
        return (updated.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24); // Convert ms to days
      });

    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    // Group by destination
    const destinationStats = enrichedApplications.reduce((acc, app) => {
      if (!acc[app.destination]) {
        acc[app.destination] = 0;
      }
      acc[app.destination]++;
      return acc;
    }, {} as Record<string, number>);

    // Prepare the response
    const reportData = {
      summary: {
        totalApplications,
        statusCounts,
        avgProcessingTime: parseFloat(avgProcessingTime.toFixed(1)),
        destinations: Object.keys(destinationStats).length
      },
      recentApplications: enrichedApplications.slice(0, 50), // Limit to most recent 50 applications
      destinationStats,
      statusOverTime: {
        // This would be enhanced with actual time-based data in a real implementation
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        data: [12, 19, 3, 5, 2, 3, 7, 10, 15, 8, 12, 9] // Example data
      }
    };

    return NextResponse.json(reportData);
  } catch (error: any) {
    console.error("API_ADMIN_VISA_REPORTS_ERROR:", error);
    return NextResponse.json(
      { error: 'Failed to generate visa reports', details: error.message },
      { status: 500 }
    );
  }
}
