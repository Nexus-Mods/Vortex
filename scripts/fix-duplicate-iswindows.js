#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// List of extensions with duplicate isWindows issues
const extensionsWithDuplicateIsWindows = [
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

// Pattern to match the duplicate isWindows declaration
const duplicateIsWindowsPattern = /const\s+isWindows\s*=\s*\(\)\s*=>\s*process\.platform\s*===\s*['"]win32['"]\s*;\n?/;

async function fixExtension(extensionName) {
  const extensionPath = path.join(__dirname, '..', 'extensions', 'games', extensionName, 'index.js');
  
  try {
    // Check if file exists
    await fs.access(extensionPath);
    
    // Read the file
    const content = await fs.readFile(extensionPath, 'utf8');
    
    // Check if it has the duplicate isWindows declaration
    if (duplicateIsWindowsPattern.test(content)) {
      // Remove the duplicate declaration
      const fixedContent = content.replace(duplicateIsWindowsPattern, '');
      
      // Write the fixed content back to the file
      await fs.writeFile(extensionPath, fixedContent, 'utf8');
      
      console.log(`✓ Fixed ${extensionName}`);
      return true;
    } else {
      console.log(`- No duplicate isWindows found in ${extensionName}`);
      return false;
    }
  } catch (err) {
    console.error(`✗ Error fixing ${extensionName}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('Fixing duplicate isWindows declarations in extensions...\n');
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const extensionName of extensionsWithDuplicateIsWindows) {
    try {
      const fixed = await fixExtension(extensionName);
      if (fixed) {
        fixedCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(`Error processing ${extensionName}: ${err.message}`);
    }
  }
  
  console.log(`\nDone! Fixed ${fixedCount} extensions.`);
  if (errorCount > 0) {
    console.log(`Encountered errors with ${errorCount} extensions.`);
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});