#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// List of extensions to clean up
const extensionsToClean = [
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

// Pattern to match the platform detection comment
const platformCommentPattern = /\/\/ Platform detection\n?/;

async function cleanExtension(extensionName) {
  const extensionPath = path.join(__dirname, '..', 'extensions', 'games', extensionName, 'index.js');
  
  try {
    // Check if file exists
    await fs.access(extensionPath);
    
    // Read the file
    const content = await fs.readFile(extensionPath, 'utf8');
    
    // Check if it has the platform detection comment
    if (platformCommentPattern.test(content)) {
      // Remove the platform detection comment
      const cleanedContent = content.replace(platformCommentPattern, '');
      
      // Write the cleaned content back to the file
      await fs.writeFile(extensionPath, cleanedContent, 'utf8');
      
      console.log(`✓ Cleaned ${extensionName}`);
      return true;
    } else {
      console.log(`- No platform detection comment found in ${extensionName}`);
      return false;
    }
  } catch (err) {
    console.error(`✗ Error cleaning ${extensionName}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('Removing platform detection comments from extensions...\n');
  
  let cleanedCount = 0;
  let errorCount = 0;
  
  for (const extensionName of extensionsToClean) {
    try {
      const cleaned = await cleanExtension(extensionName);
      if (cleaned) {
        cleanedCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(`Error processing ${extensionName}: ${err.message}`);
    }
  }
  
  console.log(`\nDone! Cleaned comments from ${cleanedCount} extensions.`);
  if (errorCount > 0) {
    console.log(`Encountered errors with ${errorCount} extensions.`);
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});