#!/usr/bin/env node

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=== VORTEX INSTALLATION SIMULATION ===');

// Simulate the exact Vortex installation process
const sourceDir = '/Users/veland/Downloads/vortex/Balatro Vortex Extension-1315-0-1-2-1748486275';
const testArchive = '/tmp/test_balatro_vortex.7z';
const extensionsPath = '/tmp/test_vortex_extensions';
const archivePath = testArchive;

// Create the tempPath exactly like Vortex does
const tempPath = path.join(extensionsPath, path.basename(archivePath)) + '.installing';

console.log('Paths:', {
  sourceDir,
  testArchive,
  extensionsPath,
  tempPath
});

console.log('\n1. Creating test .7z archive...');
try {
  // Clean up any existing files
  if (fs.existsSync(testArchive)) {
    fs.unlinkSync(testArchive);
  }
  if (fs.existsSync(extensionsPath)) {
    fs.rmSync(extensionsPath, { recursive: true, force: true });
  }

  // Create the archive
  const createResult = spawnSync('7z', ['a', testArchive, `${sourceDir}/*`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  if (createResult.status !== 0) {
    throw new Error(`Failed to create archive: ${createResult.stderr}`);
  }
  
  console.log('✅ Archive created successfully');
} catch (err) {
  console.error('❌ Failed to create archive:', err.message);
  process.exit(1);
}

console.log('\n2. Creating directories like Vortex...');
try {
  // Ensure target directories exist
  fs.mkdirSync(extensionsPath, { recursive: true });
  fs.mkdirSync(tempPath, { recursive: true });
  
  console.log('✅ Directories created');
} catch (err) {
  console.error('❌ Failed to create directories:', err.message);
  process.exit(1);
}

console.log('\n3. Extracting using Vortex method...');
try {
  // Extract using the same command Vortex uses
  const extractResult = spawnSync('7z', ['x', '-y', testArchive, `-o${tempPath}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  console.log('Extraction result:', {
    status: extractResult.status,
    error: extractResult.error?.message,
    stderr: extractResult.stderr?.trim()
  });
  
  if (extractResult.status !== 0) {
    throw new Error(`Failed to extract archive: ${extractResult.stderr}`);
  }
  
  console.log('✅ Extraction completed');
} catch (err) {
  console.error('❌ Failed to extract archive:', err.message);
  process.exit(1);
}

console.log('\n4. Simulating Vortex validation checks...');
try {
  // Wait a bit like Vortex does
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check if extraction directory exists and has content
  const stats = fs.statSync(tempPath);
  if (!stats.isDirectory()) {
    throw new Error('Extraction directory is not a directory');
  }
  
  const files = fs.readdirSync(tempPath);
  console.log('Extracted files:', files);
  
  // Check for key files like validateExtractionCompleteness does
  const keyFiles = ['index.js', 'info.json'];
  const missingFiles = keyFiles.filter(file => !files.includes(file));
  
  console.log('Key files check:', {
    keyFiles,
    missingFiles,
    allPresent: missingFiles.length === 0
  });
  
  if (missingFiles.length === 0) {
    // All key files are present, check if they are accessible
    for (const file of keyFiles) {
      const filePath = path.join(tempPath, file);
      const fileStat = fs.statSync(filePath);
      console.log(`${file}: size=${fileStat.size} bytes, accessible=true`);
    }
    console.log('✅ All key files are present and accessible');
  } else {
    console.log('❌ Missing key files:', missingFiles);
  }
  
} catch (err) {
  console.error('❌ Failed validation checks:', err.message);
  process.exit(1);
}

console.log('\n5. Simulating findEntryScript...');
try {
  const findEntryScript = (extPath) => {
    const indexPath = path.join(extPath, 'index.js');
    const distIndexPath = path.join(extPath, 'dist', 'index.js');
    const packagePath = path.join(extPath, 'package.json');
    
    console.log('Checking paths:');
    console.log('  index.js:', fs.existsSync(indexPath) ? '✅' : '❌');
    console.log('  dist/index.js:', fs.existsSync(distIndexPath) ? '✅' : '❌');
    console.log('  package.json:', fs.existsSync(packagePath) ? '✅' : '❌');
    
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
    
    if (fs.existsSync(distIndexPath)) {
      return distIndexPath;
    }
    
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (pkg && typeof pkg.main === 'string' && pkg.main.length > 0) {
          const mainPath = path.join(extPath, pkg.main);
          if (fs.existsSync(mainPath)) {
            return mainPath;
          }
        }
      } catch (e) {
        console.log('  package.json parse error:', e.message);
      }
    }
    
    return null;
  };
  
  const entryScript = findEntryScript(tempPath);
  console.log('Found entry script:', entryScript || 'NONE');
  
  if (entryScript) {
    console.log('✅ Entry script detection successful');
  } else {
    console.log('❌ Entry script detection failed');
  }
} catch (err) {
  console.error('❌ Failed to simulate findEntryScript:', err.message);
}

console.log('\n6. Checking directory structure...');
try {
  const walkDir = (dir, level = 0) => {
    const indent = '  '.repeat(level);
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        console.log(`${indent}📁 ${item}/`);
        if (level < 2) { // Limit depth
          walkDir(itemPath, level + 1);
        }
      } else {
        console.log(`${indent}📄 ${item} (${stat.size} bytes)`);
      }
    }
  };
  
  console.log('Directory structure:');
  walkDir(tempPath);
  
} catch (err) {
  console.error('❌ Failed to check directory structure:', err.message);
}

console.log('\n7. Cleanup...');
try {
  if (fs.existsSync(testArchive)) {
    fs.unlinkSync(testArchive);
  }
  if (fs.existsSync(extensionsPath)) {
    fs.rmSync(extensionsPath, { recursive: true, force: true });
  }
  console.log('✅ Cleanup completed');
} catch (err) {
  console.error('❌ Cleanup failed:', err.message);
}

console.log('\n=== SIMULATION COMPLETED ===');