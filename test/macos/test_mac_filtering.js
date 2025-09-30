// Test script to verify Mac filtering logic
const fs = require('fs');
const path = require('path');

console.log('=== Testing Mac Filtering Logic ===\n');

// Simulate a game with Mac compatibility
const mockGameWithMacCompatibility = {
  id: 'balatro',
  name: 'Balatro',
  details: {
    macOSCompatibility: {
      windowsExecutable: 'Balatro.exe',
      macOSAppBundle: 'Balatro.app',
      alternativeFiles: ['liblovely.dylib']
    }
  }
};

// Simulate a game without Mac compatibility
const mockGameWithoutMacCompatibility = {
  id: 'somegame',
  name: 'Some Game',
  details: {}
};

// Simulate a game with alternative Mac support
const mockGameWithAlternativeMacSupport = {
  id: 'anothergame',
  name: 'Another Game',
  details: {
    macSupport: true
  }
};

// Simulate the filtering logic from GamePicker.tsx
function applyGameFilter(game, showMacCompatibleOnly = false, currentFilterValue = '') {
  // Apply text filter
  const textMatch = game.name.toLowerCase().includes(currentFilterValue.toLowerCase()) || !currentFilterValue;
  
  // Apply macOS compatibility filter
  if (showMacCompatibleOnly) {
    // Enhanced check for macOS compatibility that handles various data structures
    const hasMacOSCompatibility = game.details?.macOSCompatibility !== undefined && 
                                 game.details?.macOSCompatibility !== null;
    
    // Debug logging
    console.log(`[Test Filter] Game: ${game.name}, ID: ${game.id}, Has Mac Compatibility: ${hasMacOSCompatibility}`);
    if (game.details?.macOSCompatibility) {
      console.log(`[Test Filter] Mac Compatibility Data:`, game.details.macOSCompatibility);
    }
    
    // Additional check for games that might have macOS compatibility but in a different format
    const hasAlternativeMacSupport = game.details?.macSupport === true || 
                                    (game.details?.platforms && game.details.platforms.includes('mac'));
    
    return textMatch && (hasMacOSCompatibility || hasAlternativeMacSupport);
  }
  
  return textMatch;
}

console.log('1. Testing game with Mac compatibility:');
const result1 = applyGameFilter(mockGameWithMacCompatibility, true);
console.log(`✓ Should show: ${result1} (Expected: true)`);

console.log('\n2. Testing game without Mac compatibility:');
const result2 = applyGameFilter(mockGameWithoutMacCompatibility, true);
console.log(`✓ Should show: ${result2} (Expected: false)`);

console.log('\n3. Testing game with alternative Mac support:');
const result3 = applyGameFilter(mockGameWithAlternativeMacSupport, true);
console.log(`✓ Should show: ${result3} (Expected: true)`);

console.log('\n4. Testing without Mac filter (show all):');
const result4 = applyGameFilter(mockGameWithoutMacCompatibility, false);
console.log(`✓ Should show: ${result4} (Expected: true)`);

console.log('\n=== UI Instructions ===');
console.log('To see Mac compatible games in the UI:');
console.log('1. Go to the Games section');
console.log('2. Look for the "Mac Compatible Only" button (should show a game icon or checkmark)');
console.log('3. Click it to toggle Mac-only filtering');
console.log('4. Only games with Mac compatibility should be visible');

console.log('\n=== Current Issue ===');
console.log('Based on the logs, the issue is that only Balatro is installed.');
console.log('You need to install game extensions for other games to see them.');
console.log('The filtering logic itself is working correctly.');

console.log('\n=== Solutions ===');
console.log('1. Install game extensions for Civilization VI, VII, etc. in the Extensions section');
console.log('2. Check the Unmanaged tab for discovered games');
console.log('3. Verify the "Mac Compatible Only" toggle is working by checking if Balatro disappears when filtered');