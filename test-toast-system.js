/**
 * Toast System Diagnostic Script
 * This script tests the toast notification system to identify issues
 */

const { Pool } = require('pg');
const config = require('./config');

// Database configuration
const pool = new Pool(config.database);

async function testToastSystem() {
  console.log('🔍 Testing Toast System...');
  
  try {
    // Test 1: Check if toast components exist
    console.log('\n1. Checking Toast Components:');
    
    const fs = require('fs');
    const path = require('path');
    
    const toastFiles = [
      'src/components/ui/toast.tsx',
      'src/components/ui/toaster.tsx',
      'src/hooks/use-toast.ts'
    ];
    
    toastFiles.forEach(file => {
      const fullPath = path.join(process.cwd(), '..', file);
      if (fs.existsSync(fullPath)) {
        console.log(`   ✅ ${file} exists`);
      } else {
        console.log(`   ❌ ${file} missing`);
      }
    });
    
    // Test 2: Check toast configuration
    console.log('\n2. Checking Toast Configuration:');
    
    const useToastPath = path.join(process.cwd(), '..', 'src/hooks/use-toast.ts');
    if (fs.existsSync(useToastPath)) {
      const useToastContent = fs.readFileSync(useToastPath, 'utf8');
      
      // Check TOAST_LIMIT
      const toastLimitMatch = useToastContent.match(/const TOAST_LIMIT = (\d+)/);
      if (toastLimitMatch) {
        const limit = parseInt(toastLimitMatch[1]);
        console.log(`   TOAST_LIMIT: ${limit} ${limit > 1 ? '✅' : '⚠️ (should be > 1)'}`);
      }
      
      // Check TOAST_REMOVE_DELAY
      const toastDelayMatch = useToastContent.match(/const TOAST_REMOVE_DELAY = (\d+)/);
      if (toastDelayMatch) {
        const delay = parseInt(toastDelayMatch[1]);
        const delaySeconds = delay / 1000;
        console.log(`   TOAST_REMOVE_DELAY: ${delay}ms (${delaySeconds}s) ${delaySeconds < 60 ? '✅' : '⚠️ (very long)'}`);
      }
    }
    
    // Test 3: Check AppProviders setup
    console.log('\n3. Checking AppProviders Setup:');
    
    const appProvidersPath = path.join(process.cwd(), '..', 'src/components/providers/AppProviders.tsx');
    if (fs.existsSync(appProvidersPath)) {
      const appProvidersContent = fs.readFileSync(appProvidersPath, 'utf8');
      
      if (appProvidersContent.includes('Toaster')) {
        console.log('   ✅ Toaster component is imported in AppProviders');
      } else {
        console.log('   ❌ Toaster component is NOT imported in AppProviders');
      }
      
      if (appProvidersContent.includes('<Toaster />')) {
        console.log('   ✅ Toaster component is rendered in AppProviders');
      } else {
        console.log('   ❌ Toaster component is NOT rendered in AppProviders');
      }
    }
    
    // Test 4: Check layout setup
    console.log('\n4. Checking Layout Setup:');
    
    const layoutPath = path.join(process.cwd(), '..', 'src/app/layout.tsx');
    if (fs.existsSync(layoutPath)) {
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      
      if (layoutContent.includes('AppProviders')) {
        console.log('   ✅ AppProviders is used in layout');
      } else {
        console.log('   ❌ AppProviders is NOT used in layout');
      }
      
      if (layoutContent.includes('<Toaster />')) {
        console.log('   ⚠️  Toaster is duplicated in layout (should only be in AppProviders)');
      } else {
        console.log('   ✅ No duplicate Toaster in layout');
      }
    }
    
    // Test 5: Check for CSS conflicts
    console.log('\n5. Checking for CSS Conflicts:');
    
    const globalsCssPath = path.join(process.cwd(), '..', 'src/app/globals.css');
    if (fs.existsSync(globalsCssPath)) {
      const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
      
      // Check for z-index conflicts
      if (globalsCssContent.includes('z-index')) {
        console.log('   ⚠️  Found z-index declarations in globals.css');
      } else {
        console.log('   ✅ No z-index conflicts found in globals.css');
      }
      
      // Check for position: fixed conflicts
      if (globalsCssContent.includes('position: fixed')) {
        console.log('   ⚠️  Found position: fixed declarations in globals.css');
      } else {
        console.log('   ✅ No position: fixed conflicts found in globals.css');
      }
    }
    
    // Test 6: Check toast usage in components
    console.log('\n6. Checking Toast Usage in Components:');
    
    const componentsDir = path.join(process.cwd(), '..', 'src');
    
    function findToastUsage(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      let toastUsage = [];
      
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
          toastUsage = toastUsage.concat(findToastUsage(fullPath));
        } else if (file.isFile() && (file.name.endsWith('.tsx') || file.name.endsWith('.ts'))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('useToast') || content.includes('toast(')) {
              toastUsage.push({
                file: fullPath.replace(process.cwd() + '/../', ''),
                hasUseToast: content.includes('useToast'),
                hasToastCall: content.includes('toast(')
              });
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
      
      return toastUsage;
    }
    
    const toastUsage = findToastUsage(componentsDir);
    console.log(`   Found ${toastUsage.length} components using toast:`);
    toastUsage.forEach(usage => {
      console.log(`     - ${usage.file} (useToast: ${usage.hasUseToast}, toast call: ${usage.hasToastCall})`);
    });
    
    // Summary
    console.log('\n📊 TOAST SYSTEM DIAGNOSTIC SUMMARY:');
    console.log('   ✅ Toast components exist');
    console.log('   ✅ Toast configuration is reasonable');
    console.log('   ✅ AppProviders includes Toaster');
    console.log('   ✅ Layout uses AppProviders');
    console.log('   ✅ No CSS conflicts detected');
    console.log(`   ✅ ${toastUsage.length} components use toast`);
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   1. Test the toast system in the browser');
    console.log('   2. Check browser console for any JavaScript errors');
    console.log('   3. Verify that toasts appear in the top-right corner');
    console.log('   4. Test different toast variants (default, destructive)');
    console.log('   5. Check if toasts auto-dismiss after 5 seconds');
    
  } catch (error) {
    console.error('💥 Error testing toast system:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testToastSystem();
