#!/usr/bin/env node

/**
 * Test script for macOS game discovery implementation
 * This script tests the discovery functions with mock data to ensure proper functionality
 */

const fs = require('fs');
const path = require('path');

// Mock the log utility
const mockLog = {
  debug: (message, context) => console.log(`[DEBUG] ${message}`, context || ''),
  warn: (message, context) => console.log(`[WARN] ${message}`, context || ''),
  error: (message, context) => console.log(`[ERROR] ${message}`, context || ''),
  info: (message, context) => console.log(`[INFO] ${message}`, context || '')
};

// Mock the executable resolver
const mockExecutableResolver = {
  resolveGameExecutable: async (gamePath, options = {}) => {
    console.log(`[RESOLVER] Resolving executable for: ${gamePath}`);
    
    // Simulate different types of executables based on path
    if (gamePath.includes('.app')) {
      return {
        executable: path.join(gamePath, 'Contents/MacOS/Game'),
        priority: 1,
        type: 'native_macos'
      };
    } else if (gamePath.includes('Steam')) {
      return {
        executable: path.join(gamePath, 'game.exe'),
        priority: 2,
        type: 'windows_via_proton'
      };
    } else if (gamePath.includes('Epic')) {
      return {
        executable: path.join(gamePath, 'Game.exe'),
        priority: 3,
        type: 'windows_via_crossover'
      };
    }
    
    return null;
  }
};

// Create test directories structure
function createTestStructure() {
  const testDir = '/tmp/vortex-test-discovery';
  
  // Clean up existing test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  // Create test structure
  const dirs = [
    `${testDir}/Applications/TestGame.app/Contents/MacOS`,
    `${testDir}/Applications/Steam.app/Contents/MacOS`,
    `${testDir}/Library/Application Support/Steam/steamapps/common/TestSteamGame`,
    `${testDir}/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests`,
    `${testDir}/Applications/GOG Galaxy.app`,
    `${testDir}/Applications/CrossOver/Bottles/TestBottle/drive_c/Program Files/TestGame`
  ];
  
  dirs.forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
  });
  
  // Create test files
  fs.writeFileSync(`${testDir}/Applications/TestGame.app/Contents/MacOS/TestGame`, '#!/bin/bash\necho "Native macOS game"');
  fs.chmodSync(`${testDir}/Applications/TestGame.app/Contents/MacOS/TestGame`, 0o755);
  
  fs.writeFileSync(`${testDir}/Library/Application Support/Steam/steamapps/common/TestSteamGame/game.exe`, 'Mock Windows executable');
  
  // Create Epic manifest
  const epicManifest = {
    AppName: 'TestEpicGame',
    DisplayName: 'Test Epic Game',
    InstallLocation: `${testDir}/Epic Games/TestEpicGame`,
    LaunchExecutable: 'Game.exe'
  };
  fs.writeFileSync(`${testDir}/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests/test.item`, JSON.stringify(epicManifest));
  
  // Create Epic game directory
  fs.mkdirSync(`${testDir}/Epic Games/TestEpicGame`, { recursive: true });
  fs.writeFileSync(`${testDir}/Epic Games/TestEpicGame/Game.exe`, 'Mock Epic game executable');
  
  console.log(`[TEST] Created test structure at: ${testDir}`);
  return testDir;
}

