#!/usr/bin/env node

/**
 * macOS Code Signing and Notarization Script for Vortex
 * 
 * This script handles code signing and notarization of the Vortex application for macOS.
 * It uses the Apple notarization service to submit the app for notarization and then
 * staples the notarization ticket to the app bundle.
 * 
 * Prerequisites:
 * - Apple Developer ID certificate installed in Keychain
 * - Apple ID credentials with app-specific password
 * - Xcode command line tools installed
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

// Configuration
const APP_NAME = 'Vortex';
const APP_ID = 'com.nexusmods.vortex';
const BUILD_PATH = path.join(__dirname, '..', 'dist', 'mac');
const APP_PATH = path.join(BUILD_PATH, `${APP_NAME}.app`);
const ZIP_PATH = path.join(BUILD_PATH, `${APP_NAME}.zip`);

// Environment variables (should be set in .env file or CI/CD environment)
// For local development, create a .env file with these variables:
// APPLE_ID=your-apple-id@example.com
// APPLE_ID_PASSWORD=your-app-specific-password
// APPLE_TEAM_ID=your-team-id
const APPLE_ID = process.env.APPLE_ID;
const APPLE_ID_PASSWORD = process.env.APPLE_ID_PASSWORD; // App-specific password
const TEAM_ID = process.env.APPLE_TEAM_ID;

/**
 * Execute a command and return a promise
 */
function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, { 
      stdio: 'inherit',
      ...options
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
 * Check if required environment variables are set
 */
function checkEnvironment() {
  const missing = [];
  
  if (!APPLE_ID) missing.push('APPLE_ID');
  if (!APPLE_ID_PASSWORD) missing.push('APPLE_ID_PASSWORD');
  if (!TEAM_ID) missing.push('APPLE_TEAM_ID');
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Verify that the app bundle exists
 */
async function verifyAppBundle() {
  try {
    await fs.access(APP_PATH);
    console.log(`Found app bundle at: ${APP_PATH}`);
  } catch (err) {
    throw new Error(`App bundle not found at ${APP_PATH}. Please build the app first.`);
  }
}

/**
 * Sign the app bundle with Developer ID certificate
 */
async function signApp() {
  console.log('Signing app bundle...');
  
  // Get the Developer ID certificate (assumes it's installed in Keychain)
  const certName = 'Developer ID Application';
  
  // Sign the app bundle
  await execCommand('codesign', [
    '--force',
    '--deep',
    '--sign', certName,
    '--timestamp',
    '--options', 'runtime',
    APP_PATH
  ]);
  
  console.log('App bundle signed successfully');
}

/**
 * Verify the code signature
 */
async function verifySignature() {
  console.log('Verifying code signature...');
  
  await execCommand('codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=2',
    APP_PATH
  ]);
  
  console.log('Code signature verified successfully');
}

/**
 * Create a zip archive of the app bundle for notarization
 */
async function createZipArchive() {
  console.log('Creating zip archive for notarization...');
  
  // Remove existing zip file if it exists
  try {
    await fs.unlink(ZIP_PATH);
  } catch (err) {
    // File doesn't exist, that's fine
  }
  
  // Create zip archive
  await execCommand('ditto', [
    '-c',
    '-k',
    '--keepParent',
    APP_PATH,
    ZIP_PATH
  ]);
  
  console.log(`Created zip archive at: ${ZIP_PATH}`);
}

/**
 * Submit the app for notarization
 */
async function submitForNotarization() {
  console.log('Submitting app for notarization...');
  
  // Submit for notarization using xcrun notarytool
  await execCommand('xcrun', [
    'notarytool',
    'submit',
    ZIP_PATH,
    '--apple-id', APPLE_ID,
    '--password', APPLE_ID_PASSWORD,
    '--team-id', TEAM_ID,
    '--wait'
  ]);
  
  console.log('App notarization submitted successfully');
}

/**
 * Staple the notarization ticket to the app bundle
 */
async function stapleTicket() {
  console.log('Stapling notarization ticket...');
  
  await execCommand('xcrun', [
    'stapler',
    'staple',
    APP_PATH
  ]);
  
  console.log('Notarization ticket stapled successfully');
}

/**
 * Verify the notarization
 */
async function verifyNotarization() {
  console.log('Verifying notarization...');
  
  await execCommand('spctl', [
    '--assess',
    '--type', 'exec',
    '--verbose',
    APP_PATH
  ]);
  
  console.log('Notarization verified successfully');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting macOS code signing and notarization process...');
    
    // Check environment
    checkEnvironment();
    
    // Verify app bundle exists
    await verifyAppBundle();
    
    // Sign the app
    await signApp();
    
    // Verify signature
    await verifySignature();
    
    // Create zip archive
    await createZipArchive();
    
    // Submit for notarization
    await submitForNotarization();
    
    // Staple ticket
    await stapleTicket();
    
    // Verify notarization
    await verifyNotarization();
    
    console.log('macOS code signing and notarization completed successfully!');
    
  } catch (err) {
    console.error('Error during code signing and notarization:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  signApp,
  verifySignature,
  createZipArchive,
  submitForNotarization,
  stapleTicket,
  verifyNotarization
};