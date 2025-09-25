#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Preinstall script for macOS to remove drivelist from package.json files
 * This prevents the native compilation errors during yarn install
 */

function isMacOS() {
  return os.platform() === 'darwin';
}

function backupPackageJson(filePath) {
  const backupPath = filePath + '.backup';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`Created backup: ${backupPath}`);
  }
}

function removeDrivelistFromPackageJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Package.json not found: ${filePath}`);
    return false;
  }

  try {
    // Create backup before modifying
    backupPackageJson(filePath);

    const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let modified = false;

    // Remove from dependencies
    if (packageJson.dependencies && packageJson.dependencies.drivelist) {
      delete packageJson.dependencies.drivelist;
      modified = true;
      console.log(`Removed drivelist from dependencies in ${filePath}`);
    }

    // Remove from optionalDependencies
    if (packageJson.optionalDependencies && packageJson.optionalDependencies.drivelist) {
      delete packageJson.optionalDependencies.drivelist;
      modified = true;
      console.log(`Removed drivelist from optionalDependencies in ${filePath}`);
    }

    // Remove from devDependencies (just in case)
    if (packageJson.devDependencies && packageJson.devDependencies.drivelist) {
      delete packageJson.devDependencies.drivelist;
      modified = true;
      console.log(`Removed drivelist from devDependencies in ${filePath}`);
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`Updated ${filePath}`);
    }

    return modified;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function restorePackageJson(filePath) {
  const backupPath = filePath + '.backup';
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    console.log(`Restored ${filePath} from backup`);
  }
}

function main() {
  if (!isMacOS()) {
    console.log('Not running on macOS, skipping drivelist removal');
    return;
  }

  console.log('Running preinstall script on macOS - removing drivelist from package.json files');

  const rootDir = path.resolve(__dirname, '..');
  const mainPackageJson = path.join(rootDir, 'package.json');
  const appPackageJson = path.join(rootDir, 'app', 'package.json');

  let anyModified = false;

  // Process main package.json
  if (removeDrivelistFromPackageJson(mainPackageJson)) {
    anyModified = true;
  }

  // Process app/package.json
  if (removeDrivelistFromPackageJson(appPackageJson)) {
    anyModified = true;
  }

  if (anyModified) {
    console.log('Successfully removed drivelist from package.json files on macOS');
    console.log('Note: Backups were created and will be restored after installation');
  } else {
    console.log('No drivelist dependencies found to remove');
  }
}

// Handle cleanup on process exit
process.on('exit', () => {
  if (isMacOS()) {
    const rootDir = path.resolve(__dirname, '..');
    const mainPackageJson = path.join(rootDir, 'package.json');
    const appPackageJson = path.join(rootDir, 'app', 'package.json');
    
    // Note: We don't restore here because we want the changes to persist
    // through the install process. The postinstall script will handle restoration.
  }
});

if (require.main === module) {
  main();
}

module.exports = { removeDrivelistFromPackageJson, restorePackageJson, isMacOS };