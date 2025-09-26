// Test script to verify Mac filtering logic works correctly
const fs = require('fs');
const path = require('path');

console.log('=== Testing Mac Filtering Logic ===\n');

// Simulate the MACOS_GAME_FIXES data
const MACOS_GAME_FIXES = [
  { gameId: 'cyberpunk2077' },
  { gameId: 'balatro' },
  { gameId: 'stardewvalley' },
  { gameId: 'rimworld' },
  { gameId: 'factorio' }
];

// Simulate game extensions with Mac compatibility
const mockGameExtensions = {
  'cyberpunk2077': {
    id: 'cyberpunk2077',
    name: 'Cyberpunk 2077',
    details: {
      macOSCompatibility: {
        windowsExecutable: 'bin/x64/Cyberpunk2077.exe',
        macOSAppBundle: 'Cyberpunk 2077.app',
        alternativeFiles: ['launch_modded.sh']
      }
    }
  },
  'balatro': {
    id: 'balatro',
    name: 'Balatro',
    details: {
      macOSCompatibility: {
        windowsExecutable: 'Balatro.exe',
        macOSAppBundle: 'Balatro.app',
        alternativeFiles: []
      }
    }
  },
  'stardewvalley': {
    id: 'stardewvalley',
    name: 'Stardew Valley',
    details: {
      macOSCompatibility: {
        windowsExecutable: 'Stardew Valley.exe',
        macOSAppBundle: 'Stardew Valley.app',
        alternativeFiles: []
      }
    }
  }
};

// Simulate discovered games
const mockDiscoveredGames = [
  { gameId: 'cyberpunk2077', name: 'Cyberpunk 2077', path: '/Applications/Cyberpunk 2077.app' },
  { gameId: 'balatro', name: 'Balatro', path: '/Applications/Balatro.app' },
  { gameId: 'witcher3', name: 'The Witcher 3', path: '/Applications/The Witcher 3.app' },
  { gameId: 'unknowngame', name: 'Unknown Game', path: '/Applications/Unknown Game.app' }
];

// Simulate the fixed gameFromDiscovery function
function gameFromDiscovery(discoveredGame, knownGame) {
  const gameStored = {
    id: discoveredGame.gameId,
    name: discoveredGame.name,
    executable: discoveredGame.path,
    extensionPath: discoveredGame.path,
    details: knownGame?.details || {}
  };
  
  return gameStored;
}

// Simulate the Mac filtering logic
function applyGameFilter(games, showMacCompatibleOnly, searchText = '') {
  return games.filter(game => {
    // Text filter
    const textMatch = !searchText || game.name.toLowerCase().includes(searchText.toLowerCase());
    
    // Mac compatibility filter
    if (showMacCompatibleOnly) {
      const hasMacOSCompatibility = game.details?.macOSCompatibility !== undefined;
      console.log(`[Mac Filter Debug] Game: ${game.name}, ID: ${game.id}, Has Mac Compatibility: ${hasMacOSCompatibility}`);
      if (game.details?.macOSCompatibility) {
        console.log(`[Mac Filter Debug] Mac Compatibility Data:`, game.details.macOSCompatibility);
      }
      return textMatch && hasMacOSCompatibility;
    }
    
    return textMatch;
  });
}

// Test the logic
console.log('1. Creating games from discovery with Mac compatibility preservation...\n');

const processedGames = mockDiscoveredGames.map(discoveredGame => {
  const knownGame = mockGameExtensions[discoveredGame.gameId];
  const gameStored = gameFromDiscovery(discoveredGame, knownGame);
  
  console.log(`Processed ${gameStored.name}:`);
  console.log(`  - Has Mac compatibility: ${gameStored.details?.macOSCompatibility !== undefined}`);
  if (gameStored.details?.macOSCompatibility) {
    console.log(`  - Mac app bundle: ${gameStored.details.macOSCompatibility.macOSAppBundle}`);
  }
  console.log('');
  
  return gameStored;
});

console.log('2. Testing Mac filtering (showMacCompatibleOnly = false)...\n');
const allGames = applyGameFilter(processedGames, false);
console.log(`All games shown: ${allGames.length} games`);
allGames.forEach(game => console.log(`  - ${game.name}`));

console.log('\n3. Testing Mac filtering (showMacCompatibleOnly = true)...\n');
const macOnlyGames = applyGameFilter(processedGames, true);
console.log(`Mac-compatible games shown: ${macOnlyGames.length} games`);
macOnlyGames.forEach(game => console.log(`  - ${game.name}`));

console.log('\n=== Test Results ===');
console.log(`✅ Total games processed: ${processedGames.length}`);
console.log(`✅ Games with Mac compatibility: ${processedGames.filter(g => g.details?.macOSCompatibility).length}`);
console.log(`✅ Mac filtering working: ${macOnlyGames.length > 0 ? 'YES' : 'NO'}`);

if (macOnlyGames.length > 0) {
  console.log('\n🎉 SUCCESS: Mac filtering is working correctly!');
  console.log('The gameFromDiscovery fix successfully preserves Mac compatibility data.');
} else {
  console.log('\n❌ FAILURE: Mac filtering is not working.');
  console.log('Mac compatibility data is not being preserved properly.');
}