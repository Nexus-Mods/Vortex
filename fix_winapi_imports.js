#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of game extensions that need fixing (from our search results)
const extensionsToFix = [
  'game-worldoftanks',
  'game-witcher',
  'game-witcher2',
  'game-pathfinderkingmaker',
  'game-monster-hunter-world',
  'game-prisonarchitect',
  'game-survivingmars',
  'game-torchlight2',
  'game-enderal',
  'game-dragonage',
  'game-mount-and-blade',
  'game-teso',
  'game-teamfortress2',
  'game-fallout4vr',
  'game-sims3',
  'game-dawnofman',
  'game-dragonage2',
  'game-vtmbloodlines',
  'game-skyrimvr',
  'game-neverwinter-nights',
  'game-oni',
  'game-x4foundations',
  'game-divinityoriginalsin2',
  'game-sims4',
  'game-galciv3',
  'game-grimdawn',
  'game-darkestdungeon',
  'game-sw-kotor'
];

const gamesDir = '/Users/veland/Downloads/vortex/extensions/games';

function fixWinapiImport(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already fixed
  if (content.includes('// Conditional winapi import')) {
    console.log(`  Already fixed: ${filePath}`);
    return;
  }
  
  // Pattern 1: Direct winapi require
  const directRequirePattern = /^const winapi = require\('winapi-bindings'\);$/m;
  if (directRequirePattern.test(content)) {
    content = content.replace(
      directRequirePattern,
      `// Platform detection
const isWindows = () => process.platform === 'win32';

// Conditional winapi import - only available on Windows
const winapi = isWindows() ? require('winapi-bindings') : undefined;`
    );
  }
  
  // Pattern 2: Winapi with other imports on same line
  const inlineRequirePattern = /^(.*?)const winapi = require\('winapi-bindings'\);(.*)$/m;
  if (inlineRequirePattern.test(content)) {
    content = content.replace(
      inlineRequirePattern,
      `$1// Platform detection
const isWindows = () => process.platform === 'win32';

// Conditional winapi import - only available on Windows
const winapi = isWindows() ? require('winapi-bindings') : undefined;$2`
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`  Fixed: ${filePath}`);
}

// Process each extension
extensionsToFix.forEach(extensionName => {
  const indexPath = path.join(gamesDir, extensionName, 'index.js');
  
  if (fs.existsSync(indexPath)) {
    try {
      fixWinapiImport(indexPath);
    } catch (error) {
      console.error(`Error fixing ${indexPath}:`, error.message);
    }
  } else {
    console.log(`File not found: ${indexPath}`);
  }
});

console.log('Winapi import fixing completed!');