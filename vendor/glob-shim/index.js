"use strict";
const fs = require("fs");
const path = require("path");

// Simple glob implementation for basic patterns
function globSync(pattern, options = {}) {
  const cwd = options.cwd || process.cwd();
  
  // Handle simple patterns - for ts-json-schema-generator we mainly need **/*.ts support
  if (pattern.includes('**/*.ts')) {
    return findTypeScriptFiles(cwd);
  }
  
  // Handle other basic patterns
  if (pattern.includes('*')) {
    return findFilesWithPattern(pattern, cwd);
  }
  
  // Direct file check
  const fullPath = path.resolve(cwd, pattern);
  if (fs.existsSync(fullPath)) {
    return [pattern];
  }
  
  return [];
}

function findTypeScriptFiles(dir) {
  const results = [];
  
  function walk(currentDir) {
    try {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          walk(fullPath);
        } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
          const relativePath = path.relative(dir, fullPath);
          results.push(relativePath.replace(/\\/g, '/'));
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  }
  
  walk(dir);
  return results;
}

function findFilesWithPattern(pattern, cwd) {
  // Basic pattern matching - extend as needed
  const results = [];
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  
  function walk(currentDir) {
    try {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          walk(fullPath);
        } else if (regex.test(file)) {
          const relativePath = path.relative(cwd, fullPath);
          results.push(relativePath.replace(/\\/g, '/'));
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  }
  
  walk(cwd);
  return results;
}

// Main glob function for async usage
function glob(pattern, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  try {
    const results = globSync(pattern, options);
    process.nextTick(() => callback(null, results));
  } catch (err) {
    process.nextTick(() => callback(err));
  }
}

// Add hasMagic function for rimraf compatibility
function hasMagic(pattern, options) {
  if (typeof pattern !== 'string') return false;
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[') || pattern.includes('{');
}

glob.hasMagic = hasMagic;

// Export both sync and async versions for compatibility
module.exports = glob;
module.exports.sync = globSync;
module.exports.globSync = globSync;
module.exports.hasMagic = hasMagic;
module.exports.default = glob;
module.exports.glob = glob;