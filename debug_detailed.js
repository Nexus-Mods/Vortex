const { getMacOSGameFix, getExecutablePathForPlatform } = require('./out/util/macOSGameCompatibility');
const fs = require('fs');
const path = require('path');

console.log('=== Detailed Debug of Cyberpunk 2077 Path Resolution ===\n');

const basePath = '/Users/veland/Library/Application Support/Steam/steamapps/common/Cyberpunk 2077';
const gameId = 'cyberpunk2077';

console.log('1. Basic path information:');
console.log(`   Base path: ${basePath}`);
console.log(`   Base path exists: ${fs.existsSync(basePath)}`);
console.log(`   Game ID: ${gameId}`);

console.log('\n2. Getting game fix:');
const fix = getMacOSGameFix(gameId);
console.log(`   Fix found: ${fix ? 'Yes' : 'No'}`);
if (fix) {
  console.log(`   Windows executable: ${fix.windowsExecutable}`);
  console.log(`   macOS app bundle: ${fix.macOSAppBundle}`);
  console.log(`   Alternative files: ${JSON.stringify(fix.alternativeFiles)}`);
}

console.log('\n3. Manual app bundle detection:');
if (fix) {
  const appBundlePath = path.join(basePath, fix.macOSAppBundle);
  console.log(`   Expected app bundle path: ${appBundlePath}`);
  console.log(`   App bundle exists: ${fs.existsSync(appBundlePath)}`);
  
  if (fs.existsSync(appBundlePath)) {
    console.log(`   App bundle is directory: ${fs.statSync(appBundlePath).isDirectory()}`);
    
    // Check Contents/MacOS directory
    const contentsPath = path.join(appBundlePath, 'Contents');
    const macOSPath = path.join(contentsPath, 'MacOS');
    console.log(`   Contents directory exists: ${fs.existsSync(contentsPath)}`);
    console.log(`   MacOS directory exists: ${fs.existsSync(macOSPath)}`);
    
    if (fs.existsSync(macOSPath)) {
      const macOSContents = fs.readdirSync(macOSPath);
      console.log(`   MacOS directory contents: ${JSON.stringify(macOSContents)}`);
    }
  }
}

console.log('\n4. Manual path construction:');
if (fix) {
  const manualAppPath = path.join(basePath, fix.macOSAppBundle);
  console.log(`   Manual app path: ${manualAppPath}`);
  console.log(`   Manual app path exists: ${fs.existsSync(manualAppPath)}`);
}

console.log('\n5. Testing getExecutablePathForPlatform:');
if (fix) {
  console.log(`   Calling getExecutablePathForPlatform('${basePath}', '${gameId}', '${fix.windowsExecutable}')`);
  const result = getExecutablePathForPlatform(basePath, gameId, fix.windowsExecutable);
  console.log(`   Result: ${result}`);
  
  if (result) {
    console.log(`   Result exists: ${fs.existsSync(result)}`);
  }
}

console.log('\n6. Testing alternative files:');
if (fix && fix.alternativeFiles) {
  fix.alternativeFiles.forEach((altFile, index) => {
    const altPath = path.join(basePath, altFile);
    console.log(`   Alternative ${index + 1}: ${altFile}`);
    console.log(`   Full path: ${altPath}`);
    console.log(`   Exists: ${fs.existsSync(altPath)}`);
  });
}

console.log('\n7. Testing direct Windows executable path:');
if (fix) {
  const directPath = path.join(basePath, fix.windowsExecutable);
  console.log(`   Direct path: ${directPath}`);
  console.log(`   Direct path exists: ${fs.existsSync(directPath)}`);
}

console.log('\n=== Debug Complete ===');