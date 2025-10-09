/**
 * Extension Compatibility Shim for Vortex
 * 
 * This shim provides compatibility for downloaded extensions that use:
 * - Duplicate isWindows declarations
 * - Browser-specific APIs in Node.js context
 * - Other deprecated patterns
 * 
 * It acts as a bridge between legacy extension patterns and the current Vortex system.
 */

const path = require('path');
const fs = require('fs-extra');
const { log } = require('vortex-api');

// Registry for compatibility fixes
const compatFixes = new Map();

/**
 * Applies compatibility fixes to extension code before loading
 */
function applyCompatibilityFixes(extensionPath, extensionCode) {
  let fixedCode = extensionCode;
  const fixesApplied = [];

  // Fix 1: Remove duplicate isWindows declarations
  const duplicateIsWindowsPattern = /const\s+isWindows\s*=\s*\(\)\s*=>\s*process\.platform\s*===\s*['"]win32['"]\s*;/g;
  if (duplicateIsWindowsPattern.test(fixedCode)) {
    fixedCode = fixedCode.replace(duplicateIsWindowsPattern, '');
    fixesApplied.push('duplicate-iswindows');
    log('debug', 'Applied duplicate isWindows declaration fix', { extensionPath });
  }

  // Fix 2: Replace browser-specific document references with safe checks
  // Only replace actual JavaScript references to document, not occurrences in strings or comments
  if (/\bdocument\b/.test(fixedCode)) {
    // Only apply this fix if we're not in a browser context
    if (typeof process !== 'undefined' && process.type !== 'renderer') {
      // Replace document references but avoid those in string literals and comments
      // This regex avoids replacing document in common string contexts
      fixedCode = fixedCode.replace(/(\bdocument\b)(?![^'"]*['"](?:[^'"]*['"][^'"]*)*$)/g, 
                                   '(typeof document !== "undefined" ? document : undefined)');
      fixesApplied.push('document-reference');
      log('debug', 'Applied document reference fix', { extensionPath });
    }
  }

  // Fix 3: Remove duplicate platform function declarations
  const platformFunctionPattern = /\/\/ Platform detection utilities\nfunction isWindows\(\).*?function isLinux\(\)[\s\S]*?}/g;
  if (platformFunctionPattern.test(fixedCode)) {
    fixedCode = fixedCode.replace(platformFunctionPattern, '');
    fixesApplied.push('platform-functions');
    log('debug', 'Applied platform function declaration fix', { extensionPath });
  }

  // Fix 4: Correct nested winapi declarations
  const nestedWinapiPattern = /const winapi = isWindows\(\) \? \(isWindows\(\) \? require\(['"]winapi-bindings['"]\) : undefined\) : undefined;/g;
  if (nestedWinapiPattern.test(fixedCode)) {
    fixedCode = fixedCode.replace(nestedWinapiPattern, 'const winapi = isWindows() ? require(\'winapi-bindings\') : undefined;');
    fixesApplied.push('nested-winapi');
    log('debug', 'Applied nested winapi declaration fix', { extensionPath });
  }

  return {
    code: fixedCode,
    fixes: fixesApplied
  };
}

/**
 * Loads an extension with compatibility fixes applied
 */
async function loadExtensionWithFixes(extensionInfo, realContext) {
  try {
    log('info', 'Loading extension with compatibility fixes', { 
      name: extensionInfo.name, 
      path: extensionInfo.path 
    });
    
    const indexPath = path.join(extensionInfo.path, 'index.js');
    
    // Check if the extension file exists
    if (!await fs.pathExists(indexPath)) {
      log('warn', 'Extension index file not found', { indexPath });
      return false;
    }
    
    // Read the extension code
    const extensionCode = await fs.readFile(indexPath, 'utf8');
    
    // Apply compatibility fixes
    const { code: fixedCode, fixes } = applyCompatibilityFixes(extensionInfo.path, extensionCode);
    
    if (fixes.length > 0) {
      log('info', 'Applied compatibility fixes to extension', { 
        name: extensionInfo.name, 
        fixes 
      });
    }
    
    // Create a temporary file with the fixed code
    const tempPath = indexPath + '.fixed';
    await fs.writeFile(tempPath, fixedCode, 'utf8');
    
    // Clear require cache to ensure fresh load
    delete require.cache[require.resolve(indexPath)];
    if (require.cache[tempPath]) {
      delete require.cache[tempPath];
    }
    
    // Load the fixed extension module
    const extensionModule = require(tempPath);
    
    // Clean up the temporary file
    try {
      await fs.unlink(tempPath);
    } catch (err) {
      log('debug', 'Failed to clean up temporary file', { tempPath, error: err.message });
    }
    
    // Create context wrapper
    const compatContext = {
      ...realContext,
      // Add any additional compatibility methods here if needed
    };
    
    // Execute the extension's main function
    if (typeof extensionModule === 'function') {
      // Direct function export
      extensionModule(compatContext);
    } else if (extensionModule.default && typeof extensionModule.default === 'function') {
      // ES6 default export
      extensionModule.default(compatContext);
    } else if (extensionModule.main && typeof extensionModule.main === 'function') {
      // Named main export
      extensionModule.main(compatContext);
    } else {
      log('warn', 'Extension has no recognizable entry point', { 
        name: extensionInfo.name,
        exports: Object.keys(extensionModule)
      });
      return false;
    }
    
    log('info', 'Extension loaded successfully with compatibility fixes', { name: extensionInfo.name });
    return true;
    
  } catch (err) {
    log('error', 'Failed to load extension with compatibility fixes', { 
      name: extensionInfo.name, 
      error: err.message,
      stack: err.stack 
    });
    return false;
  }
}

/**
 * Scans for extensions that might need compatibility fixes
 */
async function scanForExtensionsNeedingFixes() {
  const extensionPaths = [
    path.join(__dirname, '..', 'games'), // Game extensions
    // Add other paths where downloaded extensions might be located
  ];

  const extensionsNeedingFixes = [];

  for (const extPath of extensionPaths) {
    try {
      if (await fs.pathExists(extPath)) {
        const entries = await fs.readdir(extPath);
        for (const entry of entries) {
          const entryPath = path.join(extPath, entry);
          const stat = await fs.stat(entryPath);
          
          if (stat.isDirectory()) {
            const indexPath = path.join(entryPath, 'index.js');
            const packagePath = path.join(entryPath, 'package.json');
            
            if (await fs.pathExists(indexPath)) {
              // Check if the extension might need fixes by looking for common patterns
              const code = await fs.readFile(indexPath, 'utf8');
              
              // Look for patterns that indicate the extension might need fixes
              const needsFixes = 
                /const\s+isWindows\s*=\s*\(\)\s*=>\s*process\.platform\s*===\s*['"]win32['"]\s*;/g.test(code) ||
                /\bdocument\b.*?is\s+not\s+defined/g.test(code) ||
                /\/\/ Platform detection utilities\nfunction isWindows\(\)/g.test(code) ||
                /const winapi = isWindows\(\) \? \(isWindows\(\) \? require\(['"]winapi-bindings['"]\)/g.test(code);
              
              if (needsFixes) {
                let extensionName = entry;
                let gameId = null;
                
                // Try to get extension info from package.json
                if (await fs.pathExists(packagePath)) {
                  try {
                    const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
                    extensionName = packageData.name || extensionName;
                    gameId = packageData.vortex?.gameId || null;
                  } catch (err) {
                    log('debug', 'Failed to parse extension package.json', { packagePath, error: err.message });
                  }
                }
                
                extensionsNeedingFixes.push({
                  name: extensionName,
                  path: entryPath,
                  indexPath: indexPath,
                  gameId: gameId,
                  packagePath: packagePath
                });
              }
            }
          }
        }
      }
    } catch (err) {
      log('debug', 'Error scanning for extensions', { path: extPath, error: err.message });
    }
  }

  return extensionsNeedingFixes;
}

/**
 * Main extension function for the compatibility shim
 */
function main(context) {
  log('info', 'Extension Compatibility Shim initializing');
  
  // Register the shim itself
  context.once(async () => {
    try {
      log('info', 'Extension Compatibility Shim: Scanning for extensions needing fixes');
      
      // Scan for extensions that might need compatibility fixes
      const extensionsNeedingFixes = await scanForExtensionsNeedingFixes();
      
      if (extensionsNeedingFixes.length === 0) {
        log('info', 'No extensions found that need compatibility fixes');
        return;
      }
      
      log('info', 'Found extensions needing compatibility fixes', { 
        count: extensionsNeedingFixes.length,
        extensions: extensionsNeedingFixes.map(ext => ext.name)
      });
      
      // Load each extension with compatibility fixes
      let successCount = 0;
      for (const extensionInfo of extensionsNeedingFixes) {
        const success = await loadExtensionWithFixes(extensionInfo, context);
        if (success) {
          successCount++;
        }
      }
      
      log('info', 'Extension loading with compatibility fixes complete', { 
        total: extensionsNeedingFixes.length,
        successful: successCount,
        failed: extensionsNeedingFixes.length - successCount
      });
      
      // Show notification to user about loaded extensions with fixes
      if (successCount > 0) {
        context.api.sendNotification({
          type: 'info',
          title: 'Extensions Loaded with Compatibility Fixes',
          message: `${successCount} extension${successCount !== 1 ? 's' : ''} loaded with compatibility fixes applied`,
          displayMS: 5000
        });
      }
      
    } catch (err) {
      log('error', 'Extension Compatibility Shim failed', { error: err.message });
    }
  });
  
  return true;
}

module.exports = {
  default: main
};