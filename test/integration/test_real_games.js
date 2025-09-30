const { getMacOSGameFix, getExecutablePathForPlatform } = require('./out/util/macOSGameCompatibility');
const path = require('path');
const fs = require('fs');

console.log('=== Testing macOS Compatibility with Real Games ===\n');

// Test games you have installed
const testGames = [
  {
    gameId: 'balatro',
    name: 'Balatro',
    basePath: '/Applications/Balatro.app' // Common macOS installation path
  },
  {
    gameId: 'cyberpunk2077', 
    name: 'Cyberpunk 2077',
    basePath: '/Applications/Cyberpunk 2077.app' // Common macOS installation path
  }
];

console.log('1. Testing getMacOSGameFix for real games:');
testGames.forEach(game => {
  const fix = getMacOSGameFix(game.gameId);
  console.log(`   ${game.name} (${game.gameId}):`, fix ? 'Found fix' : 'No fix found');
  if (fix) {
    console.log(`     - Windows executable: ${fix.windowsExecutable}`);
    console.log(`     - macOS app bundle: ${fix.macOSAppBundle}`);
    console.log(`     - Alternative files: ${fix.alternativeFiles.join(', ')}`);
  }
});

console.log('\n2. Testing getExecutablePathForPlatform with real game paths:');
testGames.forEach(game => {
  console.log(`\n   Testing ${game.name}:`);
  
  // Check if the app actually exists
  const appExists = fs.existsSync(game.basePath);
  console.log(`     App exists at ${game.basePath}: ${appExists}`);
  
  if (appExists) {
    // Test with the actual app bundle path and correct parameters
    const fix = getMacOSGameFix(game.gameId);
    if (fix) {
      const result = getExecutablePathForPlatform(game.basePath, game.gameId, fix.windowsExecutable);
      console.log(`     getExecutablePathForPlatform result: ${result}`);
      
      // Check if the result path exists
      if (result && fs.existsSync(result)) {
        console.log(`     ✅ Result path exists and is accessible`);
      } else {
        console.log(`     ⚠️  Result path does not exist or is not accessible`);
      }
    } else {
      console.log(`     ⚠️  No game fix found for ${game.gameId}`);
    }
  } else {
    console.log(`     ⚠️  App not found at expected location, testing with hypothetical path`);
    const fix = getMacOSGameFix(game.gameId);
    if (fix) {
      const result = getExecutablePathForPlatform(game.basePath, game.gameId, fix.windowsExecutable);
      console.log(`     getExecutablePathForPlatform result: ${result}`);
    }
  }
});

console.log('\n3. Testing with Steam/other installation paths:');
// Common Steam installation paths on macOS
const steamPaths = [
  '~/Library/Application Support/Steam/steamapps/common/Balatro',
  '~/Library/Application Support/Steam/steamapps/common/Cyberpunk 2077'
];

steamPaths.forEach((steamPath, index) => {
  const game = testGames[index];
  const expandedPath = steamPath.replace('~', require('os').homedir());
  console.log(`\n   Testing ${game.name} Steam path:`);
  console.log(`     Path: ${expandedPath}`);
  
  const steamExists = fs.existsSync(expandedPath);
  console.log(`     Steam installation exists: ${steamExists}`);
  
  if (steamExists) {
    const fix = getMacOSGameFix(game.gameId);
    if (fix) {
      const result = getExecutablePathForPlatform(expandedPath, game.gameId, fix.windowsExecutable);
      console.log(`     getExecutablePathForPlatform result: ${result}`);
      
      if (result && fs.existsSync(result)) {
        console.log(`     ✅ Result path exists and is accessible`);
      } else {
        console.log(`     ⚠️  Result path does not exist or is not accessible`);
      }
    } else {
      console.log(`     ⚠️  No game fix found for ${game.gameId}`);
    }
  }
});

console.log('\n=== Test Complete ===');