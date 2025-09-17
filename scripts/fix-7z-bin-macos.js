#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Fix for 7z-bin package on macOS
 * The 7z-bin package doesn't include macOS binaries in the darwin directory,
 * but Vortex expects them there. This script creates the darwin directory
 * and symlinks to the system 7z binary if available.
 */

function fix7zBinMacOS() {
  // Only run on macOS
  if (process.platform !== 'darwin') {
    console.log('7z-bin macOS fix: Skipping (not macOS)');
    return;
  }

  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  const sevenZipBinPath = path.join(nodeModulesPath, '7z-bin');
  const darwinPath = path.join(sevenZipBinPath, 'darwin');
  const darwinBinaryPath = path.join(darwinPath, '7z');

  // Check if 7z-bin package exists
  if (!fs.existsSync(sevenZipBinPath)) {
    console.log('7z-bin macOS fix: 7z-bin package not found, skipping');
    return;
  }

  // Check if darwin directory already exists and has the binary
  if (fs.existsSync(darwinBinaryPath)) {
    console.log('7z-bin macOS fix: darwin/7z already exists');
    return;
  }

  // Find system 7z binary
  let systemSevenZipPath = null;
  const possiblePaths = [
    '/usr/local/bin/7z',
    '/opt/homebrew/bin/7z',
    '/usr/bin/7z'
  ];

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      systemSevenZipPath = possiblePath;
      break;
    }
  }

  // Try to find 7z in PATH
  if (!systemSevenZipPath) {
    try {
      systemSevenZipPath = execSync('which 7z', { encoding: 'utf8' }).trim();
    } catch (error) {
      // 7z not found in PATH
    }
  }

  if (!systemSevenZipPath) {
    console.warn('7z-bin macOS fix: System 7z binary not found. Please install 7-Zip via Homebrew: brew install p7zip');
    return;
  }

  try {
    // Create darwin directory if it doesn't exist
    if (!fs.existsSync(darwinPath)) {
      fs.mkdirSync(darwinPath, { recursive: true });
      console.log('7z-bin macOS fix: Created darwin directory');
    }

    // Create symlink to system 7z binary
    fs.symlinkSync(systemSevenZipPath, darwinBinaryPath);
    console.log(`7z-bin macOS fix: Created symlink from ${darwinBinaryPath} to ${systemSevenZipPath}`);

    // Verify the symlink works
    if (fs.existsSync(darwinBinaryPath)) {
      console.log('7z-bin macOS fix: Successfully fixed 7z-bin for macOS');
    } else {
      console.error('7z-bin macOS fix: Failed to create working symlink');
    }
  } catch (error) {
    console.error('7z-bin macOS fix: Error creating symlink:', error.message);
  }
}

// Run the fix
fix7zBinMacOS();