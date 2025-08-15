// Comprehensive database analysis script
require('dotenv').config();
const postgres = require('postgres');

async function comprehensiveDatabaseAnalysis() {
  console.log('Starting comprehensive database analysis...');
  
  const {
    DATABASE_HOST,
    DATABASE_NAME,
    DATABASE_USER,
    DATABASE_PASSWORD,
  } = process.env;

  if (!DATABASE_HOST || !DATABASE_NAME || !DATABASE_USER || !DATABASE_PASSWORD) {
    console.error('Missing required database environment variables');
    process.exit(1);
  }

  const sql = postgres({
    host: DATABASE_HOST,
    database: DATABASE_NAME,
    username: DATABASE_USER,
    password: DATABASE_PASSWORD,
    ssl: false,
  });

  try {
    console.log('\n=== TABLE STATISTICS ===');
    // Get table statistics with row counts
    const tableStats = await sql`
      SELECT 
        schemaname,
        relname as tablename,
        n_tup_ins as total_inserts,
        n_tup_upd as total_updates,
        n_tup_del as total_deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size
      FROM pg_stat_user_tables 
      ORDER BY n_live_tup DESC;
    `;
    
    console.log('Table Statistics (sorted by row count):');
    tableStats.forEach(table => {
      console.log(`- ${table.tablename}: ${table.live_rows} rows, ${table.size}, ${table.dead_rows} dead rows`);
    });

    console.log('\n=== INDEXES ===');
    // Get all indexes
    const indexes = await sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    
    console.log('Existing Indexes:');
    let currentTable = '';
    indexes.forEach(index => {
      if (index.tablename !== currentTable) {
        console.log(`\n${index.tablename}:`);
        currentTable = index.tablename;
      }
      console.log(`  - ${index.indexname}: ${index.indexdef}`);
    });

    console.log('\n=== FOREIGN KEY CONSTRAINTS ===');
    // Get foreign key constraints
    const foreignKeys = await sql`
      SELECT
        tc.table_name as table_name,
        kcu.column_name as column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
      ORDER BY tc.table_name, kcu.column_name;
    `;
    
    console.log('Foreign Key Relationships:');
    foreignKeys.forEach(fk => {
      console.log(`- ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    console.log('\n=== MISSING INDEXES ON FOREIGN KEYS ===');
    // Check for missing indexes on foreign keys
    const missingIndexes = await sql`
      SELECT 
        t.relname as table_name,
        a.attname as column_name,
        'Missing index on foreign key' as issue
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = t.oid
        AND a.attnum = ANY(i.indkey)
      )
      ORDER BY t.relname, a.attname;
    `;
    
    if (missingIndexes.length > 0) {
      console.log('Missing Indexes on Foreign Keys:');
      missingIndexes.forEach(missing => {
        console.log(`- ${missing.table_name}.${missing.column_name}`);
      });
    } else {
      console.log('All foreign keys have indexes ✓');
    }

    console.log('\n=== DETAILED TABLE STRUCTURES ===');
    // Get detailed column information for key tables
    const keyTables = ['travel_requests', 'users', 'expense_claims', 'visa_applications', 'accommodation_bookings'];
    
    for (const tableName of keyTables) {
      const columns = await sql`
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_primary_key,
          CASE WHEN fk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_foreign_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.table_name, ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
        LEFT JOIN (
          SELECT ku.table_name, ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
        ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
        WHERE c.table_name = $1 AND c.table_schema = 'public'
        ORDER BY c.ordinal_position;
      `;
      
      if (columns.length > 0) {
        console.log(`\n${tableName} structure:`);
        columns.forEach(col => {
          const keys = [];
          if (col.is_primary_key === 'YES') keys.push('PK');
          if (col.is_foreign_key === 'YES') keys.push('FK');
          const keyInfo = keys.length > 0 ? ` [${keys.join(', ')}]` : '';
          console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}${keyInfo}`);
        });
      }
    }

    console.log('\n=== POTENTIAL ISSUES ===');
    
    // Check for tables with no primary key
    const tablesWithoutPK = await sql`
      SELECT table_name
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = t.table_name 
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      );
    `;
    
    if (tablesWithoutPK.length > 0) {
      console.log('Tables without primary keys:');
      tablesWithoutPK.forEach(table => console.log(`- ${table.table_name}`));
    }

    // Check for unused columns (columns that are always NULL)
    console.log('\nChecking for potentially unused columns...');
    for (const tableName of ['travel_requests', 'expense_claims', 'visa_applications']) {
      try {
        const nullColumns = await sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = ${tableName}
          AND table_schema = 'public'
          AND is_nullable = 'YES'
          AND column_name NOT IN ('updated_at', 'deleted_at', 'additional_comments', 'additional_data')
        `;
        
        // Check each nullable column to see if it's always null
        for (const col of nullColumns) {
          const result = await sql`
            SELECT COUNT(*) as total_rows, 
                   COUNT(${sql(col.column_name)}) as non_null_rows
            FROM ${sql(tableName)}
          `;
          
          if (result[0].total_rows > 0 && result[0].non_null_rows === 0) {
            console.log(`- ${tableName}.${col.column_name}: Always NULL (${result[0].total_rows} rows)`);
          }
        }
      } catch (error) {
        console.log(`Could not analyze ${tableName}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await sql.end();
    console.log('\nAnalysis complete!');
  }
}

comprehensiveDatabaseAnalysis().catch(console.error);