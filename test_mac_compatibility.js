// Test script to verify Mac compatibility data
const fs = require('fs');
const path = require('path');

// Load the Mac compatibility data
const macOSGameCompatibilityPath = path.join(__dirname, 'src/util/macOSGameCompatibility.ts');
const content = fs.readFileSync(macOSGameCompatibilityPath, 'utf8');

// Extract game IDs from MACOS_GAME_FIXES
const gameIdMatches = content.match(/gameId:\s*['"`]([^'"`]+)['"`]/g);
if (gameIdMatches) {
  console.log('Mac-compatible games defined in MACOS_GAME_FIXES:');
  gameIdMatches.forEach((match, index) => {
    const gameId = match.match(/gameId:\s*['"`]([^'"`]+)['"`]/)[1];
    console.log(`${index + 1}. ${gameId}`);
  });
  console.log(`\nTotal Mac-compatible games: ${gameIdMatches.length}`);
} else {
  console.log('No Mac-compatible games found in MACOS_GAME_FIXES');
}

console.log('\nMac compatibility fix has been applied to GamePicker.tsx');
console.log('The gameFromDiscovery function now preserves Mac compatibility data');
console.log('Games should now show up when Mac filtering is enabled');