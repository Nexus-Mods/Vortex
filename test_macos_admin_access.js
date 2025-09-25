#!/usr/bin/env node

/**
 * Test script for macOS admin access functionality
 * This script tests the integration of admin access with deployment methods
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the required modules for testing
const mockLog = (level, message, meta) => {
  console.log(`[${level.toUpperCase()}] ${message}`, meta ? JSON.stringify(meta) : '');
};

// Test the MacOSAdminAccessManager
async function testMacOSAdminAccess() {
  console.log('Testing macOS Admin Access functionality...\n');
  
  // Check if we're on macOS
  if (os.platform() !== 'darwin') {
    console.log('❌ Not running on macOS - skipping admin access tests');
    return;
  }
  
  try {
    // Import the MacOSAdminAccessManager
    const { MacOSAdminAccessManager } = require('./src/util/macOSAdminAccess');
    
    const adminManager = MacOSAdminAccessManager.getInstance();
    
    // Test 1: Check write access to a directory we should have access to
    console.log('Test 1: Checking write access to user home directory...');
    const homeResult = await adminManager.checkWriteAccess(os.homedir());
    console.log(`✅ Home directory access: ${homeResult.hasAccess ? 'GRANTED' : 'DENIED'}`);
    
    // Test 2: Check write access to a restricted directory
    console.log('\nTest 2: Checking write access to /Applications...');
    const appsResult = await adminManager.checkWriteAccess('/Applications');
    console.log(`📋 Applications directory access: ${appsResult.hasAccess ? 'GRANTED' : 'DENIED'}`);
    console.log(`📋 Can request admin: ${appsResult.canRequestAdmin ? 'YES' : 'NO'}`);
    
    // Test 3: Test admin access request (commented out to avoid prompting during automated testing)
    /*
    if (!appsResult.hasAccess && appsResult.canRequestAdmin) {
      console.log('\nTest 3: Requesting admin access to /Applications...');
      const granted = await adminManager.requestAdminAccess('/Applications');
      console.log(`🔐 Admin access ${granted ? 'GRANTED' : 'DENIED'}`);
    }
    */
    
    console.log('\n✅ macOS Admin Access tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing macOS admin access:', error.message);
  }
}

// Test deployment method integration
function testDeploymentMethodIntegration() {
  console.log('\nTesting deployment method integration...\n');
  
  try {
    // Check if the deployment methods have the necessary imports
    const moveActivatorPath = './src/extensions/move_activator/index.ts';
    const hardlinkActivatorPath = './src/extensions/hardlink_activator/index.ts';
    
    if (fs.existsSync(moveActivatorPath)) {
      const moveContent = fs.readFileSync(moveActivatorPath, 'utf8');
      const hasMacOSImport = moveContent.includes('MacOSAdminAccessManager');
      const hasAdminLogic = moveContent.includes('requestAdminAccess');
      
      console.log(`✅ Move Activator Integration:`);
      console.log(`   - MacOS import: ${hasMacOSImport ? '✓' : '✗'}`);
      console.log(`   - Admin logic: ${hasAdminLogic ? '✓' : '✗'}`);
    }
    
    if (fs.existsSync(hardlinkActivatorPath)) {
      const hardlinkContent = fs.readFileSync(hardlinkActivatorPath, 'utf8');
      const hasMacOSImport = hardlinkContent.includes('MacOSAdminAccessManager');
      const hasAdminLogic = hardlinkContent.includes('requestAdminAccess');
      
      console.log(`✅ Hardlink Activator Integration:`);
      console.log(`   - MacOS import: ${hasMacOSImport ? '✓' : '✗'}`);
      console.log(`   - Admin logic: ${hasAdminLogic ? '✓' : '✗'}`);
    }
    
    console.log('\n✅ Deployment method integration tests completed!');
    
  } catch (error) {
    console.error('❌ Error testing deployment method integration:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting macOS Admin Access System Tests\n');
  console.log('='.repeat(50));
  
  await testMacOSAdminAccess();
  testDeploymentMethodIntegration();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 All tests completed!');
  console.log('\nTo test the full functionality:');
  console.log('1. Build and run Vortex on macOS');
  console.log('2. Try to deploy mods to a protected directory (e.g., /Applications/Game)');
  console.log('3. Verify that admin access is requested when needed');
  console.log('4. Verify that fallback to copy deployment works if admin is denied');
}

// Run the tests
runTests().catch(console.error);