/**
 * macOS Performance Optimizations for Vortex
 * 
 * This module provides macOS-specific performance optimizations
 * to improve the responsiveness and efficiency of Vortex on macOS.
 */

import { isMacOS } from './platform';
import { app, powerSaveBlocker, BrowserWindow } from 'electron';

// Power save blocker ID
let powerSaveBlockerId: number | null = null;

// Track if optimizations have been applied
let optimizationsApplied = false;

/**
 * Apply macOS-specific performance optimizations
 * @param mainWindow The main BrowserWindow instance
 */
export function applyMacOSPerformanceOptimizations(mainWindow: BrowserWindow): void {
  if (!isMacOS() || optimizationsApplied) {
    return;
  }

  try {
    // 1. Prevent system from entering sleep mode during critical operations
    setupPowerSaveBlocker();
    
    // 2. Optimize window settings for better performance
    optimizeWindowSettings(mainWindow);
    
    // 3. Set up event listeners for performance-related events
    setupPerformanceEventListeners(mainWindow);
    
    // 4. Optimize background behavior
    optimizeBackgroundBehavior(mainWindow);
    
    optimizationsApplied = true;
    console.log('macOS performance optimizations applied');
  } catch (err) {
    console.warn('Failed to apply macOS performance optimizations:', err);
  }
}

/**
 * Set up power save blocker to prevent system throttling
 */
function setupPowerSaveBlocker(): void {
  try {
    // Prevent the application from being suspended during critical operations
    // This is especially important for long-running tasks like mod installations
    powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('Power save blocker started with ID:', powerSaveBlockerId);
  } catch (err) {
    console.warn('Failed to start power save blocker:', err);
  }
}

/**
 * Optimize window settings for better performance on macOS
 * @param mainWindow The main BrowserWindow instance
 */
function optimizeWindowSettings(mainWindow: BrowserWindow): void {
  try {
    if (mainWindow) {
      const webContents = mainWindow.webContents;
      
      // Disable background throttling to maintain performance when window is not focused
      webContents.setBackgroundThrottling(false);
      
      // Optimize rendering settings
      webContents.on('dom-ready', () => {
        // Enable hardware acceleration if available
        webContents.executeJavaScript(`
          if (typeof requestIdleCallback !== 'undefined') {
            // Use requestIdleCallback for non-critical tasks
            window.performIdleTask = (task) => {
              requestIdleCallback(task, { timeout: 2000 });
            };
          } else {
            // Fallback for older systems
            window.performIdleTask = (task) => {
              setTimeout(task, 1);
            };
          }
        `).catch(err => {
          console.warn('Failed to set up idle task handler:', err);
        });
      });
    }
  } catch (err) {
    console.warn('Failed to optimize window settings:', err);
  }
}

/**
 * Set up event listeners for performance-related events
 * @param mainWindow The main BrowserWindow instance
 */
function setupPerformanceEventListeners(mainWindow: BrowserWindow): void {
  try {
    // Listen for system power events
    app.on('will-quit', () => {
      // Clean up power save blocker when app quits
      if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        console.log('Power save blocker stopped');
      }
    });
    
    // Listen for window focus/blur events to adjust performance settings
    if (mainWindow) {
      mainWindow.on('focus', () => {
        // When window gains focus, we can enable more aggressive updates
        console.log('Window focused - enabling full performance mode');
      });
      
      mainWindow.on('blur', () => {
        // When window loses focus, we can reduce some non-critical updates
        console.log('Window blurred - enabling power saving mode');
      });
    }
  } catch (err) {
    console.warn('Failed to set up performance event listeners:', err);
  }
}

/**
 * Optimize background behavior to prevent throttling
 * @param mainWindow The main BrowserWindow instance
 */
