// check-existing-steps-fixed.js
// Check what approval steps exist for the problematic TSRs

require('dotenv').config();
const postgres = require('postgres');

const sql = postgres({
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
  ssl: false,
  max: 5,
  debug: false
});

async function checkExistingSteps() {
  console.log('🔍 Checking Existing Approval Steps...\n');

  try {
    const tsrIds = ['TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4'];
    
    console.log('TSR IDs to check:', tsrIds);

    // First, let's check the table structure
    const tableStructure = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'trf_approval_steps' 
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📋 trf_approval_steps table structure:');
    tableStructure.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // Get existing approval steps for these specific TSRs
    const existingSteps = await sql`
      SELECT 
        trf_id,
        step_role,
        step_name,
        status,
        step_date,
        comments,
        created_at
      FROM trf_approval_steps
      WHERE trf_id = ANY(${tsrIds})
      ORDER BY trf_id, created_at ASC;
    `;

    console.log(`\n✅ Found ${existingSteps.length} existing approval steps\n`);

    if (existingSteps.length === 0) {
      console.log('❓ No approval steps found. Let me check if the TSR IDs exist...');
      
      // Check if these TSRs are in the travel_requests table
      const tsrCheck = await sql`
        SELECT id, requestor_name, status, travel_type
        FROM travel_requests 
        WHERE id = ANY(${tsrIds});
      `;

      console.log(`🔍 TSR Records Check (${tsrCheck.length} found):`);
      tsrCheck.forEach(tsr => {
        console.log(`  ${tsr.id} | ${tsr.requestor_name} | ${tsr.status} | ${tsr.travel_type}`);
      });
      
      // Check if there are any approval steps at all
      const anySteps = await sql`
        SELECT COUNT(*) as total_steps
        FROM trf_approval_steps;
      `;
      
      console.log(`\n📊 Total approval steps in database: ${anySteps[0].total_steps}`);
      
      if (anySteps[0].total_steps > 0) {
        // Show some sample approval steps
        const sampleSteps = await sql`
          SELECT trf_id, step_role, status, step_date
          FROM trf_approval_steps
          ORDER BY created_at DESC
          LIMIT 10;
        `;
        
        console.log('\n📋 Sample approval steps in database:');
        sampleSteps.forEach(step => {
          console.log(`  ${step.trf_id} | ${step.step_role} | ${step.status} | ${step.step_date?.toDateString()}`);
        });
      }
      
      return;
    }

    // Group by TSR ID
    const stepsByTSR = {};
    existingSteps.forEach(step => {
      if (!stepsByTSR[step.trf_id]) {
        stepsByTSR[step.trf_id] = [];
      }
      stepsByTSR[step.trf_id].push(step);
    });

    // Display each TSR's steps
    Object.entries(stepsByTSR).forEach(([tsrId, steps]) => {
      console.log(`📋 ${tsrId} (${steps.length} steps):`);
      steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.step_role} | ${step.status} | ${step.step_date?.toISOString()} | ${step.step_name || 'N/A'}`);
        if (step.comments) {
          console.log(`     Comments: ${step.comments}`);
        }
      });
      
      // Check what's missing
      const hasRoles = {
        'Department Focal': steps.some(s => s.step_role === 'Department Focal'),
        'Line Manager': steps.some(s => s.step_role === 'Line Manager'),
        'HOD': steps.some(s => s.step_role === 'HOD')
      };
      
      const missing = [];
      if (!hasRoles['Department Focal']) missing.push('Department Focal');
      if (!hasRoles['Line Manager']) missing.push('Line Manager');
      if (!hasRoles['HOD']) missing.push('HOD');
      
      console.log(`  ❌ Missing: ${missing.length > 0 ? missing.join(', ') : 'None'}\n`);
    });

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await sql.end();
    console.log('\n🔍 Existing steps check completed.');
  }
}

checkExistingSteps().catch(console.error);