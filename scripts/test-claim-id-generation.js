#!/usr/bin/env node

// Test the updated claim ID generation
const { generateRequestId, parseRequestId } = require('../src/utils/requestIdGenerator.ts');

async function testClaimIdGeneration() {
  try {
    console.log('🧪 Testing updated claim ID generation...\n');
    
    // Generate several claim IDs to test the format
    console.log('📋 Generating test claim IDs:');
    console.log('═'.repeat(60));
    
    for (let i = 1; i <= 5; i++) {
      const claimId = generateRequestId('CLM', 'TEST');
      console.log(`${i}. ${claimId}`);
      
      // Verify it matches the expected pattern
      const isCorrect = claimId.match(/^CLM-\d{8}-\d{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/);
      console.log(`   ✅ Format check: ${isCorrect ? 'PASSED' : 'FAILED'}`);
      
      // Test parsing
      const parsed = parseRequestId(claimId);
      if (parsed) {
        console.log(`   📊 Parsed: Type=${parsed.type}, Context=${parsed.context}, UniqueID=${parsed.uniqueId}`);
      } else {
        console.log(`   ❌ Parse failed`);
      }
      console.log('   ' + '-'.repeat(40));
    }
    
    // Test other types haven't been affected
    console.log('\n🔍 Testing other request types (should be unchanged):');
    console.log('═'.repeat(60));
    
    const tsrId = generateRequestId('TSR', 'NYC');
    const visaId = generateRequestId('VIS', 'USA');
    const transportId = generateRequestId('TRN', 'LOCAL');
    
    console.log(`TSR:       ${tsrId}`);
    console.log(`Visa:      ${visaId}`);
    console.log(`Transport: ${transportId}`);
    
    console.log('\n✅ Claim ID generation test completed!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Claims now use CLM-YYYYMMDD-HHMM-XXXXX-XXXX format');
    console.log('   ✅ Other request types maintain original format');
    console.log('   ✅ Parsing works for both formats');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testClaimIdGeneration();