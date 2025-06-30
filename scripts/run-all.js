// scripts/run-all.js
const { spawn } = require('child_process');
const path = require('path');

console.log('SynTra Database Setup - Complete Process');
console.log('=======================================');

// Function to run a script and return a promise
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning: ${path.basename(scriptPath)}`);
    console.log('----------------------------------------');
    
    const process = spawn('node', [scriptPath], { stdio: 'inherit' });
    
    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
        return;
      }
      resolve();
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Main function to run all scripts in sequence
async function runAllScripts() {
  try {
    // Step 1: Create the database if it doesn't exist
    await runScript(path.resolve(__dirname, 'create-database.js'));
    
    // Step 2: Set up the database schema and seed data
    await runScript(path.resolve(__dirname, 'setup-database.js'));
    
    console.log('\n✅ All database setup scripts completed successfully!');
    console.log('Your SynTra database is now ready to use.');
    
  } catch (error) {
    console.error('\n❌ Error during database setup:', error.message);
    process.exit(1);
  }
}

// Run all scripts
runAllScripts();
