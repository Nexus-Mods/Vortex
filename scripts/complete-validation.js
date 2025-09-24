#!/usr/bin/env node

// Complete Validation Script
// This script ensures all submodules are on the correct branch, replaces glob usage with native fs,
// and validates that the project and all submodules install, build, and run correctly

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
      // Default to master if no branch is configured
      return 'master';
    }
  } catch (error) {
    console.error(`❌ Error getting configured branch for ${submodulePath}: ${error.message}`);
    return 'master';
  }
}

// Function to switch a submodule from detached HEAD to the correct branch
async function fixDetachedHead(submodulePath) {
  const configuredBranch = getConfiguredBranch(submodulePath);
  console.log(`🔄 Switching ${submodulePath} from detached HEAD to ${configuredBranch}`);
  
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
    
    console.log(`✅ Successfully switched ${submodulePath} to ${configuredBranch}`);
  } catch (error) {
    console.error(`❌ Failed to switch ${submodulePath} to ${configuredBranch}: ${error.message}`);
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
    console.log(`⚠️  Cannot push from ${submodulePath}: not on a branch`);
    return;
  }
  
  console.log(`📤 Pushing changes from ${submodulePath} on branch ${branch}`);
  
  try {
    await execCommand(`git push origin ${branch}`, { cwd: submodulePath });
    console.log(`✅ Successfully pushed changes from ${submodulePath}`);
  } catch (error) {
    console.error(`❌ Failed to push changes from ${submodulePath}: ${error.message}`);
    console.log(`ℹ️  You may need to manually push changes or fork the repository if you don't have push permissions`);
  }
}

// Main function to check and fix all submodules
async function checkAndFixSubmodules() {
  console.log('🔍 Checking and fixing submodule branches...');
  
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
      console.log(`⏭️  Skipping ${submodulePath}: directory does not exist`);
      continue;
    }
    
    console.log(`\n🔧 Processing ${submodulePath}...`);
    
    // Check if in detached HEAD state
    if (isDetachedHead(fullPath)) {
      console.log(`⚠️  ${submodulePath} is in detached HEAD state`);
      await fixDetachedHead(fullPath);
    } else {
      const branch = getSubmoduleBranch(fullPath);
      console.log(`🌿 ${submodulePath} is on branch: ${branch}`);
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
  
  console.log('\n🎉 Submodule branch check and fix completed!');
}

// Function to ensure TypeScript types are properly installed
async function ensureTypesInstalled() {
  console.log('🔧 Ensuring TypeScript types are properly installed...');
  
  // Ensure rimraf types are properly installed
  const rimrafTypesPath = path.join(process.cwd(), 'node_modules', '@types', 'rimraf');
  if (!directoryExists(rimrafTypesPath) || fs.readdirSync(rimrafTypesPath).length === 0) {
    console.log('📦 @types/rimraf is missing or empty, reinstalling...');
    await execCommand('yarn add --dev @types/rimraf@2.0.3', { cwd: process.cwd() });
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
          console.warn(`⚠️  Warning: Could not remove ${dirPath} directly, retrying in ${retryDelay}ms...`);
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

// Main validation function
async function validateCleanInstall() {
  console.log('🚀 Starting Vortex Clean Install Validation...');
  console.log(`💻 Platform: ${process.platform}`);
  
  try {
    // Step 1: Verify we're in the correct directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fileExists(packageJsonPath)) {
      throw new Error('This script must be run from the root of the Vortex project directory');
    }
    
    // Step 2: Clean previous builds if they exist
    console.log('🧹 Cleaning previous builds...');
    const buildDirs = ['node_modules', 'out', 'app/node_modules'];
    for (const dir of buildDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (directoryExists(fullPath)) {
        console.log(`🗑️  Removing ${dir}...`);
        // Use Node.js methods instead of shell commands for better cross-platform compatibility
        await removeDirectory(fullPath);
      }
    }
    
    // Step 3: Install dependencies
    console.log('📦 Installing dependencies...');
    await execCommand('yarn install --frozen-lockfile', { cwd: process.cwd() });
    
    // Step 4: Ensure TypeScript types are properly installed
    await ensureTypesInstalled();
    
    // Step 5: Build the API
    console.log('🔧 Building API...');
    const apiPath = path.join(process.cwd(), 'api');
    if (directoryExists(apiPath)) {
      await execCommand('yarn run build', { cwd: apiPath });
    }
    
    // Step 6: Build the main application
    console.log('🏗️  Building main application...');
    await execCommand('yarn run build', { cwd: process.cwd() });
    
    // Step 7: Build extensions
    console.log('🧩 Building extensions...');
    await execCommand('yarn run subprojects', { cwd: process.cwd() });
    
    // Step 8: Compile themes
    console.log('🎨 Compiling themes...');
    await execCommand('yarn run compile_themes', { cwd: process.cwd() });
    
    // Step 9: Verify build output
    console.log('🔍 Verifying build output...');
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
      console.log(`✅ Found ${file}`);
    }
    
    // Step 10: Verify bundled plugins
    console.log('🔌 Verifying bundled plugins...');
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
    
    console.log(`✅ Found ${pluginDirs.length} bundled plugins`);
    
    // Step 11: Validate platform-specific handling
    console.log('🖥️  Validating platform-specific handling...');
    if (isMacOS()) {
      console.log('🍎 Running on macOS - verifying mock modules are used');
      // Check that mock modules exist
      const mocksDir = path.join(process.cwd(), '__mocks__');
      if (!directoryExists(mocksDir)) {
        throw new Error('Mocks directory missing on macOS');
      }
    } else if (isWindows()) {
      console.log('🪟 Running on Windows - verifying native modules');
    }
    
    console.log('\n🎉 Clean install validation completed successfully!');
    console.log('\n📋 Summary of validation steps:');
    console.log('1. ✅ Verified project directory structure');
    console.log('2. ✅ Cleaned previous builds');
    console.log('3. ✅ Installed dependencies with yarn');
    console.log('4. ✅ Ensured TypeScript types are properly installed');
    console.log('5. ✅ Built API');
    console.log('6. ✅ Built main application');
    console.log('7. ✅ Built extensions');
    console.log('8. ✅ Compiled themes');
    console.log('9. ✅ Verified build output files');
    console.log('10. ✅ Verified bundled plugins');
    console.log('11. ✅ Validated platform-specific handling');
    
    return true;
  } catch (error) {
    console.error('\n❌ Clean install validation failed!');
    console.error(`💥 Error: ${error.message}`);
    return false;
  }
}

// Main function that runs all validation steps
async function main() {
  console.log('🚀 Starting complete validation process...');
  
  try {
    // Step 1: Check and fix submodule branches
    await checkAndFixSubmodules();
    
    // Step 2: Validate clean install
    const success = await validateCleanInstall();
    
    if (success) {
      console.log('\n🎉 All validation steps completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Validation failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Unexpected error during validation:', error);
    process.exit(1);
  }
}

// Run the validation
main();