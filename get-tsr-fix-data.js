// get-tsr-fix-data.js
// Extract TSR fix data without workflow_executions dependency

require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');

const sql = postgres({
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
  ssl: false,
  max: 5,
  debug: false
});

async function getTSRFixData() {
  console.log('📋 Extracting TSR Fix Data...\n');

  try {
    // Get the complete list of TSRs that need fixing
    const tsrsNeedingFix = await sql`
      WITH fix_candidates AS (
        SELECT 
          tr.id,
          tr.requestor_name,
          tr.status,
          tr.travel_type,
          tr.submitted_at,
          tr.created_at,
          COALESCE(tas.total_steps, 0) as current_steps,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'Department Focal'
          ) THEN 1 ELSE 0 END as needs_focal,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'Line Manager'
          ) THEN 1 ELSE 0 END as needs_manager,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'HOD'
          ) THEN 1 ELSE 0 END as needs_hod,
          (SELECT MAX(step_date) FROM trf_approval_steps WHERE trf_id = tr.id) as latest_step_date
        FROM travel_requests tr
        LEFT JOIN (
          SELECT trf_id, COUNT(*) as total_steps
          FROM trf_approval_steps
          GROUP BY trf_id
        ) tas ON tr.id = tas.trf_id
        WHERE tr.status ILIKE '%approved%'
      )
      SELECT 
        id,
        requestor_name,
        status,
        travel_type,
        submitted_at,
        created_at,
        current_steps,
        needs_focal,
        needs_manager,
        needs_hod,
        (needs_focal + needs_manager + needs_hod) as total_missing_steps,
        COALESCE(latest_step_date, created_at) as reference_timestamp
      FROM fix_candidates
      WHERE (needs_focal + needs_manager + needs_hod) > 0
      ORDER BY (needs_focal + needs_manager + needs_hod) DESC, submitted_at DESC;
    `;

    // Get all approved TSRs for context
    const approvedTSRs = await sql`
      SELECT 
        COUNT(*) as total_approved
      FROM travel_requests 
      WHERE status ILIKE '%approved%';
    `;

    // Get existing approval steps for the TSRs that need fixing
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
      WHERE trf_id IN (${tsrsNeedingFix.map(tsr => tsr.id)})
      ORDER BY trf_id, step_date ASC;
    `;

    console.log(`✅ Found ${tsrsNeedingFix.length} TSRs needing workflow fixes out of ${approvedTSRs[0].total_approved} approved TSRs`);

    // Categorize the issues
    const criticalFixes = tsrsNeedingFix.filter(tsr => tsr.total_missing_steps === 3);
    const majorFixes = tsrsNeedingFix.filter(tsr => tsr.total_missing_steps === 2);
    const minorFixes = tsrsNeedingFix.filter(tsr => tsr.total_missing_steps === 1);
    
    console.log(`🔧 Fix Categories:`);
    console.log(`  🚨 CRITICAL (missing all 3 steps): ${criticalFixes.length} TSRs`);
    console.log(`  ⚠️  MAJOR (missing 2 steps): ${majorFixes.length} TSRs`);
    console.log(`  📝 MINOR (missing 1 step): ${minorFixes.length} TSRs`);

    // Create the fix data structure
    const fixData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalApproved: approvedTSRs[0].total_approved,
        totalNeedingFix: tsrsNeedingFix.length,
        criticalCount: criticalFixes.length,
        majorCount: majorFixes.length,
        minorCount: minorFixes.length,
        issueRate: (tsrsNeedingFix.length / approvedTSRs[0].total_approved * 100).toFixed(1)
      },
      tsrsNeedingFix: tsrsNeedingFix.map(tsr => ({
        id: tsr.id,
        requestorName: tsr.requestor_name,
        status: tsr.status,
        travelType: tsr.travel_type,
        submittedAt: tsr.submitted_at,
        createdAt: tsr.created_at,
        currentSteps: tsr.current_steps,
        needsFocal: tsr.needs_focal === 1,
        needsManager: tsr.needs_manager === 1,
        needsHOD: tsr.needs_hod === 1,
        totalMissingSteps: tsr.total_missing_steps,
        referenceTimestamp: tsr.reference_timestamp
      })),
      existingSteps: existingSteps.map(step => ({
        trfId: step.trf_id,
        stepRole: step.step_role,
        stepName: step.step_name,
        status: step.status,
        stepDate: step.step_date,
        comments: step.comments,
        createdAt: step.created_at
      }))
    };
    
    // Write to JSON file
    fs.writeFileSync('tsr-workflow-fix-data.json', JSON.stringify(fixData, null, 2));
    console.log('✅ Fix data exported to: tsr-workflow-fix-data.json');

    // Display detailed info about each TSR
    console.log('\n📋 Detailed TSR Fix Requirements:');
    tsrsNeedingFix.forEach(tsr => {
      const missing = [];
      if (tsr.needs_focal === 1) missing.push('Department Focal');
      if (tsr.needs_manager === 1) missing.push('Line Manager');
      if (tsr.needs_hod === 1) missing.push('HOD');
      
      console.log(`\n🔧 ${tsr.id} (${tsr.requestor_name})`);
      console.log(`   Status: ${tsr.status}`);
      console.log(`   Travel Type: ${tsr.travel_type}`);
      console.log(`   Submitted: ${tsr.submitted_at?.toDateString()}`);
      console.log(`   Current Steps: ${tsr.current_steps}`);
      console.log(`   Missing Steps: ${missing.join(', ')}`);
      console.log(`   Reference Date: ${tsr.reference_timestamp?.toISOString()}`);
    });

  } catch (error) {
    console.error('❌ Failed to extract fix data:', error);
  } finally {
    await sql.end();
    console.log('\n📋 TSR fix data extraction completed.');
  }
}

getTSRFixData().catch(console.error);