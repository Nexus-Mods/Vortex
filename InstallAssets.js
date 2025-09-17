'use strict';

const Promise = require('bluebird');
const fs = require('fs-extra');
const path = require('path');
// Removed glob dependency - using native Node.js fs operations
const exec = require('child_process').exec;

const data = require('./InstallAssets.json');

// Native file system operations don't need glob options

// Helper function for recursive directory walking
function walkDir(dir, suffix, results) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      walkDir(fullPath, suffix, results);
    } else {
      // Handle both exact suffix matching and wildcard patterns
      if (suffix === '') {
        results.push(fullPath);
      } else if (suffix.includes('*')) {
        // Convert wildcard pattern to regex
        const regexPattern = suffix.replace(/\*/g, '.*');
        const regex = new RegExp(regexPattern + '$');
        if (regex.test(path.basename(fullPath))) {
          results.push(fullPath);
        }
      } else if (fullPath.endsWith(suffix)) {
        results.push(fullPath);
      }
    }
  }
}

// Function to expand wildcard paths using native fs
function expandWildcardPath(pattern) {
  const results = [];
  
  // Handle different wildcard patterns
  if (pattern.includes('**')) {
    // Recursive directory traversal
    const basePath = pattern.split('**')[0];
    const suffix = pattern.split('**')[1] || '';
    
    // Clean up the suffix - remove leading slash and handle .extension properly
    const cleanSuffix = suffix.startsWith('/') ? suffix.substring(1) : suffix;
    
    walkDir(basePath, cleanSuffix, results);
  } else if (pattern.includes('*')) {
    // Single level wildcard
    const basePath = path.dirname(pattern);
    const fileName = path.basename(pattern);
    
    if (fs.existsSync(basePath)) {
      const items = fs.readdirSync(basePath);
      for (const item of items) {
        const fullPath = path.join(basePath, item);
        if (fileName === '*' || item.match(fileName.replace(/\*/g, '.*'))) {
          results.push(fullPath);
        }
      }
    }
  }
  
  return results;
}

if (process.argv.length < 3) {
  process.exit(1);
}
const tgt = process.argv[2];

let childProcesses = [];
let copies = -1;

let status = 0;

// run other, independend commands concurrently to speed things up.
for (const spawn of data.spawn) {
  if (!spawn.target || spawn.target.indexOf(tgt) === -1) {
    continue;
  }

  const cmdline = spawn.executable + ' ' + spawn.arguments.join(' ');
  const child = exec(spawn.executable + ' ' + spawn.arguments.join(' '), {
    stdio: [0, 1, 2],
    env: Object.assign({}, process.env, spawn.env)
  });
  console.log('spawned', cmdline);
  child.stdout.on('data', (output) => {
    console.log(spawn.executable, output);
  });
  child.stderr.on('data', (output) => {
    console.log('Error:', spawn.executable, output);
  });
  child.on('close', (code) => {
    if (code !== 0) {
      status = 1;
    }
    console.log('finished', spawn.executable, code);
  });
  childProcesses.push(spawn.executable);
  child.on('exit', () => {
    childProcesses = childProcesses.filter((proc) => proc !== spawn.executable);
  });
}

function waitForProcesses() {
  let resolve;

  const cb = () => {
    if ((childProcesses.length > 0) || (copies !== 0)) {
      setTimeout(cb, 100);
    } else {
      resolve();
    }
  }

  return new Promise((resolveIn, reject) => {
    resolve = resolveIn;
    setTimeout(cb, 100);
  });
}

// Utility: apply optional excludes from config
function applyExcludes(files, fileConfig) {
  const excludeNames = Array.isArray(fileConfig.excludeNames) ? fileConfig.excludeNames : [];
  const excludePaths = Array.isArray(fileConfig.excludePaths) ? fileConfig.excludePaths.map(p => path.resolve(p)) : [];

  return files.filter(f => {
    const base = path.basename(f);
    if (excludeNames.includes(base)) {
      return false;
    }
    const resolved = path.resolve(f);
    for (const ex of excludePaths) {
      if (resolved === ex || resolved.startsWith(ex + path.sep)) {
        return false;
      }
    }
    return true;
  });
}

// copy files
Promise.mapSeries(data.copy, file => {
  if (!file.target || file.target.indexOf(tgt) === -1) {
    return;
  }

  return new Promise((resolve, reject) => {
    // Handle different path patterns
    if (file.srcPath.includes('*')) {
      // For wildcard patterns, we need to expand them
      const basePath = file.srcPath.split('*')[0];
      const pattern = file.srcPath.split('*')[1] || '';
      
      if (fs.existsSync(basePath)) {
        let files = expandWildcardPath(file.srcPath);
        // Apply excludes if configured
        files = applyExcludes(files, file);
        copies = copies === -1 ? files.length : copies += files.length;
        resolve(files);
      } else {
        resolve([]);
      }
    } else {
      // For direct file paths
      if (fs.existsSync(file.srcPath)) {
        let files = [file.srcPath];
        files = applyExcludes(files, file);
        copies = copies === -1 ? files.length : copies += files.length;
        resolve(files);
      } else {
        resolve([]);
      }
    }
  })
    .then(files => Promise.map(files, (globResult) => {
      let globTarget = path.join(...globResult.split(/[\/\\]/).slice(file.skipPaths));
      if (file.rename) {
        globTarget = path.join(path.dirname(globTarget), file.rename);
      }
      const targetFile = path.join(tgt, file.outPath, globTarget);

      return fs.ensureDir(path.dirname(targetFile))
        .then(() => fs.copy(globResult, targetFile))
        .then(() => {
          console.log('copied', globResult, targetFile);
        })
        .catch((copyErr) => {
          console.log('failed to copy', globResult, targetFile, copyErr);
        })
        .finally(() => {
          --copies;
        });
    }));
})
  .then(() => waitForProcesses());
