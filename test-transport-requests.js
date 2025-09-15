const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
};

async function testTransportRequests() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🧪 Testing Transport Requests functionality...');
    
    // Test 1: Check if tables exist
    console.log('\n1. Checking if transport tables exist...');
    const tables = ['transport_requests', 'transport_details', 'transport_approval_steps'];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' does not exist`);
      }
    }
    
    // Test 2: Check table structure
    console.log('\n2. Checking table structure...');
    
    const transportRequestsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transport_requests'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Transport Requests table structure:');
    transportRequestsStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test 3: Insert a test transport request
    console.log('\n3. Testing insert functionality...');
    
    const testTransportRequest = {
      requestor_name: 'John Doe',
      staff_id: 'EMP001',
      department: 'IT Department',
      position: 'Software Engineer',
      cost_center: 'CC001',
      tel_email: 'john.doe@company.com',
      email: 'john.doe@company.com',
      purpose: 'Client meeting transport',
      status: 'Draft',
      total_estimated_cost: 150.00,
      tsr_reference: 'TSR-2024-001',
      additional_comments: 'Test transport request',
      confirm_policy: true,
      confirm_manager_approval: true,
      confirm_terms_and_conditions: true,
      created_by: 'test-user'
    };
    
    const insertResult = await pool.query(`
      INSERT INTO transport_requests (
        requestor_name, staff_id, department, position, cost_center,
        tel_email, email, purpose, status, total_estimated_cost,
        tsr_reference, additional_comments, confirm_policy,
        confirm_manager_approval, confirm_terms_and_conditions, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [
      testTransportRequest.requestor_name,
      testTransportRequest.staff_id,
      testTransportRequest.department,
      testTransportRequest.position,
      testTransportRequest.cost_center,
      testTransportRequest.tel_email,
      testTransportRequest.email,
      testTransportRequest.purpose,
      testTransportRequest.status,
      testTransportRequest.total_estimated_cost,
      testTransportRequest.tsr_reference,
      testTransportRequest.additional_comments,
      testTransportRequest.confirm_policy,
      testTransportRequest.confirm_manager_approval,
      testTransportRequest.confirm_terms_and_conditions,
      testTransportRequest.created_by
    ]);
    
    const transportRequestId = insertResult.rows[0].id;
    console.log(`✅ Test transport request created with ID: ${transportRequestId}`);
    
    // Test 4: Insert transport details
    console.log('\n4. Testing transport details insert...');
    
    const testTransportDetail = {
      transport_request_id: transportRequestId,
      date: '2024-01-15',
      day: 'Monday',
      from_location: 'Office Building A',
      to_location: 'Client Office',
      departure_time: '09:00',
      arrival_time: '10:30',
      transport_type: 'Local',
      vehicle_type: 'Car',
      number_of_passengers: 2,
      purpose: 'Client meeting',
      remarks: 'Standard transport request',
      estimated_cost: 75.00
    };
    
    await pool.query(`
      INSERT INTO transport_details (
        transport_request_id, date, day, from_location, to_location,
        departure_time, arrival_time, transport_type, vehicle_type,
        number_of_passengers, purpose, remarks, estimated_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      testTransportDetail.transport_request_id,
      testTransportDetail.date,
      testTransportDetail.day,
      testTransportDetail.from_location,
      testTransportDetail.to_location,
      testTransportDetail.departure_time,
      testTransportDetail.arrival_time,
      testTransportDetail.transport_type,
      testTransportDetail.vehicle_type,
      testTransportDetail.number_of_passengers,
      testTransportDetail.purpose,
      testTransportDetail.remarks,
      testTransportDetail.estimated_cost
    ]);
    
    console.log('✅ Test transport detail created');
    
    // Test 5: Insert approval steps
    console.log('\n5. Testing approval steps insert...');
    
    const testApprovalStep = {
      transport_request_id: transportRequestId,
      role: 'Requestor',
      name: 'John Doe',
      status: 'Current',
      date: new Date(),
      comments: 'Initial submission'
    };
    
    await pool.query(`
      INSERT INTO transport_approval_steps (
        transport_request_id, role, name, status, date, comments
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      testApprovalStep.transport_request_id,
      testApprovalStep.role,
      testApprovalStep.name,
      testApprovalStep.status,
      testApprovalStep.date,
      testApprovalStep.comments
    ]);
    
    console.log('✅ Test approval step created');
    
    // Test 6: Query the complete transport request
    console.log('\n6. Testing complete transport request query...');
    
    const completeRequest = await pool.query(`
      SELECT 
        tr.*,
        td.id as detail_id,
        td.date as detail_date,
        td.from_location,
        td.to_location,
        td.departure_time,
        td.arrival_time,
        td.transport_type,
        td.vehicle_type,
        td.number_of_passengers,
        td.estimated_cost as detail_cost,
        tas.role as approval_role,
        tas.name as approval_name,
        tas.status as approval_status
      FROM transport_requests tr
      LEFT JOIN transport_details td ON tr.id = td.transport_request_id
      LEFT JOIN transport_approval_steps tas ON tr.id = tas.transport_request_id
      WHERE tr.id = $1
    `, [transportRequestId]);
    
    console.log('📊 Complete transport request data:');
    console.log(`  - Request ID: ${completeRequest.rows[0]?.id}`);
    console.log(`  - Requestor: ${completeRequest.rows[0]?.requestor_name}`);
    console.log(`  - Purpose: ${completeRequest.rows[0]?.purpose}`);
    console.log(`  - Status: ${completeRequest.rows[0]?.status}`);
    console.log(`  - TSR Reference: ${completeRequest.rows[0]?.tsr_reference}`);
    console.log(`  - Total Cost: $${completeRequest.rows[0]?.total_estimated_cost}`);
    
    // Test 7: Clean up test data
    console.log('\n7. Cleaning up test data...');
    
    await pool.query('DELETE FROM transport_approval_steps WHERE transport_request_id = $1', [transportRequestId]);
    await pool.query('DELETE FROM transport_details WHERE transport_request_id = $1', [transportRequestId]);
    await pool.query('DELETE FROM transport_requests WHERE id = $1', [transportRequestId]);
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All transport request tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing transport requests:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testTransportRequests()
    .then(() => {
      console.log('\n✅ Transport request functionality test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Transport request functionality test failed:', error);
      process.exit(1);
    });
}

module.exports = { testTransportRequests }; 