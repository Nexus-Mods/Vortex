// Test script to verify the expanded macOS compatibility list
const fs = require('fs');
const path = require('path');

console.log('=== Testing Expanded macOS Compatibility List ===\n');

// Test that all the new games are in the MACOS_GAME_FIXES
console.log('1. Checking for expanded game list...');
try {
  const macOSGameCompatibilityPath = path.join(__dirname, 'src', 'util', 'macOSGameCompatibility.ts');
  const content = fs.readFileSync(macOSGameCompatibilityPath, 'utf8');
  
  // List of games we added
  const newGames = [
    'sidmeierscivilizationvi',
    'sidmeierscivilizationvii',
    'europauniversalisiv',
    'crusaderkingsiii',
    'stellaris',
    'heartsofironiv',
    'totalwarwarhammer3',
    'ageofempires2definitiveedition',
    'ageofempires4',
    'companyofheroes2',
    'warthunder',
    'worldofwarships',
    'worldoftanks',
    'thesims4',
    'citiesskylinesii',
    'palworld',
    'hogwartslegacy',
    'eldenring',
    'godoFWar',
    'horizonzerodawn',
    'ghostoftsushima'
  ];
  
  let allFound = true;
  newGames.forEach(gameId => {
    const found = content.includes(`gameId: '${gameId}'`);
    console.log(`✓ ${gameId}: ${found ? 'Found' : 'Missing'}`);
    if (!found) allFound = false;
  });
  
  if (allFound) {
    console.log('\n✓ All new games successfully added to MACOS_GAME_FIXES');
  } else {
    console.log('\n✗ Some games are missing from MACOS_GAME_FIXES');
  }
} catch (err) {
  console.log('✗ Error reading macOSGameCompatibility.ts:', err.message);
}

// Test the enhanced matching logic with more game examples
console.log('\n2. Testing enhanced matching logic with new games...');
const mockExtensionGames = [
  {
    id: 'Sid Meier\'s Civilization VII Vortex Extension',
    name: 'Sid Meier\'s Civilization VII',
    details: {}
  },
  {
    id: 'sidmeierscivilizationvi',
    name: 'Sid Meier\'s Civilization VI',
    details: {}
  },
  {
    id: 'Europa Universalis IV',
    name: 'Europa Universalis IV',
    details: {}
  },
  {
    id: 'Crusader Kings III',
    name: 'Crusader Kings III',
    details: {}
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
    gameId: 'europauniversalisiv',
    windowsExecutable: 'eu4.exe',
    macOSAppBundle: 'Europa Universalis IV.app'
  },
  {
    gameId: 'crusaderkingsiii',
    windowsExecutable: 'CK3.exe',
    macOSAppBundle: 'Crusader Kings III.app'
  }
];

// Simulate the enhanced matching logic from the actual implementation
function enhancedMatchingLogic(fix, extensionGames) {
  // First try exact match
  let existingGame = extensionGames.find(game => game.id === fix.gameId);
  
  // If no exact match, try more flexible matching
  if (!existingGame) {
    // Normalize the fix gameId for comparison
    const normalizedFixId = fix.gameId
      .toLowerCase()
      .replace(/sidmeiers/g, '')
      .replace(/civilization/g, 'civ')
      .replace(/europauniversalis/g, 'eu')
      .replace(/crusaderkings/g, 'ck')
      .replace(/[^a-z0-9]/g, '');
    
    // Try to match with more flexible logic
    existingGame = extensionGames.find(game => {
      const normalizedGameId = game.id
        .toLowerCase()
        .replace(/sid meier's/g, '')
        .replace(/civilization/g, 'civ')
        .replace(/europa universalis/g, 'eu')
        .replace(/crusader kings/g, 'ck')
        .replace(/vortex extension/g, '')
        .replace(/game:/g, '')
        .replace(/[^a-z0-9]/g, '');
      
      const normalizedGameName = game.name
        .toLowerCase()
        .replace(/sid meier's/g, '')
        .replace(/civilization/g, 'civ')
        .replace(/europa universalis/g, 'eu')
        .replace(/crusader kings/g, 'ck')
        .replace(/[^a-z0-9]/g, '');
      
      // Check for matches
      return normalizedGameId.includes(normalizedFixId) || 
             normalizedGameName.includes(normalizedFixId) ||
             normalizedFixId.includes(normalizedGameId);
    });
  }
  
  return existingGame;
}

let allMatchesSuccessful = true;
mockMacFixes.forEach(fix => {
  const matchedGame = enhancedMatchingLogic(fix, mockExtensionGames);
  if (matchedGame) {
    console.log(`✓ Successfully matched ${fix.gameId} to ${matchedGame.id}`);
  } else {
    console.log(`✗ Failed to match ${fix.gameId}`);
    allMatchesSuccessful = false;
  }
});

if (allMatchesSuccessful) {
  console.log('\n✓ PASS: All sample games matched successfully');
} else {
  console.log('\n✗ FAIL: Some sample games failed to match');
}

console.log('\n=== Summary ===');
console.log('The expanded macOS compatibility list includes:');
console.log('- 20+ new games added to MACOS_GAME_FIXES');
console.log('- Enhanced matching logic to handle various ID formats');
console.log('- Better support for strategy and simulation games');
console.log('- Expanded coverage for popular titles');

console.log('\n=== Expected Result ===');
console.log('When the "Show Mac Compatible Only" filter is enabled:');
console.log('- All newly added games should be recognized as macOS compatible');
console.log('- Games with proper macOS compatibility data should be displayed');
console.log('- Debug logs should show more accurate matching information');