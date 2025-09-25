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
    // 2. App bundles (.app directories)
    // 3. Shell scripts with shebangs
    // 4. Other executable formats
    
    // Check if the path points to an app bundle
    if (filePath.includes('.app')) {
      try {
        // Extract the app bundle path
        let appPath = filePath;
        const appIndex = filePath.indexOf('.app');
        if (appIndex !== -1) {
          appPath = filePath.substring(0, appIndex + 4);
        }
        
        // Try to get version from Info.plist
        const plistPath = path.join(appPath, 'Contents', 'Info.plist');
        try {
          const { stdout: plistVersion } = await execAsync(`defaults read "${plistPath}" CFBundleShortVersionString 2>/dev/null`);
          if (plistVersion && plistVersion.trim() && plistVersion.trim() !== '(null)') {
            return plistVersion.trim().replace(/"/g, '');
          }
        } catch (plistError) {
          // Try alternative version keys
          try {
            const { stdout: bundleVersion } = await execAsync(`defaults read "${plistPath}" CFBundleVersion 2>/dev/null`);
            if (bundleVersion && bundleVersion.trim() && bundleVersion.trim() !== '(null)') {
              return bundleVersion.trim().replace(/"/g, '');
            }
          } catch (bundleError) {
            // Continue to other methods
          }
        }
      } catch (appError) {
        // Continue to other methods
      }
    }
    
    // Check if it's a Mach-O binary using file command
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
      
      // Try to get version from strings command (look for version patterns)
      try {
        const { stdout: stringsOutput } = await execAsync(`strings "${filePath}" | grep -E "^[0-9]+\\.[0-9]+\\.[0-9]+" | head -1 2>/dev/null`);
        if (stringsOutput && stringsOutput.trim()) {
          const versionMatch = stringsOutput.trim().match(/^([0-9]+\.[0-9]+\.[0-9]+)/);
          if (versionMatch && versionMatch[1]) {
            return versionMatch[1];
          }
        }
      } catch (stringsError) {
        // Ignore strings error
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
   * Get product version (same as file version on macOS)
   * @param {string} filePath - Path to the executable file
   * @returns {string} Version string or '0.0.0' if not found
   */
  getProductVersion: defaultVersionFunction,
  
  /**
   * Get file version
   * @param {string} filePath - Path to the executable file
   * @returns {string} Version string or '0.0.0' if not found
   */
  getFileVersion: defaultVersionFunction,
  
  /**
   * Get localized product version (same as product version on macOS)
   * @param {string} filePath - Path to the executable file
   * @returns {string} Version string or '0.0.0' if not found
   */
  getProductVersionLocalized: defaultVersionFunction,
  
  /**
   * Get localized file version (same as file version on macOS)
   * @param {string} filePath - Path to the executable file
   * @returns {string} Version string or '0.0.0' if not found
   */
  getFileVersionLocalized: defaultVersionFunction,
  
  /**
   * Default export to match exe-version module API
   */
  default: defaultVersionFunction
};