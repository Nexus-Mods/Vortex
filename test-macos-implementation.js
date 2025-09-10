#!/usr/bin/env node

/**
 * Test script for macOS-specific implementations
 * This script validates that the real implementations for macOS work correctly
 */

const os = require('os');
const path = require('path');

// Check if we're running on macOS
if (process.platform !== 'darwin') {
  console.log('This test script is designed for macOS only');
  process.exit(0);
}

console.log('Testing macOS-specific implementations...\n');

// Test drivelist implementation
console.log('1. Testing drivelist implementation...');
try {
  const drivelist = require('./src/util/drivelist-macos.js');
  
  drivelist.list((err, drives) => {
    if (err) {
      console.error('  ❌ drivelist.list callback failed:', err.message);
    } else {
      console.log('  ✅ drivelist.list callback succeeded');
      console.log('     Found', drives.length, 'drives');
      if (drives.length > 0) {
        console.log('     First drive:', drives[0].displayName);
      }
    }
  });
  
  drivelist.listAsync()
    .then(drives => {
      console.log('  ✅ drivelist.listAsync succeeded');
      console.log('     Found', drives.length, 'drives');
      if (drives.length > 0) {
        console.log('     First drive:', drives[0].displayName);
      }
    })
    .catch(err => {
      console.error('  ❌ drivelist.listAsync failed:', err.message);
    });
} catch (err) {
  console.error('  ❌ Failed to load drivelist implementation:', err.message);
}

// Test diskusage implementation
console.log('\n2. Testing diskusage implementation...');
try {
  const diskusage = require('./src/util/diskusage-macos.js');
  
  const testPath = os.homedir();
  
  diskusage.check(testPath, (err, result) => {
    if (err) {
      console.error('  ❌ diskusage.check callback failed:', err.message);
    } else {
      console.log('  ✅ diskusage.check callback succeeded');
      console.log('     Path:', testPath);
      console.log('     Total:', Math.round(result.total / (1024*1024*1024)), 'GB');
      console.log('     Available:', Math.round(result.available / (1024*1024*1024)), 'GB');
    }
  });
  
  const syncResult = diskusage.checkSync(testPath);
  console.log('  ✅ diskusage.checkSync succeeded');
  console.log('     Path:', testPath);
  console.log('     Total:', Math.round(syncResult.total / (1024*1024*1024)), 'GB');
  console.log('     Available:', Math.round(syncResult.available / (1024*1024*1024)), 'GB');
} catch (err) {
  console.error('  ❌ Failed to load diskusage implementation:', err.message);
}

// Test exe-version implementation
console.log('\n3. Testing exe-version implementation...');
try {
  const exeVersion = require('./src/util/exe-version-macos.js');
  
  // Test with a common macOS executable
  const testExecutable = '/bin/bash';
  
  exeVersion.getVersion(testExecutable)
    .then(version => {
      console.log('  ✅ exeVersion.getVersion succeeded');
      console.log('     Executable:', testExecutable);
      console.log('     Version:', version);
    })
    .catch(err => {
      console.error('  ❌ exeVersion.getVersion failed:', err.message);
    });
  
  const syncVersion = exeVersion.getVersionSync(testExecutable);
  console.log('  ✅ exeVersion.getVersionSync succeeded');
  console.log('     Executable:', testExecutable);
  console.log('     Version:', syncVersion);
} catch (err) {
  console.error('  ❌ Failed to load exe-version implementation:', err.message);
}

console.log('\n✅ macOS implementation testing completed');