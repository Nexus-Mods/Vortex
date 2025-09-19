const fs = require('fs');
const path = require('path');

// Extensions that use winapi functions and need platform guards
const extensionsWithWinapi = [
  'game-teso',
  'game-mount-and-blade', 
  'game-grimdawn',
  'game-monster-hunter-world',
  'game-darkestdungeon',
  'game-skyrimvr',
  'game-worldoftanks',
  'game-prisonarchitect',
  'game-x4foundations',
  'game-witcher2',
  'game-torchlight2',
  'game-witcher3',
  'game-sims3',
  'game-vtmbloodlines',
  'game-pathfinderkingmaker',
  'game-dragonage2',
  'game-stardewvalley',
  'game-survivingmars',
  'game-oni',
  'game-witcher',
  'game-sw-kotor',
  'game-divinityoriginalsin2',
  'game-fallout4vr',
  'game-dawnofman',
  'game-dragonage',
  'game-enderal',
  'game-galciv3',
  'game-sims4',
  'game-neverwinter-nights'
];

function fixWinapiUsage(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix double null assignments like ": null : null"
    content = content.replace(/: null : null/g, ': null');
    if (content.includes(': null : null')) {
      modified = true;
    }

    // Fix double platform guards in RegEnumValues calls
    content = content.replace(
      /const keys = \(isWindows\(\) && winapi\) \? winapi\.RegEnumValues\(hkey\);/g,
      'const keys = winapi.RegEnumValues(hkey);'
    );
    if (content.includes('const keys = (isWindows() && winapi) ? winapi.RegEnumValues(hkey);')) {
      modified = true;
    }

    // Fix assignments with double ternary operators
    content = content.replace(
      /(\s*)(const\s+\w+\s*=\s*)\(isWindows\(\) && winapi\) \? winapi\.(RegGetValue\([^)]+\)) : null : null;/g,
      '$1$2(isWindows() && winapi) ? winapi.$3 : null;'
    );

    // Fix multi-line RegGetValue calls with syntax errors
    content = content.replace(
      /(\s*)(const\s+\w+\s*=\s*)\(isWindows\(\) && winapi\) \? winapi\.(RegGetValue\(\s*[^;]+) : null : null;/gs,
      '$1$2(isWindows() && winapi) ? winapi.$3 : null;'
    );

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed syntax errors in ${filePath}`);
    } else {
      console.log(`No syntax errors found in ${filePath}`);
    }

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Process all extensions
const gamesDir = path.join(__dirname, 'extensions', 'games');

extensionsWithWinapi.forEach(extensionName => {
  const extensionDir = path.join(gamesDir, extensionName);
  
  // Check for index.js
  const jsPath = path.join(extensionDir, 'index.js');
  if (fs.existsSync(jsPath)) {
    fixWinapiUsage(jsPath);
  }
  
  // Check for index.ts
  const tsPath = path.join(extensionDir, 'index.ts');
  if (fs.existsSync(tsPath)) {
    fixWinapiUsage(tsPath);
  }
});

console.log('Winapi syntax error fixing completed!');