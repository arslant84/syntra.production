const postgres = require('postgres');

// Database configuration
const sql = postgres({
  host: 'localhost',
  database: 'syntra',
  username: 'postgres',
  password: '221202',
  ssl: false
});

async function investigateTSRs() {
  console.log('Investigating TSR workflow inconsistency...\n');
  
  const tsrIds = ['TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4'];
  
  for (const tsrId of tsrIds) {
    console.log(`\n=== ${tsrId} ===`);
    
    // 1. Check main travel_requests record
    console.log('\n1. Travel Requests Table:');
    try {
      const trfRecord = await sql`
        SELECT id, requestor_name, status, travel_type, purpose, 
               submitted_at, created_at, updated_at, staff_id, department
        FROM travel_requests 
        WHERE id = ${tsrId}
      `;
      
      if (trfRecord.length > 0) {
        console.log(JSON.stringify(trfRecord[0], null, 2));
      } else {
        console.log(`No travel_requests record found for ${tsrId}`);
      }
    } catch (err) {
      console.error('Error querying travel_requests:', err.message);
    }
    
    // 2. Check TRF approval steps table structure first
    console.log('\n2. TRF Approval Steps Table Structure:');
    try {
      const tableInfo = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'trf_approval_steps'
        ORDER BY ordinal_position
      `;
      
      if (tableInfo.length > 0) {
        console.log('Table structure:');
        tableInfo.forEach(col => console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable})`));
      } else {
        console.log('trf_approval_steps table does not exist');
      }
    } catch (err) {
      console.error('Error getting table structure:', err.message);
    }
    
    // 3. Check TRF approval steps (with correct columns)
    console.log('\n3. TRF Approval Steps:');
    try {
      const approvalSteps = await sql`
        SELECT *
        FROM trf_approval_steps 
        WHERE trf_id = ${tsrId}
        ORDER BY created_at
      `;
      
      if (approvalSteps.length > 0) {
        approvalSteps.forEach(step => console.log(JSON.stringify(step, null, 2)));
      } else {
        console.log(`No trf_approval_steps found for ${tsrId}`);
      }
    } catch (err) {
      console.error('Error querying trf_approval_steps:', err.message);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  // 4. Check if workflow system tables exist
  console.log('\n\n=== SYSTEM ANALYSIS ===');
  console.log('\n4. Checking Workflow System Tables:');
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('workflow_executions', 'step_executions', 'workflow_templates', 'workflow_audit_log')
    `;
    
    console.log('Found workflow tables:', tables.map(t => t.table_name));
  } catch (err) {
    console.error('Error checking workflow tables:', err.message);
  }
  
  // 5. Check approved TSRs status
  console.log('\n5. Count of Approved TSRs:');
  try {
    const approvedCount = await sql`
      SELECT COUNT(*) as total_approved,
             COUNT(CASE WHEN status = 'Approved' THEN 1 END) as exactly_approved
      FROM travel_requests 
      WHERE status ILIKE '%approved%'
    `;
    
    console.log(JSON.stringify(approvedCount[0], null, 2));
  } catch (err) {
    console.error('Error counting approved TSRs:', err.message);
  }
  
  // 6. Sample of approved TSRs
  console.log('\n6. Sample of Recently Approved TSRs:');
  try {
    const sampleApproved = await sql`
      SELECT id, requestor_name, status, submitted_at, updated_at
      FROM travel_requests 
      WHERE status = 'Approved'
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    
    if (sampleApproved.length > 0) {
      sampleApproved.forEach(tsr => console.log(`${tsr.id}: ${tsr.requestor_name} - ${tsr.status} (updated: ${tsr.updated_at})`));
    } else {
      console.log('No approved TSRs found');
    }
  } catch (err) {
    console.error('Error getting sample approved TSRs:', err.message);
  }
  
  await sql.end();
}

investigateTSRs().catch(console.error);