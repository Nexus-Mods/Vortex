const path = require('path');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const Bluebird = require('bluebird');

// We need to mock the util object with storeHelper functions
const storeHelper = require('../util/storeHelper');

global.modsInstalled = 0;
global.suppressLogging = false;

// Polyfill for Node.js functions not available in jsdom
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => {
    return setTimeout(() => callback(...args), 0);
  };
}

if (typeof global.clearImmediate === 'undefined') {
  global.clearImmediate = (id) => {
    return clearTimeout(id);
  };
}

function getVortexPath(key) {
  const testBasePath = global.testBasePath || path.join(os.tmpdir(), 'vortex-test-default');
  switch (key) {
    case 'userData':
      return testBasePath;
    case 'temp':
      return path.join(testBasePath, 'temp');
    case 'downloads':
      return global.testDownloadPath || path.join(testBasePath, 'downloads');
    default:
      return testBasePath;
  }
}

function genMd5Hash(filePath, progressFunc) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    const hash = crypto.createHash('md5');
    const stats = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    let totalBytes = 0;

    stream.on('data', (chunk) => {
      hash.update(chunk);
      totalBytes += chunk.length;
      if (progressFunc) {
        progressFunc(totalBytes, stats.size);
      }
    });

    stream.on('end', () => {
      resolve({
        md5sum: hash.digest('hex'),
        numBytes: stats.size
      });
    });

    stream.on('error', reject);
  });
}

// Helper to create mock API methods that extensions commonly use
// Note: These are plain functions, not jest mocks. Tests should wrap them with jest.fn() if needed.
const createMockApiMethods = () => ({
  setStylesheet: (id, stylesheetPath) => {
    // Mock stylesheet registration - does nothing in tests
  },

  addMetaServer: (id, server) => {
    // Mock meta server registration - does nothing in tests
  },

  // UI methods (no-op in tests)
  highlightControl: () => {},
  selectGame: () => Promise.resolve(),
  selectDir: () => Promise.resolve('/mock/path'),

  withPrePost: (eventName, func) => {
    return (...args) => {
      const result = func(...args);
      return result;
    };
  },

  getGames: () => [
    { id: 'stardewvalley', name: 'Stardew Valley' }
  ],

  getGame: (gameId) => {
    return {
      id: gameId || 'stardewvalley',
      name: 'Stardew Valley',
      mergeMods: false,
      modTypes: [],
      supportedTools: [],
      queryModPath: () => '.',
      queryPath: () => undefined,
      executable: () => 'StardewValley.exe',
      setup: () => Promise.resolve(),
      requiredFiles: [],
      environment: {},
      details: {},
      logo: 'gameart.jpg',
      extensionPath: '',
      compatible: {},
      final: true,
      contributed: undefined,
      shell: false,
      parameters: [],
      requiresCleanup: false,
      requiresLauncher: undefined
    };
  },
});

