import * as fs from 'fs';
import * as path from 'path';

/**
 * Convert a glob pattern to a regular expression
 * @param pattern The glob pattern to convert
 * @returns A regular expression that matches the pattern
 */
export function globToRegex(pattern: string): RegExp {
  // Use a placeholder to avoid double replacement when handling ** and *
  const DOUBLE_STAR_PLACEHOLDER = '\u0000DOUBLESTAR\u0000';

  // Escape special regex characters, but be careful with * and ?
  let escapedPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special characters except * and ?
    .replace(/\?/g, '.')                   // Convert ? to .
    .replace(/\*\*/g, DOUBLE_STAR_PLACEHOLDER); // Temporarily replace **

  // Convert single * to .*
  escapedPattern = escapedPattern.replace(/\*/g, '.*');

  // Restore ** as .*
  escapedPattern = escapedPattern.replace(new RegExp(DOUBLE_STAR_PLACEHOLDER, 'g'), '.*');

  // Ensure the pattern matches the entire path
  return new RegExp(`^${escapedPattern}$`);
}

/**
 * Check if a file path matches a glob pattern
 * @param filePath The file path to check
 * @param pattern The glob pattern to match against
 * @returns True if the file path matches the pattern, false otherwise
 */
export function matchPattern(filePath: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filePath);
}

/**
 * Recursively find all files in a directory that match a pattern
 * @param dir The directory to search in
 * @param pattern The glob pattern to match against
 * @returns An array of file paths that match the pattern
 */
export function findFiles(dir: string, pattern: string): string[] {
  const results: string[] = [];
  
  function walk(currentDir: string) {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          walk(fullPath);
        } else if (item.isFile() && matchPattern(fullPath, pattern)) {
          results.push(fullPath);
        }
      }
    } catch (err) {
      // Handle permission errors or other issues
      console.warn(`Could not read directory: ${currentDir}`, err);
    }
  }
  
  walk(dir);
  return results;
}

/**
 * Find all files with specific extensions in a directory
 * @param dir The directory to search in
 * @param extensions An array of extensions to match (e.g., ['.ts', '.tsx'])
 * @returns An array of file paths that match the extensions
 */
export function findFilesWithExtensions(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  
  function walk(currentDir: string) {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory()) {
          walk(fullPath);
        } else if (item.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (err) {
      console.warn(`Could not read directory: ${currentDir}`, err);
    }
  }
  
  walk(dir);
  return results;
}

/**
 * Enhanced pattern matching utility that mimics glob.sync functionality
 * @param pattern The glob pattern to match
 * @param options Options for matching (currently unused but kept for API compatibility)
 * @returns An array of file paths that match the pattern
 */
export function globSync(pattern: string, options?: any): string[] {
  // Handle absolute paths
  if (pattern.startsWith('/')) {
    const dir = path.dirname(pattern);
    const filePattern = path.basename(pattern);
    return findFiles(dir, filePattern);
  }
  
  // Handle relative paths from current working directory
  return findFiles(process.cwd(), pattern);
}

/**
 * Enhanced pattern matching utility that mimics glob functionality with callback
 * @param pattern The glob pattern to match
 * @param options Options for matching (currently unused but kept for API compatibility)
 * @param callback Callback function to receive results
 */
export function glob(pattern: string, options: any, callback: (err: Error | null, matches: string[]) => void): void;
export function glob(pattern: string, callback: (err: Error | null, matches: string[]) => void): void;
export function glob(pattern: string, options: any, callback?: (err: Error | null, matches: string[]) => void): void {
  // Handle overloaded function signatures
  let cb: (err: Error | null, matches: string[]) => void;
  if (typeof options === 'function') {
    cb = options;
  } else {
    cb = callback!;
  }
  
  try {
    const matches = globSync(pattern);
    cb(null, matches);
  } catch (err) {
    cb(err as Error, []);
  }
}

// Export the glob functions to mimic the glob module API
export default {
  sync: globSync,
  glob: glob,
  globSync: globSync
};