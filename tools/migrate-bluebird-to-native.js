#!/usr/bin/env node

/**
 * Bluebird to Native Promise Migration Script
 * 
 * This script helps migrate the Vortex codebase from Bluebird Promises to native Node.js Promises.
 * Node 22 has excellent Promise support, making Bluebird largely redundant.
 * 
 * Migration Strategy:
 * 1. Replace Bluebird imports with native Promise
 * 2. Handle Bluebird-specific methods that don't exist in native Promise
 * 3. Update Promise.config calls
 * 4. Handle promisify usage
 * 5. Update type definitions
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build'];
const FILE_EXTENSIONS = ['.ts', '.tsx'];

// Bluebird-specific methods that need special handling
const BLUEBIRD_METHODS = {
  'map': 'Use Promise.all() with Array.map() or implement custom map function',
  'mapSeries': 'Use async/await with for-of loop or implement custom sequential map',
  'each': 'Use async/await with for-of loop',
  'filter': 'Use Promise.all() with Array.filter() or implement custom filter function',
  'reduce': 'Use async/await with for-of loop or implement custom reduce function',
  'props': 'Use Promise.all() with Object.keys() or implement custom props function',
  'some': 'Implement custom some function using Promise.allSettled()',
  'any': 'Use Promise.any() (available in Node 15+)',
  'race': 'Use Promise.race() (already available)',
  'join': 'Use Promise.all()',
  'try': 'Use async function or Promise.resolve().then()',
  'method': 'Wrap function in async function',
  'bind': 'Use arrow functions or .bind()',
  'call': 'Use direct method calls',
  'apply': 'Use .apply() directly',
  'get': 'Use property access',
  'set': 'Use property assignment',
  'return': 'Use return statement',
  'throw': 'Use throw statement',
  'caught': 'Use .catch()',
  'error': 'Use .catch()',
  'finally': 'Use .finally() (available in Node 10+)',
  'lastly': 'Use .finally()',
  'tap': 'Use .then() with side effects',
  'tapCatch': 'Use .catch() with side effects and re-throw',
  'delay': 'Use setTimeout wrapped in Promise',
  'timeout': 'Use Promise.race() with setTimeout',
  'cancel': 'Implement custom cancellation logic',
  'reflect': 'Use .then()/catch() to inspect promise state',
  'isPending': 'Implement custom state tracking',
  'isFulfilled': 'Implement custom state tracking',
  'isRejected': 'Implement custom state tracking',
  'value': 'Access resolved value directly',
  'reason': 'Access rejection reason directly',
  'promisify': 'Use util.promisify()',
  'promisifyAll': 'Use util.promisify() on individual methods',
  'coroutine': 'Use async/await',
  'spawn': 'Use async/await'
};

// Migration patterns
const MIGRATION_PATTERNS = [
  // Import replacements
  {
    pattern: /import\s+Promise\s+from\s+['"]bluebird['"]/g,
    replacement: '// TODO: Remove Bluebird import - using native Promise',
    description: 'Remove Bluebird import'
  },
  {
    pattern: /import\s+Bluebird\s+from\s+['"]bluebird['"]/g,
    replacement: '// TODO: Remove Bluebird import - using native Promise',
    description: 'Remove Bluebird import (named)'
  },
  {
    pattern: /import\s+PromiseBB\s+from\s+['"]bluebird['"]/g,
    replacement: '// TODO: Remove Bluebird import - using native Promise',
    description: 'Remove Bluebird import (aliased)'
  },
  // Promise.config replacement
  {
    pattern: /Promise\.config\(\{[^}]*\}\);/g,
    replacement: '// TODO: Remove Promise.config - native Promise does not support this',
    description: 'Remove Promise.config'
  },
  // Simple method replacements (where native equivalents exist)
  {
    pattern: /Promise\.try\(/g,
    replacement: '(async () => ',
    description: 'Replace Promise.try with async IIFE'
  }
];

// Statistics
const stats = {
  filesProcessed: 0,
  importsReplaced: 0,
  methodsReplaced: 0,
  configCallsRemoved: 0,
  filesWithIssues: []
};

/**
 * Check if a file should be processed
 */
