import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  // Only allow system administrators to run this debug endpoint
  if (!hasPermission(session, 'admin_all') && session.role !== 'System Administrator') {
    return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
  }

  try {
    console.log('🔍 Checking transport request consistency...');

    // Get all transport requests with user information
    const transportRequests = await sql`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.staff_id,
        tr.department,
        tr.created_by,
        tr.status,
        tr.submitted_at,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.staff_id as user_staff_id,
        u.department as user_department,
        u.role as user_role
      FROM transport_requests tr
      LEFT JOIN users u ON (tr.created_by = u.id OR tr.staff_id = u.staff_id)
      ORDER BY tr.submitted_at DESC
    `;

    // Get user statistics
    const userStats = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.department,
        u.staff_id,
        COUNT(tr.id) as request_count
      FROM users u
      LEFT JOIN transport_requests tr ON (tr.created_by = u.id OR tr.staff_id = u.staff_id)
      WHERE u.role LIKE '%Admin%' OR COUNT(tr.id) > 0
      GROUP BY u.id, u.name, u.email, u.role, u.department, u.staff_id
      ORDER BY u.name
    `;

    // Group requests by user
    const userGroups = {};
    const orphanRequests = [];

    transportRequests.forEach(req => {
      if (req.user_id) {
        const userId = req.user_id;
        if (!userGroups[userId]) {
          userGroups[userId] = {
            user: {
              id: req.user_id,
              name: req.user_name,
              email: req.user_email,
              staff_id: req.user_staff_id,
              department: req.user_department,
              role: req.user_role
            },
            requests: []
          };
        }
        userGroups[userId].requests.push({
          id: req.id,
          requestor_name: req.requestor_name,
          status: req.status,
          submitted_at: req.submitted_at,
          staff_id: req.staff_id,
          department: req.department,
          created_by: req.created_by
        });
      } else {
        orphanRequests.push({
          id: req.id,
          requestor_name: req.requestor_name,
          staff_id: req.staff_id,
          created_by: req.created_by,
          status: req.status,
          submitted_at: req.submitted_at
        });
      }
    });

    // Check for inconsistencies
    const inconsistencies = [];
    Object.values(userGroups).forEach((group: any) => {
      group.requests.forEach((req: any) => {
        const issues = [];
        if (req.requestor_name !== group.user.name) {
          issues.push(`Name mismatch: Request="${req.requestor_name}" vs User="${group.user.name}"`);
        }
        if (req.staff_id && req.staff_id !== group.user.staff_id) {
          issues.push(`Staff ID mismatch: Request="${req.staff_id}" vs User="${group.user.staff_id}"`);
        }
        if (req.department && req.department !== group.user.department) {
          issues.push(`Department mismatch: Request="${req.department}" vs User="${group.user.department}"`);
        }
        
        if (issues.length > 0) {
          inconsistencies.push({
            request_id: req.id,
            user: group.user.name,
            issues: issues
          });
        }
      });
    });

    // Filter transport admins specifically
    const transportAdmins = Object.values(userGroups).filter((group: any) => 
      group.user.role === 'Transport Admin' || 
      group.user.role === 'System Administrator'
    );

    const summary = {
      total_requests: transportRequests.length,
      users_with_requests: Object.keys(userGroups).length,
      orphan_requests: orphanRequests.length,
      inconsistencies: inconsistencies.length,
      transport_admins_with_requests: transportAdmins.length
    };

    return NextResponse.json({
      summary,
      user_groups: userGroups,
      orphan_requests: orphanRequests,
      inconsistencies,
      transport_admins: transportAdmins,
      user_stats: userStats,
      debug_info: {
        session_user: {
          name: session.name,
          role: session.role,
          email: session.email
        }
      }
    });

  } catch (error) {
    console.error('Error checking transport consistency:', error);
    return NextResponse.json(
      { error: 'Failed to check transport consistency', details: error.message },
      { status: 500 }
    );
  }
});