/**
 * Script to fix transport request TRN-20250828-1112-LOCAL-2WXL
 * Updates status and sends missing Transport Admin notification
 */

const { sql } = require('../src/lib/db');

async function fixTransportRequest() {
  try {
    const transportId = 'TRN-20250828-1112-LOCAL-2WXL';
    console.log(`🔧 Fixing transport request: ${transportId}\n`);

    // 1. Check current status
    const [transport] = await sql`
      SELECT 
        id, requestor_name, department, purpose, status, created_by,
        tr.email as direct_email,
        u.email as created_by_email
      FROM transport_requests tr
      LEFT JOIN users u ON tr.created_by = u.id
      WHERE id = ${transportId}
    `;

    if (!transport) {
      console.log('❌ Transport request not found');
      return;
    }

    console.log('📋 CURRENT STATUS:');
    console.log(`   🆔 ID: ${transport.id}`);
    console.log(`   👤 Requestor: ${transport.requestor_name}`);
    console.log(`   🏢 Department: ${transport.department}`);
    console.log(`   📊 Current Status: ${transport.status}`);
    console.log('');

    // 2. Update status if it's "Approved"
    if (transport.status === 'Approved') {
      console.log('🔄 Updating status from "Approved" to "Processing with Transport Admin"...');
      
      await sql`
        UPDATE transport_requests 
        SET status = 'Processing with Transport Admin', updated_at = NOW()
        WHERE id = ${transportId}
      `;
      
      console.log('✅ Status updated successfully');
      
      // Add approval step for HOD (if missing)
      const hodStepExists = await sql`
        SELECT id FROM transport_approval_steps 
        WHERE transport_request_id = ${transportId} AND role = 'HOD'
      `;
      
      if (hodStepExists.length === 0) {
        console.log('➕ Adding missing HOD approval step...');
        await sql`
          INSERT INTO transport_approval_steps (
            transport_request_id, role, name, status, date, comments
          ) VALUES (
            ${transportId}, 
            'HOD', 
            'System Generated', 
            'Approved',
            NOW(), 
            'Retroactive approval step added'
          )
        `;
        console.log('✅ HOD approval step added');
      }
      
    } else {
      console.log(`ℹ️  Status is already "${transport.status}" - no update needed`);
    }

    // 3. Send notification to Transport Admin using the unified notification service
    console.log('📧 Sending Transport Admin notification...');
    
    try {
      // Import notification service
      const { UnifiedNotificationService } = await import('../src/lib/unified-notification-service');
      
      // Determine requestor email
      const requestorEmail = transport.direct_email || transport.created_by_email;
      
      await UnifiedNotificationService.sendWorkflowNotification({
        eventType: 'transport_hod_approved',
        entityType: 'transport',
        entityId: transportId,
        currentStatus: 'Processing with Transport Admin',
        previousStatus: 'Pending HOD',
        requestorId: transport.created_by,
        requestorName: transport.requestor_name,
        requestorEmail: requestorEmail,
        department: transport.department,
        approverName: 'HOD (Retroactive)',
        approverRole: 'HOD',
        entityTitle: `Transport Request - ${transport.purpose}`,
        transportPurpose: transport.purpose,
        comments: 'Retroactive notification - HOD approval completed'
      });
      
      console.log('✅ Transport Admin notification sent successfully');
      
    } catch (notificationError) {
      console.error('❌ Failed to send notification:', notificationError);
      console.log('ℹ️  You may need to manually notify the Transport Admin');
    }

    // 4. Show final status
    console.log('\n📋 FINAL STATUS:');
    const [updatedTransport] = await sql`
      SELECT status FROM transport_requests WHERE id = ${transportId}
    `;
    console.log(`   📊 Status: ${updatedTransport.status}`);
    
    console.log('\n✅ Transport request fix completed!');
    console.log('🔍 Transport Admin should now be notified and can process the request');

  } catch (error) {
    console.error('❌ Error fixing transport request:', error);
  } finally {
    process.exit(0);
  }
}

fixTransportRequest().catch(console.error);