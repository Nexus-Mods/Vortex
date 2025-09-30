// Test script to simulate the full Vortex startup process and macOS enhancement
const fs = require('fs');
const path = require('path');

// Simulate the local storage
const $ = {
  extensionGames: [],
  extensionStubs: []
};

// Simulate MACOS_GAME_FIXES
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

// Simulate the enhanceGamesWithMacOSCompatibility function
function enhanceGamesWithMacOSCompatibility() {
  console.log(`[Test Full] Starting enhancement, available games: ${$.extensionGames.length}`);
  console.log(`[Test Full] Available game IDs:`, $.extensionGames.map(g => g.id));
  console.log(`[Test Full] Mac fixes to apply:`, MACOS_GAME_FIXES.map(f => f.gameId));
  
  // Log all available fixes for debugging
  console.log(`[Test Full] All MACOS_GAME_FIXES:`, MACOS_GAME_FIXES);
  
  MACOS_GAME_FIXES.forEach(fix => {
    // Only enhance existing bundled or community extensions, never create game stubs
    const existingGame = $.extensionGames.find(game => game.id === fix.gameId);
    
    if (existingGame) {
      // If bundled/community extension exists, enhance it with macOS compatibility info
      console.log('[Test Full] Enhancing existing extension with macOS compatibility', { 
        gameId: fix.gameId, 
        gameName: existingGame.name 
      });
      
      console.log(`[Test Full] Enhancing game: ${existingGame.name} (${fix.gameId})`);
      
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
        console.log(`[Test Full] Added Mac compatibility to ${existingGame.name}:`, existingGame.details.macOSCompatibility);
      } else {
        console.log(`[Test Full] Game ${existingGame.name} already has Mac compatibility`);
      }
    } else {
      // Log that we're skipping this game since no proper extension exists
      console.log('[Test Full] Skipping macOS compatibility enhancement - no extension found', { 
        gameId: fix.gameId,
        message: 'Waiting for bundled or community extension to be available'
      });
      console.log(`[Test Full] No extension found for game ID: ${fix.gameId}`);
      console.log(`[Test Full] Available extensions:`, $.extensionGames.map(g => g.id));
    }
  });
}

// Simulate loading all game extensions (like Vortex does)
function loadAllGameExtensions() {
  console.log('[Test Full] Loading all game extensions...');
  
  // Simulate loading the Balatro extension
  const balatroGame = {
    id: 'balatro',
    name: 'Balatro',
    executable: () => process.platform === 'darwin' ? 'Balatro.app' : 'Balatro.exe',
    requiredFiles: process.platform === 'darwin' ? ['Balatro.app'] : ['Balatro.exe'],
    details: {
      steamAppId: 2379250,
      nexusPageId: 'balatro'
    }
  };
  
  $.extensionGames.push(balatroGame);
  console.log('[Test Full] Loaded Balatro extension');
  
  // Simulate loading other extensions
  const otherGame = {
    id: 'othergame',
    name: 'Other Game',
    executable: () => 'other.exe',
    requiredFiles: ['other.exe'],
    details: {}
  };
  
  $.extensionGames.push(otherGame);
  console.log('[Test Full] Loaded Other Game extension');
  
  console.log(`[Test Full] Total extensions loaded: ${$.extensionGames.length}`);
}

// Simulate the Vortex startup process
console.log('=== Testing Full Vortex Startup Process ===');

// Step 1: Define the enhancement function (this happens in context.once)
console.log('\n--- Step 1: Define enhancement function ---');
// The function is already defined above

// Step 2: Load game extensions (this happens through registerGame calls)
console.log('\n--- Step 2: Load game extensions ---');
loadAllGameExtensions();

// Step 3: Run the enhancement function (this should happen after extensions are loaded)
console.log('\n--- Step 3: Run enhancement function ---');
enhanceGamesWithMacOSCompatibility();

// Step 4: Check the results
console.log('\n--- Step 4: Check results ---');
const balatroGame = $.extensionGames.find(g => g.id === 'balatro');
if (balatroGame) {
  console.log('Balatro game after enhancement:');
  console.log('  Has details:', !!balatroGame.details);
  console.log('  Has macOSCompatibility:', !!balatroGame.details?.macOSCompatibility);
  if (balatroGame.details?.macOSCompatibility) {
    console.log('  macOSCompatibility data:', JSON.stringify(balatroGame.details.macOSCompatibility, null, 2));
  }
}

// Step 5: Simulate GamePicker filtering
console.log('\n--- Step 5: Simulate GamePicker filtering ---');
function applyGameFilter(game, showMacCompatibleOnly) {
  if (showMacCompatibleOnly) {
    const hasMacOSCompatibility = game.details?.macOSCompatibility !== undefined;
    console.log(`[Test Filter] Game: ${game.name}, ID: ${game.id}, Has Mac Compatibility: ${hasMacOSCompatibility}`);
    return hasMacOSCompatibility;
  }
  return true; // No filter applied
}

const filteredGames = $.extensionGames.filter(game => applyGameFilter(game, true));
console.log(`Filtered games (macOS compatible only): ${filteredGames.length}`);
filteredGames.forEach(game => {
  console.log(`  - ${game.name} (${game.id})`);
});

console.log('\n=== End Test ===');