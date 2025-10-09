#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// List of extensions that were fixed for duplicate isWindows issues
const fixedExtensions = [
  'game-darkestdungeon',
  'game-dawnofman',
  'game-divinityoriginalsin2',
  'game-dragonage',
  'game-dragonage2',
  'game-enderal',
  'game-fallout4',
  'game-fallout4vr',
  'game-galciv3',
  'game-grimdawn',
  'game-monster-hunter-world',
  'game-mount-and-blade',
  'game-neverwinter-nights',
  'game-neverwinter-nights2',
  'game-oni',
  'game-pathfinderkingmaker',
  'game-prisonarchitect',
  'game-sims3',
  'game-sims4',
  'game-skyrim',
  'game-skyrimvr',
  'game-stardewvalley',
  'game-survivingmars',
  'game-sw-kotor',
  'game-teamfortress2',
  'game-teso',
  'game-torchlight2',
  'game-vtmbloodlines',
  'game-witcher',
  'game-witcher2',
  'game-witcher3',
  'game-worldoftanks',
  'game-x4foundations'
];

// Pattern to match the duplicate isWindows declaration that should no longer exist
const duplicateIsWindowsPattern = /const\s+isWindows\s*=\s*\(\)\s*=>\s*process\.platform\s*===\s*['"]win32['"]\s*;/;

async function verifyExtension(extensionName) {
  const extensionPath = path.join(__dirname, '..', 'extensions', 'games', extensionName, 'index.js');
  
  try {
    // Check if file exists
    await fs.access(extensionPath);
    
    // Read the file
    const content = await fs.readFile(extensionPath, 'utf8');
    
    // Check if it still has the duplicate isWindows declaration
    if (duplicateIsWindowsPattern.test(content)) {
      console.log(`✗ FAILED: ${extensionName} still has duplicate isWindows declaration`);
      return false;
    } else {
      console.log(`✓ PASSED: ${extensionName} correctly fixed`);
      return true;
    }
  } catch (err) {
    console.error(`✗ ERROR: Could not check ${extensionName}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('Verifying fixes for duplicate isWindows declarations...\n');
  
  let passedCount = 0;
  let failedCount = 0;
  let errorCount = 0;
  
  for (const extensionName of fixedExtensions) {
    try {
      const passed = await verifyExtension(extensionName);
      if (passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(`Error verifying ${extensionName}: ${err.message}`);
    }
  }
  
  console.log(`\nVerification complete:`);
  console.log(`✓ ${passedCount} extensions correctly fixed`);
  console.log(`✗ ${failedCount} extensions still have issues`);
  console.log(`✗ ${errorCount} extensions had verification errors`);
  
  if (failedCount === 0 && errorCount === 0) {
    console.log(`\n🎉 All fixes verified successfully!`);
  } else {
    console.log(`\n⚠️  Some issues remain.`);
  }
}

main().catch(err => {
  console.error('Verification script failed:', err);
  process.exit(1);
});