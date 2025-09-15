#!/usr/bin/env node

/**
 * Database Consistency Checker for Transport Requests
 * Checks which users have transport requests and verifies the data consistency
 */

const { sql } = require('../src/lib/db');

async function checkTransportConsistency() {
  try {
    console.log('🔍 Checking transport request consistency...\n');

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

    console.log(`📊 Total transport requests: ${transportRequests.length}\n`);

    // Group by users
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
        userGroups[userId].requests.push(req);
      } else {
        orphanRequests.push(req);
      }
    });

    // Display results by user
    console.log('👥 TRANSPORT REQUESTS BY USER:\n');
    
    Object.values(userGroups).forEach(group => {
      console.log(`👤 User: ${group.user.name} (${group.user.email})`);
      console.log(`   Role: ${group.user.role}`);
      console.log(`   Department: ${group.user.department || 'N/A'}`);
      console.log(`   Staff ID: ${group.user.staff_id || 'N/A'}`);
      console.log(`   Request Count: ${group.requests.length}`);
      
      group.requests.forEach((req, index) => {
        console.log(`   ${index + 1}. ${req.id} - ${req.requestor_name} (${req.status}) - ${new Date(req.submitted_at).toLocaleDateString()}`);
        
        // Check for inconsistencies
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
          console.log(`      ⚠️  Issues: ${issues.join(', ')}`);
        }
      });
      console.log('');
    });

    // Display orphan requests
    if (orphanRequests.length > 0) {
      console.log('🚫 ORPHAN REQUESTS (No matching user found):');
      orphanRequests.forEach(req => {
        console.log(`   ${req.id} - ${req.requestor_name} (Staff: ${req.staff_id}, Created by: ${req.created_by})`);
      });
      console.log('');
    }

    // Summary statistics
    console.log('📈 SUMMARY:');
    console.log(`   Users with transport requests: ${Object.keys(userGroups).length}`);
    console.log(`   Total requests: ${transportRequests.length}`);
    console.log(`   Orphan requests: ${orphanRequests.length}`);
    
    // Check for Transport Admins specifically
    const transportAdmins = Object.values(userGroups).filter(group => 
      group.user.role === 'Transport Admin' || 
      group.user.role === 'System Administrator'
    );
    
    if (transportAdmins.length > 0) {
      console.log('\n🚛 TRANSPORT ADMIN REQUESTS:');
      transportAdmins.forEach(group => {
        console.log(`   ${group.user.name} (${group.user.role}): ${group.requests.length} requests`);
        group.requests.forEach(req => {
          console.log(`      ${req.id} - ${req.status} - ${new Date(req.submitted_at).toLocaleDateString()}`);
        });
      });
    }

  } catch (error) {
    console.error('❌ Error checking transport consistency:', error);
  } finally {
    process.exit(0);
  }
}

checkTransportConsistency();