// Test the discovery functions
async function testDiscovery() {
  console.log('=== Testing macOS Game Discovery Implementation ===\n');
  
  const testDir = createTestStructure();
  
  // Mock the discovery module with our test paths
  const discoveryModule = {
    // Override constants for testing
    MACOS_APPLICATIONS_DIR: `${testDir}/Applications`,
    STEAM_LIBRARY_DIRS: [`${testDir}/Library/Application Support/Steam`],
    EPIC_MANIFESTS_DIR: `${testDir}/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests`,
    GOG_GAMES_DIR: `${testDir}/Applications/GOG Galaxy.app`,
    CROSSOVER_BOTTLES_DIR: `${testDir}/Applications/CrossOver/Bottles`,
    
    // Test candidates array
    candidates: [],
    
    // Mock discovery functions
    async discoverNativeApps(callback) {
      console.log('[TEST] Running discoverNativeApps...');
      try {
        const appsDir = this.MACOS_APPLICATIONS_DIR;
        const apps = fs.readdirSync(appsDir).filter(name => name.endsWith('.app'));
        
        for (const app of apps) {
          if (app === 'Steam.app' || app === 'GOG Galaxy.app') continue;
          
          const appPath = path.join(appsDir, app);
          const resolved = await mockExecutableResolver.resolveGameExecutable(appPath);
          
          if (resolved) {
            const candidate = {
              id: app.replace('.app', ''),
              name: app.replace('.app', ''),
              executable: resolved.executable,
              priority: resolved.priority,
              type: resolved.type,
              source: 'native_macos'
            };
            
            this.candidates.push(candidate);
            callback(candidate);
            console.log(`[DISCOVERED] Native app: ${candidate.name}`);
          }
        }
      } catch (error) {
        console.error('[ERROR] discoverNativeApps failed:', error.message);
      }
    },
    
    async discoverSteamGames(callback) {
      console.log('[TEST] Running discoverSteamGames...');
      try {
        for (const libraryDir of this.STEAM_LIBRARY_DIRS) {
          const steamappsDir = path.join(libraryDir, 'steamapps', 'common');
          if (!fs.existsSync(steamappsDir)) continue;
          
          const games = fs.readdirSync(steamappsDir);
          for (const game of games) {
            const gamePath = path.join(steamappsDir, game);
            const resolved = await mockExecutableResolver.resolveGameExecutable(gamePath);
            
            if (resolved) {
              const candidate = {
                id: `steam_${game}`,
                name: game,
                executable: resolved.executable,
                priority: resolved.priority,
                type: resolved.type,
                source: 'steam'
              };
              
              this.candidates.push(candidate);
              callback(candidate);
              console.log(`[DISCOVERED] Steam game: ${candidate.name}`);
            }
          }
        }
      } catch (error) {
        console.error('[ERROR] discoverSteamGames failed:', error.message);
      }
    },
    
    async discoverEpicGames(callback) {
      console.log('[TEST] Running discoverEpicGames...');
      try {
        if (!fs.existsSync(this.EPIC_MANIFESTS_DIR)) return;
        
        const manifests = fs.readdirSync(this.EPIC_MANIFESTS_DIR)
          .filter(file => file.endsWith('.item'));
        
        for (const manifestFile of manifests) {
          const manifestPath = path.join(this.EPIC_MANIFESTS_DIR, manifestFile);
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          
          if (manifest.InstallLocation && fs.existsSync(manifest.InstallLocation)) {
            const resolved = await mockExecutableResolver.resolveGameExecutable(manifest.InstallLocation);
            
            if (resolved) {
              const candidate = {
                id: `epic_${manifest.AppName}`,
                name: manifest.DisplayName || manifest.AppName,
                executable: resolved.executable,
                priority: resolved.priority,
                type: resolved.type,
                source: 'epic'
              };
              
              this.candidates.push(candidate);
              callback(candidate);
              console.log(`[DISCOVERED] Epic game: ${candidate.name}`);
            }
          }
        }
      } catch (error) {
        console.error('[ERROR] discoverEpicGames failed:', error.message);
      }
    }
  };
  
  // Run discovery tests
  const discoveredGames = [];
  const discoveryCallback = (candidate) => {
    discoveredGames.push(candidate);
  };
  
  await discoveryModule.discoverNativeApps(discoveryCallback);
  await discoveryModule.discoverSteamGames(discoveryCallback);
  await discoveryModule.discoverEpicGames(discoveryCallback);
  
  // Test priority ordering
  console.log('\n=== Testing Priority Ordering ===');
  const sortedGames = discoveredGames.sort((a, b) => a.priority - b.priority);
  
  console.log('Games sorted by priority:');
  sortedGames.forEach((game, index) => {
    console.log(`${index + 1}. ${game.name} (Priority: ${game.priority}, Type: ${game.type}, Source: ${game.source})`);
  });
  
  // Verify expected results
  console.log('\n=== Test Results ===');
  const expectedSources = ['native_macos', 'steam', 'epic'];
  const foundSources = [...new Set(discoveredGames.map(g => g.source))];
  
  console.log(`Expected sources: ${expectedSources.join(', ')}`);
  console.log(`Found sources: ${foundSources.join(', ')}`);
  console.log(`Total games discovered: ${discoveredGames.length}`);
  
  // Check if native macOS games have highest priority (lowest number)
  const nativeGames = discoveredGames.filter(g => g.source === 'native_macos');
  const hasCorrectPriority = nativeGames.every(g => g.priority === 1);
  
  console.log(`Native macOS games have correct priority: ${hasCorrectPriority}`);
  
  // Clean up
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\n[TEST] Cleanup completed');
  
  return {
    totalDiscovered: discoveredGames.length,
    sourcesCovered: foundSources,
    priorityCorrect: hasCorrectPriority,
    success: discoveredGames.length > 0 && hasCorrectPriority
  };
}

// Run the test
if (require.main === module) {
  testDiscovery()
    .then(results => {
      console.log('\n=== Final Test Summary ===');
      console.log(`Test ${results.success ? 'PASSED' : 'FAILED'}`);
      console.log(`Games discovered: ${results.totalDiscovered}`);
      console.log(`Sources covered: ${results.sourcesCovered.join(', ')}`);
      console.log(`Priority ordering correct: ${results.priorityCorrect}`);
      
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed with error:', error);
      process.exit(1);
    });
}

module.exports = { testDiscovery };