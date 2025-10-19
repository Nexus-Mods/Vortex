#!/usr/bin/env node

/**
 * Script to fix Promise inspection patterns in the Vortex codebase
 * Replaces Bluebird-specific inspection methods with native Promise equivalents
 */

const fs = require('fs');
const path = require('path');

// Function to fix Promise inspection patterns in a file
function fixPromiseInspectionPatterns(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Replace Promise inspection methods
    content = content.replace(/\.isFulfilled\(\)/g, '.status === "fulfilled"');
    content = content.replace(/\.isRejected\(\)/g, '.status === "rejected"');
    content = content.replace(/\.value\(\)/g, '.value');
    content = content.replace(/\.reason\(\)/g, '.reason');
    
    // Write the file if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed Promise inspection patterns in: ${filePath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err.message);
    return false;
  }
}

// Function to recursively find all .ts and .tsx files
function findTSFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          // Skip node_modules directories
          if (file !== 'node_modules') {
            results = results.concat(findTSFiles(fullPath));
          }
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
          results.push(fullPath);
        }
      } catch (err) {
        // Skip files that can't be accessed
        console.warn(`Skipping inaccessible file: ${fullPath}`);
      }
    });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
  return results;
}

// Main execution
function main() {
  const rootDir = process.argv[2] || '.';
  console.log(`Searching for TypeScript files in: ${rootDir}`);
  
  const tsFiles = findTSFiles(rootDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  let fixedFiles = 0;
  tsFiles.forEach(file => {
    if (fixPromiseInspectionPatterns(file)) {
      fixedFiles++;
    }
  });
  
  console.log(`Fixed Promise inspection patterns in ${fixedFiles} files`);
}

main();