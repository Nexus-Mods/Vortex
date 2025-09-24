const { execSync } = require('child_process');
const path = require('path');

/**
 * macOS implementation of wholocks using lsof (list open files)
 * Returns an array of processes that have the specified file open
 * 
 * @param {string} filePath - Path to the file to check for locks
 * @returns {Array<{appName: string, pid: number}>} Array of processes with file open
 */
function wholocks(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return [];
  }

  try {
    // Resolve the absolute path to handle relative paths and symlinks
    const absolutePath = path.resolve(filePath);
    
    // Use lsof to find processes with the file open
    // -F pcn: Format output as process ID, command name, and file name
    // +c 0: Show full command name (not truncated)
    // The file path is passed as an argument
    const lsofOutput = execSync(`lsof -F pcn +c 0 "${absolutePath}" 2>/dev/null || true`, {
      encoding: 'utf8',
      timeout: 5000, // 5 second timeout
      maxBuffer: 1024 * 1024 // 1MB buffer
    });

    if (!lsofOutput.trim()) {
      return [];
    }

    const processes = [];
    const lines = lsofOutput.trim().split('\n');
    let currentProcess = null;

    for (const line of lines) {
      if (line.startsWith('p')) {
        // Process ID line (p<pid>)
        const pid = parseInt(line.substring(1), 10);
        if (!isNaN(pid)) {
          currentProcess = { pid, appName: null };
        }
      } else if (line.startsWith('c') && currentProcess) {
        // Command name line (c<command>)
        currentProcess.appName = line.substring(1);
        
        // Only add if we have both pid and appName
        if (currentProcess.appName) {
          processes.push({
            pid: currentProcess.pid,
            appName: currentProcess.appName
          });
        }
        currentProcess = null;
      }
    }

    // Remove duplicates based on pid (in case a process has the file open multiple times)
    const uniqueProcesses = [];
    const seenPids = new Set();
    
    for (const proc of processes) {
      if (!seenPids.has(proc.pid)) {
        seenPids.add(proc.pid);
        uniqueProcesses.push(proc);
      }
    }

    return uniqueProcesses;

  } catch (error) {
    // If lsof fails or is not available, return empty array
    // This matches the behavior expected by the calling code
    return [];
  }
}

// Export as default function to match the expected interface
module.exports = wholocks;
module.exports.default = wholocks;

// For testing purposes, allow setting a custom lsof command
module.exports.__setLsofCommand = function(command) {
  // This is mainly for testing - not used in production
  // Could be used to mock lsof behavior in tests
};