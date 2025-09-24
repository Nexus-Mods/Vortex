#!/usr/bin/env node

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const cleanDevData = args.includes('--dev-data');

// Function to execute a command and return a promise
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const cmdArgs = parts.slice(1);
    
    const child = spawn(cmd, cmdArgs, { 
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
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

// Main async function
async function main() {
  try {
    console.log('Running clean command...');
    
    // Execute the existing clean steps
    await execCommand('yarn add rm-local-modules');
    await execCommand('rm-local-modules');
    await execCommand('rimraf out');
    await execCommand('yarn install --check-files');
    
    // Check if we need to clean dev data
    if (cleanDevData) {
      console.log('Cleaning development data (--dev-data flag provided)');
      
      // Check if we're on macOS
      if (os.platform() === 'darwin') {
        const vortexDevDir = path.join(os.homedir(), 'Library', 'Application Support', 'vortex_devel');
        
        // Check if directory exists
        if (fs.existsSync(vortexDevDir)) {
          console.log(`Removing ${vortexDevDir}...`);
          await removeDir(vortexDevDir);
          console.log('Successfully removed vortex_devel directory');
        } else {
          console.log('vortex_devel directory does not exist, nothing to remove');
        }
      } else {
        console.log('The --dev-data flag is only supported on macOS systems');
      }
    } else {
      console.log('Skipping development data cleanup (use --dev-data flag to also remove vortex_devel directory)');
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