#!/usr/bin/env node

/**
 * Clean script for Vortex development environment
 * 
 * Usage:
 *   yarn clean                 - Clean basic build directories and reinstall dependencies
 *   yarn clean --dev-data      - Also clean application support data (vortex_devel directory)
 *   yarn clean --full          - Clean all build directories AND application support data
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
const cleanDevData = args.includes('--dev-data');
const cleanFull = args.includes('--full');

// Function to execute a command
function execCommand(command, options = {}) {
  try {
    console.log(`Executing: ${command}`);
    execSync(command, { 
      stdio: 'inherit',
      shell: true,
      ...options
    });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

// Function to remove directory recursively
function removeDir(dirPath) {
  return new Promise((resolve, reject) => {
    fs.rm(dirPath, { recursive: true, force: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Successfully removed directory: ${dirPath}`);
        resolve();
      }
    });
  });
}

// Main function
function main() {
  try {
    console.log('Running clean command...');
    
    // Execute the existing clean steps
    execCommand('yarn add rm-local-modules');
    execCommand('npx rm-local-modules');
    
    // Clean build directories
    console.log('Cleaning build directories...');
    execCommand('rimraf out');
    
    // Clean build state files to ensure extensions rebuild after clean
    console.log('Cleaning build state files...');
    execCommand('rimraf BuildState*.json');
    
    // If --full flag is provided, clean additional build directories
    if (cleanFull) {
      console.log('Full clean mode: removing additional build directories...');
      execCommand('rimraf dist dist_custom dist_portable dist_web force');
      execCommand('rimraf app/bundledPlugins');
      execCommand('rimraf sourcemaps');
      execCommand('rimraf coverage');
      execCommand('rimraf doc');
    }
    
    execCommand('yarn install --check-files');
    
    // Check if we need to clean dev data (either --dev-data flag or --full flag)
    if (cleanDevData || cleanFull) {
      const flagUsed = cleanFull ? '--full' : '--dev-data';
      console.log(`Cleaning development data (${flagUsed} flag provided)`);
      
      // Check if we're on macOS
      if (os.platform() === 'darwin') {
        const vortexDevDir = path.join(os.homedir(), 'Library', 'Application Support', 'vortex_devel');
        
        // Check if directory exists
        if (fs.existsSync(vortexDevDir)) {
          console.log(`Removing ${vortexDevDir}...`);
          removeDir(vortexDevDir);
          console.log('Successfully removed vortex_devel directory');
        } else {
          console.log('vortex_devel directory does not exist, nothing to remove');
        }
      } else {
        console.log('The --dev-data flag is only supported on macOS systems');
      }
    } else {
      console.log('Skipping development data cleanup (use --dev-data or --full flag to also remove vortex_devel directory)');
    }
    
    console.log('Clean process completed successfully');
  } catch (error) {
    console.error('Error during clean process:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the main function
main();