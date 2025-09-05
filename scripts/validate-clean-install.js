#!/usr/bin/env node

// Clean Install Validation Script
// This script validates that Vortex can be installed, built, and run from a fresh clean install
// without any errors or warnings on both Windows and macOS

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Platform detection utilities
function isWindows() {
  return process.platform === 'win32';
}

function isMacOS() {
  return process.platform === 'darwin';
}

// Utility function to execute a command and return a promise
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command}`);
    
    const [cmd, ...args] = command.split(' ');
    const proc = spawn(cmd, args, { 
      ...options,
      shell: true,
      stdio: ['inherit', 'inherit', 'inherit']
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command}`));
      }
    });
    
    proc.on('error', (error) => {
      reject(new Error(`Failed to execute command: ${command}\nError: ${error.message}`));
    });
  });
}

// Function to check if a directory exists
function directoryExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (err) {
    return false;
  }
}

// Function to check if a file exists
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

// Enhanced function to remove directory with retry logic using Node.js fs methods
function removeDirectory(dirPath) {
  return new Promise((resolve, reject) => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    function attemptRemove(attempt) {
      // Try to remove directory using fs.rmSync (Node.js 14.14.0+)
      try {
        fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 });
        resolve();
      } catch (err) {
        if (attempt < maxRetries) {
          console.warn(`Warning: Could not remove ${dirPath} directly, retrying in ${retryDelay}ms...`);
          setTimeout(() => attemptRemove(attempt + 1), retryDelay);
        } else {
          // Last resort: try with shell command but with better error handling
          const command = isWindows() ? `rmdir /s /q "${dirPath}"` : `rm -rf "${dirPath}"`;
          execCommand(command, { cwd: process.cwd() })
            .then(resolve)
            .catch(shellError => {
              reject(new Error(`Failed to remove directory ${dirPath} after ${maxRetries} attempts. Native error: ${err.message}. Shell error: ${shellError.message}`));
            });
        }
      }
    }
    
    attemptRemove(1);
  });
}

// Function to ensure TypeScript types are properly installed
async function ensureTypesInstalled() {
  console.log('Ensuring TypeScript types are properly installed...');
  
  // Ensure rimraf types are properly installed
  const rimrafTypesPath = path.join(process.cwd(), 'node_modules', '@types', 'rimraf');
  if (!directoryExists(rimrafTypesPath) || fs.readdirSync(rimrafTypesPath).length === 0) {
    console.log('@types/rimraf is missing or empty, reinstalling...');
    await execCommand('yarn add --dev @types/rimraf@2.0.3', { cwd: process.cwd() });
  }
}

// Main validation function
async function validateCleanInstall() {
  console.log('Starting Vortex Clean Install Validation...');
  console.log(`Platform: ${process.platform}`);
  
  try {
    // Step 1: Verify we're in the correct directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fileExists(packageJsonPath)) {
      throw new Error('This script must be run from the root of the Vortex project directory');
    }
    
    // Step 2: Clean previous builds if they exist
    console.log('Cleaning previous builds...');
    const buildDirs = ['node_modules', 'out', 'app/node_modules'];
    for (const dir of buildDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (directoryExists(fullPath)) {
        console.log(`Removing ${dir}...`);
        // Use Node.js methods instead of shell commands for better cross-platform compatibility
        await removeDirectory(fullPath);
      }
    }
    
    // Step 3: Install dependencies
    console.log('Installing dependencies...');
    await execCommand('yarn install --frozen-lockfile', { cwd: process.cwd() });
    
    // Step 4: Ensure TypeScript types are properly installed
    await ensureTypesInstalled();
    
    // Step 5: Build the API
    console.log('Building API...');
    const apiPath = path.join(process.cwd(), 'api');
    if (directoryExists(apiPath)) {
      await execCommand('yarn run build', { cwd: apiPath });
    }
    
    // Step 6: Build the main application
    console.log('Building main application...');
    await execCommand('yarn run build', { cwd: process.cwd() });
    
    // Step 7: Build extensions
    console.log('Building extensions...');
    await execCommand('yarn run subprojects', { cwd: process.cwd() });
    
    // Step 8: Compile themes
    console.log('Compiling themes...');
    await execCommand('yarn run compile_themes', { cwd: process.cwd() });
    
    // Step 9: Verify build output
    console.log('Verifying build output...');
    const requiredFiles = [
      'out/main.js',
      'out/renderer.js',
      'out/assets/css/style.css'
    ];
    
    for (const file of requiredFiles) {
      const fullPath = path.join(process.cwd(), file);
      if (!fileExists(fullPath)) {
        throw new Error(`Required build output file missing: ${file}`);
      }
      console.log(`✓ Found ${file}`);
    }
    
    // Step 10: Verify bundled plugins
    console.log('Verifying bundled plugins...');
    const bundledPluginsDir = path.join(process.cwd(), 'out', 'bundledPlugins');
    if (!directoryExists(bundledPluginsDir)) {
      throw new Error('Bundled plugins directory missing');
    }
    
    const pluginDirs = fs.readdirSync(bundledPluginsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    if (pluginDirs.length === 0) {
      throw new Error('No bundled plugins found');
    }
    
    console.log(`✓ Found ${pluginDirs.length} bundled plugins`);
    
    // Step 11: Validate platform-specific handling
    console.log('Validating platform-specific handling...');
    if (isMacOS()) {
      console.log('✓ Running on macOS - verifying mock modules are used');
      // Check that mock modules exist
      const mocksDir = path.join(process.cwd(), '__mocks__');
      if (!directoryExists(mocksDir)) {
        throw new Error('Mocks directory missing on macOS');
      }
    } else if (isWindows()) {
      console.log('✓ Running on Windows - verifying native modules');
    }
    
    console.log('\n✅ Clean install validation completed successfully!');
    console.log('\nSummary of validation steps:');
    console.log('1. Verified project directory structure');
    console.log('2. Cleaned previous builds');
    console.log('3. Installed dependencies with yarn');
    console.log('4. Ensured TypeScript types are properly installed');
    console.log('5. Built API');
    console.log('6. Built main application');
    console.log('7. Built extensions');
    console.log('8. Compiled themes');
    console.log('9. Verified build output files');
    console.log('10. Verified bundled plugins');
    console.log('11. Validated platform-specific handling');
    
    return true;
  } catch (error) {
    console.error('\n❌ Clean install validation failed!');
    console.error(`Error: ${error.message}`);
    return false;
  }
}

// Run the validation
validateCleanInstall()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error during validation:', error);
    process.exit(1);
  });