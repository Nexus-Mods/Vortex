// Test script to simulate the macOS enhancement process
const fs = require('fs');
const path = require('path');

// Simulate the MACOS_GAME_FIXES
const MACOS_GAME_FIXES = [
  {
    gameId: 'balatro',
    windowsExecutable: 'Balatro.exe',
    macOSAppBundle: 'Balatro.app',
    alternativeFiles: [
      'liblovely.dylib',
      'run_lovely_macos.sh',
      'lovely',
      'lovely.exe',
      'steammodded.lua',
      'steammodded',
      'balatro.app',
      'BALATRO.app',
      'Balatro.x86_64',
      'Balatro.app/Contents/MacOS/Balatro'
    ]
  }
];

// Simulate extension games array
const extensionGames = [];

// Simulate the enhanceGamesWithMacOSCompatibility function
function enhanceGamesWithMacOSCompatibility() {
  console.log(`[Test] Starting enhancement, available games: ${extensionGames.length}`);
  console.log(`[Test] Available game IDs:`, extensionGames.map(g => g.id));
  console.log(`[Test] Mac fixes to apply:`, MACOS_GAME_FIXES.map(f => f.gameId));
  
  // Log all available fixes for debugging
  console.log(`[Test] All MACOS_GAME_FIXES:`, MACOS_GAME_FIXES);
  
  MACOS_GAME_FIXES.forEach(fix => {
    // Only enhance existing bundled or community extensions, never create game stubs
    const existingGame = extensionGames.find(game => game.id === fix.gameId);
    
    if (existingGame) {
      // If bundled/community extension exists, enhance it with macOS compatibility info
      console.log('[Test] Enhancing existing extension with macOS compatibility', { 
        gameId: fix.gameId, 
        gameName: existingGame.name 
      });
      
      console.log(`[Test] Enhancing game: ${existingGame.name} (${fix.gameId})`);
      
      // Store the macOS compatibility info in the details property
      if (!existingGame.details) {
        existingGame.details = {};
      }
      if (!existingGame.details.macOSCompatibility) {
        existingGame.details.macOSCompatibility = {
          windowsExecutable: fix.windowsExecutable,
          macOSAppBundle: fix.macOSAppBundle,
          alternativeFiles: fix.alternativeFiles
        };
        console.log(`[Test] Added Mac compatibility to ${existingGame.name}:`, existingGame.details.macOSCompatibility);
      } else {
        console.log(`[Test] Game ${existingGame.name} already has Mac compatibility`);
      }
    } else {
      // Log that we're skipping this game since no proper extension exists
      console.log('[Test] Skipping macOS compatibility enhancement - no extension found', { 
        gameId: fix.gameId,
        message: 'Waiting for bundled or community extension to be available'
      });
      console.log(`[Test] No extension found for game ID: ${fix.gameId}`);
      console.log(`[Test] Available extensions:`, extensionGames.map(g => g.id));
    }
  });
}

// Simulate loading a game extension
function loadBalatroExtension() {
  const game = {
    id: 'balatro',
    name: 'Balatro',
    executable: () => process.platform === 'darwin' ? 'Balatro.app' : 'Balatro.exe',
    requiredFiles: process.platform === 'darwin' ? ['Balatro.app'] : ['Balatro.exe'],
    details: {
      steamAppId: 2379250,
      nexusPageId: 'balatro'
    }
  };
  
  console.log('[Test] Loading Balatro extension');
  extensionGames.push(game);
  console.log('[Test] Balatro extension loaded');
}

// Test the enhancement process
console.log('=== Testing macOS Enhancement Process ===');

// First run - no games loaded
console.log('\n--- First run (no games) ---');
enhanceGamesWithMacOSCompatibility();

// Second run - with Balatro loaded
console.log('\n--- Second run (with Balatro) ---');
loadBalatroExtension();
enhanceGamesWithMacOSCompatibility();

// Check if the game now has macOS compatibility
const balatroGame = extensionGames.find(g => g.id === 'balatro');
if (balatroGame) {
  console.log('\n--- Balatro game after enhancement ---');
  console.log('Has details:', !!balatroGame.details);
  console.log('Has macOSCompatibility:', !!balatroGame.details?.macOSCompatibility);
  if (balatroGame.details?.macOSCompatibility) {
    console.log('macOSCompatibility data:', balatroGame.details.macOSCompatibility);
  }
}

console.log('\n=== End Test ===');