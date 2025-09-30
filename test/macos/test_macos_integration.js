#!/usr/bin/env node

/**
 * Test script to verify macOS compatibility layer integration
 */

const path = require('path');
const { getExecutablePathForPlatform } = require('./out/util/macOSGameCompatibility');

console.log('Testing macOS compatibility layer integration...\n');

// Test cases
const testCases = [
  {
    name: 'Skyrim Special Edition',
    basePath: '/Applications/Steam/steamapps/common/Skyrim Special Edition',
    gameId: 'skyrimse',
    windowsExecutable: 'SkyrimSE.exe'
  },
  {
    name: 'Fallout 4',
    basePath: '/Applications/Steam/steamapps/common/Fallout 4',
    gameId: 'fallout4',
    windowsExecutable: 'Fallout4.exe'
  },
  {
    name: 'Generic Game (no fix)',
    basePath: '/Applications/Steam/steamapps/common/SomeGame',
    gameId: 'unknowngame',
    windowsExecutable: 'Game.exe'
  }
];

console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Base Path: ${testCase.basePath}`);
  console.log(`  Game ID: ${testCase.gameId}`);
  console.log(`  Windows Executable: ${testCase.windowsExecutable}`);
  
  try {
    const result = getExecutablePathForPlatform(
      testCase.basePath,
      testCase.gameId,
      testCase.windowsExecutable
    );
    
    console.log(`  Result: ${result || 'null'}`);
    
    if (result) {
      console.log(`  ✅ macOS compatibility layer returned a path`);
    } else {
      console.log(`  ⚠️  macOS compatibility layer returned null`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  console.log('');
});

console.log('Integration test completed.');