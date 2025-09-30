const fs = require('fs').promises;
const path = require('path');

// Simulate the fixed getPackaged7zPath function logic for macOS
async function testGetPackaged7zPath() {
  console.log('Testing 7z binary resolution on macOS...');
  
  // Test 7zip-bin package first (should work)
  try {
    const sevenZipBin = require('7zip-bin');
    if (sevenZipBin) {
      const sevenZipBinPath = sevenZipBin.path7za || sevenZipBin;
      if (sevenZipBinPath) {
        try {
          const st = await fs.stat(sevenZipBinPath);
          if (st && st.isFile()) {
            console.log('✅ 7zip-bin package resolved successfully:', sevenZipBinPath);
            return sevenZipBinPath;
          }
        } catch (err) {
          console.log('❌ 7zip-bin path exists but stat failed:', err.message);
        }
      }
    }
  } catch (err) {
    console.log('❌ 7zip-bin package not found:', err.message);
  }

  // Test 7z-bin package as fallback
  try {
    const sevenBinPath = require('7z-bin');
    if (sevenBinPath) {
      try {
        const st = await fs.stat(sevenBinPath);
        if (st && st.isFile()) {
          console.log('✅ 7z-bin package resolved successfully:', sevenBinPath);
          return sevenBinPath;
        }
      } catch (err) {
        console.log('❌ 7z-bin path failed, trying darwin correction...');
        // Try the darwin correction
        if (sevenBinPath.includes('/darwin/')) {
          const correctedPath = sevenBinPath.replace('/darwin/', '/bin/');
          try {
            const st = await fs.stat(correctedPath);
            if (st && st.isFile()) {
              console.log('✅ 7z-bin corrected path resolved:', correctedPath);
              return correctedPath;
            }
          } catch (corrErr) {
            console.log('❌ 7z-bin corrected path also failed:', corrErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.log('❌ 7z-bin package not found:', err.message);
  }

  console.log('❌ No 7z binary could be resolved');
  return undefined;
}

// Test extraction with the resolved binary
async function testExtraction(binaryPath) {
  if (!binaryPath) {
    console.log('❌ Cannot test extraction - no binary path');
    return;
  }

  console.log('\nTesting extraction with resolved binary...');
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    // Test if the binary can be executed (just get version info)
    const child = spawn(binaryPath, [], { stdio: 'pipe' });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0 || output.includes('7-Zip') || errorOutput.includes('7-Zip')) {
        console.log('✅ Binary is executable and working');
        console.log('Output:', output.substring(0, 200));
      } else {
        console.log('❌ Binary execution failed with code:', code);
        console.log('Error output:', errorOutput.substring(0, 200));
      }
      resolve();
    });
    
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.log('❌ ENOENT error - binary not found or not executable');
      } else {
        console.log('❌ Execution error:', err.message);
      }
      resolve();
    });
  });
}

async function main() {
  try {
    const binaryPath = await testGetPackaged7zPath();
    await testExtraction(binaryPath);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

main();