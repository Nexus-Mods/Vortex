#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');

console.log('🎮 COMMUNITY EXTENSION LOADING TEST');
console.log('====================================\n');

// Test the actual Balatro extension path
const userDataPath = '/Users/veland/Library/Application Support/CrossOver/Bottles/Steam/drive_c/users/crossover/AppData/Roaming/Vortex';
const pluginsPath = path.join(userDataPath, 'plugins');
const extensionPath = path.join(pluginsPath, 'Balatro Vortex Extension-1315-0-1-2-1748486275');
const indexPath = path.join(extensionPath, 'index.js');
const infoPath = path.join(extensionPath, 'info.json');

console.log('📁 Checking community extension files:');
console.log(`User data path: ${userDataPath}`);
console.log(`Plugins path: ${pluginsPath}`);
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
  console.log(`Author: ${info.author}`);
  console.log(`Version: ${info.version}`);
  console.log(`Description: ${info.description}`);
  
  // Check if type is set correctly
  if (info.type !== 'game') {
    console.log(`⚠️  Extension type is not set to 'game', setting it now...`);
    info.type = 'game';
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
    console.log(`✅ Extension type updated to 'game'`);
  } else {
    console.log(`✅ Extension type is correctly set to 'game'`);
  }
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
  console.log(`Module loaded successfully`);
  console.log(`Has default export: ${typeof extensionModule.default === 'function'}`);
  console.log(`Has main export: ${typeof extensionModule.main === 'function'}`);
  console.log(`Is direct function: ${typeof extensionModule === 'function'}`);
  
  // Test the extension with a mock context
  const registeredGames = [];
  const mockContext = {
    api: {
      getState: () => ({
        session: {
          extensions: {
            installed: {}
          }
        },
        settings: {
          gameMode: {
            discovered: {}
          }
        }
      }),
      store: {
        dispatch: (action) => {
          console.log(`Dispatched action: ${action.type}`);
        }
      },
      sendNotification: (notification) => {
        console.log(`Notification: ${notification.type} - ${notification.message}`);
      },
      showErrorNotification: (title, error) => {
        console.log(`Error notification: ${title} - ${error.message || error}`);
      }
    },
    registerGame: (game) => {
      console.log(`✅ Game registered: ${game.id} (${game.name})`);
      registeredGames.push(game);
    },
    registerGameStub: (game, extInfo) => {
      console.log(`✅ Game stub registered: ${game.id} (${game.name})`);
    },
    once: (callback) => {
      console.log('✅ Once callback registered');
      // Execute immediately for testing
      try {
        callback();
      } catch (err) {
        console.error('❌ Error in once callback:', err.message);
      }
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
    registerGameInfoProvider: () => {},
    registerGameStore: () => {},
    registerGameVersionProvider: () => {},
    registerPreview: () => {},
    registerHistoryStack: () => {},
    registerGameSpecificCollectionsData: () => {}
  };

  // Try to call the extension
  const initFunction = extensionModule.default || extensionModule.main || extensionModule;
  if (typeof initFunction === 'function') {
    console.log('\n🚀 Calling extension init function...');
    initFunction(mockContext);
    console.log(`✅ Extension executed successfully`);
    console.log(`🎮 Games registered: ${registeredGames.length}`);
    registeredGames.forEach(game => {
      console.log(`  - ${game.id}: ${game.name}`);
    });
  } else {
    console.error('❌ Extension does not export a function');
    process.exit(1);
  }
  
} catch (err) {
  console.error('❌ Failed to load extension module:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}

console.log('\n✅ Community extension loading test completed successfully!');