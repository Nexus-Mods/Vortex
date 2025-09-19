#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find all package.json files in extensions
function findPackageJsonFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      const packageJsonPath = path.join(fullPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        files.push(packageJsonPath);
      }
    }
  }
  
  return files;
}

const extensionsDir = '/Users/veland/Downloads/vortex/extensions';
const packageJsonFiles = findPackageJsonFiles(extensionsDir);

let fixedCount = 0;
let skippedCount = 0;

console.log('Fixing package.json files...');

packageJsonFiles.forEach(packagePath => {
  try {
    const content = fs.readFileSync(packagePath, 'utf8');
    
    // Check if it has the problematic extractInfo command
    if (content.includes('&& extractInfo"') || content.includes('&& extractInfo ')) {
      const packageObj = JSON.parse(content);
      
      if (packageObj.scripts && packageObj.scripts.build) {
        // Fix the build script
        packageObj.scripts.build = packageObj.scripts.build.replace(
          /&& extractInfo\s*$/,
          '&& node ./node_modules/vortex-api/bin/extractInfo.js'
        );
        
        const newContent = JSON.stringify(packageObj, null, 2);
        fs.writeFileSync(packagePath, newContent);
        
        const extensionName = path.basename(path.dirname(packagePath));
        console.log(`Fixed: ${extensionName}/package.json`);
        fixedCount++;
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  } catch (error) {
    console.error(`Error processing ${packagePath}:`, error.message);
    skippedCount++;
  }
});

console.log(`\nSummary:`);
console.log(`Fixed: ${fixedCount} files`);
console.log(`Skipped: ${skippedCount} files`);