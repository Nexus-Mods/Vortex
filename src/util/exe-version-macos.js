'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * Extract version information from executable files on macOS
 * Handles both Mach-O binaries and other executable formats
 */
async function getExecutableVersion(filePath) {
  try {
    // For macOS, we need to handle different executable formats:
    // 1. Mach-O binaries (native macOS executables)
    // 2. Shell scripts with shebangs
    // 3. Other executable formats
    
    // First, check if it's a Mach-O binary using file command
    const { stdout: fileType } = await execAsync(`file -b "${filePath}"`);
    
    if (fileType.includes('Mach-O')) {
      // For Mach-O binaries, try to extract version information
      try {
        // Use mdls (metadata list) to get version information from macOS metadata
        const { stdout: metadata } = await execAsync(`mdls -name kMDItemVersion -raw "${filePath}" 2>/dev/null`);
        if (metadata && metadata.trim() && metadata.trim() !== '(null)') {
          return metadata.trim();
        }
      } catch (metadataError) {
        // Ignore metadata error and try other methods
      }
      
      // Try to get version from plist file if it's an app bundle
      if (filePath.endsWith('.app/Contents/MacOS')) {
        try {
          const appPath = path.dirname(path.dirname(path.dirname(filePath)));
          const { stdout: plistVersion } = await execAsync(`defaults read "${appPath}/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null`);
          if (plistVersion) {
            return plistVersion.trim().replace(/"/g, '');
          }
        } catch (plistError) {
          // Ignore plist error and continue
        }
      }
    } else if (fileType.includes('shell script') || fileType.includes('script')) {
      // For shell scripts, try to extract version from shebang or comments
      try {
        const { stdout: headContent } = await execAsync(`head -20 "${filePath}" | grep -E "(version|Version)" | head -1`);
        if (headContent) {
          // Try to extract version number from comments
          const versionMatch = headContent.match(/version\s*:?\s*([0-9]+\.?[0-9]*\.?[0-9]*)/i);
          if (versionMatch && versionMatch[1]) {
            return versionMatch[1];
          }
        }
      } catch (scriptError) {
        // Ignore script parsing error
      }
    }
    
    // Fallback: try to get version using otool for Mach-O binaries
    if (fileType.includes('Mach-O')) {
      try {
        const { stdout: otoolOutput } = await execAsync(`otool -L "${filePath}" 2>/dev/null | head -5`);
        // This might give us some version information from linked libraries
        // but it's not reliable for the executable version itself
      } catch (otoolError) {
        // Ignore otool error
      }
    }
    
    // If all else fails, return a default version
    return '0.0.0';
  } catch (error) {
    // Return default version if any error occurs
    return '0.0.0';
  }
}

/**
 * Default synchronous version function to match exe-version API
 * @param {string} filePath - Path to the executable file
 * @returns {string} Version string or '0.0.0' if not found
 */
function defaultVersionFunction(filePath) {
  try {
    // Use synchronous exec to get version information
    const fileType = require('child_process').execSync(`file -b "${filePath}"`, { encoding: 'utf8' });
    
    if (fileType.includes('Mach-O')) {
      try {
        const metadata = require('child_process').execSync(`mdls -name kMDItemVersion -raw "${filePath}" 2>/dev/null`, { encoding: 'utf8' });
        if (metadata && metadata.trim() && metadata.trim() !== '(null)') {
          return metadata.trim();
        }
      } catch (metadataError) {
        // Ignore metadata error
      }
    }
    
    return '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

module.exports = {
  /**
   * Get version information from an executable file
   * @param {string} filePath - Path to the executable file
   * @returns {string} Version string or '0.0.0' if not found
   */
  getVersion: async (filePath) => {
    return await getExecutableVersion(filePath);
  },
  
  /**
   * Synchronous version of getVersion
   * @param {string} filePath - Path to the executable file
   * @returns {string} Version string or '0.0.0' if not found
   */
  getVersionSync: defaultVersionFunction,
  
  /**
   * Default export to match exe-version module API
   */
  default: defaultVersionFunction
};