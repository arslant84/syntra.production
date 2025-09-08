/**
 * Update existing auto-generated accommodation requests to include TSR references
 * This will update the 15 accommodation requests created today to include proper TSR references
 */

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Find accommodation requests that were auto-generated today but don't have TSR references
    console.log('\n--- Finding accommodation requests needing TSR references ---');
    
    const accommodationRequests = await client.query(`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.additional_comments,
        tr.additional_data,
        tr.submitted_at
      FROM travel_requests tr
      WHERE tr.travel_type = 'Accommodation'
        AND tr.additional_comments LIKE 'Auto-generated from TSR%'
        AND tr.submitted_at >= CURRENT_DATE
        AND (tr.additional_data IS NULL OR tr.additional_data::text = '{}' OR NOT (tr.additional_data ? 'tsrReference'))
      ORDER BY tr.submitted_at DESC
    `);

    console.log(`Found ${accommodationRequests.rows.length} accommodation requests needing TSR references:`);
    
    if (accommodationRequests.rows.length > 0) {
      console.table(accommodationRequests.rows.map(row => ({
        id: row.id,
        requestor: row.requestor_name,
        comments: row.additional_comments?.substring(0, 50) + '...',
        current_data: row.additional_data
      })));
    }

    // Update each accommodation request to include TSR reference
    let updated = 0;
    let errors = 0;

    for (const accomRequest of accommodationRequests.rows) {
      try {
        // Extract TSR ID from additional_comments
        const tsrMatch = accomRequest.additional_comments?.match(/Auto-generated from TSR (TSR-[^:]+):/);
        
        if (tsrMatch) {
          const tsrId = tsrMatch[1];
          console.log(`\nUpdating ${accomRequest.id} with TSR reference: ${tsrId}`);
          
          // Update the additional_data to include TSR reference
          const updatedData = {
            ...(accomRequest.additional_data || {}),
            tsrReference: tsrId
          };
          
          const updateQuery = `
            UPDATE travel_requests 
            SET additional_data = $1,
                updated_at = NOW()
            WHERE id = $2
          `;
          
          await client.query(updateQuery, [
            JSON.stringify(updatedData),
            accomRequest.id
          ]);
          
          console.log(`✅ Updated ${accomRequest.id} with TSR reference ${tsrId}`);
          updated++;
          
        } else {
          console.log(`❌ Could not extract TSR ID from: ${accomRequest.additional_comments}`);
          errors++;
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${accomRequest.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== UPDATE SUMMARY ===');
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`❌ Errors: ${errors}`);

    // Verify the updates
    console.log('\n=== VERIFICATION ===');
    const verificationQuery = await client.query(`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.additional_data
      FROM travel_requests tr
      WHERE tr.travel_type = 'Accommodation'
        AND tr.submitted_at >= CURRENT_DATE
        AND tr.additional_data ? 'tsrReference'
      ORDER BY tr.submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`Accommodation requests with TSR references: ${verificationQuery.rows.length}`);
    if (verificationQuery.rows.length > 0) {
      console.table(verificationQuery.rows.map(row => ({
        id: row.id,
        requestor: row.requestor_name,
        tsr_reference: row.additional_data?.tsrReference
      })));
    }

  } catch (error) {
    console.error('Error during TSR reference update:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

main().catch(console.error);