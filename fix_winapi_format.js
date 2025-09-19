const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// First fix all WinapiFormat.ts files
const winapiFiles = [
  './app/node_modules/vortex-parse-ini/src/WinapiFormat.ts',
  './node_modules/vortex-parse-ini/src/WinapiFormat.ts',
  './extensions/mo-import/node_modules/vortex-parse-ini/src/WinapiFormat.ts',
  './extensions/local-gamesettings/node_modules/vortex-parse-ini/src/WinapiFormat.ts',
  './extensions/test-gameversion/node_modules/vortex-parse-ini/src/WinapiFormat.ts',
  './extensions/gamebryo-test-settings/node_modules/vortex-parse-ini/src/WinapiFormat.ts'
];

winapiFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Fixing ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the import is already there
    if (content.includes('import { isWindows }')) {
      console.log(`  Already fixed: ${filePath}`);
      return;
    }
    
    // Calculate the correct relative path
    const depth = filePath.split('/').length - 1; // Count directory levels
    const apiPath = '../'.repeat(depth - 2) + 'api/lib/util/platform';
    
    // Add the import after the existing imports
    const importLine = `import { isWindows } from '${apiPath}';`;
    
    if (content.includes('import * as winapi from \'winapi-bindings\';')) {
      content = content.replace(
        'import * as winapi from \'winapi-bindings\';',
        `import * as winapi from 'winapi-bindings';\n${importLine}`
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  Fixed: ${filePath}`);
    } else {
      console.log(`  Could not find winapi import in: ${filePath}`);
    }
  } else {
    console.log(`  File not found: ${filePath}`);
  }
});

// Now fix all the extension files with wrong import paths
console.log('\nFixing extension import paths...');

try {
  // Find all files with the wrong import path
  const grepResult = execSync("grep -r \"from '../../../api/lib/util/platform'\" extensions/", { encoding: 'utf8' });
  const lines = grepResult.trim().split('\n');
  
  const filesToFix = new Set();
  lines.forEach(line => {
    const match = line.match(/^([^:]+):/);
    if (match) {
      filesToFix.add(match[1]);
    }
  });
  
  filesToFix.forEach(filePath => {
    console.log(`Fixing import path in: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the incorrect import path with the correct one
    content = content.replace(
      /from '\.\.\/\.\.\/\.\.\/api\/lib\/util\/platform'/g,
      "from '../../../../api/lib/util/platform'"
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Fixed: ${filePath}`);
  });
  
  console.log(`\nFixed ${filesToFix.size} files with incorrect import paths.`);
  
} catch (error) {
  console.log('No files found with incorrect import paths or error occurred:', error.message);
}

console.log('\nAll fixes completed!');