class MockTestAPI {
  constructor(initialState = {}, collectionData = null) {
    // Create a single temporary base directory (platform agnostic)
    this.tempBasePath = path.join(os.tmpdir(), 'vortex-test-' + Date.now());
    this.tempDownloadPath = path.join(this.tempBasePath, 'downloads');
    this.tempInstallPath = path.join(this.tempBasePath, 'installs');

    // Ensure temp directories exist
    if (!fs.existsSync(this.tempBasePath)) {
      fs.mkdirSync(this.tempBasePath, { recursive: true });
    }
    if (!fs.existsSync(this.tempDownloadPath)) {
      fs.mkdirSync(this.tempDownloadPath, { recursive: true });
    }
    if (!fs.existsSync(this.tempInstallPath)) {
      fs.mkdirSync(this.tempInstallPath, { recursive: true });
    }

    // Set global variables for mocked selectors and getVortexPath
    global.testBasePath = this.tempBasePath;
    global.testDownloadPath = this.tempDownloadPath;
    global.testInstallPath = this.tempInstallPath;

    // Initialize state with defaults or provided state
    this.state = {
      app: {
        instanceId: initialState.app?.instanceId || 'test-instance-' + Date.now()
      },
      persistent: {
        profiles: initialState.persistent?.profiles || {},
        mods: initialState.persistent?.mods || {},
        downloads: {
          files: initialState.persistent?.downloads?.files || {},
          ...initialState.persistent?.downloads
        },
        nexus: initialState.persistent?.nexus || {},
        collections: initialState.persistent?.collections || {},
        settings: {
          downloads: {
            path: this.tempDownloadPath,
            collectionsInstallWhileDownloading: true,
            ...initialState.persistent?.settings?.downloads
          },
          mods: {
            installPath: this.tempInstallPath,
            ...initialState.persistent?.settings?.mods
          },
          automation: {
            install: true,
            ...initialState.persistent?.settings?.automation
          }
        }
      },
      confidential: {
        account: {
          nexus: {
            APIKey: process.env.NEXUS_API_KEY,
            ...initialState.confidential?.account?.nexus
          }
        },
        ...initialState.confidential
      },
      session: {
        base: {
          gameMode: collectionData?.info?.domainName || 'stardewvalley',
          activity: {},
          ...initialState.session?.base
        },
        gameMode: {
          known: [],
          ...initialState.session?.gameMode
        },
        collections: {
          installSession: {},
          ...initialState.session?.collections
        }
      },
      settings: initialState.settings || {}
    };

    this.collectionData = collectionData;
    this.eventListeners = new Map();
    this.events = {
      emit: (event, ...args) => {
        if (event === 'get-download-free-slots' && typeof args[0] === 'function') {
          args[0](5); // Mock 5 free download slots
          return;
        }

        // Handle deploy-mods event with callback
        if (event === 'deploy-mods' && typeof args[0] === 'function') {
          // Call the callback immediately to simulate instant deployment
          setImmediate(() => args[0](null)); // Call with no error
          return;
        }

        // Call any registered listeners for this event
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            console.error(`❌ Error in event listener for ${event}:`, error.message);
          }
        });

