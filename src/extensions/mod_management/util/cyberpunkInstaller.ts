import { ProgressDelegate } from '../types/InstallFunc';
import { ISupportedResult } from '../types/TestSupported';
import { 
  validateCyberpunkMacOSCompatibility, 
  CompatibilityValidationResult,
  hasWindowsOnlyFiles,
  hasWindowsOnlyDirectories,
  hasWindowsOnlyFrameworks
} from '../../../util/macOSGameCompatibility';

import Promise from 'bluebird';
import * as path from 'path';

/**
 * Test if this installer supports the given files for Cyberpunk 2077
 * Includes macOS compatibility validation on macOS systems
 */
export function testSupported(files: string[], gameId: string): Promise<ISupportedResult> {
  // Only handle Cyberpunk 2077 mods
  if (gameId !== 'cyberpunk2077') {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  // On macOS, perform compatibility validation
  if (process.platform === 'darwin') {
    // Quick check for obvious Windows-only content
    if (hasWindowsOnlyFiles(files) || hasWindowsOnlyDirectories(files) || hasWindowsOnlyFrameworks(files)) {
      return Promise.resolve({ 
        supported: false, 
        requiredFiles: [],
        errors: ['This mod contains Windows-only components that are not compatible with macOS']
      });
    }
  }

  // Basic file validation - ensure we have some content
  const hasContent = files.some(file => !file.endsWith(path.sep) && file.length > 0);
  
  if (!hasContent) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  return Promise.resolve({ 
    supported: true, 
    requiredFiles: [],
    priority: 50 // Higher priority than basic installer but lower than specialized ones
  });
}

/**
 * Install function for Cyberpunk 2077 mods with macOS compatibility validation
 */
export function install(
  files: string[], 
  destinationPath: string,
  gameId: string, 
  progress: ProgressDelegate
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      // Perform full compatibility validation on macOS
      if (process.platform === 'darwin') {
        const validationResult: CompatibilityValidationResult = 
          await validateCyberpunkMacOSCompatibility(destinationPath, files);
        
        if (!validationResult.isCompatible) {
          // Return installation failure with user-friendly error message
          return reject(new Error(validationResult.errorMessage || 'Mod is not compatible with macOS'));
        }
      }

      // Filter out directories and create installation instructions
      const instructions = files
        .filter((name: string) => !name.endsWith(path.sep))
        .map((name: string) => ({ 
          type: 'copy', 
          source: name, 
          destination: name 
        }));

      // Report progress
      if (progress) {
        progress(100);
      }

      resolve({
        message: 'Cyberpunk 2077 mod installed successfully',
        instructions
      });

    } catch (error) {
      console.error('Error during Cyberpunk 2077 mod installation:', error);
      reject(error);
    }
  });
}