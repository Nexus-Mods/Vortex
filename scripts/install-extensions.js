#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSIONS_DIR = path.join(__dirname, '..', 'extensions');

console.log('Installing dependencies for all extensions...');
console.log('==============================================\n');

let successCount = 0;
let skipCount = 0;
let failCount = 0;
const failedExtensions = [];

// Get all directories in extensions/
const extensions = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)
  .sort();

for (const extension of extensions) {
  const extensionPath = path.join(EXTENSIONS_DIR, extension);
  const packageJsonPath = path.join(extensionPath, 'package.json');

  // Skip if no package.json
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⊘ Skipping ${extension} (no package.json)`);
    skipCount++;
    continue;
  }

  console.log(`\n📦 Installing dependencies for ${extension}...`);

  try {
    execSync('yarn install', {
      cwd: extensionPath,
      stdio: 'inherit', // Show output in real-time
      encoding: 'utf8'
    });
    console.log(`  ✓ Success`);
    successCount++;
  } catch (error) {
    console.error(`  ✗ Failed`);
    failCount++;
    failedExtensions.push(extension);
  }
}

console.log('\n==============================================');
console.log('Summary:');
console.log(`  ✓ Successful: ${successCount}`);
console.log(`  ⊘ Skipped: ${skipCount}`);
console.log(`  ✗ Failed: ${failCount}`);

if (failCount > 0) {
  console.log('\nFailed extensions:');
  failedExtensions.forEach(ext => console.log(`  - ${ext}`));
  process.exit(1);
}

console.log('\nAll extensions installed successfully!');
