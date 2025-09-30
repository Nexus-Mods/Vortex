// Test script to verify Civilization games macOS compatibility
const fs = require('fs');
const path = require('path');

console.log('=== Testing Civilization Games macOS Compatibility ===\n');

// Test the MACOS_GAME_FIXES contains Civilization games
console.log('1. Checking if MACOS_GAME_FIXES contains Civilization games...');
try {
  const macOSGameCompatibilityPath = path.join(__dirname, 'src', 'util', 'macOSGameCompatibility.ts');
  const content = fs.readFileSync(macOSGameCompatibilityPath, 'utf8');
  
  const hasCivVI = content.includes("gameId: 'sidmeierscivilizationvi'");
  const hasCivVII = content.includes("gameId: 'sidmeierscivilizationvii'");
  
  console.log('✓ Sid Meier\'s Civilization VI in MACOS_GAME_FIXES:', hasCivVI);
  console.log('✓ Sid Meier\'s Civilization VII in MACOS_GAME_FIXES:', hasCivVII);
  
  if (hasCivVI && hasCivVII) {
    console.log('✓ All Civilization games are in MACOS_GAME_FIXES');
  } else {
    console.log('✗ Some Civilization games are missing from MACOS_GAME_FIXES');
  }
} catch (err) {
  console.log('✗ Error reading macOSGameCompatibility.ts:', err.message);
}

// Test the enhanced matching logic
console.log('\n2. Testing enhanced matching logic...');
const mockExtensionGames = [
  {
    id: 'Sid Meier\'s Civilization VII Vortex Extension',
    name: 'Sid Meier\'s Civilization VII'
  },
  {
    id: 'sidmeierscivilizationvi',
    name: 'Sid Meier\'s Civilization VI'
  },
  {
    id: 'balatro',
    name: 'Balatro'
  }
];

const mockMacFixes = [
  {
    gameId: 'sidmeierscivilizationvi',
    windowsExecutable: 'CivilizationVI.exe',
    macOSAppBundle: 'Civilization VI.app'
  },
  {
    gameId: 'sidmeierscivilizationvii',
    windowsExecutable: 'CivilizationVII.exe',
    macOSAppBundle: 'Civilization VII.app'
  },
  {
    gameId: 'balatro',
    windowsExecutable: 'Balatro.exe',
    macOSAppBundle: 'Balatro.app'
  }
];

// Simulate the enhanced matching logic
mockMacFixes.forEach(fix => {
  // Enhanced matching logic
  let existingGame = mockExtensionGames.find(game => game.id === fix.gameId);
  
  // If no exact match, try more flexible matching
  if (!existingGame) {
    // Normalize the fix gameId for comparison
    const normalizedFixId = fix.gameId
      .toLowerCase()
      .replace(/sidmeiers/g, '')
      .replace(/civilization/g, 'civ')
      .replace(/[^a-z0-9]/g, '');
    
    // Try to match with more flexible logic
    existingGame = mockExtensionGames.find(game => {
      const normalizedGameId = game.id
        .toLowerCase()
        .replace(/sid meier's/g, '')
        .replace(/civilization/g, 'civ')
        .replace(/vortex extension/g, '')
        .replace(/game:/g, '')
        .replace(/[^a-z0-9]/g, '');
      
      const normalizedGameName = game.name
        .toLowerCase()
        .replace(/sid meier's/g, '')
        .replace(/civilization/g, 'civ')
        .replace(/[^a-z0-9]/g, '');
      
      // Check for matches
      return normalizedGameId.includes(normalizedFixId) || 
             normalizedGameName.includes(normalizedFixId) ||
             normalizedFixId.includes(normalizedGameId);
    });
  }
  
  if (existingGame) {
    console.log(`✓ Matched ${fix.gameId} to ${existingGame.id} (${existingGame.name})`);
  } else {
    console.log(`✗ No match found for ${fix.gameId}`);
  }
});

console.log('\n=== Test Complete ===');
console.log('The enhanced matching logic should now properly match Civilization games');
console.log('even when their extension IDs don\'t exactly match the MACOS_GAME_FIXES IDs.');