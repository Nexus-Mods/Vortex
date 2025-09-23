#!/usr/bin/env node

// Project Setup Verification Script
// This script verifies the correct setup of the Vortex project for macOS development
// including submodule branch verification and SCSS compilation verification

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

// Load branch mapping configuration
const configPath = path.join(__dirname, 'macos-branch-mapping.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {
  submoduleBranchMapping: {
    "extensions/changelog-dashlet": "macos-experimental",
    "extensions/issue-tracker": "macos-experimental",
    "extensions/collections": "macos-experimental",
    "extensions/theme-switcher": "macos-tahoe-theme"
  },
  defaultBranch: "master"
};

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

// Function to get the current branch of a submodule
function getSubmoduleBranch(submodulePath) {
  try {
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: submodulePath,
      encoding: 'utf8'
    });
    
    if (result.status === 0) {
      return result.stdout.trim();
    } else {
      console.error(`Failed to get branch for ${submodulePath}: ${result.stderr}`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting branch for ${submodulePath}: ${error.message}`);
    return null;
  }
}

// Function to check if a submodule is in detached HEAD state
function isDetachedHead(submodulePath) {
  const branch = getSubmoduleBranch(submodulePath);
  return branch === 'HEAD';
}

// Function to get the expected branch for a submodule
function getExpectedBranch(submodulePath) {
  return config.submoduleBranchMapping[submodulePath] || config.defaultBranch;
}

// Function to switch a submodule from detached HEAD to the correct branch
async function fixDetachedHead(submodulePath) {
  const expectedBranch = getExpectedBranch(submodulePath);
  console.log(`Switching ${submodulePath} from detached HEAD to ${expectedBranch}`);
  
  try {
    // Fetch the latest changes
    await execCommand(`git fetch origin`, { cwd: submodulePath });
    
    // Check if the branch exists locally
    const branchExists = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${expectedBranch}`], {
      cwd: submodulePath
    });
    
    if (branchExists.status === 0) {
      // Branch exists locally, switch to it
      await execCommand(`git checkout ${expectedBranch}`, { cwd: submodulePath });
    } else {
      // Check if remote branch exists
      const remoteBranchExists = spawnSync('git', ['ls-remote', '--heads', 'origin', expectedBranch], {
        cwd: submodulePath,
        encoding: 'utf8'
      });
      
      if (remoteBranchExists.status === 0 && remoteBranchExists.stdout.trim() !== '') {
        // Branch exists remotely, create it locally
        await execCommand(`git checkout -b ${expectedBranch} origin/${expectedBranch}`, { cwd: submodulePath });
      } else {
        console.log(`Remote branch ${expectedBranch} does not exist for ${submodulePath}, staying on current branch`);
      }
    }
    
    console.log(`Successfully switched ${submodulePath} to ${expectedBranch}`);
  } catch (error) {
    console.error(`Failed to switch ${submodulePath} to ${expectedBranch}: ${error.message}`);
  }
}

// Function to check for uncommitted changes in a submodule
function hasUncommittedChanges(submodulePath) {
  try {
    const result = spawnSync('git', ['status', '--porcelain'], {
      cwd: submodulePath,
      encoding: 'utf8'
    });
    
    return result.stdout.trim() !== '';
  } catch (error) {
    console.error(`Error checking for changes in ${submodulePath}: ${error.message}`);
    return false;
  }
}

// Function to commit changes in a submodule
async function commitChanges(submodulePath) {
  console.log(`Committing changes in ${submodulePath}`);
  
  try {
    // Add all changes
    await execCommand('git add .', { cwd: submodulePath });
    
    // Commit changes
    await execCommand('git commit -m "Commit untracked changes during project setup verification"', { cwd: submodulePath });
    
    console.log(`Successfully committed changes in ${submodulePath}`);
  } catch (error) {
    console.error(`Failed to commit changes in ${submodulePath}: ${error.message}`);
  }
}

