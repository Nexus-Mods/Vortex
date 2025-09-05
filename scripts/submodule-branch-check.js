#!/usr/bin/env node

// Submodule Branch Check and Fix Script
// This script ensures all Git submodules are on the correct branch with no detached HEAD states
// and any untracked changes are committed and pushed where possible

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
      // Default to master if no branch is configured
      return 'master';
    }
  } catch (error) {
    console.error(`Error getting configured branch for ${submodulePath}: ${error.message}`);
    return 'master';
  }
}

// Function to switch a submodule from detached HEAD to the correct branch
async function fixDetachedHead(submodulePath) {
  const configuredBranch = getConfiguredBranch(submodulePath);
  console.log(`Switching ${submodulePath} from detached HEAD to ${configuredBranch}`);
  
  try {
    // Fetch the latest changes
    await execCommand(`git fetch origin`, { cwd: submodulePath });
    
    // Check if the branch exists locally
    const branchExists = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${configuredBranch}`], {
      cwd: submodulePath
    });
    
    if (branchExists.status === 0) {
      // Branch exists locally, switch to it
      await execCommand(`git checkout ${configuredBranch}`, { cwd: submodulePath });
    } else {
      // Branch doesn't exist locally, create it from origin
      await execCommand(`git checkout -b ${configuredBranch} origin/${configuredBranch}`, { cwd: submodulePath });
    }
    
    console.log(`Successfully switched ${submodulePath} to ${configuredBranch}`);
  } catch (error) {
    console.error(`Failed to switch ${submodulePath} to ${configuredBranch}: ${error.message}`);
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
    await execCommand('git commit -m "Commit untracked changes"', { cwd: submodulePath });
    
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

// Main function to check and fix all submodules
async function checkAndFixSubmodules() {
  console.log('Checking and fixing submodule branches...');
  
  // Read .gitmodules file to get all submodules
  const gitmodulesPath = path.join(process.cwd(), '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) {
    console.error('No .gitmodules file found');
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
  
  console.log(`Found ${submodulePaths.length} submodules`);
  
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
    } else {
      const branch = getSubmoduleBranch(fullPath);
      console.log(`${submodulePath} is on branch: ${branch}`);
    }
    
    // Check for uncommitted changes
    if (hasUncommittedChanges(fullPath)) {
      console.log(`${submodulePath} has uncommitted changes`);
      await commitChanges(fullPath);
      await pushChanges(fullPath);
    } else {
      console.log(`${submodulePath} has no uncommitted changes`);
    }
  }
  
  console.log('\n✅ Submodule branch check and fix completed!');
}

// Run the script
checkAndFixSubmodules()
  .catch(error => {
    console.error('Error during submodule check:', error);
    process.exit(1);
  });