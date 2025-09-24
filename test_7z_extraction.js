const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Simulate the getPackaged7zPath function from installExtension.ts
async function getPackaged7zPath() {
  const modulesPath = path.join(__dirname, 'node_modules');
  
  // Check 7zip-bin first (prioritized for macOS)
  const zipBinPath = path.join(modulesPath, '7zip-bin');
  if (fs.existsSync(zipBinPath)) {
    const arch = process.arch;
    const macPath = path.join(zipBinPath, 'mac', arch, '7za');
    if (fs.existsSync(macPath)) {
      return macPath;
    }
  }
  
  // Fallback to 7z-bin
  try {
    const sevenZBin = require('7z-bin');
    if (fs.existsSync(sevenZBin)) {
      return sevenZBin;
    } else {
      // Try the fallback logic
      const fallbackPath = sevenZBin.replace('/darwin/', '/bin/');
      if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
      }
    }
  } catch (err) {
    console.log('Error requiring 7z-bin:', err.message);
  }
  
  return null;
}

// Test extraction
async function testExtraction() {
  const archivePath = path.join(__dirname, 'test_mod.zip');
  const destPath = path.join(__dirname, 'test_extraction');
  
  // Clean up any previous test
  if (fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }
  fs.mkdirSync(destPath, { recursive: true });
  
  console.log('Testing 7z extraction...');
  console.log('Archive:', archivePath);
  console.log('Destination:', destPath);
  
  const packaged7z = await getPackaged7zPath();
  console.log('7z binary path:', packaged7z);
  
  if (!packaged7z) {
    console.log('No 7z binary found!');
    return;
  }
  
  // Test the extraction
  const args = ['x', '-y', archivePath, `-o${destPath}`];
  console.log('Running command:', packaged7z, args.join(' '));
  
  const child = spawn(packaged7z, args, { stdio: 'pipe' });
  
  let stdout = '';
  let stderr = '';
  
  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });
  
  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });
  
  child.on('close', (code) => {
    console.log('Exit code:', code);
    if (stdout) console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);
    
    // Check if extraction worked
    if (fs.existsSync(path.join(destPath, 'test_mod'))) {
      console.log('✓ Extraction successful!');
    } else {
      console.log('✗ Extraction failed!');
    }
    
    // Clean up
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }
  });
  
  child.on('error', (err) => {
    console.log('Spawn error:', err.message);
    console.log('Error code:', err.code);
    if (err.code === 'ENOENT') {
      console.log('This is the ENOENT error we are looking for!');
    }
  });
}

testExtraction().catch(console.error);