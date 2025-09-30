#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Simulate the extension installation process
async function testExtensionInstall() {
  const archivePath = path.join(__dirname, 'test_balatro_extension.7z');
  const extensionsPath = path.join(__dirname, 'test_extensions');
  const tempPath = path.join(extensionsPath, path.basename(archivePath)) + '.installing';
  
  console.log('🧪 Testing Extension Installation Process');
  console.log('========================================');
  console.log(`Archive: ${archivePath}`);
  console.log(`Temp Path: ${tempPath}`);
  console.log('');

  try {
    // Ensure directories exist
    await fs.ensureDir(extensionsPath);
    await fs.ensureDir(tempPath);
    
    console.log('✅ Created directories');
    
    // Extract archive using 7z (simulating the macOS extraction)
    console.log('📦 Extracting archive...');
    execSync(`7z x -y "${archivePath}" -o"${tempPath}"`, { stdio: 'inherit' });
    
    console.log('✅ Archive extracted');
    
    // List contents of temp directory
    console.log('\n📁 Contents of temp directory:');
    const files = await fs.readdir(tempPath);
    for (const file of files) {
      const filePath = path.join(tempPath, file);
      const stats = await fs.stat(filePath);
      console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
    }
    
    // Test findEntryScript logic
    console.log('\n🔍 Testing entry script detection...');
    
    // Check for index.js
    const indexPath = path.join(tempPath, 'index.js');
    const indexExists = await fs.pathExists(indexPath);
    console.log(`  index.js: ${indexExists ? '✅ Found' : '❌ Not found'}`);
    
    // Check for dist/index.js
    const distIndexPath = path.join(tempPath, 'dist', 'index.js');
    const distIndexExists = await fs.pathExists(distIndexPath);
    console.log(`  dist/index.js: ${distIndexExists ? '✅ Found' : '❌ Not found'}`);
    
    // Check for package.json and main field
    const packagePath = path.join(tempPath, 'package.json');
    const packageExists = await fs.pathExists(packagePath);
    console.log(`  package.json: ${packageExists ? '✅ Found' : '❌ Not found'}`);
    
    let packageContent = null;
    if (packageExists) {
      try {
        packageContent = await fs.readJson(packagePath);
        const mainField = packageContent.main;
        console.log(`  package.json main: ${mainField || 'Not specified'}`);
        
        if (mainField) {
          const mainPath = path.join(tempPath, mainField);
          const mainExists = await fs.pathExists(mainPath);
          console.log(`  ${mainField}: ${mainExists ? '✅ Found' : '❌ Not found'}`);
        }
      } catch (err) {
        console.log(`  ❌ Error reading package.json: ${err.message}`);
      }
    }
    
    // Check for info.json
    const infoPath = path.join(tempPath, 'info.json');
    const infoExists = await fs.pathExists(infoPath);
    console.log(`  info.json: ${infoExists ? '✅ Found' : '❌ Not found'}`);
    
    if (infoExists) {
      try {
        const infoContent = await fs.readJson(infoPath);
        console.log(`  Extension name: ${infoContent.name}`);
        console.log(`  Extension version: ${infoContent.version}`);
      } catch (err) {
        console.log(`  ❌ Error reading info.json: ${err.message}`);
      }
    }
    
    console.log('\n🎯 Entry Script Detection Result:');
    if (indexExists || distIndexExists || (packageExists && packageContent?.main)) {
      console.log('✅ Entry script found - installation should succeed');
    } else {
      console.log('❌ No entry script found - this would cause the installation to fail');
    }
    
    // Clean up
    await fs.remove(tempPath);
    console.log('\n🧹 Cleaned up temporary files');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Clean up on error
    try {
      await fs.remove(tempPath);
    } catch (cleanupError) {
      console.error('Failed to clean up:', cleanupError.message);
    }
  }
}

// Run the test
testExtensionInstall().catch(console.error);