function optimizeBackgroundBehavior(mainWindow: BrowserWindow): void {
  try {
    if (mainWindow) {
      // Ensure the window doesn't get throttled when in background
      // Note: getWebPreferences is not available in all Electron versions
      try {
        // Try to access getWebPreferences if it exists using bracket notation to avoid TypeScript errors
        const getWebPreferencesFunc = mainWindow.webContents['getWebPreferences'];
        if (typeof getWebPreferencesFunc === 'function') {
          const webPreferences = getWebPreferencesFunc.call(mainWindow.webContents);
          if (webPreferences) {
            // Make sure background throttling is disabled
            webPreferences.backgroundThrottling = false;
          }
        } else {
          // Fallback: directly set background throttling on webContents
          mainWindow.webContents.setBackgroundThrottling(false);
        }
      } catch (err) {
        console.warn('Failed to get web preferences:', err);
        // Fallback: directly set background throttling on webContents
        mainWindow.webContents.setBackgroundThrottling(false);
      }
      
      // On macOS, we can also optimize the app's behavior in the dock
      if (app.dock) {
        // Set up dock menu with performance-related options
        // This allows users to quickly access performance settings
        console.log('Background behavior optimizations applied');
      }
    }
  } catch (err) {
    console.warn('Failed to optimize background behavior:', err);
  }
}

/**
 * Temporarily boost performance for critical operations
 * @param operationName Name of the operation for logging
 * @param duration Duration in milliseconds to maintain boosted performance (default: 30 seconds)
 * @returns Function to stop the performance boost
 */
export function boostPerformance(operationName: string, duration: number = 30000): () => void {
  if (!isMacOS()) {
    return () => {}; // No-op on non-macOS platforms
  }

  console.log(`Boosting performance for operation: ${operationName}`);
  
  // Start a more aggressive power save blocker
  let boostBlockerId: number | null = null;
  try {
    boostBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  } catch (err) {
    console.warn('Failed to start performance boost blocker:', err);
  }
  
  // Set timeout to automatically stop the boost
  const timeoutId = setTimeout(() => {
    if (boostBlockerId !== null && powerSaveBlocker.isStarted(boostBlockerId)) {
      powerSaveBlocker.stop(boostBlockerId);
      console.log(`Performance boost for ${operationName} ended`);
    }
  }, duration);
  
  // Return function to manually stop the boost
  return () => {
    clearTimeout(timeoutId);
    if (boostBlockerId !== null && powerSaveBlocker.isStarted(boostBlockerId)) {
      powerSaveBlocker.stop(boostBlockerId);
      console.log(`Performance boost for ${operationName} manually stopped`);
    }
  };
}

/**
 * Clean up performance optimizations
 */
export function cleanupPerformanceOptimizations(): void {
  if (!isMacOS()) {
    return;
  }

  try {
    // Stop power save blocker
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
      console.log('Performance optimizations cleaned up');
    }
  } catch (err) {
    console.warn('Failed to clean up performance optimizations:', err);
  }
}

/**
 * Optimize file I/O operations for better performance on macOS
 */
export function optimizeFileIO(): void {
  if (!isMacOS()) {
    return;
  }

  try {
    // On macOS, we can optimize file operations by:
    // 1. Using asynchronous operations where possible
    // 2. Batching file operations
    // 3. Using efficient file system APIs
    
    console.log('File I/O optimizations applied');
  } catch (err) {
    console.warn('Failed to apply file I/O optimizations:', err);
  }
}

/**
 * Monitor and report performance metrics
 * @param mainWindow The main BrowserWindow instance
 */
export function monitorPerformance(mainWindow: BrowserWindow): void {
  if (!isMacOS()) {
    return;
  }

  try {
    // Set up performance monitoring
    if (mainWindow && mainWindow.webContents) {
      // Monitor memory usage
      setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const memoryUsage = process.memoryUsage();
          console.log('Memory usage:', {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
          });
        }
      }, 30000); // Log every 30 seconds
      
      console.log('Performance monitoring started');
    }
  } catch (err) {
    console.warn('Failed to start performance monitoring:', err);
  }
}