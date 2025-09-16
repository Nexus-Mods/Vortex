'use strict';

const util = require('util');
const path = require('path');

let error = undefined;

module.exports = {
  // Shell operations
  ShellExecuteEx: () => {
    if (error === undefined) {
      return;
    } else {
      throw new Error(error);
    }
  },
  
  // Registry operations
  RegGetValue: () => {
    return {
      type: 'REG_SZ',
      value: 'foobar',
    };
  },
  WithRegOpen: (hive, key, callback) => {
    // Mock registry handle
    const mockHandle = { _mock: true };
    try {
      return callback(mockHandle);
    } catch (err) {
      // Simulate registry not found
      const regError = new Error('Registry key not found');
      regError.code = 'ENOENT';
      throw regError;
    }
  },
  RegEnumKeys: (hkey) => {
    // Return empty array for mock registry
    return [];
  },
  
  // File system operations
  GetVolumePathName: (filePath) => {
    if (filePath === '/missing') {
      const error = new Error('ENOTFOUND');
      error.code = 'ENOTFOUND';
      throw error;
    }
    // For macOS, simulate Windows volume behavior
    if (process.platform === 'darwin') {
      // Return the root directory for macOS paths
      return path.parse(filePath).root || '/';
    }
    return path.dirname(filePath);
  },
  GetDiskFreeSpaceEx: (volumePath) => {
    // Return low disk space for /driveb to trigger the insufficient space error
    if (volumePath.includes('driveb') || volumePath === '/driveb') {
      return {
        free: 100000000, // 100MB - less than 512MB required
        freeToCaller: 100000000,
        total: 10000000000 // 10GB
      };
    }
    return {
      free: 1000000000, // 1GB
      freeToCaller: 1000000000,
      total: 10000000000 // 10GB
    };
  },
  
  // Process operations
  GetProcessList: () => {
    return [];
  },
  GetModuleList: (processId) => {
    return [];
  },
  GetProcessWindowList: (processId) => {
    return [];
  },
  SetForegroundWindow: (windowHandle) => {
    // No-op on macOS
    return;
  },
  
  // System operations
  InitiateSystemShutdown: (message, timeout, forceApps, reboot) => {
    // No-op on macOS
    return;
  },
  AbortSystemShutdown: () => {
    // No-op on macOS
    return;
  },
  
  // Task scheduler operations
  RunTask: (taskName) => {
    // No-op on macOS
    return;
  },
  CreateTask: (taskName, options) => {
    // No-op on macOS
    return;
  },
  DeleteTask: (taskName) => {
    // No-op on macOS
    return;
  },
  GetTasks: () => {
    return [];
  },
  
  // User privilege operations
  CheckYourPrivilege: () => {
    return [];
  },
  AddUserPrivilege: (privilege) => {
    // No-op on macOS
    return;
  },
  RemoveUserPrivilege: (privilege) => {
    // No-op on macOS
    return;
  },
  GetUserPrivilege: () => {
    return [];
  },
  GetUserSID: () => {
    return 'mock-sid';
  },
  
  // Wine detection
  IsThisWine: () => {
    return false;
  },
  
  // Elevated operations
  runElevated: (ipcPath, func, options) => {
    // Mock elevated execution
    return Promise.resolve();
  },
  dynreq: (modulePath) => {
    // Mock dynamic require
    return { default: () => {} };
  },
  
  // App container operations
  SupportsAppContainer: () => {
    return false;
  },
  GrantAppContainer: (path) => {
    // No-op on macOS
    return;
  },
  
  // Mock error control
  __setError: (err) => { error = err; },
};
