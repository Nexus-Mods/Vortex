#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to fix winapi-bindings imports across all Vortex extensions
 * Makes imports platform-conditional to prevent build errors on non-Windows platforms
 */

// Utility function to check if a platform check function exists
function hasIsWindowsFunction(content) {
  return content.includes('isWindows()') || content.includes('process.platform === \'win32\'');
}

// Add isWindows import if not present
function ensureIsWindowsImport(content, filePath) {
  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  
  if (!hasIsWindowsFunction(content)) {
    // Check if vortex-api import exists
    const vortexApiImportMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]vortex-api['"];?/);
    
    if (vortexApiImportMatch) {
      // Add isWindows to existing vortex-api import
      const imports = vortexApiImportMatch[1];
      if (!imports.includes('isWindows')) {
        const newImports = imports.trim() + ', isWindows';
        content = content.replace(vortexApiImportMatch[0], 
          `import { ${newImports} } from 'vortex-api';`);
      }
    } else {
      // Add new import at the top
      const importStatement = isTypeScript 
        ? "import { isWindows } from 'vortex-api';\n"
        : "const { isWindows } = require('vortex-api');\n";
      
      // Find the best place to insert the import
      const lines = content.split('\n');
      let insertIndex = 0;
      
      // Skip shebang and comments at the top
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#!') || line.startsWith('//') || line.startsWith('/*') || line === '') {
          insertIndex = i + 1;
        } else {
          break;
        }
      }
      
      lines.splice(insertIndex, 0, importStatement.trim());
      content = lines.join('\n');
    }
  }
  
  return content;
}

// Fix direct winapi require/import statements
function fixDirectWinapiImports(content, filePath) {
  const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  
  // Pattern 1: const winapi = require('winapi-bindings');
  content = content.replace(
    /const\s+winapi\s*=\s*require\(['"]winapi-bindings['"]\);?/g,
    "const winapi = isWindows() ? require('winapi-bindings') : undefined;"
  );
  
  // Pattern 2: import * as winapi from 'winapi-bindings';
  content = content.replace(
    /import\s+\*\s+as\s+winapi\s+from\s+['"]winapi-bindings['"];?/g,
    "const winapi = isWindows() ? require('winapi-bindings') : undefined;"
  );
  
  // Pattern 3: import winapi from 'winapi-bindings';
  content = content.replace(
    /import\s+winapi\s+from\s+['"]winapi-bindings['"];?/g,
    "const winapi = isWindows() ? require('winapi-bindings') : undefined;"
  );
  
  return content;
}

// Fix winapi usage to include platform checks
function fixWinapiUsage(content) {
  // Find winapi method calls that aren't already wrapped in platform checks
  const winapiMethodPattern = /(?<!isWindows\(\)\s*&&\s*)(?<!&&\s*)winapi\.\w+\(/g;
  
  let matches = [];
  let match;
  while ((match = winapiMethodPattern.exec(content)) !== null) {
    matches.push({
      index: match.index,
      text: match[0]
    });
  }
  
  // Process matches in reverse order to maintain indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const matchInfo = matches[i];
    const beforeMatch = content.substring(0, matchInfo.index);
    const afterMatch = content.substring(matchInfo.index);
    
    // Check if this is already inside a platform check
    const recentLines = beforeMatch.split('\n').slice(-3).join('\n');
    if (recentLines.includes('isWindows()') || recentLines.includes('process.platform === \'win32\'')) {
      continue;
    }
    
    // Find the full statement/expression
    let parenCount = 0;
    let endIndex = matchInfo.text.length - 1; // Start after the opening paren
    
    for (let j = matchInfo.text.length; j < afterMatch.length; j++) {
      const char = afterMatch[j];
      if (char === '(') parenCount++;
      else if (char === ')') {
        if (parenCount === 0) {
          endIndex = j + 1;
          break;
        }
        parenCount--;
      }
    }
    
    const fullCall = afterMatch.substring(0, endIndex);
    const wrappedCall = `(isWindows() && winapi) ? ${fullCall} : undefined`;
    
    content = beforeMatch + wrappedCall + afterMatch.substring(endIndex);
  }
  
  return content;
}

// Process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Skip if file doesn't contain winapi references
    if (!content.includes('winapi')) {
      return false;
    }
    
    console.log(`Processing: ${filePath}`);
    
    // Ensure isWindows function is available
    content = ensureIsWindowsImport(content, filePath);
    
    // Fix direct imports
    content = fixDirectWinapiImports(content, filePath);
    
    // Fix usage patterns (commented out for now as it's complex and might break code)
    // content = fixWinapiUsage(content);
    
    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ Fixed winapi imports in ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Recursively find all JS/TS files in extensions
function findExtensionFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other build directories
      if (!['node_modules', '.git', 'dist', 'build', 'lib'].includes(entry.name)) {
        findExtensionFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      // Process JS/TS files
      if (/\.(js|ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

// Main execution
function main() {
  const extensionsDir = path.join(__dirname, 'extensions');
  
  if (!fs.existsSync(extensionsDir)) {
    console.error('Extensions directory not found!');
    process.exit(1);
  }
  
  console.log('🔧 Fixing winapi imports across all extensions...\n');
  
  const files = findExtensionFiles(extensionsDir);
  let processedCount = 0;
  let fixedCount = 0;
  
  for (const file of files) {
    processedCount++;
    if (processFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Processed ${processedCount} files, fixed ${fixedCount} files`);
  
  if (fixedCount > 0) {
    console.log('\n📝 Summary of changes made:');
    console.log('  - Added conditional winapi imports: const winapi = isWindows() ? require(\'winapi-bindings\') : undefined;');
    console.log('  - Added isWindows imports where needed');
    console.log('  - Converted direct imports to platform-conditional imports');
    console.log('\n⚠️  Note: You may need to manually review complex winapi usage patterns');
    console.log('   and ensure they are properly wrapped with isWindows() checks.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { processFile, findExtensionFiles };