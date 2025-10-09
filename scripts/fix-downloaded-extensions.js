#!/usr/bin/env node

/**
 * Script to automatically fix downloaded extensions with deprecated patterns
 * This script can be run during the build process or manually to fix extensions
 * Note: This only targets user-downloaded extensions, not bundled plugins which should be fixed manually
 */

const fs = require('fs').promises;
const path = require('path');
const { isWindows } = require('../src/util/platform');

async function fixExtensionFile(filePath) {
  try {
    // Read the file
    const content = await fs.readFile(filePath, 'utf8');
    
    // Apply fixes
    let fixedContent = content;
    const fixesApplied = [];
    
    // Fix 1: Remove duplicate isWindows declarations
    const duplicateIsWindowsPattern = /const\s+isWindows\s*=\s*\(\)\s*=>\s*process\.platform\s*===\s*['"]win32['"]\s*;/g;
    if (duplicateIsWindowsPattern.test(fixedContent)) {
      fixedContent = fixedContent.replace(duplicateIsWindowsPattern, '');
      fixesApplied.push('duplicate-iswindows');
    }
    
    // Fix 2: Remove duplicate platform function declarations
    const platformFunctionPattern = /\/\/ Platform detection utilities\nfunction isWindows\(\).*?function isLinux\(\)[\s\S]*?}/g;
    if (platformFunctionPattern.test(fixedContent)) {
      fixedContent = fixedContent.replace(platformFunctionPattern, '');
      fixesApplied.push('platform-functions');
    }
    
    // Fix 3: Correct nested winapi declarations
    const nestedWinapiPattern = /const winapi = isWindows\(\) \? \(isWindows\(\) \? require\(['"]winapi-bindings['"]\) : undefined\) : undefined;/g;
    if (nestedWinapiPattern.test(fixedContent)) {
      fixedContent = fixedContent.replace(nestedWinapiPattern, 'const winapi = isWindows() ? require(\'winapi-bindings\') : undefined;');
      fixesApplied.push('nested-winapi');
    }
    
    // Fix 4: Wrap document references in safe checks (for Node.js context)
    const documentPattern = /\bdocument\b/g;
    if (documentPattern.test(fixedContent) && typeof process !== 'undefined' && process.type !== 'renderer') {
      fixedContent = fixedContent.replace(documentPattern, '(typeof document !== "undefined" ? document : undefined)');
      fixesApplied.push('document-reference');
    }
    
    // If any fixes were applied, write the fixed content back to the file
    if (fixesApplied.length > 0) {
      await fs.writeFile(filePath, fixedContent, 'utf8');
      console.log(`Applied fixes to ${filePath}: ${fixesApplied.join(', ')}`);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`Failed to fix ${filePath}: ${err.message}`);
    return false;
  }
}

async function scanAndFixExtensions(extensionsDir) {
  try {
    const entries = await fs.readdir(extensionsDir);
    let fixedCount = 0;
    
    for (const entry of entries) {
      const entryPath = path.join(extensionsDir, entry);
      const stat = await fs.stat(entryPath);
      
      if (stat.isDirectory()) {
        const indexPath = path.join(entryPath, 'index.js');
        
        if (await fs.access(indexPath).then(() => true).catch(() => false)) {
          const fixed = await fixExtensionFile(indexPath);
          if (fixed) {
            fixedCount++;
          }
        }
      }
    }
    
    console.log(`Fixed ${fixedCount} extensions in ${extensionsDir}`);
    return fixedCount;
  } catch (err) {
    console.error(`Failed to scan extensions directory ${extensionsDir}: ${err.message}`);
    return 0;
  }
}

async function main() {
  // Only target user-downloaded extensions, not bundled plugins
  const extensionsDirs = [
    path.join(__dirname, '..', 'extensions', 'plugins')
    // Note: We exclude bundled plugins as those should be fixed manually in the source
  ];
  
  let totalFixed = 0;
  
  for (const extensionsDir of extensionsDirs) {
    try {
      if (await fs.access(extensionsDir).then(() => true).catch(() => false)) {
        const fixed = await scanAndFixExtensions(extensionsDir);
        totalFixed += fixed;
      }
    } catch (err) {
      console.error(`Error processing ${extensionsDir}: ${err.message}`);
    }
  }
  
  console.log(`Total downloaded extensions fixed: ${totalFixed}`);
  
  // If running in a development environment, also run the compatibility shim
  if (process.env.NODE_ENV === 'development') {
    console.log('Development environment detected - compatibility shim will handle runtime fixes');
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
}

module.exports = {
  fixExtensionFile,
  scanAndFixExtensions,
  main
};