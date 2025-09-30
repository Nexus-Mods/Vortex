#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🎮 BALATRO EXTENSION LOADING TEST');
console.log('================================\n');

// Test 1: Check if the extension files exist
const extensionPath = '/Users/veland/Downloads/vortex/out/bundledPlugins/game-balatro';
const indexPath = path.join(extensionPath, 'index.js');
const infoPath = path.join(extensionPath, 'info.json');

console.log('📁 Checking extension files:');
console.log(`Extension path: ${extensionPath}`);
console.log(`Index.js exists: ${fs.existsSync(indexPath)}`);
console.log(`Info.json exists: ${fs.existsSync(infoPath)}`);

if (!fs.existsSync(indexPath)) {
  console.error('❌ Extension index.js not found!');
  process.exit(1);
}

if (!fs.existsSync(infoPath)) {
  console.error('❌ Extension info.json not found!');
  process.exit(1);
}

// Test 2: Load and parse info.json
console.log('\n📋 Loading extension info:');
try {
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  console.log(`Name: ${info.name}`);
  console.log(`Game ID: ${info.gameId}`);
  console.log(`Version: ${info.version}`);
  console.log(`Type: ${info.type}`);
} catch (err) {
  console.error('❌ Failed to parse info.json:', err.message);
  process.exit(1);
}

// Test 3: Try to load the extension module
console.log('\n🔧 Loading extension module:');
try {
  // Clear module cache first
  delete require.cache[indexPath];
  
  const extensionModule = require(indexPath);
  console.log(`Module loaded: ${typeof extensionModule}`);
  console.log(`Has default export: ${typeof extensionModule.default}`);
  console.log(`Export keys: ${Object.keys(extensionModule)}`);
  
  if (typeof extensionModule.default !== 'function') {
    console.error('❌ Extension does not export a default function!');
    process.exit(1);
  }
  
  console.log('✅ Extension module loaded successfully');
} catch (err) {
  console.error('❌ Failed to load extension module:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}

// Test 4: Try to call the extension with a mock context
console.log('\n🎯 Testing extension registration:');
try {
  const extensionModule = require(indexPath);
  const registeredGames = [];
  
  // Create a mock context
  const mockContext = {
    registerGame: (game) => {
      console.log(`✅ Game registered: ${game.id} (${game.name})`);
      registeredGames.push(game);
    },
    registerGameStub: (game) => {
      console.log(`✅ Game stub registered: ${game.id} (${game.name})`);
    },
    // Stub other register methods
    registerReducer: () => {},
    registerAction: () => {},
    registerAttributeExtractor: () => {},
    registerArchiveType: () => {},
    registerDashlet: () => {},
    registerDialog: () => {},
    registerFooter: () => {},
    registerInstaller: () => {},
    registerInterpreter: () => {},
    registerLoadOrder: () => {},
    registerMainPage: () => {},
    registerMerge: () => {},
    registerMigration: () => {},
    registerModSource: () => {},
    registerModType: () => {},
    registerPersistor: () => {},
    registerProtocol: () => {},
    registerSettings: () => {},
    registerStartHook: () => {},
    registerTableAttribute: () => {},
    registerTest: () => {},
    registerTool: () => {},
    registerToolVariables: () => {},
    registerDeploymentMethod: () => {},
    registerProfileFeature: () => {},
    registerBanner: () => {},
    registerHistoryStack: () => {},
    registerCollectionFeature: () => {},
    registerModInfoExtractor: () => {},
    registerAPI: () => {},
    once: () => {},
    onAsync: () => {},
    onStateChange: () => {},
    optional: {
      registerCollectionFeature: () => {},
      registerModInfoExtractor: () => {},
    },
    api: {
      store: {
        dispatch: () => {},
        getState: () => ({
          settings: {
            gameMode: {
              discovered: {}
            }
          }
        })
      },
      events: {
        emit: () => {},
        on: () => {},
        once: () => {}
      },
      showDialog: () => Promise.resolve({ action: 'dismiss' }),
      sendNotification: () => {},
      dismissNotification: () => {},
      showErrorNotification: () => {},
      translate: (text) => text,
      getPath: (pathType) => {
        if (pathType === 'userData') return '/tmp/vortex-test';
        return '/tmp';
      }
    }
  };
  
  // Call the extension
  const result = extensionModule.default(mockContext);
  console.log(`Extension call result: ${result}`);
  
  if (registeredGames.length === 0) {
    console.error('❌ No games were registered by the extension!');
    process.exit(1);
  }
  
  console.log(`✅ Extension registered ${registeredGames.length} game(s)`);
  registeredGames.forEach(game => {
    console.log(`  - ${game.id}: ${game.name}`);
  });
  
} catch (err) {
  console.error('❌ Failed to test extension registration:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}

console.log('\n🎉 All tests passed! The Balatro extension appears to be working correctly.');
console.log('\nThis suggests the issue might be:');
console.log('1. Extension loading timing during Vortex startup');
console.log('2. Extension state management (enabled/disabled)');
console.log('3. Extension registration order');
console.log('4. Game discovery vs extension loading race condition');