        return true;
      },
      on: (event, listener) => {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
      }
    };

    // Create store with dispatch
    this.registeredReducers = {};

    this.store = {
      getState: () => this.state,
      dispatch: (action) => {
        if (typeof action === 'function') {
          try {
            const result = action(this.store.dispatch);
            if (result && typeof result.then === 'function') {
              setTimeout(() => {
                // Auto-resolve dialog after a tiny delay to simulate user interaction
              }, 1);

              return Promise.resolve({
                action: 'Install',
                input: {
                  remember: false,
                  variant: '',
                  replace: false,
                  password: ''
                }
              });
            }

            return result;
          } catch (error) {
            console.error(`❌ Error executing thunk:`, error.message);
            return Promise.resolve({
              action: 'Install',
              input: {
                remember: false,
                variant: '',
                replace: false,
                password: ''
              }
            });
          }
        }

        if (action.type === 'BATCHED_ACTIONS' || (Array.isArray(action.payload) && action.payload.length > 0 && action.payload[0].type)) {
          const actions = action.payload || [];
          actions.forEach(batchedAction => {
            this.store.dispatch(batchedAction);
          });
          return;
        }

        if (action.type === 'INIT_DOWNLOAD') {
          const { id, urls, modInfo, games } = action.payload;
          if (!this.state.persistent.downloads.files[id]) {
            this.state.persistent.downloads.files[id] = {
              id,
              state: 'init',
              game: games,
              urls: urls || [],
              modInfo: modInfo || {},
              fileTime: Date.now(),
              size: 0,
              received: 0,
              localPath: '',
              chunks: []
            };
          }
        }

        if (action.type === 'SET_DOWNLOAD_HASH_BY_FILE') {
          const { fileName, fileMD5, fileSize } = action.payload;
          const downloadId = Object.keys(this.state.persistent.downloads.files).find(
            id => this.state.persistent.downloads.files[id].localPath === fileName
          );
          if (downloadId) {
            this.state.persistent.downloads.files[downloadId].fileMD5 = fileMD5;
            this.state.persistent.downloads.files[downloadId].size = fileSize;
          }
        }

        if (action.type === 'SET_DOWNLOAD_FILEPATH') {
          const { id, filePath } = action.payload;
          if (this.state.persistent.downloads.files[id]) {
            this.state.persistent.downloads.files[id].localPath = filePath;
          }
        }

        if (action.type === 'FINISH_DOWNLOAD') {
          const { id, state: downloadState } = action.payload;
          if (this.state.persistent.downloads.files[id]) {
            this.state.persistent.downloads.files[id].state = downloadState;
          }
        }

        if (action.type === 'SHOW_MODAL_DIALOG') {
          return Promise.resolve();
        }

        if (action.type && action.type.includes('DIALOG') ||
            action.type && action.type.includes('SHOW') ||
            (action.payload && typeof action.payload === 'object' &&
             (action.payload.title === 'Install Dependencies' || action.payload.type === 'question'))) {
          return Promise.resolve({
            action: 'Install',
            input: {
              remember: false,
              variant: '',
              replace: false,
              password: ''
            }
          });
        }

        Object.entries(this.registeredReducers).forEach(([statePath, reducerSpec]) => {
          try {
            const pathParts = statePath.split('.');
            let current = this.state;
            for (const part of pathParts.slice(0, -1)) {
              current = current[part];
            }
            const lastPart = pathParts[pathParts.length - 1];
            const oldState = current[lastPart];
            let newState = oldState;
            if (reducerSpec.reducers) {
              Object.entries(reducerSpec.reducers).forEach(([key, reducerFn]) => {
                try {
                  let matches = false;
                  if (typeof key === 'function' && key.getType) {
                    matches = key.getType() === action.type;
                  } else if (typeof key === 'string') {
                    matches = key === action.type;
                  } else if (key.toString) {
                    matches = key.toString() === action.type;
                  }

                  if (matches) {
                    newState = reducerFn(newState, action.payload);
                  }
                } catch (err) {
                  // noop
                }
              });
            }

            // Update state if changed
            if (newState !== oldState) {
              current[lastPart] = newState;
            }
          } catch (err) {
            // Ignore reducer errors
          }
        });

        return Promise.resolve();
      }
    };

    // Extension API
    this.ext = {
      ensureLoggedIn: () => Promise.resolve(true)
    };

    // Create storage for async event handlers
    this.asyncEventHandlers = new Map();

    // Event registration methods
    this.onAsync = (eventName, handler) => {
      if (!this.asyncEventHandlers.has(eventName)) {
        this.asyncEventHandlers.set(eventName, []);
      }
      this.asyncEventHandlers.get(eventName).push(handler);
      return Promise.resolve();
    };

    this.on = (eventName, handler) => {
      // Silent registration
    };

    this.off = (eventName, handler) => {
      // Silent unregistration
    };

    // State change subscription
    this.onStateChange = (path, callback) => {
      return () => {}; // Return unsubscribe function
    };

    // State access
    this.getState = () => this.state;

    // Translation
    this.translate = (text, options) => {
      if (options && options.replace) {
        let result = text;
        Object.keys(options.replace).forEach(key => {
          result = result.replace(`{{${key}}}`, options.replace[key]);
        });
        return result;
      }
      return text;
    };

    // Game methods
    this.getGames = () => {
      return Object.keys(this.state.session.gameMode.known || {}).map(gameId => ({
        id: gameId,
        name: this.state.session.gameMode.known[gameId].name || gameId
      }));
    };

    this.getGame = (gameId) => {
      const games = this.state.session.gameMode.known || {};
      if (gameId && games[gameId]) {
        return {
          id: gameId,
          name: games[gameId].name || gameId,
          mergeMods: false,
          supportedTools: []
        };
      }
      // Default to first game or Stardew Valley
      return {
        id: this.collectionData?.info?.domainName || 'stardewvalley',
        name: 'Stardew Valley',
        mergeMods: false,
        supportedTools: []
      };
    };

    // Import common API methods
    const apiMethods = createMockApiMethods();
    this.withPrePost = apiMethods.withPrePost;
    this.highlightControl = apiMethods.highlightControl;
    this.selectGame = apiMethods.selectGame;
    this.setStylesheet = apiMethods.setStylesheet;
    this.addMetaServer = apiMethods.addMetaServer;
    this.selectDir = () => Promise.resolve(this.tempDownloadPath);

    // Utilities
    this.util = {
      installPath: () => this.tempInstallPath,
      getGame: () => this.getGame(),
      getSafe: (obj, path, defaultValue) => {
        let current = obj;
        for (const key of path) {
          if (current && typeof current === 'object' && key in current) {
            current = current[key];
          } else {
            return defaultValue;
          }
        }
        return current !== undefined ? current : defaultValue;
      }
    };

    // Extension registration
    this.registeredGames = {};
    this.registeredInstallers = [];

    this.registerGame = (game) => {
      this.registeredGames[game.id] = game;

      if (!this.state.session.gameMode.known) {
        this.state.session.gameMode.known = [];
      }

      // Convert game to IGameStored format
      const gameStored = {
        id: game.id,
        name: game.name,
        logo: game.logo,
        executable: game.executable,
        extensionPath: game.extensionPath,
        imageURL: game.imageURL,
        mergeArchive: !!game.mergeArchive,
        mergeMods: !!game.mergeMods,
        requiredFiles: game.requiredFiles || [],
        setup: game.setup,
        shell: !!game.shell,
        shortName: game.shortName,
        supportedTools: game.supportedTools || [],
        queryModPath: game.queryModPath,
        queryPath: game.queryPath,
        details: game.details || {},
        contributed: game.contributed,
        final: !!game.final
      };

      const existingIndex = this.state.session.gameMode.known.findIndex(g => g.id === game.id);
      if (existingIndex >= 0) {
        this.state.session.gameMode.known[existingIndex] = gameStored;
      } else {
        this.state.session.gameMode.known.push(gameStored);
      }
    };

    this.registerInstaller = (id, priority, testSupported, install) => {
      this.registeredInstallers.push({ id, priority, testSupported, install });
    };

    this.registerTool = (tool) => {
      // Silent registration
    };

    this.registerReducer = (reducers) => {
      Object.entries(reducers).forEach(([path, reducer]) => {
        this.registeredReducers[path] = reducer;
      });
    };

    this.registerSettings = (title, element, props) => {
      // Silent registration
    };

    this.registerAction = (group, position, iconOrComponent, options, titleOrAction) => {
      // Silent registration
    };

    this.registerAttributeExtractor = (priority, extractor) => {
      // Silent registration
    };

    this.registerModType = (typeId, priority, isSupported, getPath, test, options) => {
      // Silent registration
    };

    this.registerAPI = (id, api, options) => {
      // Silent registration
    };

    this.registerTableAttribute = (gameId, attributeId, options) => {
      // Silent registration
    };

    this.registerTest = (id, test) => {
      // Silent registration
    };

    // Protocol handlers
    this.protocolHandlers = {};

    this.registerProtocol = (protocol, def, callback) => {
      this.protocolHandlers[protocol] = callback;
      return true;
    };

    this.deregisterProtocol = (protocol) => {
      delete this.protocolHandlers[protocol];
    };

    // MD5 hash generation
    this.genMd5Hash = (filePath, progressCB) => {
      const hash = crypto.createHash('md5');
      hash.update(filePath + Date.now());
      const md5sum = hash.digest('hex');

      let numBytes = 0;
      try {
        const stats = fs.statSync(filePath);
        numBytes = stats.size;

        if (progressCB) {
          progressCB(numBytes / 2, numBytes);
          progressCB(numBytes, numBytes);
        }
      } catch (err) {
        // File not found or error - return 0 bytes
      }

      return Promise.resolve({ md5sum, numBytes });
    };

    // Emit and await async events
    this.emitAndAwait = async (event, ...args) => {
      const handlers = this.asyncEventHandlers.get(event) || [];
      if (handlers.length > 0) {
        const results = await Promise.all(handlers.map(handler => {
          try {
            return handler(...args);
          } catch (error) {
            console.error(`  ❌ Handler error for ${event}:`, error.message);
            return { error };
          }
        }));
        return results;
      }
      return [];
    };

    // Once callback
    this.once = (callbackOrEvent, handler) => {
      if (typeof callbackOrEvent === 'function') {
        try {
          callbackOrEvent();
        } catch (err) {
          console.error(`❌ Error in once callback:`, err.message);
        }
      }
    };

    // Mod metadata lookup
    this.lookupModMeta = (details) => {
      if (!details.fileMD5 && !details.filePath) {
        return Bluebird.resolve([]);
      }

      if (details.fileSize === 0) {
        return Bluebird.resolve([]);
      }

      const targetMD5 = details.fileMD5;
      if (!targetMD5 || !this.collectionData) {
        return Bluebird.resolve([]);
      }

      const matchingMod = this.collectionData.mods.find(mod =>
        mod.source && mod.source.md5 === targetMD5
      );

      if (matchingMod) {
        const lookupResult = {
          key: {
            fileMD5: targetMD5,
            fileSize: details.fileSize,
            gameId: details.gameId || 'stardewvalley'
          },
          value: {
            details: {
              name: matchingMod.name,
              version: matchingMod.source?.version || '1.0.0',
              nexus: {
                modId: matchingMod.source?.modId?.toString(),
                fileId: matchingMod.source?.fileId?.toString()
              }
            },
            gameId: details.gameId || 'stardewvalley',
            source: 'nexus',
            logicalFileName: matchingMod.source?.logicalFilename || `${matchingMod.name}.zip`,
            fileName: matchingMod.source?.logicalFilename || `${matchingMod.name}.zip`,
            fileMD5: targetMD5,
            fileSize: details.fileSize,
            nexus: {
              modId: matchingMod.source?.modId,
              fileId: matchingMod.source?.fileId
            },
            name: matchingMod.name,
            version: matchingMod.source?.version || '1.0.0'
          }
        };

        return Bluebird.resolve([lookupResult]);
      } else {
        return Bluebird.resolve([]);
      }
    };

    // Enhanced mod lookup using reference metadata
    this.lookupModReference = async (reference, options) => {
      if (!reference || (!reference.id && !reference.logicalFileName)) {
        return [];
      }

      if (!this.collectionData) {
        return [];
      }

      try {
        const matchingMod = this.collectionData.mods.find(mod =>
          mod.source && (
            mod.source.md5 === reference.archiveId ||
            (mod.source.modId?.toString() === reference.id?.toString() &&
             mod.source.fileId?.toString() === reference.fileId?.toString())
          )
        );

        if (matchingMod && matchingMod.source) {
          const gameId = reference.gameId || 'stardewvalley';
          const modId = matchingMod.source?.modId;
          const fileId = matchingMod.source?.fileId;

          const nxmUrl = `nxm://${gameId}/mods/${modId}/files/${fileId}`;

          const lookupResult = {
            key: {
              fileMD5: matchingMod.source.md5,
              fileSize: reference.fileSizeBytes || matchingMod.source.fileSize || 0,
              gameId: gameId
            },
            value: {
              details: {
                name: matchingMod.name,
                version: matchingMod.source?.version || '1.0.0',
                modId: modId?.toString(),
                fileId: fileId?.toString(),
                nexus: {
                  modId: modId?.toString(),
                  fileId: fileId?.toString()
                }
              },
              gameId: gameId,
              domainName: gameId,
              source: 'nexus',
              sourceURI: nxmUrl,
              logicalFileName: reference.logicalFileName || matchingMod.source?.logicalFilename || `${matchingMod.name}.zip`,
              fileName: reference.logicalFileName || matchingMod.source?.logicalFilename || `${matchingMod.name}.zip`,
              fileMD5: matchingMod.source.md5,
              fileSize: reference.fileSizeBytes || matchingMod.source.fileSize || 0,
              fileSizeBytes: reference.fileSizeBytes || matchingMod.source.fileSize || 0,
              nexus: {
                modId: modId,
                fileId: fileId,
                ids: {
                  modId: modId,
                  fileId: fileId,
                  gameId: gameId
                }
              },
              name: matchingMod.name,
              version: matchingMod.source?.version || '1.0.0'
            }
          };

          return [lookupResult];
        }

        return [];

      } catch (error) {
        console.warn(`  ⚠️ Mod reference lookup failed: ${error.message}`);
        return [];
      }
    };

    // Extension context
    this.extensionContext = {
      api: this,
      once: this.once,
      registerGame: this.registerGame,
      registerInstaller: this.registerInstaller,
      registerTool: this.registerTool,
      registerReducer: this.registerReducer,
      registerSettings: this.registerSettings,
      registerAction: this.registerAction,
      registerAttributeExtractor: this.registerAttributeExtractor,
      registerModType: this.registerModType,
      registerAPI: this.registerAPI,
      registerTableAttribute: this.registerTableAttribute,
      registerTest: this.registerTest,
      optional: {
        registerGame: this.registerGame,
        registerInstaller: this.registerInstaller,
        registerTool: this.registerTool,
        registerReducer: this.registerReducer,
        registerSettings: this.registerSettings,
        registerAction: this.registerAction,
        registerAttributeExtractor: this.registerAttributeExtractor,
        registerModType: this.registerModType,
        registerAPI: this.registerAPI,
        registerTableAttribute: this.registerTableAttribute,
        registerTest: this.registerTest
      }
    };

    // Selectors
    this.selectors = {
      downloadPathForGame: (state, gameId) => {
        return this.tempDownloadPath;
      },
      activeGameId: (state) => {
        return this.state.settings.gameMode?.current || this.collectionData?.info?.domainName || 'stardewvalley';
      },
    };

    // Notification methods
    this.showErrorNotification = (title, message, details) => {
      // Suppress error notifications after tests complete
      if (!global.suppressLogging) {
        console.error(`❌ Error: ${title} - ${message}`, details);
        if (message && message.stack) {
          console.error(`   📋 Stack trace:`, message.stack);
        }
      }
      return Promise.resolve();
    };

    this.showActivity = (message, id) => {
      return Promise.resolve();
    };

    this.dismissNotification = (id) => {
      return Promise.resolve();
    };

    this.sendNotification = (notification) => {
      return Promise.resolve();
    };

    this.showDialog = (type, title, content, actions) => {
      let result;
      if (title === 'Downloads Folder invalid') {
        result = {
          action: 'Reinit',
          input: {}
        };
      } else if (title === 'Confirm' && content?.text?.includes('not marked as a downloads folder')) {
        result = {
          action: 'Continue',
          input: {}
        };
      } else {
        result = {
          action: 'Install',
          input: {
            remember: false,
            variant: '',
            replace: false,
            password: ''
          }
        };
      }

      return Promise.resolve(result);
    };
  }

  // Cleanup method
  cleanup() {
    try {
      if (fs.existsSync(this.tempBasePath)) {
        fs.rmSync(this.tempBasePath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean up temp directory:', error.message);
    }
  }
}

// Mock the entire vortex-api module
const vortexApi = {
  util: {
    setSafe: storeHelper.setSafe,
    deleteOrNop: storeHelper.deleteOrNop,
    getSafe: storeHelper.getSafe,
    removeValue: storeHelper.removeValue,
    pushSafe: storeHelper.pushSafe,
    merge: storeHelper.merge,
    setOrNop: storeHelper.setOrNop,
    updateOrNop: storeHelper.updateOrNop,
    batchDispatch: () => {},
    bytesToString: (bytes) => `${bytes} bytes`,
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    makeQueue: () => ({ push: () => {}, length: 0 }),
    toPromise: (value) => Promise.resolve(value),
    unique: (arr) => [...new Set(arr)],
    sanitizeFilename: (name) => name.replace(/[<>:"/\\|?*]/g, '_'),
    isChildPath: () => false,
    isFilenameValid: () => true,
    isPathValid: () => true,
    deBOM: (input) => {
      if (typeof input === 'string' && input.charCodeAt(0) === 0xFEFF) {
        return input.slice(1);
      }
      return input;
    },
    lazyRequire: (getModule) => {
      // Lazy require - delays loading until first access
      let cached = null;
      return new Proxy({}, {
        get: (target, prop) => {
          if (cached === null) {
            cached = getModule();
          }
          return cached[prop];
        }
      });
    },
  },
  actions: {},
  types: {},
  fs: {
    writeFileAtomic: async () => {},
    copyFileAtomic: async () => {},
    readFileAsync: async (filePath, options) => {
      const fs = require('fs').promises;
      return fs.readFile(filePath, options);
    },
    statAsync: async (filePath) => {
      const fs = require('fs').promises;
      return fs.stat(filePath);
    },
    readFileSync: (filePath, options) => {
      const fs = require('fs');
      try {
        return fs.readFileSync(filePath, options);
      } catch (err) {
        return options?.encoding ? '' : Buffer.alloc(0);
      }
    },
    readdirSync: (dirPath) => {
      const fs = require('fs');
      try {
        return fs.readdirSync(dirPath);
      } catch (err) {
        return [];
      }
    },
    existsSync: (filePath) => {
      const fs = require('fs');
      return fs.existsSync(filePath);
    },
  },
  log: (level, message, meta) => {
    // Suppress logging after tests complete to avoid Jest warnings
    if (!global.suppressLogging) {
      // Use console.error for error level logs, console.log for others
      const logFn = level === 'error' ? console.error : console.log;
      logFn(`[${level}] ${message}`, meta || '');

      // Debug: Show what we're checking for installation messages
      if (message.includes('Installation') || message.includes('install')) {
        console.log(`🔍 Message check: "${message}", exact match: ${message === 'Installation completed successfully'}, has meta: ${!!meta}, has modId: ${!!(meta && meta.modId)}, current count: ${global.modsInstalled || 0}`);
      }
    }

    // Increment counter when installation completes successfully
    if (message === 'Installation completed successfully' && meta && meta.modId) {
      global.modsInstalled = (global.modsInstalled || 0) + 1;
      if (!global.suppressLogging) {
        console.log(`✅ Incremented modsInstalled to ${global.modsInstalled} for mod ${meta.modId}`);
      }
    }
  },
  selectors: {
    installPathForGame: (state, gameId) => {
      return global.testInstallPath || '/tmp/vortex-test/installs';
    },
    downloadPathForGame: (state, gameId) => {
      return global.testDownloadPath || '/tmp/vortex-test/downloads';
    },
    activeGameId: (state) => 'stardewvalley',
    activeProfile: (state) => ({
      gameId: 'stardewvalley',
      id: 'default',
      modState: {},
      name: 'Default'
    }),
    currentProfile: (state) => {
      const profiles = state?.persistent?.profiles || {};
      return Object.values(profiles)[0] || { id: 'default', gameId: 'stardewvalley' };
    },
    profileById: (state, profileId) => {
      return state?.persistent?.profiles?.[profileId] || {
        gameId: 'stardewvalley',
        id: profileId,
        modState: {},
        name: 'Default'
      };
    },
    gameProfiles: (state) => ({}),
    discoveryByGame: (state, gameId) => ({
      path: 'C:/Program Files/Stardew Valley',
      tools: {},
      store: 'steam'
    }),
    gameName: (state, gameId) => 'Stardew Valley',
    knownGames: (state) => {
      if (state?.session?.gameMode?.known) {
        return state.session.gameMode.known;
      }
      return [{
        id: 'stardewvalley',
        name: 'Stardew Valley',
        executable: () => 'StardewValley.exe',
        queryPath: () => 'StardewValley',
        queryModPath: () => 'Mods',
        logo: 'gameart.jpg'
      }];
    },
    lastActiveProfileForGame: (state, gameId) => 'default',
    // Collection selectors
    getCollectionInstallProgress: (state) => {
      const session = state?.session?.collections?.activeSession;
      if (!session) {
        return null;
      }

      const totalRequired = session.totalRequired || 25;
      const totalOptional = session.totalOptional || 0;
      const downloadedCount = session.downloadedCount || 0;
      const installedCount = session.installedCount || global.modsInstalled || 0;
      const failedCount = session.failedCount || 0;
      const skippedCount = session.skippedCount || 0;

      const downloadProgress = totalRequired > 0
        ? Math.round((downloadedCount / totalRequired) * 100)
        : 0;

      const installProgress = totalRequired > 0
        ? Math.round((installedCount / totalRequired) * 100)
        : 0;

      // isComplete is true ONLY when compatibility info has been added (debug log emitted)
      const isComplete = global.modsInstalled >= totalRequired;

      // Suppress logging once installation is complete to avoid Jest warnings about logging after tests
      if (isComplete && !global.suppressLogging) {
        global.suppressLogging = true;
      }

      return {
        totalRequired,
        totalOptional,
        downloadedCount,
        installedCount,
        failedCount,
        skippedCount,
        downloadProgress,
        installProgress,
        isComplete,
      };
    },
    getCollectionModByReference: (state, searchParams) => {
      const session = state?.session?.collections?.activeSession;
      if (!session || !session.mods) {
        return undefined;
      }

      const mods = session.mods;

      // First try to find by modId if provided (most direct match)
      if (searchParams.modId) {
        const byModId = Object.values(mods).find(mod => mod.modId === searchParams.modId);
        if (byModId) return byModId;
      }

      // Fall back to searching by rule reference fields
      return Object.values(mods).find(mod => {
        const ref = mod.rule?.reference;
        if (!ref) return false;

        // Check each available identifier
        if (searchParams.tag && ref.tag === searchParams.tag) return true;
        if (searchParams.fileMD5 && ref.fileMD5 === searchParams.fileMD5) return true;
        if (searchParams.fileId && ref.fileId === searchParams.fileId) return true;
        if (searchParams.logicalFileName && ref.logicalFileName === searchParams.logicalFileName) return true;

        return false;
      });
    },
    getCollectionActiveSessionMods: (state) => {
      const session = state?.session?.collections?.activeSession;
      return session?.mods || {};
    },
  },
  genMd5Hash,
  createMockApiMethods,
  getVortexPath,
  // Export the MockTestAPI class for tests to use
  MockTestAPI,
};

module.exports = vortexApi;