function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  return FILE_EXTENSIONS.includes(ext);
}

/**
 * Check if a directory should be excluded
 */
function shouldExcludeDir(dirPath) {
  const dirName = path.basename(dirPath);
  return EXCLUDE_DIRS.includes(dirName);
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let changesMade = false;
    const issuesFound = [];

    // Apply migration patterns
    for (const migration of MIGRATION_PATTERNS) {
      const matches = content.match(migration.pattern);
      if (matches) {
        content = content.replace(migration.pattern, migration.replacement);
        changesMade = true;
        
        // Update statistics
        if (migration.description.includes('import')) {
          stats.importsReplaced += matches.length;
        } else if (migration.description.includes('config')) {
          stats.configCallsRemoved += matches.length;
        } else {
          stats.methodsReplaced += matches.length;
        }
      }
    }

    // Check for Bluebird-specific methods that need manual handling
    for (const [method, advice] of Object.entries(BLUEBIRD_METHODS)) {
      const pattern = new RegExp(`Promise\\.${method}\\s*\\(`, 'g');
      const matches = content.match(pattern);
      if (matches) {
        issuesFound.push({
          method: `Promise.${method}`,
          count: matches.length,
          advice: advice
        });
      }
    }

    // Check for promisify usage
    const promisifyPattern = /Promise\.promisify/g;
    const promisifyMatches = content.match(promisifyPattern);
    if (promisifyMatches) {
      issuesFound.push({
        method: 'Promise.promisify',
        count: promisifyMatches.length,
        advice: 'Replace with util.promisify() from Node.js built-in utilities'
      });
    }

    // Write file if changes were made
    if (changesMade && content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Processed: ${filePath}`);
    } else {
      console.log(`- No changes: ${filePath}`);
    }

    // Record issues
    if (issuesFound.length > 0) {
      stats.filesWithIssues.push({
        file: filePath,
        issues: issuesFound
      });
    }

    stats.filesProcessed++;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}: ${error.message}`);
  }
}

/**
 * Recursively process directories
 */
function processDirectory(dirPath) {
  if (shouldExcludeDir(dirPath)) {
    return;
  }

  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        processDirectory(itemPath);
      } else if (stat.isFile() && shouldProcessFile(itemPath)) {
        processFile(itemPath);
      }
    }
  } catch (error) {
    console.error(`✗ Error reading directory ${dirPath}: ${error.message}`);
  }
}

/**
 * Generate migration report
 */
function generateReport() {
  console.log('\n=== Bluebird to Native Promise Migration Report ===');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Bluebird imports replaced: ${stats.importsReplaced}`);
  console.log(`Bluebird methods requiring attention: ${stats.methodsReplaced}`);
  console.log(`Promise.config calls removed: ${stats.configCallsRemoved}`);
  
  if (stats.filesWithIssues.length > 0) {
    console.log('\n=== Files Requiring Manual Attention ===');
    for (const fileIssue of stats.filesWithIssues) {
      console.log(`\nFile: ${fileIssue.file}`);
      for (const issue of fileIssue.issues) {
        console.log(`  - ${issue.method} (${issue.count} occurrences): ${issue.advice}`);
      }
    }
  }

  console.log('\n=== Migration Guidelines ===');
  console.log('1. Review all TODO comments and remove Bluebird imports');
  console.log('2. Replace Bluebird-specific methods with native equivalents or custom implementations');
  console.log('3. Test thoroughly as some behavioral differences may exist');
  console.log('4. Update type definitions if using TypeScript');
  console.log('5. Remove bluebird from package.json dependencies');
}

/**
 * Main function
 */
function main() {
  console.log('Starting Bluebird to Native Promise Migration...\n');
  
  // Process source directory
  const srcPath = path.join(PROJECT_ROOT, 'src');
  if (fs.existsSync(srcPath)) {
    console.log('Processing src directory...');
    processDirectory(srcPath);
  }

  // Process extensions directory
  const extensionsPath = path.join(PROJECT_ROOT, 'extensions');
  if (fs.existsSync(extensionsPath)) {
    console.log('\nProcessing extensions directory...');
    processDirectory(extensionsPath);
  }

  // Generate report
  generateReport();
}

// Run the migration
main();