// Function to push changes from a submodule
async function pushChanges(submodulePath) {
  const branch = getSubmoduleBranch(submodulePath);
  if (!branch || branch === 'HEAD') {
    console.log(`Cannot push from ${submodulePath}: not on a branch`);
    return;
  }
  
  console.log(`Pushing changes from ${submodulePath} on branch ${branch}`);
  
  try {
    await execCommand(`git push origin ${branch}`, { cwd: submodulePath });
    console.log(`Successfully pushed changes from ${submodulePath}`);
  } catch (error) {
    console.error(`Failed to push changes from ${submodulePath}: ${error.message}`);
    console.log(`You may need to manually push changes or fork the repository if you don't have push permissions`);
  }
}

// Submodule verification function
async function verifySubmodules() {
  console.log('=== Submodule Verification ===');
  
  // Read .gitmodules file to get all submodules
  const gitmodulesPath = path.join(process.cwd(), '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) {
    console.error('No .gitmodules file found');
    return false;
  }
  
  const gitmodulesContent = fs.readFileSync(gitmodulesPath, 'utf8');
  const submodulePaths = [];
  
  // Extract submodule paths from .gitmodules
  const submoduleRegex = /\[submodule "([^"]+)"\]/g;
  let match;
  while ((match = submoduleRegex.exec(gitmodulesContent)) !== null) {
    submodulePaths.push(match[1]);
  }
  
  console.log(`Found ${submodulePaths.length} submodules`);
  
  let verificationPassed = true;
  
  // Process each submodule
  for (const submodulePath of submodulePaths) {
    const fullPath = path.join(process.cwd(), submodulePath);
    
    // Check if submodule directory exists
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping ${submodulePath}: directory does not exist`);
      continue;
    }
    
    console.log(`\nProcessing ${submodulePath}...`);
    
    // Check if in detached HEAD state
    if (isDetachedHead(fullPath)) {
      console.log(`${submodulePath} is in detached HEAD state`);
      await fixDetachedHead(fullPath);
      verificationPassed = false; // Mark as needing fix
    } else {
      const branch = getSubmoduleBranch(fullPath);
      const expectedBranch = getExpectedBranch(submodulePath);
      
      if (branch !== expectedBranch) {
        console.log(`${submodulePath} is on branch: ${branch}, expected: ${expectedBranch}`);
        verificationPassed = false; // Mark as not matching expected
      } else {
        console.log(`${submodulePath} is on the correct branch: ${branch}`);
      }
    }
    
    // Check for uncommitted changes
    if (hasUncommittedChanges(fullPath)) {
      console.log(`${submodulePath} has uncommitted changes`);
      // We don't automatically commit changes, just report them
      verificationPassed = false;
    } else {
      console.log(`${submodulePath} has no uncommitted changes`);
    }
  }
  
  console.log('\n✅ Submodule verification completed!');
  return verificationPassed;
}

// SCSS compilation verification function
async function verifySCSSCompilation() {
  console.log('\n=== SCSS Compilation Verification ===');
  
  // List of all extension SCSS files to test
  const extensionSCSSFiles = [
    // Already fixed extensions
    'extensions/documentation/src/stylesheets/documentation.scss',
    'extensions/collections/style.scss',
    'extensions/issue-tracker/src/issue_tracker.scss',
    
    // Other extensions to check
    'extensions/titlebar-launcher/titlebar-launcher.scss',
    'extensions/mod-content/src/mod-content.scss',
    'extensions/gamebryo-savegame-management/src/stylesheets/savegame_management.scss',
    'extensions/game-pillarsofeternity2/src/stylesheet.scss',
    'extensions/mod-dependency-manager/src/stylesheets/node-content-renderer.scss',
    'extensions/mod-dependency-manager/src/stylesheets/dependency-manager.scss',
    'extensions/mo-import/src/stylesheets/mo-import.scss',
    'extensions/meta-editor/src/stylesheets/metaeditor.scss',
    'extensions/gamebryo-plugin-management/src/stylesheets/plugin_management.scss',
    'extensions/morrowind-plugin-management/src/stylesheet.scss',
    'extensions/mod-highlight/src/stylesheets/mod-highlight.scss',
    'extensions/feedback/src/stylesheets/feedback.scss',
    'extensions/changelog-dashlet/src/changelog.scss',
    'extensions/script-extender-error-check/src/style.scss',
    'extensions/nmm-import-tool/src/stylesheets/import-tool.scss',
    'extensions/extension-dashlet/src/extensions-dashlet.scss',
    'extensions/games/game-masterchiefcollection/masterchief.scss',
    'extensions/games/game-stardewvalley/sdvstyle.scss'
  ];

  // Include paths for SASS compilation
  const includePaths = [
    path.join(__dirname, '..', 'src', 'stylesheets'),
    path.join(__dirname, '..', 'app', 'assets', 'css'),
    path.join(__dirname, '..', 'src', 'stylesheets', 'bootstrap'),
    path.join(__dirname, '..', 'src', 'stylesheets', 'bootstrap', 'bootstrap')
  ];

  console.log('Testing SASS compilation for all extensions...\n');

  let passed = 0;
  let failed = 0;
  const failedFiles = [];

  for (const scssFile of extensionSCSSFiles) {
    const fullPath = path.join(__dirname, '..', scssFile);
    
    if (fs.existsSync(fullPath)) {
      try {
        const result = sass.renderSync({
          file: fullPath,
          includePaths: includePaths,
          outputStyle: 'compressed'
        });
        
        console.log(`✓ ${scssFile} - SUCCESS (${result.css.length} bytes)`);
        passed++;
      } catch (error) {
        console.error(`✗ ${scssFile} - FAILED`);
        console.error(`  Error: ${error.message}`);
        if (error.formatted) {
          console.error(`  Details: ${error.formatted.split('\n')[0]}`);
        }
        failed++;
        failedFiles.push({ file: scssFile, error: error.message });
      }
    } else {
      console.log(`? ${scssFile} - NOT FOUND`);
    }
  }

  // Test core SCSS files
  const coreSCSSFiles = [
    'src/stylesheets/style.scss',
    'src/stylesheets/loadingScreen.scss'
  ];

  console.log('\nTesting core SCSS files...\n');

  for (const scssFile of coreSCSSFiles) {
    const fullPath = path.join(__dirname, '..', scssFile);
    
    if (fs.existsSync(fullPath)) {
      try {
        const result = sass.renderSync({
          file: fullPath,
          includePaths: includePaths,
          outputStyle: 'compressed'
        });
        
        console.log(`✓ ${scssFile} - SUCCESS (${result.css.length} bytes)`);
        passed++;
      } catch (error) {
        console.error(`✗ ${scssFile} - FAILED`);
        console.error(`  Error: ${error.message}`);
        if (error.formatted) {
          console.error(`  Details: ${error.formatted.split('\n')[0]}`);
        }
        failed++;
        failedFiles.push({ file: scssFile, error: error.message });
      }
    } else {
      console.log(`? ${scssFile} - NOT FOUND`);
    }
  }

  console.log(`\n=== SCSS Compilation Summary ===`);
  console.log(`${passed} files compiled successfully, ${failed} files failed`);

  if (failed > 0) {
    console.log('\nFailed files:');
    failedFiles.forEach(({ file, error }) => {
      console.log(`  ${file}: ${error.split('\n')[0]}`);
    });
    return false;
  }
  
  console.log('✅ SCSS compilation verification completed!');
  return true;
}

// Main function to run all verification checks
async function runProjectSetupVerification() {
  console.log('Starting Project Setup Verification...\n');
  
  // Run submodule verification
  const submoduleVerificationPassed = await verifySubmodules();
  
  // Run SCSS compilation verification
  const scssVerificationPassed = await verifySCSSCompilation();
  
  console.log('\n=== Final Verification Results ===');
  console.log(`Submodule Verification: ${submoduleVerificationPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`SCSS Compilation Verification: ${scssVerificationPassed ? 'PASSED' : 'FAILED'}`);
  
  if (submoduleVerificationPassed && scssVerificationPassed) {
    console.log('\n🎉 All verifications passed! Project setup is correct.');
    return true;
  } else {
    console.log('\n❌ Some verifications failed. Please check the output above.');
    return false;
  }
}

// Run the script if called directly
if (require.main === module) {
  runProjectSetupVerification()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error during project setup verification:', error);
      process.exit(1);
    });
}

module.exports = {
  verifySubmodules,
  verifySCSSCompilation,
  runProjectSetupVerification
};