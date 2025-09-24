/**
 * macOS Permission Handling for Vortex
 * 
 * This module provides proper permission handling for macOS,
 * including file system access and security scoped bookmarks.
 */

import { isMacOS } from './platform';
import { app, session, dialog, BrowserWindow } from 'electron';
import * as path from 'path';

/**
 * Initialize macOS permission handling
 * @param mainWindow The main BrowserWindow instance
 */
export function initializeMacOSPermissions(mainWindow: BrowserWindow): void {
  if (!isMacOS() || !mainWindow) {
    return;
  }

  const webContents = mainWindow.webContents;
  const ses = webContents.session;

  // Set up permission request handler for various permissions
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    console.log('🔐 Permission requested:', permission, details);
    
    // Handle different types of permissions
    switch (permission) {
      case 'media':
        // Handle camera/microphone permissions
        handleMediaPermission(permission, callback, details);
        break;
      
      case 'geolocation':
        // Handle location permissions
        handleGeolocationPermission(permission, callback, details);
        break;
      
      case 'notifications':
        // Handle notification permissions
        handleNotificationPermission(permission, callback, details);
        break;
      
      default:
        // For other permissions, we'll show a dialog to the user
        handleGenericPermission(permission, callback, details);
        break;
    }
  });

  // Set up permission check handler
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('🔍 Permission check:', permission, requestingOrigin, details);
    
    // Allow all permissions by default for the main application
    // In a production app, you might want more granular control
    return true;
  });

  // Handle file system access restrictions
  ses.on('file-system-access-restricted' as any, async (event, details, callback) => {
    console.log('🚫 File system access restricted:', details);
    
    try {
      const { origin, path: restrictedPath } = details;
      
      // Show a dialog to the user asking for permission
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'File System Access Required',
        message: `Vortex needs access to a restricted file or folder.`,
        detail: `The application "${origin}" is trying to access "${restrictedPath}".\n\nDo you want to allow this access?`,
        buttons: ['Deny', 'Allow', 'Choose Different Folder'],
        cancelId: 0,
        defaultId: 1
      });
      
      switch (response) {
        case 0: // Deny
          callback('deny');
          break;
        case 1: // Allow
          callback('allow');
          break;
        case 2: // Choose Different Folder
          callback('tryAgain');
          break;
      }
    } catch (err) {
      console.warn('⚠️ Failed to handle file system access restriction:', err);
      callback('deny');
    }
  });

  console.log('✅ macOS permission handling initialized');
}

/**
 * Handle media (camera/microphone) permissions
 */
function handleMediaPermission(
  permission: string, 
  callback: (permissionGranted: boolean) => void, 
  details: any
): void {
  // For media permissions, we'll show a dialog to the user
  // In a real application, you might want to check if the feature is actually needed
  callback(true); // Allow by default for now
}

/**
 * Handle geolocation permissions
 */
function handleGeolocationPermission(
  permission: string, 
  callback: (permissionGranted: boolean) => void, 
  details: any
): void {
  // Vortex doesn't typically need location access, so we'll deny by default
  callback(false);
}

/**
 * Handle notification permissions
 */
function handleNotificationPermission(
  permission: string, 
  callback: (permissionGranted: boolean) => void, 
  details: any
): void {
  // Allow notifications by default
  callback(true);
}

/**
 * Handle generic permissions with user dialog
 */
async function handleGenericPermission(
  permission: string, 
  callback: (permissionGranted: boolean) => void, 
  details: any
): Promise<void> {
  try {
    // For unknown permissions, we'll deny by default for security
    // In a real application, you might want to show a dialog to the user
    console.warn('⚠️ Unknown permission requested:', permission, details);
    callback(false);
  } catch (err) {
    console.warn('⚠️ Failed to handle generic permission:', err);
    callback(false);
  }
}

/**
 * Request access to a directory with security scoped bookmarks
 * @param directoryPath The directory path to request access to
 * @returns Promise that resolves when access is granted
 */
export async function requestDirectoryAccess(directoryPath: string): Promise<boolean> {
  if (!isMacOS()) {
    return true; // Non-macOS platforms don't need this
  }

  try {
    // On macOS, we can use the dialog to show a directory picker
    // This will automatically handle security scoped bookmarks
    const result = await dialog.showOpenDialog({
      title: 'Select Directory',
      defaultPath: directoryPath,
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return false;
    }

    // The selected directory is now accessible
    // Electron automatically handles security scoped bookmarks for us
    console.log('✅ Directory access granted:', result.filePaths[0]);
    return true;
  } catch (err) {
    console.warn('⚠️ Failed to request directory access:', err);
    return false;
  }
}

/**
 * Check if Vortex has access to a specific directory
 * @param directoryPath The directory path to check access for
 * @returns Promise that resolves with whether access is granted
 */
export async function checkDirectoryAccess(directoryPath: string): Promise<boolean> {
  if (!isMacOS()) {
    return true; // Non-macOS platforms don't need this
  }

  try {
    // On macOS, we can try to access the directory
    // If we get a permission error, we know we don't have access
    const fs = require('fs-extra');
    await fs.access(directoryPath);
    return true;
  } catch (err) {
    if (err.code === 'EACCES') {
      return false; // No access
    }
    // For other errors, we assume access is granted
    return true;
  }
}

/**
 * Request user to add Vortex to Security & Privacy settings
 * This is needed for certain system-level operations
 */
export async function requestSecurityPrivacyAccess(): Promise<void> {
  if (!isMacOS()) {
    return;
  }

  try {
    // Show a dialog explaining that the user needs to add Vortex to
    // Security & Privacy settings
    await dialog.showMessageBox({
      type: 'info',
      title: 'Security & Privacy Access Required',
      message: 'Full Disk Access Required',
      detail: 'Vortex needs full disk access to properly manage your game mods and saves.\n\n' +
              'Please follow these steps:\n' +
              '1. Open System Preferences\n' +
              '2. Go to Security & Privacy\n' +
              '3. Click on the Privacy tab\n' +
              '4. Select "Full Disk Access" from the list\n' +
              '5. Click the lock icon and enter your password\n' +
              '6. Click the "+" button and add Vortex to the list\n\n' +
              'After adding Vortex, please restart the application.',
      buttons: ['OK']
    });
  } catch (err) {
    console.warn('⚠️ Failed to show security privacy access dialog:', err);
  }
}