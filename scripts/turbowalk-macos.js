const fs = require('fs');
const path = require('path');

/**
 * macOS-native implementation of turbowalk
 * Provides high-performance file system traversal using native fs operations
 * 
 * Interface compatibility:
 * - IEntry: { filePath: string, isDirectory: boolean, size: number }
 * - Callback: (entries: IEntry[]) => void
 * - Options: { skipHidden?: boolean, skipLinks?: boolean, skipInaccessible?: boolean }
 */

async function turbowalkMacOS(basePath, callback, options = {}) {
  const {
    skipHidden = true,
    skipLinks = false,
    skipInaccessible = true
  } = options;

  const entries = [];
  const visited = new Set(); // Prevent infinite loops with symlinks

  async function walkDirectory(dirPath) {
    try {
      // Get canonical path to handle symlinks properly
      const realPath = await fs.promises.realpath(dirPath);
      
      // Check for circular references
      if (visited.has(realPath)) {
        return;
      }
      visited.add(realPath);

      const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        // Skip hidden files if requested
        if (skipHidden && item.name.startsWith('.')) {
          continue;
        }

        // Skip symlinks if requested
        if (skipLinks && item.isSymbolicLink()) {
          continue;
        }

        try {
          let stats;
          if (item.isSymbolicLink()) {
            // For symlinks, get stats of the target
            stats = await fs.promises.stat(itemPath);
          } else {
            // For regular files/directories, use lstat to avoid following symlinks
            stats = await fs.promises.lstat(itemPath);
          }

          const entry = {
            filePath: itemPath,
            isDirectory: stats.isDirectory(),
            size: stats.isDirectory() ? 0 : stats.size
          };

          entries.push(entry);

          // Recursively walk subdirectories
          if (stats.isDirectory()) {
            await walkDirectory(itemPath);
          }
        } catch (error) {
          // Skip inaccessible files if requested
          if (skipInaccessible) {
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (skipInaccessible) {
        return; // Skip inaccessible directories
      }
      throw error;
    }
  }

  try {
    // Check if base path exists and is accessible
    const baseStat = await fs.promises.stat(basePath);
    
    // Add the base path itself as an entry
    entries.push({
      filePath: basePath,
      isDirectory: baseStat.isDirectory(),
      size: baseStat.isDirectory() ? 0 : baseStat.size
    });

    // If it's a directory, walk its contents
    if (baseStat.isDirectory()) {
      await walkDirectory(basePath);
    }

    // Call the callback with all collected entries
    callback(entries);
  } catch (error) {
    if (skipInaccessible) {
      // If we can't access the base path, call callback with empty array
      callback([]);
    } else {
      throw error;
    }
  }
}

// Export both as default function and named export for compatibility
module.exports = turbowalkMacOS;
module.exports.default = turbowalkMacOS;

// Add testing helper function
module.exports.__setPathHandler = function(handler) {
  // This is used by tests - we can implement if needed
  // For now, just store it but don't use it
  module.exports.__pathHandler = handler;
};