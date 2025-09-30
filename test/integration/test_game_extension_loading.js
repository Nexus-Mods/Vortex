#!/usr/bin/env node

// Test script to verify game extension loading
const path = require('path');
const fs = require('fs');

console.log('=== Testing Game Extension Loading ===');

// Check if the extensions directory exists
const extensionsDir = path.join(__dirname, 'extensions', 'games');
console.log('Extensions directory:', extensionsDir);
console.log('Extensions directory exists:', fs.existsSync(extensionsDir));

if (fs.existsSync(extensionsDir)) {
  const gameExtensions = fs.readdirSync(extensionsDir, { withFileTypes: true });
  console.log(`Found ${gameExtensions.length} game extension directories`);
  
  // Check a few game extensions
  const sampleExtensions = gameExtensions.slice(0, 5);
  sampleExtensions.forEach(dirent => {
    if (dirent.isDirectory()) {
      const extPath = path.join(extensionsDir, dirent.name);
      const indexPath = path.join(extPath, 'index.js');
      const infoPath = path.join(extPath, 'info.json');
      
      console.log(`\n--- Checking ${dirent.name} ---`);
      console.log('  Directory exists:', fs.existsSync(extPath));
      console.log('  index.js exists:', fs.existsSync(indexPath));
      console.log('  info.json exists:', fs.existsSync(infoPath));
      
      if (fs.existsSync(infoPath)) {
        try {
          const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
          console.log('  Extension info:', {
            name: info.name,
            author: info.author,
            version: info.version,
            type: info.type
          });
        } catch (err) {
          console.log('  Failed to read info.json:', err.message);
        }
      }
      
      if (fs.existsSync(indexPath)) {
        try {
          // Try to load the extension
          const extensionModule = require(indexPath);
          console.log('  Module loaded successfully');
          console.log('  Has default export:', typeof extensionModule.default === 'function');
          console.log('  Has main export:', typeof extensionModule.main === 'function');
          console.log('  Is function:', typeof extensionModule === 'function');
        } catch (err) {
          console.log('  Failed to load module:', err.message);
          console.log('  Error stack:', err.stack);
        }
      }
    }
  });
  
  // Also check for the Balatro extension specifically
  console.log('\n--- Checking for Balatro extension ---');
  const balatroPath = path.join(extensionsDir, 'game-balatro');
  if (fs.existsSync(balatroPath)) {
    console.log('Balatro extension directory exists');
    const balatroIndexPath = path.join(balatroPath, 'index.js');
    console.log('Balatro index.js exists:', fs.existsSync(balatroIndexPath));
    
    if (fs.existsSync(balatroIndexPath)) {
      try {
        // Try to load the extension
        const balatroModule = require(balatroIndexPath);
        console.log('Balatro module loaded successfully');
        console.log('Balatro has default export:', typeof balatroModule.default === 'function');
        console.log('Balatro has main export:', typeof balatroModule.main === 'function');
        console.log('Balatro is function:', typeof balatroModule === 'function');
      } catch (err) {
        console.log('Failed to load Balatro module:', err.message);
        console.log('Error stack:', err.stack);
      }
    }
  } else {
    console.log('Balatro extension directory not found');
  }
}

console.log('\n=== End Test ===');