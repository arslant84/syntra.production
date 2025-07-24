const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

// Database configuration
const DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
const DATABASE_NAME = process.env.DATABASE_NAME || 'syntra';
const DATABASE_USER = process.env.DATABASE_USER || 'postgres';
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || '';

async function testExpenseClaims() {
  console.log('Testing Expense Claims Database Functionality...');
  console.log('Database config:', { host: DATABASE_HOST, database: DATABASE_NAME, user: DATABASE_USER });
  
  let sql;
  
  try {
    // Initialize database connection
    sql = postgres({
      host: DATABASE_HOST,
      database: DATABASE_NAME,
      username: DATABASE_USER,
      password: DATABASE_PASSWORD,
      ssl: false,
      connect_timeout: 10,
    });
    
    console.log('Database connection established');
    
    // Test 1: Check if tables exist
    console.log('\n1. Checking if tables exist...');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('expense_claims', 'expense_claim_items', 'expense_claim_fx_rates')
      ORDER BY table_name
    `;
    
    console.log('Found tables:', tables.map(t => t.table_name));
    
    if (tables.length === 0) {
      console.log('❌ No expense claim tables found. Please check if the database schema is set up correctly.');
      return;
    }
    
    // Test 2: Check table schemas
    console.log('\n2. Checking table schemas...');
    
    for (const table of tables) {
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${table.table_name}
        ORDER BY ordinal_position
      `;
      
      console.log(`\n${table.table_name} columns:`);
      columns.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
    }
    
    // Test 3: Check if we can insert test data
    console.log('\n3. Testing data insertion...');
    
    // Insert a test claim
    const testClaim = await sql`
      INSERT INTO expense_claims (
        document_type, document_number, claim_for_month_of, staff_name, staff_no, gred,
        staff_type, executive_status, department_code, dept_cost_center_code, location, tel_ext,
        start_time_from_home, time_of_arrival_at_home, bank_name, account_number, purpose_of_claim,
        is_medical_claim, applicable_medical_type, is_for_family, family_member_spouse,
        family_member_children, family_member_other, total_advance_claim_amount, less_advance_taken,
        less_corporate_credit_card_payment, balance_claim_repayment, cheque_receipt_no,
        i_declare, declaration_date, status
      ) VALUES (
        'TR01', 'TEST-CLM-001', '2025-01-01', 'Test User', 'EMP001', 'G5',
        'PERMANENT STAFF', 'NON-EXECUTIVE', 'IT', 'IT001', 'Kuala Lumpur', '1234',
        '08:00', '17:00', 'Test Bank', '1234567890', 'Test purpose',
        false, null, false, false, false, null, 100.00, 0.00, 0.00, 100.00, null,
        true, '2025-01-01', 'Pending Verification'
      ) RETURNING id
    `;
    
    const claimId = testClaim[0].id;
    console.log(`Inserted test claim with ID: ${claimId}`);
    
    // Insert test expense item
    const testExpenseItem = await sql`
      INSERT INTO expense_claim_items (
        claim_id, item_date, claim_or_travel_details, official_mileage_km,
        transport, hotel_accommodation_allowance, out_station_allowance_meal,
        miscellaneous_allowance_10_percent, other_expenses
      ) VALUES (
        ${claimId}, '2025-01-01', 'Test Location - Test Destination - Test Hotel',
        50.00, 25.00, 50.00, 15.00, 10.00, 0.00
      ) RETURNING id
    `;
    
    console.log(`Inserted test expense item with ID: ${testExpenseItem[0].id}`);
    
    // Insert test FX rate
    const testFxRate = await sql`
      INSERT INTO expense_claim_fx_rates (
        claim_id, fx_date, type_of_currency, selling_rate_tt_od
      ) VALUES (
        ${claimId}, '2025-01-01', 'USD', 3.7500
      ) RETURNING id
    `;
    
    console.log(`Inserted test FX rate with ID: ${testFxRate[0].id}`);
    
    // Test 4: Verify data was inserted correctly
    console.log('\n4. Verifying inserted data...');
    
    const claim = await sql`SELECT * FROM expense_claims WHERE id = ${claimId}`;
    console.log('Claim data:', claim[0]);
    
    const expenseItems = await sql`SELECT * FROM expense_claim_items WHERE claim_id = ${claimId}`;
    console.log('Expense items:', expenseItems);
    
    const fxRates = await sql`SELECT * FROM expense_claim_fx_rates WHERE claim_id = ${claimId}`;
    console.log('FX rates:', fxRates);
    
    // Test 5: Clean up test data
    console.log('\n5. Cleaning up test data...');
    
    await sql`DELETE FROM expense_claim_fx_rates WHERE claim_id = ${claimId}`;
    await sql`DELETE FROM expense_claim_items WHERE claim_id = ${claimId}`;
    await sql`DELETE FROM expense_claims WHERE id = ${claimId}`;
    
    console.log('Test data cleaned up successfully');
    
    console.log('\n✅ All tests passed! Database is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}

// Run the test
testExpenseClaims()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  }); 