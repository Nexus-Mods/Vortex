/**
 * Legacy Extension Shim for Vortex macOS Port
 * 
 * This shim provides compatibility for older community mods that use:
 * - context.registerGame() patterns
 * - context.once() patterns
 * 
 * It acts as a bridge between legacy extension APIs and the current Vortex system.
 */

const path = require('path');
const fs = require('fs-extra');
const { log } = require('vortex-api');

// Registry for legacy extensions
const legacyExtensions = new Map();
const legacyOnceCallbacks = new Map();

/**
 * Scans for legacy extensions in common directories
 */
async function scanForLegacyExtensions() {
  const legacyPaths = [
    path.join(__dirname, '..', 'legacy-mods'),
    path.join(__dirname, '..', 'community-mods'),
    // Add other common legacy extension paths
  ];

  const foundExtensions = [];

  for (const legacyPath of legacyPaths) {
    try {
      if (await fs.pathExists(legacyPath)) {
        const entries = await fs.readdir(legacyPath);
        for (const entry of entries) {
          const entryPath = path.join(legacyPath, entry);
          const stat = await fs.stat(entryPath);
          
          if (stat.isDirectory()) {
            const indexPath = path.join(entryPath, 'index.js');
            const packagePath = path.join(entryPath, 'package.json');
            
            if (await fs.pathExists(indexPath)) {
              foundExtensions.push({
                name: entry,
                path: entryPath,
                indexPath,
                packagePath: await fs.pathExists(packagePath) ? packagePath : null
              });
            }
          }
        }
      }
    } catch (err) {
      log('warn', 'Failed to scan legacy extension path', { path: legacyPath, error: err.message });
    }
  }

  return foundExtensions;
}

/**
 * Creates a legacy context wrapper that provides compatibility APIs
 */
function createLegacyContext(realContext, extensionName) {
  const legacyContext = {
    // Proxy all existing context methods
    ...realContext,
    
    // Override registerGame to handle legacy patterns
    registerGame: (gameDefinition) => {
      log('info', 'Legacy extension registering game', { 
        extension: extensionName, 
        gameId: gameDefinition.id 
      });
      
      // Store the registration for later processing
      legacyExtensions.set(extensionName, {
        type: 'game',
        definition: gameDefinition,
        registered: false
      });
      
      // Call the real registerGame
      return realContext.registerGame(gameDefinition);
    },
    
    // Override once to handle legacy patterns
    once: (callback) => {
      log('info', 'Legacy extension registering once callback', { extension: extensionName });
      
      // Store the callback for later execution
      legacyOnceCallbacks.set(extensionName, callback);
      
      // Call the real once method
      return realContext.once(() => {
        try {
          callback();
          log('debug', 'Legacy once callback executed successfully', { extension: extensionName });
        } catch (err) {
          log('error', 'Legacy once callback failed', { 
            extension: extensionName, 
            error: err.message,
            stack: err.stack 
          });
        }
      });
    },
    
    // Provide legacy API methods that might be missing
    api: {
      ...realContext.api,
      
      // Add any legacy API methods that older extensions might expect
      getState: () => realContext.api.store.getState(),
      
      // Legacy notification methods
      sendNotification: (notification) => {
        return realContext.api.sendNotification(notification);
      },
      
      // Legacy dialog methods  
      showDialog: (type, title, content, actions) => {
        return realContext.api.showDialog(type, title, content, actions);
      }
    }
  };
  
  return legacyContext;
}

/**
 * Loads a legacy extension with compatibility wrapper
 */
async function loadLegacyExtension(extensionInfo, realContext) {
  try {
    log('info', 'Loading legacy extension', { name: extensionInfo.name, path: extensionInfo.path });
    
    // Clear require cache to ensure fresh load
    delete require.cache[require.resolve(extensionInfo.indexPath)];
    
    // Load the extension module
    const extensionModule = require(extensionInfo.indexPath);
    
    // Create legacy context wrapper
    const legacyContext = createLegacyContext(realContext, extensionInfo.name);
    
    // Execute the extension's main function
    if (typeof extensionModule === 'function') {
      // Direct function export
      extensionModule(legacyContext);
    } else if (extensionModule.default && typeof extensionModule.default === 'function') {
      // ES6 default export
      extensionModule.default(legacyContext);
    } else if (extensionModule.main && typeof extensionModule.main === 'function') {
      // Named main export
      extensionModule.main(legacyContext);
    } else {
      log('warn', 'Legacy extension has no recognizable entry point', { 
        name: extensionInfo.name,
        exports: Object.keys(extensionModule)
      });
    }
    
    log('info', 'Legacy extension loaded successfully', { name: extensionInfo.name });
    return true;
    
  } catch (err) {
    log('error', 'Failed to load legacy extension', { 
      name: extensionInfo.name, 
      error: err.message,
      stack: err.stack 
    });
    return false;
  }
}

/**
 * Main extension function for the shim
 */
function main(context) {
  log('info', 'Legacy Extension Shim initializing');
  
  // Register the shim itself
  context.once(async () => {
    try {
      log('info', 'Legacy Extension Shim: Scanning for legacy extensions');
      
      // Scan for legacy extensions
      const legacyExtensions = await scanForLegacyExtensions();
      
      if (legacyExtensions.length === 0) {
        log('info', 'No legacy extensions found');
        return;
      }
      
      log('info', 'Found legacy extensions', { 
        count: legacyExtensions.length,
        extensions: legacyExtensions.map(ext => ext.name)
      });
      
      // Load each legacy extension
      let successCount = 0;
      for (const extensionInfo of legacyExtensions) {
        const success = await loadLegacyExtension(extensionInfo, context);
        if (success) {
          successCount++;
        }
      }
      
      log('info', 'Legacy extension loading complete', { 
        total: legacyExtensions.length,
        successful: successCount,
        failed: legacyExtensions.length - successCount
      });
      
      // Show notification to user about loaded legacy extensions
      if (successCount > 0) {
        context.api.sendNotification({
          type: 'info',
          title: 'Legacy Extensions Loaded',
          message: `Successfully loaded ${successCount} legacy community extension(s)`,
          displayMS: 5000
        });
      }
      
    } catch (err) {
      log('error', 'Legacy Extension Shim failed during initialization', { 
        error: err.message,
        stack: err.stack 
      });
      
      context.api.showErrorNotification('Legacy Extension Shim Error', err, {
        allowReport: false
      });
    }
  });
}

module.exports = {
  default: main
};