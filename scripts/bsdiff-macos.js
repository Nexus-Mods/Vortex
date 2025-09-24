'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * macOS-native implementation of bsdiff-node using system bsdiff/bspatch commands
 * Provides binary diff and patch functionality for macOS
 */

/**
 * Create a binary diff between two files
 * @param {string} oldFile - Path to the original file
 * @param {string} newFile - Path to the new file
 * @param {string} patchFile - Path where the patch file should be created
 * @returns {Promise<void>}
 */
async function diff(oldFile, newFile, patchFile) {
  try {
    // Validate input paths
    if (!oldFile || !newFile || !patchFile) {
      throw new Error('All file paths must be provided');
    }

    // Use bsdiff command to create patch
    // bsdiff oldfile newfile patchfile
    const command = `bsdiff "${oldFile}" "${newFile}" "${patchFile}"`;
    await execAsync(command, { timeout: 30000 }); // 30 second timeout
  } catch (error) {
    // If bsdiff command is not found, try to provide a helpful error
    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      throw new Error('bsdiff command not found. Please install bsdiff using Homebrew: brew install bsdiff');
    }
    throw error;
  }
}

/**
 * Apply a binary patch to a file
 * @param {string} oldFile - Path to the original file
 * @param {string} newFile - Path where the patched file should be created
 * @param {string} patchFile - Path to the patch file
 * @returns {Promise<void>}
 */
async function patch(oldFile, newFile, patchFile) {
  try {
    // Validate input paths
    if (!oldFile || !newFile || !patchFile) {
      throw new Error('All file paths must be provided');
    }

    // Use bspatch command to apply patch
    // bspatch oldfile newfile patchfile
    const command = `bspatch "${oldFile}" "${newFile}" "${patchFile}"`;
    await execAsync(command, { timeout: 30000 }); // 30 second timeout
  } catch (error) {
    // If bspatch command is not found, try to provide a helpful error
    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      throw new Error('bspatch command not found. Please install bsdiff using Homebrew: brew install bsdiff');
    }
    throw error;
  }
}

// Export functions to match bsdiff-node API
module.exports = {
  diff,
  patch
};