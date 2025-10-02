#!/usr/bin/env node

const { execSync } = require('child_process');

function isMacOS() {
  return process.platform === 'darwin';
}

function hasSevenZip() {
  try {
    const path = execSync('which 7z', { encoding: 'utf8' }).trim();
    return path && path.length > 0;
  } catch (err) {
    return false;
  }
}

function hasHomebrew() {
  try {
    const path = execSync('which brew', { encoding: 'utf8' }).trim();
    return path && path.length > 0;
  } catch (err) {
    return false;
  }
}

function installP7zip() {
  try {
    // Install p7zip if not already installed
    execSync('brew ls --versions p7zip || brew install p7zip', { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.warn('⚠️  Failed to install p7zip via Homebrew:', err.message);
    return false;
  }
}

function main() {
  if (!isMacOS()) {
    return;
  }

  if (hasSevenZip()) {
    console.log('✅ p7zip (7z) is already available on this system');
    return;
  }

  if (!hasHomebrew()) {
    console.warn('⚠️  Homebrew is not available. Please install p7zip manually: brew install p7zip');
    return;
  }

  console.log('📦 Installing p7zip via Homebrew...');
  const success = installP7zip();
  if (success && hasSevenZip()) {
    console.log('✅ Successfully installed p7zip (7z)');
  } else {
    console.warn('⚠️  p7zip installation did not succeed or 7z not found in PATH');
  }
}

main();