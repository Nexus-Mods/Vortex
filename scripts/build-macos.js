#!/usr/bin/env node

/**
 * macOS Build Script for Vortex
 * 
 * This script orchestrates the complete build process for macOS, including:
 * - Building the application with webpack
 * - Creating distributable packages with electron-builder
 * - Code signing the application
 * - Notarizing the application with Apple's notarization service
 * 
 * Usage:
 *   node scripts/build-macos.js [--notarize]
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const SHOULD_NOTARIZE = process.argv.includes('--notarize');

/**
 * Execute a command and return a promise
 */
function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, { 
      stdio: 'inherit',
      ...options,
      shell: true
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Build the application with webpack
 */
async function buildApp() {
  console.log('Building application with webpack...');
  
  await execCommand('webpack', [
    '--config', 'webpack.main.config.js'
  ]);
  
  await execCommand('webpack', [
    '--config', 'webpack.renderer.config.js'
  ]);
  
  console.log('Application built successfully');
}

/**
 * Package the application with electron-builder
 */
async function packageApp() {
  console.log('Packaging application with electron-builder...');
  
  const args = [
    'electron-builder',
    '--config', 'electron-builder-config.json',
    '--mac'
  ];
  
  // Add notarization flag if requested
  if (SHOULD_NOTARIZE) {
    args.push('--publish', 'never');
  }
  
  await execCommand('npx', args);
  
  console.log('Application packaged successfully');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(`Starting macOS build process... ${SHOULD_NOTARIZE ? '(with notarization)' : '(without notarization)'}`);
    
    // Build the application
    await buildApp();
    
    // Package the application
    await packageApp();
    
    // Notarize if requested
    if (SHOULD_NOTARIZE) {
      console.log('Starting notarization process...');
      
      // Run the notarization script
      await execCommand('node', [
        path.join(__dirname, 'notarize-macos.js')
      ]);
      
      console.log('Notarization completed successfully');
    }
    
    console.log('macOS build process completed successfully!');
    
  } catch (err) {
    console.error('Error during build process:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}