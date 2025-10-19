#!/usr/bin/env node

/**
 * Script to fix remaining Bluebird patterns (tap, tapCatch, reflect) in the Vortex codebase
 * Replaces Bluebird-specific patterns with native Promise equivalents
 */

const fs = require('fs');
const path = require('path');

// Define specific replacements for the remaining patterns
const replacements = [
  // tap patterns
  {
    pattern: /\.tap\s*\(\s*\(\)\s*=>\s*\{/g,
    replacement: '.then(() => {'
  },
  {
    pattern: /\.tap\s*\(\s*([^)]+)\s*\)\s*=>\s*\{/g,
    replacement: '.then(($1) => {'
  },
  {
    pattern: /\.tap\s*\(\s*([^)]+)\s*\)/g,
    replacement: '.then($1)'
  },
  // tapCatch patterns
  {
    pattern: /\.tapCatch\s*\(\s*\(\)\s*=>\s*\{/g,
    replacement: '.catch(() => {'
  },
  {
    pattern: /\.tapCatch\s*\(\s*([^)]+)\s*\)\s*=>\s*\{/g,
    replacement: '.catch(($1) => {'
  },
  {
    pattern: /\.tapCatch\s*\(\s*([^)]+)\s*\)/g,
    replacement: '.catch($1)'
  },
  // reflect patterns - these are more complex and need special handling
  {
    pattern: /\.reflect\s*\(\s*\)/g,
    replacement: '.then(value => ({ isFulfilled: true, value })).catch(err => ({ isFulfilled: false, reason: err }))'
  }
];

// Function to fix a single file
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let changesMade = false;

    // Apply each replacement
    replacements.forEach(({ pattern, replacement }) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        changesMade = true;
      }
    });

    if (changesMade) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
    return false;
  }
}

// Function to get all TypeScript and JavaScript files
function getAllSourceFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other build directories
      if (!fullPath.includes('node_modules') && 
          !fullPath.includes('.git') && 
          !fullPath.includes('dist') &&
          !fullPath.includes('build')) {
        files.push(...getAllSourceFiles(fullPath));
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  
  return files;
}

// Main function
function main() {
  console.log('Starting Bluebird remaining patterns fix...');
  
  const srcDir = path.join(__dirname, 'src');
  const extensionsDir = path.join(__dirname, 'extensions');
  
  let fixedCount = 0;
  
  // Process src directory
  if (fs.existsSync(srcDir)) {
    const srcFiles = getAllSourceFiles(srcDir);
    srcFiles.forEach(file => {
      if (fixFile(file)) {
        fixedCount++;
      }
    });
  }
  
  // Process extensions directory
  if (fs.existsSync(extensionsDir)) {
    const extensionFiles = getAllSourceFiles(extensionsDir);
    extensionFiles.forEach(file => {
      if (fixFile(file)) {
        fixedCount++;
      }
    });
  }
  
  console.log(`Fixed ${fixedCount} files.`);
  console.log('Bluebird remaining patterns fix completed.');
}

// Run the script
main();