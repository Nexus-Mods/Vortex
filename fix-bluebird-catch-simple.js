#!/usr/bin/env node

/**
 * Simple script to fix Bluebird catch patterns in the Vortex codebase
 * Replaces specific Bluebird catch patterns with native Promise equivalents
 */

const fs = require('fs');
const path = require('path');

// Define specific replacements for the patterns we've identified
const replacements = [
  // ProcessCanceled patterns
  {
    pattern: /\.catch\(ProcessCanceled, \(\) => null\)/g,
    replacement: '.catch(err => { if (err instanceof ProcessCanceled) { return Promise.resolve(null); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(ProcessCanceled, \(\) => Promise\.resolve\(\)\)/g,
    replacement: '.catch(err => { if (err instanceof ProcessCanceled) { return Promise.resolve(); } else { return Promise.reject(err); }})'
  },
  // UserCanceled patterns
  {
    pattern: /\.catch\(UserCanceled, \(\) => null\)/g,
    replacement: '.catch(err => { if (err instanceof UserCanceled) { return Promise.resolve(null); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(UserCanceled, \(\) => Promise\.resolve\(\)\)/g,
    replacement: '.catch(err => { if (err instanceof UserCanceled) { return Promise.resolve(); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(UserCanceled, callCB\)/g,
    replacement: '.catch(err => { if (err instanceof UserCanceled) { return callCB(); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(UserCanceled, \(\) => undefined\)/g,
    replacement: '.catch(err => { if (err instanceof UserCanceled) { return Promise.resolve(undefined); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(UserCanceled, \(\) => \{/g,
    replacement: '.catch(err => { if (err instanceof UserCanceled) {'
  },
  // AlreadyDownloaded patterns
  {
    pattern: /\.catch\(AlreadyDownloaded, \(err: AlreadyDownloaded\) => \{/g,
    replacement: '.catch(err => { if (err instanceof AlreadyDownloaded) {'
  },
  {
    pattern: /\.catch\(AlreadyDownloaded, \(err\) => \{/g,
    replacement: '.catch(err => { if (err instanceof AlreadyDownloaded) {'
  },
  // DataInvalid patterns
  {
    pattern: /\.catch\(DataInvalid, \(\) => \{/g,
    replacement: '.catch(err => { if (err instanceof DataInvalid) {'
  },
  // DownloadIsHTML patterns
  {
    pattern: /\.catch\(DownloadIsHTML, err => undefined\)/g,
    replacement: '.catch(err => { if (err instanceof DownloadIsHTML) { return Promise.resolve(undefined); } else { return Promise.reject(err); }})'
  },
  // CorruptActiveProfile patterns
  {
    pattern: /\.catch\(CorruptActiveProfile, \(err\) => \{/g,
    replacement: '.catch(err => { if (err instanceof CorruptActiveProfile) {'
  },
  // RateLimitExceeded patterns
  {
    pattern: /\.catch\(RateLimitExceeded, \(\) => Promise\.resolve\(true\)\)/g,
    replacement: '.catch(err => { if (err instanceof RateLimitExceeded) { return Promise.resolve(true); } else { return Promise.reject(err); }})'
  },
  // GameEntryNotFound patterns
  {
    pattern: /\.catch\(GameEntryNotFound, \(\) => Promise\.resolve\(accum\)\)/g,
    replacement: '.catch(err => { if (err instanceof GameEntryNotFound) { return Promise.resolve(accum); } else { return Promise.reject(err); }})'
  },
  // Object patterns with code
  {
    pattern: /\.catch\(\{ code: 'EEXIST' \}, \(\) => moveRenameAsync\(src, nextName\(dest\)\)\)/g,
    replacement: '.catch(err => { if (err.code === \'EEXIST\') { return moveRenameAsync(src, nextName(dest)); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) => \[\]\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { return Promise.resolve([]); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) => null\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { return Promise.resolve(null); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOTFOUND' \}, \(\) => null\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOTFOUND\') { return Promise.resolve(null); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'EBADF' \}, \(\) => null\)/g,
    replacement: '.catch(err => { if (err.code === \'EBADF\') { return Promise.resolve(null); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOSPC' \}, \(\) => \{\s*\}\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOSPC\') { return Promise.resolve({}); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ECANCELED' \}, \(\) => Promise\.reject\(new UserCanceled\(\)\)\)/g,
    replacement: '.catch(err => { if (err.code === \'ECANCELED\') { return Promise.reject(new UserCanceled()); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ systemCode: 1223 \}, \(\) => Promise\.reject\(new UserCanceled\(\)\)\)/g,
    replacement: '.catch(err => { if (err.systemCode === 1223) { return Promise.reject(new UserCanceled()); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ errno: 1223 \}, \(\) => Promise\.reject\(new UserCanceled\(\)\)\)/g,
    replacement: '.catch(err => { if (err.errno === 1223) { return Promise.reject(new UserCanceled()); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ systemCode: 3 \}, \(\) => Promise\.resolve\(\)\)/g,
    replacement: '.catch(err => { if (err.systemCode === 3) { return Promise.resolve(); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'EEXIST' \}, \(\) => \{/g,
    replacement: '.catch(err => { if (err.code === \'EEXIST\') {'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, remErr => Promise\.resolve\(\)\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { return Promise.resolve(); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(err: any\) => log\('warn', 'file disappeared', err\.path\)\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { log(\'warn\', \'file disappeared\', err.path); return Promise.resolve(); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 5 \}, \(\) => reject\(new UserCanceled\(\)\)\)/g,
    replacement: '.catch(err => { if (err.code === 5) { return Promise.reject(new UserCanceled()); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ systemCode: 1223 \}, \(\) => reject\(new UserCanceled\(\)\)\)/g,
    replacement: '.catch(err => { if (err.systemCode === 1223) { return Promise.reject(new UserCanceled()); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ errno: 1223 \}, \(\) => reject\(new UserCanceled\(\)\)\)/g,
    replacement: '.catch(err => { if (err.errno === 1223) { return Promise.reject(new UserCanceled()); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) => \{/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') {'
  },
  {
    pattern: /\.catch\(\{ code: 'EBADF' \}, \(\) => \{/g,
    replacement: '.catch(err => { if (err.code === \'EBADF\') {'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOSPC' \}, \(\) => \{/g,
    replacement: '.catch(err => { if (err.code === \'ENOSPC\') {'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) => fs\.statAsync\(fullPath \+ '\.installing'\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { return fs.statAsync(fullPath + \'.installing\'); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) => fs\.statAsync\(sourcePath \+ LNK_EXT\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { return fs.statAsync(sourcePath + LNK_EXT); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(err: any\) => \{/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') {'
  },
  // Additional object patterns
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) => Promise\.resolve\(\)\)/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { return Promise.resolve(); } else { return Promise.reject(err); }})'
  },
  {
    pattern: /\.catch\(\{ code: 'EEXIST' \}, \(\) =>/g,
    replacement: '.catch(err => { if (err.code === \'EEXIST\') {'
  },
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) =>/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') {'
  },
  // Patterns with await
  {
    pattern: /\.catch\(\{ code: 'ENOENT' \}, \(\) => Promise\.resolve\(\)\);/g,
    replacement: '.catch(err => { if (err.code === \'ENOENT\') { return Promise.resolve(); } else { return Promise.reject(err); }});'
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
  console.log('Starting Bluebird catch pattern fix...');
  
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
  console.log('Bluebird catch pattern fix completed.');
}

// Run the script
main();