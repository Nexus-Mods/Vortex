#!/usr/bin/env node

// Submodule Branch Check and Fix Script for macOS Branches
// This script ensures all Git submodules are on the macos-experimental branch
// and not on master or in a detached HEAD state

const { spawn, spawnSync } = require('child_process');
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
    console.log(`⚡ Executing: ${command}`);
    
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
      console.error(`❌ Failed to get branch for ${submodulePath}: ${result.stderr}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error getting branch for ${submodulePath}: ${error.message}`);
    return null;
  }
}

// Function to check if a submodule is in detached HEAD state
function isDetachedHead(submodulePath) {
  const branch = getSubmoduleBranch(submodulePath);
  return branch === 'HEAD';
}

// Function to get the configured branch for a submodule from .gitmodules
function getConfiguredBranch(submodulePath) {
  try {
    const result = spawnSync('git', ['config', '-f', '.gitmodules', `submodule.${submodulePath}.branch`], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    
    if (result.status === 0) {
      return result.stdout.trim();
    } else {
      // Default to macos-experimental for all submodules
      return 'macos-experimental';
    }
  } catch (error) {
    console.error(`❌ Error getting configured branch for ${submodulePath}: ${error.message}`);
    return 'macos-experimental';
  }
}

// Function to switch a submodule to the macos-experimental branch
async function switchToMacOSBranch(submodulePath) {
  const targetBranch = 'macos-experimental';
  console.log(`🔄 Switching ${submodulePath} to ${targetBranch}`);
  
  try {
    // Fetch the latest changes
    await execCommand(`git fetch origin`, { cwd: submodulePath });
    
    // Check if the macos-experimental branch exists on origin
    const branchExists = spawnSync('git', ['ls-remote', '--heads', 'origin', targetBranch], {
      cwd: submodulePath,
      encoding: 'utf8'
    });
    
    if (branchExists.stdout.trim() === '') {
      console.log(`⚠️ ${targetBranch} branch does not exist on origin for ${submodulePath}`);
      // Check if master branch exists and use it as fallback
      const masterExists = spawnSync('git', ['ls-remote', '--heads', 'origin', 'master'], {
        cwd: submodulePath,
        encoding: 'utf8'
      });
      
      if (masterExists.stdout.trim() !== '') {
        console.log(`🔄 Using master branch as fallback for ${submodulePath}`);
        await switchToBranch(submodulePath, 'master');
      } else {
        console.log(`⚠️ No suitable branch found for ${submodulePath}`);
      }
      return;
    }
    
    // Switch to macos-experimental branch
    await switchToBranch(submodulePath, targetBranch);
    
    console.log(`✅ Successfully switched ${submodulePath} to ${targetBranch}`);
  } catch (error) {
    console.error(`❌ Failed to switch ${submodulePath} to ${targetBranch}: ${error.message}`);
  }
}

// Helper function to switch to a specific branch
async function switchToBranch(submodulePath, branchName) {
  // Check if the branch exists locally
  const branchExists = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], {
    cwd: submodulePath
  });
  
  if (branchExists.status === 0) {
    // Branch exists locally, switch to it
    await execCommand(`git checkout ${branchName}`, { cwd: submodulePath });
  } else {
    // Branch doesn't exist locally, create it from origin
    await execCommand(`git checkout -b ${branchName} origin/${branchName}`, { cwd: submodulePath });
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
    console.error(`❌ Error checking for changes in ${submodulePath}: ${error.message}`);
    return false;
  }
}

// Function to commit changes in a submodule
async function commitChanges(submodulePath) {
  console.log(`💾 Committing changes in ${submodulePath}`);
  
  try {
    // Add all changes
    await execCommand('git add .', { cwd: submodulePath });
    
    // Commit changes
    await execCommand('git commit -m "Commit untracked changes"', { cwd: submodulePath });
    
    console.log(`✅ Successfully committed changes in ${submodulePath}`);
  } catch (error) {
    console.error(`❌ Failed to commit changes in ${submodulePath}: ${error.message}`);
  }
}

// Function to push changes from a submodule
async function pushChanges(submodulePath) {
  const branch = getSubmoduleBranch(submodulePath);
  if (!branch || branch === 'HEAD') {
    console.log(`⚠️ Cannot push from ${submodulePath}: not on a branch`);
    return;
  }
  
  console.log(`📤 Pushing changes from ${submodulePath} on branch ${branch}`);
  
  try {
    await execCommand(`git push origin ${branch}`, { cwd: submodulePath });
    console.log(`✅ Successfully pushed changes from ${submodulePath}`);
  } catch (error) {
    console.error(`❌ Failed to push changes from ${submodulePath}: ${error.message}`);
    console.log(`ℹ️ You may need to manually push changes or fork the repository if you don't have push permissions`);
  }
}

// Main function to check and fix all submodules
async function checkAndFixSubmodules() {
  console.log('🔍 Checking and fixing submodule branches for macOS...');
  
  // Read .gitmodules file to get all submodules
  const gitmodulesPath = path.join(process.cwd(), '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) {
    console.error('❌ No .gitmodules file found');
    process.exit(1);
  }
  
  const gitmodulesContent = fs.readFileSync(gitmodulesPath, 'utf8');
  const submodulePaths = [];
  
  // Extract submodule paths from .gitmodules
  const submoduleRegex = /\[submodule "([^"]+)"\]/g;
  let match;
  while ((match = submoduleRegex.exec(gitmodulesContent)) !== null) {
    submodulePaths.push(match[1]);
  }
  
  console.log(`📋 Found ${submodulePaths.length} submodules`);
  
  // Process each submodule
  for (const submodulePath of submodulePaths) {
    const fullPath = path.join(process.cwd(), submodulePath);
    
    // Check if submodule directory exists
    if (!fs.existsSync(fullPath)) {
      console.log(`⏭️ Skipping ${submodulePath}: directory does not exist`);
      continue;
    }
    
    console.log(`\n🔧 Processing ${submodulePath}...`);
    
    // Get current branch
    const currentBranch = getSubmoduleBranch(fullPath);
    
    // Check if on master or not on macos-experimental
    if (currentBranch === 'master' || currentBranch !== 'macos-experimental') {
      console.log(`⚠️ ${submodulePath} is on branch: ${currentBranch}`);
      await switchToMacOSBranch(fullPath);
    } else if (isDetachedHead(fullPath)) {
      console.log(`⚠️ ${submodulePath} is in detached HEAD state`);
      await switchToMacOSBranch(fullPath);
    } else {
      console.log(`🌿 ${submodulePath} is on branch: ${currentBranch}`);
    }
    
    // Check for uncommitted changes
    if (hasUncommittedChanges(fullPath)) {
      console.log(`📝 ${submodulePath} has uncommitted changes`);
      await commitChanges(fullPath);
      await pushChanges(fullPath);
    } else {
      console.log(`✅ ${submodulePath} has no uncommitted changes`);
    }
  }
  
  console.log('\n🎉 Submodule branch check and fix for macOS completed!');
}

// Run the script
checkAndFixSubmodules()
  .catch(error => {
    console.error('❌ Error during submodule check:', error);
    process.exit(1);
  });