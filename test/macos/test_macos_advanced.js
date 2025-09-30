#!/usr/bin/env node

/**
 * Advanced test script to verify macOS compatibility layer sophisticated logic
 */

const path = require('path');
const fs = require('fs');
const { getExecutablePathForPlatform, getMacOSGameFix } = require('./out/util/macOSGameCompatibility');

console.log('Testing advanced macOS compatibility layer logic...\n');

// Create a temporary test directory structure
const testDir = '/tmp/vortex_macos_test';
const skyrimTestDir = path.join(testDir, 'Skyrim Special Edition');

// Clean up and create test directories
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });
fs.mkdirSync(skyrimTestDir, { recursive: true });

console.log('Created test directory structure:');
console.log(`  ${testDir}`);
console.log(`  ${skyrimTestDir}`);
console.log('');

// Test 1: Check if getMacOSGameFix works for known games
console.log('Test 1: getMacOSGameFix for known games');
const skyrimFix = getMacOSGameFix('skyrimse');
const falloutFix = getMacOSGameFix('fallout4');
const unknownFix = getMacOSGameFix('unknowngame');

console.log(`  Skyrim SE fix: ${skyrimFix ? 'Found' : 'Not found'}`);
if (skyrimFix) {
  console.log(`    Game ID: ${skyrimFix.gameId}`);
  console.log(`    Windows Executable: ${skyrimFix.windowsExecutable}`);
  console.log(`    macOS App Bundle: ${skyrimFix.macOSAppBundle}`);
}

console.log(`  Fallout 4 fix: ${falloutFix ? 'Found' : 'Not found'}`);
if (falloutFix) {
  console.log(`    Game ID: ${falloutFix.gameId}`);
  console.log(`    Windows Executable: ${falloutFix.windowsExecutable}`);
  console.log(`    macOS App Bundle: ${falloutFix.macOSAppBundle}`);
}

console.log(`  Unknown game fix: ${unknownFix ? 'Found' : 'Not found'}`);
console.log('');

// Test 2: Test with app bundle simulation
console.log('Test 2: App bundle detection simulation');
const appBundlePath = path.join(skyrimTestDir, 'The Elder Scrolls V- Skyrim Special Edition.app');
fs.mkdirSync(appBundlePath, { recursive: true });
fs.mkdirSync(path.join(appBundlePath, 'Contents', 'MacOS'), { recursive: true });

// Create a fake executable inside the app bundle
const executablePath = path.join(appBundlePath, 'Contents', 'MacOS', 'SkyrimSE');
fs.writeFileSync(executablePath, '#!/bin/bash\necho "Fake Skyrim executable"');
fs.chmodSync(executablePath, 0o755);

console.log(`  Created app bundle: ${appBundlePath}`);
console.log(`  Created executable: ${executablePath}`);

// Test the function with the app bundle
const result = getExecutablePathForPlatform(skyrimTestDir, 'skyrimse', 'SkyrimSE.exe');
console.log(`  getExecutablePathForPlatform result: ${result}`);

if (result && result.includes('.app')) {
  console.log('  ✅ Successfully detected macOS app bundle!');
} else {
  console.log('  ⚠️  Did not detect app bundle, using fallback path');
}
console.log('');

// Test 3: Test fallback behavior
console.log('Test 3: Fallback behavior for unknown games');
const unknownGameDir = path.join(testDir, 'UnknownGame');
fs.mkdirSync(unknownGameDir, { recursive: true });

const unknownResult = getExecutablePathForPlatform(unknownGameDir, 'unknowngame', 'Game.exe');
console.log(`  Unknown game result: ${unknownResult}`);
console.log(`  Expected fallback: ${path.join(unknownGameDir, 'Game.exe')}`);

if (unknownResult === path.join(unknownGameDir, 'Game.exe')) {
  console.log('  ✅ Fallback behavior working correctly');
} else {
  console.log('  ❌ Fallback behavior not working as expected');
}
console.log('');

// Clean up
console.log('Cleaning up test directories...');
fs.rmSync(testDir, { recursive: true, force: true });

console.log('Advanced integration test completed.');