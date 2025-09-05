// Proper test for pattern matcher functionality
const fs = require('fs');
const path = require('path');

// Copy the exact implementation from patternMatcher.ts
function globToRegex(pattern) {
  // Escape special regex characters
  const escapedPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special characters
    .replace(/\?/g, '.')                   // Convert ? to .
    .replace(/\*\*/g, '.*')                // Convert ** to .*
    .replace(/\*/g, '[^/]*');              // Convert * to [^/]*

  // Ensure the pattern matches the entire path
  return new RegExp(`^${escapedPattern}$`);
}

function matchPattern(filePath, pattern) {
  const regex = globToRegex(pattern);
  return regex.test(filePath);
}

function findFiles(dir, pattern) {
  const results = [];
  
  function walk(currentDir) {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          walk(fullPath);
        } else if (item.isFile() && matchPattern(fullPath, pattern)) {
          results.push(fullPath);
        }
      }
    } catch (err) {
      // Handle permission errors or other issues
      console.warn(`Could not read directory: ${currentDir}`, err);
    }
  }
  
  walk(dir);
  return results;
}

// Test the functions
console.log('Testing pattern matcher functions...');

console.log('\n1. Testing globToRegex function:');
console.log('globToRegex("*.js"):', globToRegex('*.js'));
console.log('globToRegex("**/*.ts"):', globToRegex('**/*.ts'));

console.log('\n2. Testing matchPattern function:');
console.log('matchPattern("test.js", "*.js"):', matchPattern('test.js', '*.js'));
console.log('matchPattern("test.txt", "*.js"):', matchPattern('test.txt', '*.js'));
console.log('matchPattern("src/test.ts", "**/*.ts"):', matchPattern('src/test.ts', '**/*.ts'));
console.log('matchPattern("src/util/test.ts", "**/*.ts"):', matchPattern('src/util/test.ts', '**/*.ts'));

console.log('\n3. Testing findFiles function:');
try {
  const jsFiles = findFiles('.', '*.js');
  console.log(`Found ${jsFiles.length} .js files in current directory`);
  jsFiles.slice(0, 3).forEach(file => console.log(`  ${file}`));
} catch (error) {
  console.error('Error finding .js files:', error.message);
}

try {
  const mdFiles = findFiles('.', '*.md');
  console.log(`Found ${mdFiles.length} .md files in current directory`);
  mdFiles.slice(0, 3).forEach(file => console.log(`  ${file}`));
} catch (error) {
  console.error('Error finding .md files:', error.message);
}

console.log('\n✅ All pattern matcher tests completed!');