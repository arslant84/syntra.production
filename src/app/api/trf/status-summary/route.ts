import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  console.log("API_TRF_STATUS_SUMMARY_GET (PostgreSQL): Fetching TRF status summary.");
  if (!sql) {
    console.error("API_TRF_STATUS_SUMMARY_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const trfs = await sql`
      SELECT
        status,
        "submitted_at" AS "submittedAt"
      FROM travel_requests
      ORDER BY "submittedAt" DESC;
    `;

    // Generate last 6 months
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        pending: 0,
        approved: 0,
        rejected: 0
      };
    }).reverse(); // Reverse to have oldest month first

    // Populate data for each month
    trfs.forEach((trf: any) => {
      const trfDate = new Date(trf.submittedAt);
      const monthIndex = months.findIndex(m =>
        m.month === trfDate.toLocaleString('default', { month: 'short' }) &&
        m.year === trfDate.getFullYear()
      );

      if (monthIndex !== -1) {
        if (trf.status.includes('Pending')) {
          months[monthIndex].pending++;
        } else if (trf.status.includes('Approved')) {
          months[monthIndex].approved++;
        } else if (trf.status.includes('Rejected')) {
          months[monthIndex].rejected++;
        }
      }
    });

    const statusByMonth = months.map(m => ({
      month: m.month,
      pending: m.pending,
      approved: m.approved,
      rejected: m.rejected
    }));

    console.log("API_TRF_STATUS_SUMMARY_GET (PostgreSQL): Fetched status summary by month:", statusByMonth);
    return NextResponse.json({ statusByMonth });
  } catch (error: any) {
    console.error("API_TRF_STATUS_SUMMARY_GET_ERROR (PostgreSQL): Failed to fetch status summary.", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch TRF status summary.', details: error.message }, { status: 500 });
  }
}
