#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pattern to match the problematic platform function definitions
const platformFunctionPattern = /\/\/ Platform detection utilities\nfunction isWindows\(\): boolean \{[\s\S]*?\}\n\nfunction isMacOS\(\): boolean \{[\s\S]*?\}\n\nfunction isLinux\(\): boolean \{[\s\S]*?\}\n\n/;

// Pattern to match the duplicate import and redefinition
const duplicateImportPattern = /const \{ isWindows, isMacOS, isLinux \} = require\('..\/..\/..\/..\/src\/util\/platform'\);\n\/\/ Platform detection utilities\nconst isWindows = \(\) => isWindows\(\);\nconst isMacOS = \(\) => isMacOS\(\);\nconst isLinux = \(\) => isLinux\(\);\nconst platformSwitch = <T>\(cases: \{ windows\?: T; macos\?: T; linux\?: T; default\?: T \}\): T => \{/;

// Pattern to match winapi declaration with duplicate isWindows calls
const winapiPattern = /const winapi = isWindows\(\) \? \(isWindows\(\) \? require\('winapi-bindings'\) : undefined\) : undefined;/;

function fixGameExtension(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Remove the duplicate platform function definitions
  if (platformFunctionPattern.test(content)) {
    content = content.replace(platformFunctionPattern, '');
    modified = true;
    console.log(`  - Removed duplicate platform function definitions`);
  }
  
  // Fix duplicate imports and redefinitions
  if (duplicateImportPattern.test(content)) {
    content = content.replace(duplicateImportPattern, 
                              `const { isWindows, isMacOS, isLinux, platformSwitch } = require('../../../src/util/platform');\n\nconst platformSwitchLocal = (cases) => {`);
    modified = true;
    console.log(`  - Fixed duplicate imports and redefinitions`);
  }
  
  // Fix winapi declaration
  if (winapiPattern.test(content)) {
    content = content.replace(winapiPattern, 
                              `const winapi = isWindows() ? require('winapi-bindings') : undefined;`);
    modified = true;
    console.log(`  - Fixed winapi declaration`);
  }
  
  // Fix TypeScript syntax in platformSwitch function
  const tsTypePattern = /<T>\(cases: \{ windows\?: T; macos\?: T; linux\?: T; default\?: T \}\): T =>/;
  if (tsTypePattern.test(content)) {
    content = content.replace(tsTypePattern, '(cases) =>');
    modified = true;
    console.log(`  - Removed TypeScript syntax from platformSwitch`);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Fixed ${filePath}`);
  } else {
    console.log(`  - No changes needed for ${filePath}`);
  }
}

// Find all game extension files
function findGameExtensionFiles() {
  const gamesDir = '/Users/veland/Downloads/vortex/extensions/games';
  const files = [];
  
  try {
    const gameExtensions = fs.readdirSync(gamesDir, { withFileTypes: true });
    
    for (const dirent of gameExtensions) {
      if (dirent.isDirectory()) {
        const indexPath = path.join(gamesDir, dirent.name, 'index.js');
        if (fs.existsSync(indexPath)) {
          files.push(indexPath);
        }
      }
    }
  } catch (err) {
    console.error('Error reading games directory:', err.message);
  }
  
  return files;
}

const files = findGameExtensionFiles();

console.log(`Found ${files.length} game extension files to check...`);

files.forEach(fixGameExtension);

console.log('\nDone fixing platform imports!');