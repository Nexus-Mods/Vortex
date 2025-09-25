const { getMacOSGameFix, getExecutablePathForPlatform } = require('./out/util/macOSGameCompatibility');
const path = require('path');
const fs = require('fs');

console.log('=== Debugging Cyberpunk 2077 Path Resolution ===\n');

const cyberpunkPath = '/Users/veland/Library/Application Support/Steam/steamapps/common/Cyberpunk 2077';

console.log('1. Basic path information:');
console.log(`   Base path: ${cyberpunkPath}`);
console.log(`   Path exists: ${fs.existsSync(cyberpunkPath)}`);

console.log('\n2. Directory contents:');
if (fs.existsSync(cyberpunkPath)) {
  const contents = fs.readdirSync(cyberpunkPath);
  contents.forEach(item => {
    const itemPath = path.join(cyberpunkPath, item);
    const stats = fs.statSync(itemPath);
    console.log(`   ${item} (${stats.isDirectory() ? 'directory' : 'file'})`);
  });
}

console.log('\n3. Game fix information:');
const fix = getMacOSGameFix('cyberpunk2077');
if (fix) {
  console.log(`   Game ID: ${fix.gameId}`);
  console.log(`   Windows executable: ${fix.windowsExecutable}`);
  console.log(`   macOS app bundle: ${fix.macOSAppBundle}`);
  console.log(`   Alternative files: ${fix.alternativeFiles.join(', ')}`);
  
  console.log('\n4. Checking for app bundle:');
  const appBundlePath = path.join(cyberpunkPath, fix.macOSAppBundle);
  console.log(`   Looking for: ${appBundlePath}`);
  console.log(`   App bundle exists: ${fs.existsSync(appBundlePath)}`);
  
  if (fs.existsSync(appBundlePath)) {
    console.log(`   App bundle contents:`);
    try {
      const appContents = fs.readdirSync(appBundlePath);
      appContents.forEach(item => {
        console.log(`     ${item}`);
      });
    } catch (err) {
      console.log(`     Error reading app bundle: ${err.message}`);
    }
  }
  
  console.log('\n5. Checking alternative files:');
  fix.alternativeFiles.forEach(altFile => {
    const altPath = path.join(cyberpunkPath, altFile);
    console.log(`   ${altFile}: ${fs.existsSync(altPath) ? 'EXISTS' : 'NOT FOUND'}`);
  });
}

console.log('\n6. Testing getExecutablePathForPlatform step by step:');
console.log(`   Input path: ${cyberpunkPath}`);
console.log(`   Platform: darwin`);

// Test the function
const result = getExecutablePathForPlatform(cyberpunkPath, 'darwin');
console.log(`   Result: ${result}`);

console.log('\n7. Manual path construction test:');
if (fix && fs.existsSync(path.join(cyberpunkPath, fix.macOSAppBundle))) {
  const manualPath = path.join(cyberpunkPath, fix.macOSAppBundle);
  console.log(`   Manual app bundle path: ${manualPath}`);
  console.log(`   Manual path exists: ${fs.existsSync(manualPath)}`);
}

console.log('\n=== Debug Complete ===');