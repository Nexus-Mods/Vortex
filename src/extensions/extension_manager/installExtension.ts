import { removeExtension } from '../../actions';
import { setInstalledExtensions } from './actions';
import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { DataInvalid } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';
import { INVALID_FILENAME_RE } from '../../util/util';
import { getMacOSArchitecture } from '../../util/macOSGameCompatibility';

import { countryExists, languageExists } from '../settings_interface/languagemap';

import { ExtensionType, IExtension } from './types';
import { readExtensionInfo, readExtensionsSync } from './util';

import Bluebird from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';
import * as vortexRunT from 'vortex-run';
import { spawn, spawnSync } from 'child_process';
import { promisify } from 'util';
import * as fsExtra from 'fs-extra';
import * as fsNode from 'fs';

const vortexRun: typeof vortexRunT = lazyRequire(() => require('vortex-run'));

/**
 * Enhanced retry utility for validation operations that may fail due to timing issues on macOS
 * Implements exponential backoff and more sophisticated error handling
 * @param operation The operation to retry
 * @param maxRetries Maximum number of retries (default: 5)
 * @param baseDelayMs Base delay between retries in milliseconds (default: 200)
 * @param maxDelayMs Maximum delay between retries in milliseconds (default: 5000)
 * @param operationName Name for logging purposes
 * @param shouldRetry Function to determine if an error should trigger a retry
 */
async function retryValidationOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 200,
  maxDelayMs: number = 5000,
  operationName: string = 'validation operation',
  shouldRetry?: (error: Error) => boolean
): Promise<T> {
  let lastError: Error;
  
  // Default retry logic - retry on common file system timing issues on macOS
  const defaultShouldRetry = (error: Error): boolean => {
    const errorMessage = error.message.toLowerCase();
    return (
      // Common file system timing issues on macOS
      errorMessage.includes('enoent') || // File not found
      errorMessage.includes('ebusy') ||  // Resource busy
      errorMessage.includes('eperm') ||  // Permission denied (sometimes temporary)
      errorMessage.includes('eacces') || // Access denied (sometimes temporary)
      errorMessage.includes('emfile') || // Too many open files
      errorMessage.includes('enotempty') || // Directory not empty
      // Network-related issues that might affect validation
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('econn') || // Connection errors
      errorMessage.includes('etimedout') ||
      // General retryable errors
      errorMessage.includes('temporary') ||
      errorMessage.includes('transient') ||
      // macOS specific timing issues
      errorMessage.includes('resource busy') ||
      errorMessage.includes('operation not permitted')
    );
  };
  
  const shouldRetryFunc = shouldRetry || defaultShouldRetry;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('debug', `Attempting ${operationName}`, { attempt, maxRetries });
      const result = await operation();
      if (attempt > 1) {
        log('info', `${operationName} succeeded on retry`, { 
          attempt, 
          totalAttempts: attempt,
          operationName 
        });
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Log the error details
      log('debug', `${operationName} failed on attempt ${attempt}`, { 
        attempt, 
        maxRetries, 
        error: error.message,
        stack: error.stack,
        code: (error as any).code
      });
      
      // Check if we should retry this error
      if (!shouldRetryFunc(error)) {
        log('debug', `Not retrying ${operationName} - error not retryable`, { 
          error: error.message,
          code: (error as any).code
        });
        throw error;
      }
      
      // If this is the last attempt, don't retry
      if (attempt >= maxRetries) {
        break;
      }
      
      // Calculate exponential backoff delay
      const exponentialDelay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1), 
        maxDelayMs
      );
      
      // Add some jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * exponentialDelay;
      const delayWithJitter = exponentialDelay + jitter;
      
      // Additional delay for macOS to handle file system timing issues
      let platformAdjustedDelay = delayWithJitter;
      if (process.platform === 'darwin') {
        // Increase delay on macOS to handle APFS timing issues
        platformAdjustedDelay = delayWithJitter * 1.5;
        log('debug', `Adjusted delay for macOS APFS timing issues`, { 
          originalDelay: Math.round(delayWithJitter),
          adjustedDelay: Math.round(platformAdjustedDelay),
          platform: process.platform
        });
      }
      
      log('debug', `Retrying ${operationName} in ${Math.round(platformAdjustedDelay)}ms`, { 
        attempt, 
        delay: Math.round(platformAdjustedDelay),
        exponentialDelay: Math.round(exponentialDelay),
        jitter: Math.round(jitter),
        platform: process.platform
      });
      
      await new Promise(resolve => setTimeout(resolve, platformAdjustedDelay));
    }
  }
  
  log('warn', `${operationName} failed after ${maxRetries} attempts`, { 
    error: lastError.message,
    code: (lastError as any).code,
    stack: lastError.stack
  });
  throw lastError;
}

class ContextProxyHandler implements ProxyHandler<any> {
  private mDependencies: string[] = [];

  public get(target, key: PropertyKey): any {
    if (key === 'requireExtension') {
      return (dependencyId: string) => {
        this.mDependencies.push(dependencyId);
      };
    } else if (key === 'optional') {
      return new Proxy({}, {
        get() {
          return () => undefined;
        },
      });
    } else if (key === 'api') {
      return {
        translate: (input) => input,
        actions: {
          add: () => undefined,
          remove: () => undefined,
          setShowInMenu() { /* ignore in this context */ },
        },
      };
    } else if (key === 'once') {
      return (callback: () => void | Promise<void>) => {
        // For dependency installation, we can execute the callback immediately
        // since this is a simplified context for dependency resolution
        try {
          const result = callback();
          if (result && typeof result.then === 'function') {
            result.catch((err: Error) => {
              log('warn', '⚠️ Extension once callback failed', { error: err.message });
            });
          }
        } catch (err) {
          log('warn', '⚠️ Extension once callback failed', { error: err.message });
        }
      };
    } else if (key === 'onceMain') {
      return (callback: () => void) => {
        // For dependency installation, we can execute the callback immediately if in main process
        // or skip it if in renderer process
        if (process.type !== 'renderer') {
          try {
            callback();
          } catch (err) {
            log('warn', '⚠️ Extension onceMain callback failed', { error: err.message });
          }
        }
      };
    } else if (typeof key === 'string' && key.startsWith('register')) {
      // Provide stub functions for all register* methods during dependency detection
      return (...args: any[]) => {
        // During dependency detection, we just need to prevent errors
        // The actual registration will happen during proper extension initialization
        return undefined;
      };
    }
  }

  public get dependencies(): string[] {
    return this.mDependencies;
  }
}

async function installExtensionDependencies(api: IExtensionApi, extPath: string): Promise<void> {
  const handler = new ContextProxyHandler();
  const context = new Proxy({}, handler);

  try {
    const indexPath = path.join(extPath, 'index.js');
    // If the extension package doesn't include an index.js (e.g. manifest-only update),
    // skip dependency detection gracefully.
    try {
      fs.statSync(indexPath);
    } catch (e) {
      return Promise.resolve();
    }

    const extension = vortexRun.dynreq(indexPath);
    
    // Create vortexExt compatibility shim for older extensions
    const vortexExt = {
      registerGame: (game: any, extensionPath?: string) => {
        context.registerGame(game, extensionPath || extPath);
      },
      registerGameStub: (game: any, ext: any) => {
        context.registerGameStub(game, ext);
      },
      registerGameInfoProvider: (id: string, priority: number, expireMS: number, keys: string[], query: any) => {
        context.registerGameInfoProvider(id, priority, expireMS, keys, query);
      },
      registerModType: (modType: any) => {
        context.registerModType(modType);
      },
      registerAction: (group: string, priority: number, icon: any, options: any, title: any, action: any, condition?: any) => {
        context.registerAction(group, priority, icon, options, title, action, condition);
      },
      registerReducer: (path: any, reducer: any) => {
        context.registerReducer(path, reducer);
      },
      registerSettings: (id: string, component: any, filter?: any, options?: any, priority?: number) => {
        context.registerSettings(id, component, filter, options, priority);
      },
      registerDialog: (id: string, component: any, props?: any) => {
        context.registerDialog(id, component, props);
      },
      registerDashlet: (id: string, row: number, col: number, height: number, component: any, filter?: any, props?: any) => {
        context.registerDashlet(id, row, col, height, component, filter, props);
      },
      registerInstaller: (id: string, priority: number, test: any, install: any) => {
        context.registerInstaller(id, priority, test, install);
      },
      registerDownloadProtocol: (schema: string, handler: any) => {
        context.registerDownloadProtocol(schema, handler);
      },
      registerAttributeExtractor: (priority: number, extractor: any) => {
        context.registerAttributeExtractor(priority, extractor);
      },
      registerModSource: (id: string, name: string, query: any) => {
        context.registerModSource(id, name, query);
      },
      registerTest: (id: string, eventType: string, check: any) => {
        context.registerTest(id, eventType, check);
      },
      once: (callback: () => void | Promise<void>) => {
        // For dependency installation, we can execute the callback immediately
        // since this is a simplified context for dependency resolution
        try {
          const result = callback();
          if (result && typeof result.then === 'function') {
            result.catch((err: Error) => {
              log('warn', '⚠️ Extension once callback failed', { error: err.message });
            });
          }
        } catch (err) {
          log('warn', '⚠️ Extension once callback failed', { error: err.message });
        }
      },
      onceMain: (callback: () => void) => {
        // For dependency installation, we can execute the callback immediately if in main process
        // or skip it if in renderer process
        if (process.type !== 'renderer') {
          try {
            callback();
          } catch (err) {
            log('warn', '⚠️ Extension onceMain callback failed', { error: err.message });
          }
        }
      },
      registerAPI: (name: string, func: any, options?: any) => {
        context.registerAPI(name, func, options);
      },
      registerMainPage: (id: string, title: string, component: any, options?: any) => {
        context.registerMainPage(id, title, component, options);
      },
      registerFooter: (id: string, component: any) => {
        context.registerFooter(id, component);
      },
      registerBanner: (id: string, component: any) => {
        context.registerBanner(id, component);
      },
      registerOverlay: (id: string, component: any, props?: any) => {
        context.registerOverlay(id, component, props);
      },
      registerToDo: (id: string, title: string, component: any, filter?: any) => {
        context.registerToDo(id, title, component, filter);
      },
      registerDeploymentMethod: (method: any) => {
        context.registerDeploymentMethod(method);
      },
      registerActionCheck: (actionType: string, check: any) => {
        context.registerActionCheck(actionType, check);
      },
      registerStartHook: (priority: number, id: string, func: any) => {
        context.registerStartHook(priority, id, func);
      },
      registerHistoryStack: (id: string, stack: any) => {
        context.registerHistoryStack(id, stack);
      },
      registerProfileFile: (file: any) => {
        context.registerProfileFile(file);
      },
      registerProfileFeature: (feature: any) => {
        context.registerProfileFeature(feature);
      },
      registerLoadOrder: (gameInfo: any, extPath: string) => {
        context.registerLoadOrder(gameInfo, extPath);
      },
      registerLoadOrderPage: (gameEntry: any) => {
        context.registerLoadOrderPage(gameEntry);
      },
      registerGameVersionProvider: (id: string, priority: number, query: any) => {
        context.registerGameVersionProvider(id, priority, query);
      },
      registerToolVariables: (func: any) => {
        context.registerToolVariables(func);
      },
      registerPreview: (priority: number, component: any) => {
        context.registerPreview(priority, component);
      }
    };
    
    // Make vortexExt available globally for older extensions
    (global as any).vortexExt = vortexExt;
    
    // Ensure the global assignment is available before calling the extension
    // Use setImmediate to allow the global assignment to complete
    await new Promise<void>((resolve, reject) => {
      setImmediate(() => {
        try {
          extension.default(context);
          resolve();
        } catch (err) {
          // If the extension still fails, try passing vortexExt directly as a fallback
          const errorMessage = err.message || err.toString();
          if (errorMessage.includes('registerGame is not a function') || 
              errorMessage.includes('context.registerGame is not a function')) {
            try {
              // Some extensions might expect vortexExt as a parameter
              extension.default(vortexExt);
              resolve();
            } catch (fallbackErr) {
              // If vortexExt also fails, it means registerGame is not available yet
              // This can happen if gamemode_management hasn't initialized yet
              reject(new Error(`Extension failed to load: ${errorMessage}. ` +
                `This may be due to gamemode_management not being initialized yet. ` +
                `Please ensure gamemode_management extension is loaded first.`));
            }
          } else {
            reject(err);
          }
        }
      });
    });

    const state: IState = api.store.getState();

    return Promise.resolve(
      Bluebird.map(handler.dependencies, (depId: string) => {
        if (state.session.extensions.installed[depId] !== undefined) {
          return;
        }
        const ext = state.session.extensions.available.find(iter =>
          (!iter.type && ((iter.name === depId) || (iter.id === depId))));

        if (ext !== undefined) {
          return api.emitAndAwait('install-extension', ext);
        } else {
          return Promise.resolve();
        }
      }).then(() => undefined),
    );
  } catch (err) {
    // TODO: can't check for dependencies if the extension is already loaded
    //   and registers actions
    if ((err.name === 'TypeError')
        && (err.message.startsWith('Duplicate action type'))) {
      return Promise.resolve();
    }
    return Promise.reject(err);
  }
}

function sanitize(input: string): string {
  const temp = input.replace(INVALID_FILENAME_RE, '_');
  const ext = path.extname(temp);
  if (['.7z', '.zip', '.rar'].includes(ext.toLowerCase())) {
    return path.basename(temp, path.extname(temp));
  } else {
    return path.basename(temp);
  }
}



// Attempt to flatten archives that contain a single visible top-level directory
// (ignoring hidden files like .DS_Store and __MACOSX). This moves the contents of
// that directory up into the root so that index.js and info.json are at the top level.
function flattenNestedRoot(root: string): Promise<void> {
  return Promise.resolve(fs.readdirAsync(root)
    .then((entries: string[]) =>
      Bluebird.map(entries, (name: string) =>
        fs.statAsync(path.join(root, name))
          .then(stat => ({ name, stat }))
          .catch(() => null)))
    .then((items: Array<{ name: string, stat: any } | null>) =>
      (items || []).filter((it): it is { name: string, stat: any } => it !== null))
    .then((items) => {
      // ignore hidden and macOS helper directories
      const visible = items.filter(it => !it.name.startsWith('.') && (it.name !== '__MACOSX'));
      const dirs = visible.filter(it => it.stat.isDirectory());
      const files = visible.filter(it => it.stat.isFile());

      if ((files.length === 0) && (dirs.length === 1)) {
        const inner = path.join(root, dirs[0].name);
        return fs.readdirAsync(inner)
          .then(innerEntries => Bluebird.map(innerEntries, (innerName: string) =>
            fs.renameAsync(path.join(inner, innerName), path.join(root, innerName))))
          .then(() => fs.removeAsync(inner))
          // In case there are multiple nested levels, recurse until flattened
          .then(() => flattenNestedRoot(root));
      }
      return Promise.resolve();
    })
    .then(() => undefined));
}

/**
 * Wait for archive deletion to indicate extraction completion
 * This is more reliable than arbitrary delays as it waits for the actual cleanup
 * Enhanced version with better timing controls and adaptive polling
 */
/**
 * Check if the extraction directory contains typical extension files
 */
async function hasExtensionFiles(extractionPath: string): Promise<boolean> {
  try {
    const files = await fs.readdirAsync(extractionPath);
    
    // Look for common extension files
    const extensionIndicators = [
      'package.json',
      'index.js',
      'info.json',
      'main.js',
      'extension.js'
    ];
    
    // Check if any of these files exist
    for (const indicator of extensionIndicators) {
      if (files.includes(indicator)) {
        return true;
      }
    }
    
    // Also check for .js files in general
    const hasJsFiles = files.some(file => file.endsWith('.js'));
    if (hasJsFiles) {
      return true;
    }
    
    // Check for subdirectories that might contain extension files
    for (const file of files) {
      try {
        const filePath = path.join(extractionPath, file);
        const stat = await fs.statAsync(filePath);
        if (stat.isDirectory()) {
          const subFiles = await fs.readdirAsync(filePath);
          const hasSubExtensionFiles = subFiles.some(subFile => 
            extensionIndicators.includes(subFile) || subFile.endsWith('.js')
          );
          if (hasSubExtensionFiles) {
            return true;
          }
        }
      } catch (err) {
        // Ignore errors when checking subdirectories
      }
    }
    
    return false;
  } catch (err) {
    return false;
  }
}

async function waitForExtractionCompletion(extractionPath: string, maxWaitMs: number = 15000): Promise<void> {
  // On macOS, filesystem changes may take longer to settle
  const platformFactor = (process.platform === 'darwin') ? 1.5 : 1;
  const effectiveMaxWaitMs = Math.ceil(maxWaitMs * platformFactor);
  const startTime = Date.now();
  const initialCheckInterval = 100;
  const maxCheckInterval = 500; // cap polling to reduce churn
  let checkInterval = initialCheckInterval;
  let lastFileCount = 0;
  let stableCount = 0;
  const stabilityThreshold = 3; // Need 3 consecutive stable checks (>= 300ms)
  let hasFoundFiles = false;
  let lastFileList: string[] = [];
  
  log('debug', 'Starting enhanced extraction completion monitoring', { 
    extractionPath, 
    maxWaitMs,
    platform: process.platform 
  });
  
  // Add a small initial delay to allow file system to settle
  await new Promise(resolve => setTimeout(resolve, 100));
  
  while (Date.now() - startTime < effectiveMaxWaitMs) {
    try {
      // Check if extraction directory exists and has content
      const stats = await fs.statAsync(extractionPath);
      if (!stats.isDirectory()) {
        log('debug', 'Extraction directory not found, waiting...', { extractionPath });
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      // Count files in the extraction directory, skipping hidden and macOS helper dirs
      const files = (await fs.readdirAsync(extractionPath))
        .filter(f => !f.startsWith('.') && (f !== '__MACOSX'));
      const currentFileCount = files.length;
      
      // Additional check to ensure we can access the files
      if (currentFileCount > 0) {
        try {
          // Try to access the first file to ensure it's actually readable
          const firstFile = files[0];
          if (firstFile) {
            const firstFilePath = path.join(extractionPath, firstFile);
            await fs.statAsync(firstFilePath);
          }
        } catch (accessErr) {
          log('debug', 'Files listed but not yet accessible, continuing to wait', { 
            extractionPath, 
            error: accessErr.message 
          });
          // Files listed but not accessible yet, continue waiting
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }
      }
      
      log('debug', 'Monitoring extraction progress', { 
        extractionPath, 
        currentFileCount, 
        lastFileCount,
        stableCount,
        waitedMs: Date.now() - startTime,
        files: files.slice(0, 5) // Log first 5 files for debugging
      });
      
      if (currentFileCount > 0) {
        hasFoundFiles = true;
        
        // First, check if we have typical extension files - if so, we can exit early
        const hasExtFiles = await hasExtensionFiles(extractionPath);
        if (hasExtFiles) {
          log('debug', 'Extension files detected, extraction complete', { 
            extractionPath, 
            fileCount: currentFileCount,
            waitedMs: Date.now() - startTime,
            platform: process.platform,
            files: files.slice(0, 5)
          });
          return;
        }
        
        // Also check first-level subdirectories for key files (common nested-root archives)
        for (const entry of files) {
          try {
            const entryPath = path.join(extractionPath, entry);
            const entryStat = await fs.statAsync(entryPath);
            if (entryStat.isDirectory()) {
              const subFiles = (await fs.readdirAsync(entryPath))
                .filter(f => !f.startsWith('.') && (f !== '__MACOSX'));
              if (subFiles.length === 0) continue;
              const subKeyFiles = ['index.js', 'info.json'];
              const presentSubKeys = subKeyFiles.filter(f => subFiles.includes(f));
              if (presentSubKeys.length > 0) {
                let subAllAccessible = true;
                for (const kf of presentSubKeys) {
                  try {
                    await fs.statAsync(path.join(entryPath, kf));
                  } catch {
                    subAllAccessible = false;
                    break;
                  }
                }
                if (subAllAccessible) {
                  log('debug', 'Key files found in subdirectory during extraction monitoring', {
                    extractionPath,
                    subdir: entry,
                    keyFiles: presentSubKeys,
                    waitedMs: Date.now() - startTime,
                  });
                  return;
                }
              }
              const subJs = subFiles.find(f => f.endsWith('.js'));
              if (subJs) {
                try {
                  await fs.statAsync(path.join(entryPath, subJs));
                  log('debug', 'JS file accessible in subdirectory during extraction monitoring', {
                    extractionPath,
                    subdir: entry,
                    sampleFile: subJs,
                    waitedMs: Date.now() - startTime,
                  });
                  return;
                } catch {
                  // not yet accessible; continue
                }
              }
            }
          } catch {
            // ignore entry errors and continue
          }
        }

        // Check if both file count and file list are stable
        const filesEqual = JSON.stringify(files.sort()) === JSON.stringify(lastFileList.sort());
        
        if (currentFileCount === lastFileCount && filesEqual) {
          stableCount++;
          // If file count and content have been stable for required checks, extraction is complete
          if (stableCount >= stabilityThreshold) {
            log('debug', 'Extraction directory stable, extraction complete', { 
              extractionPath, 
              fileCount: currentFileCount,
              waitedMs: Date.now() - startTime,
              stableDuration: stableCount * checkInterval,
              platform: process.platform,
              finalFiles: files
            });
            return;
          }
        } else {
          stableCount = 0;
          lastFileCount = currentFileCount;
          lastFileList = [...files];
        }
      } else if (hasFoundFiles) {
        // If we had files before but now we don't, reset everything
        log('debug', 'Files disappeared, resetting monitoring', { extractionPath });
        hasFoundFiles = false;
        stableCount = 0;
        lastFileCount = 0;
        lastFileList = [];
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      checkInterval = Math.min(maxCheckInterval, checkInterval * 2);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Directory doesn't exist yet, keep waiting
        log('debug', 'Directory not found, continuing to wait', { extractionPath, error: err.code });
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        checkInterval = Math.min(maxCheckInterval, checkInterval * 2);
      } else {
        // Other error, log and re-throw
        log('error', 'Error during extraction monitoring', { extractionPath, error: err.message });
        throw err;
      }
    }
  }
  
  // Timeout reached - but check one more time if files exist
  try {
    const finalFiles = (await fs.readdirAsync(extractionPath))
      .filter(f => !f.startsWith('.') && (f !== '__MACOSX'));
    // Final sanity: if we can detect extension files, proceed
    const hasExt = await hasExtensionFiles(extractionPath);
    log('warn', 'Extraction completion monitoring timed out, but files exist - proceeding', { 
      extractionPath,
      maxWaitMs: effectiveMaxWaitMs,
      finalFileCount: finalFiles.length,
      hasFoundFiles,
      hasExtensionFiles: hasExt,
      platform: process.platform,
      finalFiles: finalFiles.slice(0, 10) // Log first 10 files
    });
  } catch (err) {
    log('warn', 'Extraction completion monitoring timed out, and directory check failed', { 
      extractionPath,
      maxWaitMs: effectiveMaxWaitMs,
      lastFileCount,
      hasFoundFiles,
      platform: process.platform,
      error: err.message
    });
  }
}

/**
 * Additional validation to ensure extraction is truly complete on macOS
 * This function checks for the presence of key files and their accessibility
 */
async function validateExtractionCompleteness(extractionPath: string, maxWaitMs: number = 10000): Promise<void> {
  const platformFactor = (process.platform === 'darwin') ? 1.5 : 1;
  const effectiveMaxWaitMs = Math.ceil(maxWaitMs * platformFactor);
  const startTime = Date.now();
  const initialCheckInterval = 50; // Start with 50ms
  const maxCheckInterval = 500; // Max 500ms between checks
  let checkInterval = initialCheckInterval;
  
  log('debug', 'Starting extraction completeness validation', { 
    extractionPath, 
    maxWaitMs: effectiveMaxWaitMs,
    platform: process.platform 
  });
  
  // On macOS, allow a brief initial settle
  if (process.platform === 'darwin') {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  while (Date.now() - startTime < effectiveMaxWaitMs) {
    try {
      // Check if extraction directory exists and has content
      const stats = await fs.statAsync(extractionPath);
      if (!stats.isDirectory()) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      // Check for presence of key files (skip hidden and macOS helper dirs)
      const files = (await fs.readdirAsync(extractionPath))
        .filter(f => !f.startsWith('.') && (f !== '__MACOSX'));
      
      // If directory is empty, continue waiting
      if (files.length === 0) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        // increase interval slightly to reduce churn
        checkInterval = Math.min(maxCheckInterval, checkInterval * 2);
        continue;
      }
      
      const keyFiles = ['index.js', 'info.json'];
      const presentKeyFiles = keyFiles.filter(file => files.includes(file));
      
      // If we have at least one key file, check if it's accessible
      if (presentKeyFiles.length > 0) {
        // Check if key files are accessible
        let allAccessible = true;
        for (const file of presentKeyFiles) {
          try {
            await fs.statAsync(path.join(extractionPath, file));
          } catch (accessErr) {
            allAccessible = false;
            break;
          }
        }
        
        if (allAccessible) {
          log('debug', 'Key files are present and accessible, extraction is complete', { 
            extractionPath, 
            waitedMs: Date.now() - startTime,
            platform: process.platform,
            keyFiles: presentKeyFiles
          });
          return;
        }
      }
      
      // Also check for any JS files as a fallback
      const hasJsFiles = files.some(file => file.endsWith('.js'));
      if (hasJsFiles) {
        // Try to access at least one JS file
        const jsFile = files.find(file => file.endsWith('.js'));
        if (jsFile) {
          try {
            await fs.statAsync(path.join(extractionPath, jsFile));
            log('debug', 'JS files are present and accessible, extraction is complete', { 
              extractionPath, 
              waitedMs: Date.now() - startTime,
              platform: process.platform,
              sampleFile: jsFile
            });
            return;
          } catch (accessErr) {
            // JS file not accessible yet, continue waiting
          }
        }
      }

      // Check first-level subdirectories for key files (common when archives have a nested root)
      for (const entry of files) {
        try {
          const entryPath = path.join(extractionPath, entry);
          const entryStat = await fs.statAsync(entryPath);
          if (entryStat.isDirectory()) {
            const subFiles = (await fs.readdirAsync(entryPath))
              .filter(f => !f.startsWith('.') && (f !== '__MACOSX'));
            if (subFiles.length === 0) continue;
            const subKeyFiles = ['index.js', 'info.json'];
            const presentSubKeys = subKeyFiles.filter(f => subFiles.includes(f));
            if (presentSubKeys.length > 0) {
              let subAllAccessible = true;
              for (const kf of presentSubKeys) {
                try {
                  await fs.statAsync(path.join(entryPath, kf));
                } catch {
                  subAllAccessible = false;
                  break;
                }
              }
              if (subAllAccessible) {
                log('debug', 'Key files found in subdirectory, extraction complete', {
                  extractionPath,
                  subdir: entry,
                  keyFiles: presentSubKeys,
                  waitedMs: Date.now() - startTime,
                });
                return;
              }
            }
            const subJs = subFiles.find(f => f.endsWith('.js'));
            if (subJs) {
              try {
                await fs.statAsync(path.join(entryPath, subJs));
                log('debug', 'JS file accessible in subdirectory, extraction complete', {
                  extractionPath,
                  subdir: entry,
                  sampleFile: subJs,
                  waitedMs: Date.now() - startTime,
                });
                return;
              } catch {
                // not yet accessible; continue
              }
            }
          }
        } catch {
          // ignore entry errors and continue
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      checkInterval = Math.min(maxCheckInterval, checkInterval * 2);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Directory doesn't exist yet, keep waiting
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        checkInterval = Math.min(maxCheckInterval, checkInterval * 2);
      } else {
        // Other error, log and continue waiting
        log('debug', 'Error during completeness validation, continuing to wait', { 
          extractionPath, 
          error: err.message 
        });
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        checkInterval = Math.min(maxCheckInterval, checkInterval * 2);
      }
    }
  }
  
  // Timeout reached
  // Final sanity check: if typical extension files are present, proceed
  try {
    const hasExt = await hasExtensionFiles(extractionPath);
    if (hasExt) {
      log('warn', 'Completeness validation timed out, but extension files detected - proceeding', {
        extractionPath,
        maxWaitMs: effectiveMaxWaitMs,
        platform: process.platform,
      });
      return;
    }
  } catch (_) {
    // ignore
  }
  log('warn', 'Extraction completeness validation timed out, proceeding anyway', { 
    extractionPath,
    maxWaitMs: effectiveMaxWaitMs,
    platform: process.platform
  });
}

/**
 * Comprehensive validation to ensure all required files exist and are accessible
 * This helps prevent race conditions and timing issues on macOS
 * Enhanced with retry mechanisms for better reliability
 */
/**
 * Comprehensive validation to ensure all required files exist and are accessible
 * This helps prevent race conditions and timing issues on macOS
 * Enhanced with retry mechanisms for better reliability
 */
async function validateExtensionFiles(extensionPath: string, info: IExtension): Promise<void> {
  log('debug', 'Starting comprehensive file validation', { extensionPath, extensionId: info.id });
  
  // Enhanced validation with retry mechanisms
  const validateDirectoryExists = () => 
    retryValidationOperation(
      async () => {
        try {
          const stat = await fs.statAsync(extensionPath);
          if (!stat.isDirectory()) {
            throw new DataInvalid(`Extension path is not a directory: ${extensionPath}`);
          }
          return stat;
        } catch (err) {
          throw new DataInvalid(`Extension directory not found or not accessible: ${extensionPath} - ${err.message}`);
        }
      },
      8, // Increased retries for better reliability on macOS
      500, // Increased base delay for macOS file system
      5000, // 5s max delay
      `validate directory existence for ${extensionPath}`,
      (error) => {
        const errorMessage = error.message.toLowerCase();
        return (
          errorMessage.includes('enoent') || // File not found
          errorMessage.includes('ebusy') ||  // Resource busy
          errorMessage.includes('eperm') ||  // Permission denied
          errorMessage.includes('eacces') || // Access denied
          errorMessage.includes('resource busy') ||
          errorMessage.includes('operation not permitted')
        );
      }
    );

  const validateInfoJson = () => 
    retryValidationOperation(
      async () => {
        const infoPath = path.join(extensionPath, 'info.json');
        try {
          await fs.statAsync(infoPath);
          log('debug', 'info.json found and accessible', { infoPath });
          return infoPath;
        } catch (err) {
          throw new DataInvalid(`info.json not found or not accessible: ${infoPath} - ${err.message}`);
        }
      },
      8, // Increased retries for better reliability on macOS
      500, // Increased base delay for macOS file system
      5000, // 5s max delay
      `validate info.json for ${extensionPath}`,
      (error) => {
        const errorMessage = error.message.toLowerCase();
        return (
          errorMessage.includes('enoent') || // File not found
          errorMessage.includes('ebusy') ||  // Resource busy
          errorMessage.includes('eperm') ||  // Permission denied
          errorMessage.includes('eacces') || // Access denied
          errorMessage.includes('resource busy') ||
          errorMessage.includes('operation not permitted')
        );
      }
    );

  const validateEntryScript = () => 
    retryValidationOperation(
      async () => {
        const entryScript = await findEntryScript(extensionPath);
        if (!entryScript) {
          throw new DataInvalid(`No valid entry script found in extension: ${extensionPath}`);
        }
        log('debug', 'Entry script found and accessible', { entryScript, extensionPath });
        return entryScript;
      },
      8, // Increased retries for better reliability on macOS
      500, // Increased base delay for macOS file system
      5000, // 5s max delay
      `validate entry script for ${extensionPath}`,
      (error) => {
        const errorMessage = error.message.toLowerCase();
        return (
          errorMessage.includes('enoent') || // File not found
          errorMessage.includes('ebusy') ||  // Resource busy
          errorMessage.includes('eperm') ||  // Permission denied
          errorMessage.includes('eacces') || // Access denied
          errorMessage.includes('resource busy') ||
          errorMessage.includes('operation not permitted') ||
          errorMessage.includes('entry script')
        );
      }
    );

  // Execute validations with proper error handling
  try {
    await validateDirectoryExists();
    await validateInfoJson();
    await validateEntryScript();
  } catch (err) {
    log('error', 'File validation failed', {
      extensionPath,
      extensionId: info.id,
      error: err.message,
      code: (err as any).code
    });
    throw err;
  }

  // Additional validation based on extension type
  if (info.type === 'theme') {
    const themeFiles = ['variables.scss', 'style.scss', 'fonts.scss'];
    
    const validateThemeFiles = () => 
      retryValidationOperation(
        async () => {
          let hasThemeFile = false;
          
          for (const themeFile of themeFiles) {
            try {
              await fs.statAsync(path.join(extensionPath, themeFile));
              hasThemeFile = true;
              break;
            } catch (err) {
              // Continue checking other theme files
            }
          }
          
          if (!hasThemeFile) {
            log('warn', 'Theme extension missing expected theme files', { extensionPath, expectedFiles: themeFiles });
            // Don't throw for missing theme files - this is a warning, not an error
          }
          
          return hasThemeFile;
        },
        5, // fewer retries for theme files
        300, // base delay
        3000, // max delay
        `validate theme files for ${extensionPath}`
      );
    
    await validateThemeFiles();
  }

  log('debug', 'Comprehensive file validation completed successfully', { extensionPath, extensionId: info.id });
}

async function removeOldVersion(api: IExtensionApi, info: IExtension): Promise<void> {
  const state: IState = api.store.getState();
  const { installed }  = state.session.extensions;
  // should never be more than one but let's handle multiple to be safe
  const previousVersions = Object.keys(installed)
    .filter(key => !installed[key].bundled
                  && ((info.id !== undefined) && (installed[key].id === info.id)
                    || (info.modId !== undefined) && (installed[key].modId === info.modId)
                    || (installed[key].name === info.name)));
  if (previousVersions.length > 0) {
    log('info', '🗑️ removing previous versions of the extension', {
      previousVersions,
      newPath: info.path,
      paths: previousVersions.map(iter => installed[iter].path),
    });
  }

  // Remove from Redux store and delete physical files
  for (const key of previousVersions) {
    api.store.dispatch(removeExtension(key));
    
    // Actually delete the physical files from disk
    const extensionPath = installed[key].path;
    if (extensionPath) {
      try {
        if (await fs.statAsync(extensionPath).then(() => true, () => false)) {
          log('info', 'deleting extension files', { path: extensionPath });
          await fsExtra.remove(extensionPath);
          log('info', 'extension files deleted successfully', { path: extensionPath });
        }
      } catch (err) {
        log('warn', 'failed to delete extension files', { path: extensionPath, error: err.message });
        // Don't throw here - we want to continue with the installation even if cleanup fails
      }
    }
  }
}

/**
 * validate a theme extension. A theme extension can contain multiple themes, one directory
 * per theme, each is expected to contain at least one of
 * "variables.scss", "style.scss" or "fonts.scss"
 */
function validateTheme(extPath: string): Promise<void> {
  return Promise.resolve(fs.readdirAsync(extPath)
    .filter((fileName: string) =>
      fs.statAsync(path.join(extPath, fileName))
        .then(stats => stats.isDirectory()))
    .then(dirNames => {
      if (dirNames.length === 0) {
        return Promise.reject(
          new DataInvalid('Expected a subdirectory containing the stylesheets'));
      }
      // Convert Bluebird.map to standard Promise.all with map
      const validationPromises = dirNames.map(dirName =>
        retryValidationOperation(
          () => Promise.resolve(fs.readdirAsync(path.join(extPath, dirName)).then(files => {
              if (!files.includes('variables.scss')
                  && !files.includes('style.scss')
                  && !files.includes('fonts.scss')) {
                return Promise.reject(
                  new DataInvalid('Theme not found'));
              } else {
                return Promise.resolve();
              }
            })),
          5, // retries
          300, // base delay
          3000, // max delay
          `validate theme directory ${dirName} for ${extPath}`
        )
      );
      
      // Convert Bluebird promise to standard Promise
      return Promise.all(validationPromises)
        .then(() => undefined);
    }));
}

function isLocaleCode(input: string): boolean {
  try {
    new Date().toLocaleString(input);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * validate a translation extension. Can only contain one iso-code named directory (other
 * directories are ignored) which needs to contain at least one json file
 */
function validateTranslation(extPath: string): Promise<void> {
  return Promise.resolve(
    fs.readdirAsync(extPath)
      .filter((fileName: string) => isLocaleCode(fileName))
      .filter((fileName: string) =>
        fs.statAsync(path.join(extPath, fileName))
          .then(stats => stats.isDirectory()))
      .then(dirNames => {
        if (dirNames.length !== 1) {
          return Promise.reject(
            new DataInvalid('Expected exactly one language subdirectory'));
        }
        // the check in isLocaleCode is extremely unreliable because it will fall back to
        // iso on everything. Was it always like that or was that changed in a recent
        // node release?
        const [language, country] = dirNames[0].split('-');
        if (!languageExists(language)
            || (country !== undefined) && !countryExists(country)) {
          return Promise.reject(new DataInvalid('Directory isn\'t a language code'));
        }
        return retryValidationOperation(
          () => Promise.resolve(fs.readdirAsync(path.join(extPath, dirNames[0])).then(files => {
              if (files.find(fileName => path.extname(fileName) === '.json') === undefined) {
                return Promise.reject(new DataInvalid('No translation files'));
              }
              return Promise.resolve();
            })),
          5, // retries
          300, // base delay
          3000, // max delay
          `validate translation directory ${dirNames[0]} for ${extPath}`
        ).then(() => undefined); // Convert to standard Promise
      })
  );
}

/**
 * validate an extension. An extension has to contain an info.json and either an
 * index.js or a package.json with a "main" attribute on the top level
 */
function validateExtension(extPath: string): Promise<void> {
  return retryValidationOperation(
    () => Promise.resolve(fs.statAsync(path.join(extPath, 'info.json')))
      .then(() => findEntryScript(extPath))
      .then(entry => {
        if (entry) {
          return Promise.resolve();
        }
        return Promise.reject(
          new DataInvalid('Extension needs to include an entry script (index.js or package.json main) and info.json on top-level'));
      }),
    8, // retries
    500, // base delay
    5000, // max delay
    `validateExtension for ${extPath}`
  ).catch(err => {
    if ((err as any).code === 'ENOENT') {
      return Promise.reject(
        new DataInvalid('Extension needs to include an entry script (index.js or package.json main) and info.json on top-level'));
    }
    return Promise.reject(err);
  }).then(() => undefined); // Ensure we return void
}

function validateInstall(api: IExtensionApi, extPath: string, info?: IExtension): Promise<ExtensionType> {
  if (info === undefined) {
    let validAsTheme: boolean = true;
    let validAsTranslation: boolean = true;
    let validAsExtension: boolean = true;

    const guessedType: ExtensionType = undefined;
    // if we don't know the type we can only check if _any_ extension type applies
    // Enhanced validation with retry mechanisms for macOS timing issues
    return retryValidationOperation(
      () => validateTheme(extPath),
      5, // retries
      500, // base delay
      3000, // max delay
      `validateTheme for ${extPath}`
    )
      .catch(err => {
        if (err instanceof DataInvalid) {
          validAsTheme = false;
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => retryValidationOperation(
        () => validateTranslation(extPath),
        5, // retries
        500, // base delay
        3000, // max delay
        `validateTranslation for ${extPath}`
      ))
      .catch(err => {
        if (err instanceof DataInvalid) {
          validAsTranslation = false;
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => retryValidationOperation(
        () => validateExtension(extPath),
        5, // retries
        500, // base delay
        3000, // max delay
        `validateExtension for ${extPath}`
      ))
      .catch(err => {
        if (err instanceof DataInvalid) {
          validAsExtension = false;
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => {
        if (!validAsExtension && !validAsTheme && !validAsTranslation) {
          return Promise.reject(
            new DataInvalid('Doesn\'t seem to contain a correctly packaged extension, '
              + 'theme or translation'));
        }

        // Enhanced game extension detection
        // Check if this might be a game extension based on naming conventions
        if (validAsExtension) {
          try {
            const infoPath = path.join(extPath, 'info.json');
            if (fsNode.existsSync(infoPath)) {
              const extensionInfo = JSON.parse(fs.readFileSync(infoPath, { encoding: 'utf8' }));
              log('debug', 'Checking if extension is a game extension', {
                extensionName: extensionInfo.name,
                extensionId: extensionInfo.id,
                currentType: extensionInfo.type
              });
              
              // Game extensions typically have "Game:" in their name or specific game-related fields
              if (extensionInfo.name && 
                  (extensionInfo.name.toLowerCase().startsWith('game:') ||
                   extensionInfo.name.toLowerCase().includes('vortex extension') ||
                   extensionInfo.name.toLowerCase().includes('game') ||
                   // Additional patterns for common game extension naming conventions
                   extensionInfo.name.toLowerCase().includes('mod manager') ||
                   extensionInfo.name.toLowerCase().includes('game support') ||
                   extensionInfo.name.toLowerCase().includes('game extension') ||
                   // Check if the extension name contains common game-related terms
                   /\b(balatro|skyrim|fallout|witcher|stardew|factorio|rimworld|subnautica|valheim|minecraft|cyberpunk|elden|elden ring|starfield|gta|grand theft auto)\b/i.test(extensionInfo.name))) {
                log('info', 'Identified potential game extension during installation', {
                  extensionName: extensionInfo.name,
                  path: extPath,
                  matchedPattern: extensionInfo.name.toLowerCase().startsWith('game:') ? 'game:' :
                                 extensionInfo.name.toLowerCase().includes('vortex extension') ? 'vortex extension' :
                                 extensionInfo.name.toLowerCase().includes('game') ? 'game' :
                                 extensionInfo.name.toLowerCase().includes('mod manager') ? 'mod manager' :
                                 extensionInfo.name.toLowerCase().includes('game support') ? 'game support' :
                                 extensionInfo.name.toLowerCase().includes('game extension') ? 'game extension' :
                                 'game term match'
                });
                // For game extensions, we should explicitly set the type to 'game'
                // This will help the refresh-game-list handler recognize it properly
                log('debug', 'Setting extension type to game and emitting refresh event', {
                  extensionName: extensionInfo.name,
                  path: extPath
                });
                // Emit an event to notify that a game extension has been identified
                // This will help trigger the refresh-game-list event
                api.events.emit('game-extension-identified', extensionInfo.name);
                return Promise.resolve('game' as ExtensionType);
              } else {
                log('debug', 'Extension does not match game extension patterns', {
                  extensionName: extensionInfo.name,
                  nameLower: extensionInfo.name.toLowerCase()
                });
              }
            } else {
              log('warn', 'info.json not found for extension', { path: infoPath });
            }
          } catch (parseErr) {
            log('warn', 'Failed to parse info.json for game extension detection', {
              path: extPath,
              error: parseErr.message
            });
          }
        }

        // at least one type was valid, let's guess what it really is
        if (validAsExtension) {
          return Promise.resolve(undefined);
        } else if (validAsTranslation) {
          // it's unlikely we would mistake a theme for a translation since it would require
          // it to contain a directory named like a iso language code including json files.
          return Promise.resolve('translation' as ExtensionType);
        } else {
          return Promise.resolve('theme' as ExtensionType);
        }
      });
  } else if (info.type === 'theme') {
    return retryValidationOperation(
      () => validateTheme(extPath).then(() => Promise.resolve('theme' as ExtensionType)),
      5, // retries
      500, // base delay
      3000, // max delay
      `validateTheme with type for ${extPath}`
    );
  } else if (info.type === 'translation') {
    return retryValidationOperation(
      () => validateTranslation(extPath).then(() => Promise.resolve('translation' as ExtensionType)),
      5, // retries
      500, // base delay
      3000, // max delay
      `validateTranslation with type for ${extPath}`
    );
  } else {
    return retryValidationOperation(
      () => validateExtension(extPath).then(() => Promise.resolve(undefined)),
      5, // retries
      500, // base delay
      3000, // max delay
      `validateExtension with type for ${extPath}`
    );
  }
}

async function installExtension(api: IExtensionApi,
                          archivePath: string,
                          info?: IExtension): Promise<void> {
  const extensionsPath = path.join(getVortexPath('userData'), 'plugins');
  let destPath: string;
  // Remove file extension before adding .installing to avoid issues with special characters
  const archiveName = path.basename(archivePath, path.extname(archivePath));
  const tempPath = path.join(extensionsPath, archiveName) + '.installing';

  // Log the start of the installation process
  log('info', 'Starting extension installation process', {
    archivePath,
    extensionsPath,
    tempPath,
    platform: process.platform,
    hasProvidedInfo: !!info
  });

  // Removed direct node-7z extractor creation; we choose implementation per-platform below
  let fullInfo: any = info || {};

  let type: ExtensionType;
  let manifestOnly = false;

  let extName: string;
  // Ensure target directories exist to avoid ENOENT when writing manifest or extracting
  return Promise.resolve(fs.ensureDirAsync(extensionsPath))
    .then(() => {
      log('debug', 'Ensured extensions directory exists', { extensionsPath });
      return fs.ensureDirAsync(tempPath);
    })
    .then(async () => {
      log('debug', 'Ensured temporary directory exists', { tempPath });
      // Unified extraction using archive helper with platform-aware fallback and retries
      const { extractArchive } = require('../../util/archive');
      // Predict extraction method for logging visibility
      const lower = archivePath.toLowerCase();
      const predicted:
        'macOS-zip-ditto' | 'macOS-7z/rar-native' | 'tar' | 'node-7z' =
        (process.platform === 'darwin' && (lower.endsWith('.zip'))) ? 'macOS-zip-ditto'
        : ((process.platform === 'darwin') && (lower.endsWith('.7z') || lower.endsWith('.rar'))) ? 'macOS-7z/rar-native'
        : ((lower.endsWith('.tar') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz'))) ? 'tar'
        : 'node-7z';
      log('info', 'Predicted extraction method', {
        archivePath,
        tempPath,
        platform: process.platform,
        predicted,
        ext: path.extname(archivePath).toLowerCase(),
        arch: process.arch,
      });
      const extractionStartTime = Date.now();
      // macOS health check wrapper to reduce transient failures
      if (process.platform === 'darwin') {
        await retryValidationOperation(
          () => extractArchive(archivePath, tempPath, { ssc: false }),
          3, // a few retries around the core extractor
          400, // base delay
          3000, // max delay
          `macOS extractArchive for ${archivePath}`,
          (error) => {
            const msg = (error?.message || '').toLowerCase();
            return (
              msg.includes('enoent') ||
              msg.includes('ebusy') ||
              msg.includes('eperm') ||
              msg.includes('eacces') ||
              msg.includes('resource busy') ||
              msg.includes('operation not permitted') ||
              msg.includes('failed') ||
              msg.includes('exit')
            );
          }
        );
      } else {
        await extractArchive(archivePath, tempPath, { ssc: false });
      }
      const extractionDuration = Date.now() - extractionStartTime;
      log('info', 'Archive extraction completed', {
        tempPath,
        archivePath,
        platform: process.platform,
        duration: `${extractionDuration}ms`
      });
      // Validate and settle filesystem
      log('debug', 'Monitoring extraction completion', { tempPath, archivePath });
      await waitForExtractionCompletion(tempPath, 5000);
      log('debug', 'Validating extraction completeness', { tempPath, archivePath });
      await validateExtractionCompleteness(tempPath, 20000);
      log('debug', 'Adding additional delay for file system settlement', { delay: '500ms' });
      await new Promise<void>(resolve => setTimeout(resolve, 500));
    })
    .then(() => {
      log('debug', 'Flattening nested root directory if needed', { tempPath });
      return flattenNestedRoot(tempPath);
    })
    .then(() => {
      log('debug', 'Reading extension info from extracted files', { tempPath });
      return readExtensionInfo(tempPath, false, info);
    })
      // merge the caller-provided info with the stuff parsed from the info.json file because there
      // is data we may only know at runtime (e.g. the modId)
    .then(manifestInfo => {
      log('debug', 'Merging extension info', { 
        providedInfo: !!info,
        parsedInfo: !!manifestInfo.info,
        extensionId: manifestInfo.id
      });
      
      fullInfo = { ...(manifestInfo.info || {}), ...fullInfo };
      const res: { id: string, info: Partial<IExtension> } = {
        id: manifestInfo.id,
        info: fullInfo,
      };

      if (res.info.type === undefined) {
        res.info.type = type;
      }

      return res;
    })
    .catch(err => {
      log('error', 'Failed to read or merge extension info', {
        error: err.message,
        code: (err as any).code,
        archivePath,
        tempPath
      });
      
      if (err && (err as any).code === 'ENOENT') {
        if (info !== undefined) {
          log('debug', 'Using provided info as fallback', { archivePath });
          return {
            id: path.basename(archivePath, path.extname(archivePath)),
            info,
          };
        }
        return Promise.reject(new Error('not an extension, info.json missing'));
      }
      return Promise.reject(err);
    })
    .then(manifestInfo =>
        // update the manifest on disc, in case we had new info from the caller
      fs.writeFileAsync(path.join(tempPath, 'info.json'),
                        JSON.stringify(manifestInfo.info, undefined, 2))
        .then(() => {
          log('debug', 'Updated info.json with merged information', { 
            tempPath,
            extensionId: manifestInfo.id
          });
          return manifestInfo;
        }))
    .then((manifestInfo: { id: string, info: IExtension }) => {
      extName = manifestInfo.id;

      const dirName = sanitize(manifestInfo.id);
      destPath = path.join(extensionsPath, dirName);
      
      log('info', 'Processing extension installation', {
        extensionId: manifestInfo.id,
        extensionName: manifestInfo.info.name,
        extensionType: manifestInfo.info.type,
        destPath,
        tempPath
      });
      
      if (manifestInfo.info.type !== undefined) {
        type = manifestInfo.info.type;
        log('debug', 'Extension type from manifest info', { 
          extensionId: extName,
          type: type
        });
      }
      // Determine whether this is a manifest-only update (no acceptable entry script in archive)
      return retryValidationOperation(
        () => findEntryScript(tempPath),
        8, // Increased retries for better reliability on macOS
        500, // Increased base delay for macOS file system
        5000, // 5s max delay
        `findEntryScript for temp path ${tempPath}`,
        (error) => {
          const errorMessage = error.message.toLowerCase();
          return (
            errorMessage.includes('enoent') || // File not found
            errorMessage.includes('ebusy') ||  // Resource busy
            errorMessage.includes('eperm') ||  // Permission denied
            errorMessage.includes('eacces') || // Access denied
            errorMessage.includes('resource busy') ||
            errorMessage.includes('operation not permitted') ||
            errorMessage.includes('entry script')
          );
        }
      ).then(tempEntry => {
        if (!tempEntry) {
          log('debug', 'No entry script found in archive, checking for existing installation', { 
            tempPath,
            destPath 
          });
          
          // Enhanced retry mechanism for finding entry script in existing installation
          return retryValidationOperation(
            () => findEntryScript(destPath),
            8, // Increased retries for better reliability on macOS
            500, // Increased base delay for macOS file system
            5000, // 5s max delay
            `findEntryScript for dest path ${destPath}`,
            (error) => {
              const errorMessage = error.message.toLowerCase();
              return (
                errorMessage.includes('enoent') || // File not found
                errorMessage.includes('ebusy') ||  // Resource busy
                errorMessage.includes('eperm') ||  // Permission denied
                errorMessage.includes('eacces') || // Access denied
                errorMessage.includes('resource busy') ||
                errorMessage.includes('operation not permitted') ||
                errorMessage.includes('entry script')
              );
            }
          ).then(destEntry => {
            if (destEntry) {
              log('info', 'Manifest-only update detected', { 
                extensionId: extName,
                destPath 
              });
              
              manifestOnly = true;
              
              // Additional validation for manifest-only updates on macOS
              let additionalDelayPromise = Promise.resolve();
              if (process.platform === 'darwin') {
                log('debug', 'Adding additional delay for manifest-only update on macOS', { 
                  delay: '1000ms',
                  platform: process.platform
                });
                additionalDelayPromise = new Promise<void>(resolve => setTimeout(resolve, 1000));
              }
              
              // Apply manifest update into existing install and remove temp
              return additionalDelayPromise
                .then(() => fs.copyAsync(path.join(tempPath, 'info.json'), path.join(destPath, 'info.json'), { overwrite: true }))
                .then(() => {
                  log('debug', 'Copied updated info.json to existing installation', { destPath });
                  return fs.removeAsync(tempPath);
                })
                .then(() => {
                  log('debug', 'Removed temporary directory', { tempPath });
                  return undefined;
                });
            } else {
              log('error', 'No entry script found in archive or existing installation after all retries', { 
                tempPath,
                destPath 
              });
              // No entry in archive and no existing installed extension to update
              throw new DataInvalid('Extension package missing entry script (expected index.js or package.json main)');
            }
          });
        } else {
          log('debug', 'Entry script found in archive', { 
            tempPath,
            entryScript: tempEntry
          });
        }
        return undefined;
      }).then(() => {
        // Only validate a full extension install (skip for manifest-only updates)
        if (!manifestOnly) {
          log('debug', 'Validating full extension installation', { tempPath });
          
          return retryValidationOperation(
            () => validateInstall(api, tempPath, info),
            5, // 5 retries for better reliability
            300, // 300ms base delay
            3000, // 3s max delay
            `validateInstall for ${tempPath}`
          ).then(guessedType => {
            if (type === undefined) {
              type = guessedType;
              log('debug', 'Determined extension type', { 
                extensionId: extName,
                type: guessedType
              });
            } else {
              log('debug', 'Extension type already set, not overriding', { 
                extensionId: extName,
                existingType: type,
                guessedType: guessedType
              });
            }
            // Update the manifest info with the determined type
            // This ensures the info.json file reflects the correct extension type
            if (type !== undefined && manifestInfo.info.type !== type) {
              manifestInfo.info.type = type;
              log('debug', 'Updating manifest info with determined type', { 
                extensionId: extName,
                oldType: manifestInfo.info.type,
                newType: type
              });
              // Update the info.json file with the correct type
              return fs.writeFileAsync(path.join(tempPath, 'info.json'),
                                    JSON.stringify(manifestInfo.info, undefined, 2))
                .then(() => {
                  log('debug', 'Updated info.json with determined extension type', { 
                    tempPath,
                    extensionId: extName,
                    type: type
                  });
                  return manifestInfo.info;
                });
            }
            return manifestInfo.info;
          });
        }
        return manifestInfo.info;
      });
    })
      // we don't actually expect the output directory to exist
    .then((infoForRemoval) => {
      if (manifestOnly) {
        log('debug', 'Skipping old version removal for manifest-only update', { extName });
        return Promise.resolve();
      }
      
      log('debug', 'Removing old version of extension if it exists', { extName });
      return removeOldVersion(api, infoForRemoval);
    })
    .then(() => {
      if (manifestOnly) {
        log('debug', 'Skipping destination directory removal for manifest-only update', { destPath });
        return Promise.resolve();
      }
      
      log('debug', 'Removing destination directory if it exists', { destPath });
      return fs.removeAsync(destPath);
    })
    .then(() => {
      if (manifestOnly) {
        log('debug', 'Skipping directory rename for manifest-only update', { tempPath, destPath });
        return Promise.resolve();
      }
      
      log('debug', 'Renaming temporary directory to destination', { tempPath, destPath });
      return fs.renameAsync(tempPath, destPath);
    })
    .then(() => {
      if (manifestOnly) {
        log('info', 'Manifest-only update completed successfully', { extName });
        return Promise.resolve();
      }
      
      log('debug', 'Performing comprehensive file validation after extraction and file operations', { destPath });
      
      // Comprehensive file validation after extraction and file operations
      return fs.readFileAsync(path.join(destPath, 'info.json'), { encoding: 'utf8' })
        .then((data) => JSON.parse(data))
        .then((extensionInfo) => {
          log('debug', 'Validating extension files', { 
            destPath,
            extensionId: extensionInfo.id,
            extensionName: extensionInfo.name,
            extensionType: extensionInfo.type
          });
          // Ensure the extension type is correctly set in the final info.json
          if (type !== undefined && extensionInfo.type !== type) {
            extensionInfo.type = type;
            log('debug', 'Updating final info.json with correct extension type', { 
              destPath,
              extensionId: extensionInfo.id,
              oldType: extensionInfo.type,
              newType: type
            });
            // Update the info.json file with the correct type
            return fs.writeFileAsync(path.join(destPath, 'info.json'),
                                  JSON.stringify(extensionInfo, undefined, 2))
              .then(() => {
                log('debug', 'Updated final info.json with extension type', { 
                  destPath,
                  extensionId: extensionInfo.id,
                  type: type
                });
                return validateExtensionFiles(destPath, extensionInfo);
              });
          }
          return validateExtensionFiles(destPath, extensionInfo);
        })
        .catch((validationError) => {
          log('error', 'Extension file validation failed after installation', {
            destPath,
            type,
            error: validationError.message,
            platform: process.platform
          });
          throw new Error(`Extension validation failed: ${validationError.message}`);
        });
    })
    .then(() => {
      if (manifestOnly) {
        return Promise.resolve();
      }
      
      if (type === 'translation') {
        log('debug', 'Processing translation extension', { destPath });
        return fs.readdirAsync(destPath)
          .map((entry: string) => fs.statAsync(path.join(destPath, entry))
            .then(stat => ({ name: entry, stat })))
          .then(() => {
            log('debug', 'Translation extension processing completed', { destPath });
            return undefined;
          });
      } else if (type === 'theme') {
        log('debug', 'Processing theme extension', { destPath });
        return Promise.resolve();
      } else if (type === 'game') {
        log('debug', 'Processing game extension', { 
          destPath, 
          extensionName: extName,
          type: type
        });
        // For game extensions, we don't need to do any special processing during installation
        // The game extension will be loaded and registered when the user tries to manage the game
        return Promise.resolve();
      } else {
          // don't install dependencies for extensions that are already loaded because
          // doing so could cause an exception
        if (api.getLoadedExtensions().find(ext => ext.name === extName) === undefined) {
          log('debug', 'Installing extension dependencies', { destPath, extName });
          return installExtensionDependencies(api, destPath);
        } else {
          log('debug', 'Skipping dependency installation - extension already loaded', { extName });
          return Promise.resolve();
        }
      }
    })
    .then(() => {
      // Enhanced synchronous extension list update with better error handling
      log('debug', 'updating extension list synchronously after installation', { 
        extName, 
        platform: process.platform,
        destPath 
      });
      
      const updateExtensionList = async (): Promise<void> => {
        try {
            // Verify the extension directory exists and is accessible
            await fsExtra.access(destPath);
          
          // Additional delay on macOS to ensure file system operations are fully settled
          if (process.platform === 'darwin') {
            log('debug', 'Adding additional delay for macOS file system settlement', { 
              delay: '1000ms',
              platform: process.platform
            });
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
          }
          
          // Force a fresh read of extensions
          log('debug', 'Reading extensions synchronously', { force: true });
          const extensions = readExtensionsSync(true);
          
          // Verify our extension is in the list
          if (!extensions[extName]) {
            log('error', 'Extension not found in extension list after installation', { 
              extName,
              extensionCount: Object.keys(extensions).length
            });
            throw new Error(`Extension ${extName} not found in extension list after installation`);
          }
          
          api.store.dispatch(setInstalledExtensions(extensions));
          
          log('info', 'Extension list updated synchronously after installation', { 
            extensionCount: Object.keys(extensions).length,
            installedExtension: extName,
            platform: process.platform,
            verified: true
          });
          
          // Emit event to notify other components
          api.events.emit('extension-installed', extName, extensions[extName]);
          
        } catch (err) {
          log('warn', 'Failed to update extension list synchronously', { 
            error: err.message, 
            extName,
            platform: process.platform,
            destPath
          });
          
          // Fallback: try again after a longer delay with exponential backoff
          const maxRetries = 5; // Increased retries for macOS
          for (let retry = 0; retry < maxRetries; retry++) {
            // Increased delay for macOS timing issues
            const baseDelay = process.platform === 'darwin' ? 2000 : 1000;
            const delay = baseDelay * Math.pow(2, retry);
            log('debug', `Retrying extension list update in ${delay}ms`, { 
              retryAttempt: retry + 1,
              maxRetries
            });
            await new Promise<void>(resolve => setTimeout(resolve, delay));
            
            try {
                await fsExtra.access(destPath);
              const extensions = readExtensionsSync(true);
              
              if (extensions[extName]) {
                api.store.dispatch(setInstalledExtensions(extensions));
                log('info', 'Extension list updated on retry', { 
                  extensionCount: Object.keys(extensions).length,
                  installedExtension: extName,
                  retryAttempt: retry + 1
                });
                api.events.emit('extension-installed', extName, extensions[extName]);
                return;
              } else {
                throw new Error(`Extension ${extName} still not found after retry ${retry + 1}`);
              }
            } catch (retryErr) {
              if (retry === maxRetries - 1) {
                log('error', 'Failed to update extension list even after all retries', { 
                  error: retryErr.message, 
                  extName,
                  maxRetries,
                  destPath
                });
                // Don't throw here - installation succeeded, just list update failed
              } else {
                log('debug', 'Extension list update retry failed, trying again', {
                  error: retryErr.message,
                  retryAttempt: retry + 1,
                  nextDelay: baseDelay * Math.pow(2, retry + 1)
                });
              }
            }
          }
        }
      };
      
      return updateExtensionList();
    })
    .catch(err => {
      log('error', 'Extension installation failed', {
        error: err.message,
        stack: err.stack,
        code: (err as any).code,
        archivePath,
        destPath,
        tempPath,
        extName
      });

      try {
        // Emit a failure event so UI/manager can suppress loops or show a single notification
        api.events.emit('extension-install-failed', extName, { error: err.message });
      } catch (_) { /* ignore */ }

      try {
        fs.removeSync(tempPath);
        log('debug', 'Cleaned up temporary directory after failure', { tempPath });
      } catch (removeErr) {
        log('warn', 'Failed to clean up temporary directory', { 
          tempPath, 
          error: removeErr.message 
        });
      }
    });
}

/**
 * try to find the entry script of an extension (index.js or package.json main field)
 */
function findEntryScript(extPath: string): Promise<string | undefined> {
  // Enhanced tryExists with retry mechanism for macOS timing issues
  const tryExists = (p: string) => 
    retryValidationOperation(
      () => Promise.resolve(fs.statAsync(p)).then(() => true).catch(() => false),
      5, // retries
      300, // base delay
      3000, // max delay
      `check file existence for ${p}`
    );
    
  // Enhanced tryReadPkgMain with retry mechanism
  const tryReadPkgMain = () =>
    retryValidationOperation(
      () => Promise.resolve(fs.readFileAsync(path.join(extPath, 'package.json'), { encoding: 'utf8' }))
        .then(raw => {
          try {
            const pkg = JSON.parse(raw);
            if (pkg && typeof pkg.main === 'string' && pkg.main.length > 0) {
              const mainPath = path.join(extPath, pkg.main);
              return tryExists(mainPath).then(exists => exists ? mainPath : undefined);
            }
          } catch (_) {
            // ignore invalid package.json
          }
          return undefined as undefined;
        })
        .catch(() => undefined as undefined),
      5, // retries
      300, // base delay
      3000, // max delay
      `read package.json for ${extPath}`
    );

  const attemptFind = async () => {
    // Define search patterns in order of preference
    const searchPatterns = [
      // Standard patterns (current Vortex behavior)
      'index.js',
      'dist/index.js',
      
      // Common nested patterns
      'src/index.js',
      'lib/index.js',
      'build/index.js',
      'out/index.js',
      
      // Alternative entry points
      'main.js',
      'src/main.js',
      'lib/main.js',
      
      // Extension-specific patterns
      'extension.js',
      'src/extension.js',
      'lib/extension.js',
      
      // Game-specific patterns (common in Vortex game extensions)
      'game.js',
      'src/game.js',
      'lib/game.js',
      
      // TypeScript compiled outputs
      'dist/src/index.js',
      'dist/lib/index.js',
      'build/src/index.js',
      'build/lib/index.js',
      
      // Webpack/Rollup outputs
      'bundle.js',
      'dist/bundle.js',
      'build/bundle.js'
    ];
    
    // 1. Try standard file patterns
    for (const pattern of searchPatterns) {
      const filePath = path.join(extPath, pattern);
      const exists = await tryExists(filePath);
      if (exists) {
        return filePath;
      }
    }
    
    // 2. Try package.json main field in root
    const rootMain = await tryReadPkgMain();
    if (rootMain) {
      return rootMain;
    }
    
    // 3. Try package.json main field in common subdirectories
    const subDirs = ['src', 'lib', 'dist', 'build', 'out'];
    for (const subDir of subDirs) {
      const subDirPath = path.join(extPath, subDir);
      try {
        const exists = await tryExists(subDirPath);
        if (exists) {
          const subMain = await tryReadPkgMainInDir(subDirPath);
          if (subMain) {
            return subMain;
          }
        }
      } catch {
        // Directory doesn't exist or can't be accessed, continue
      }
    }
    
    // 4. Recursive search for any .js files (as last resort)
    try {
      const jsFiles = await findJsFilesRecursive(extPath, 0, 3);
      
      // Prioritize files with common entry point names
      const entryPointNames = ['index', 'main', 'extension', 'game', 'app'];
      for (const name of entryPointNames) {
        const candidate = jsFiles.find(file => {
          const basename = path.basename(file, '.js');
          return basename === name;
        });
        if (candidate) {
          return candidate;
        }
      }
      
      // If no common names found, return the first .js file
      if (jsFiles.length > 0) {
        return jsFiles[0];
      }
    } catch {
      // Recursive search failed, continue
    }
    
    return undefined;
  };
  
  // Helper function to read package.json main field in a specific directory
  const tryReadPkgMainInDir = (dirPath: string) =>
    retryValidationOperation(
      () => Promise.resolve(fs.readFileAsync(path.join(dirPath, 'package.json'), { encoding: 'utf8' }))
        .then(raw => {
          try {
            const pkg = JSON.parse(raw);
            if (pkg && typeof pkg.main === 'string' && pkg.main.length > 0) {
              const mainPath = path.join(dirPath, pkg.main);
              return tryExists(mainPath).then(exists => exists ? mainPath : undefined);
            }
          } catch (_) {
            // ignore invalid package.json
          }
          return undefined as undefined;
        })
        .catch(() => undefined as undefined),
      5, // retries
      300, // base delay
      3000, // max delay
      `read package.json for ${dirPath}`
    );
  
  // Helper function to recursively find .js files
  const findJsFilesRecursive = async (dir: string, depth: number, maxDepth: number): Promise<string[]> => {
    if (depth > maxDepth) return [];
    
    const files: string[] = [];
    try {
      const entries = await fs.readdirAsync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        try {
          const stat = await fs.statAsync(fullPath);
          
          if (stat.isFile() && entry.endsWith('.js')) {
            files.push(fullPath);
          } else if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
            const subFiles = await findJsFilesRecursive(fullPath, depth + 1, maxDepth);
            files.push(...subFiles);
          }
        } catch {
          // Skip files we can't access
        }
      }
    } catch {
      // Can't read directory
    }
    
    return files;
  };

  // Use robust retry mechanism for finding entry script
  return retryValidationOperation<string | undefined>(
    () => Promise.resolve(attemptFind()),
    8, // Increased retries for better reliability on macOS
    500, // Increased base delay for macOS file system
    5000, // 5s max delay
    `findEntryScript for ${extPath}`,
    (error) => {
      const errorMessage = error.message.toLowerCase();
      return (
        // Common file system timing issues on macOS
        errorMessage.includes('enoent') || // File not found
        errorMessage.includes('ebusy') ||  // Resource busy
        errorMessage.includes('eperm') ||  // Permission denied (sometimes temporary)
        errorMessage.includes('eacces') || // Access denied (sometimes temporary)
        errorMessage.includes('emfile') || // Too many open files
        errorMessage.includes('enotempty') || // Directory not empty
        // Network-related issues that might affect validation
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('econn') || // Connection errors
        errorMessage.includes('etimedout') ||
        // General retryable errors
        errorMessage.includes('temporary') ||
        errorMessage.includes('transient') ||
        // macOS specific timing issues
        errorMessage.includes('resource busy') ||
        errorMessage.includes('operation not permitted')
      );
    }
  ).then(result => result); // Ensure we return a standard Promise
}

export default installExtension;



// Run a system command synchronously and throw on non-zero exit code
function runCommandSync(cmd: string, args: string[], cwd?: string): void {
  const result = spawnSync(cmd, args, { 
    cwd, 
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  if (result.error) {
    (result.error as any).stdout = result.stdout;
    (result.error as any).stderr = result.stderr;
    throw result.error;
  }
  
  if (result.status !== 0) {
    const err: any = new Error(`Command failed: ${cmd} ${args.join(' ')} (exit ${result.status})`);
    err.exitCode = result.status;
    err.stdout = result.stdout;
    err.stderr = result.stderr;
    throw err;
  }
}

// Try a list of commands in sequence until one succeeds (synchronous)
function tryCommandsSync(cmds: Array<{ cmd: string, args: string[] }>, cwd?: string): void {
  interface AttemptInfo {
    command: string;
    available: boolean;
    error?: string;
    exitCode?: number;
  }
  
  const attemptedCommands: AttemptInfo[] = [];
  const startTime = Date.now();
  
  log('debug', 'Starting extraction command attempts', { 
    totalCommands: cmds.length,
    workingDirectory: cwd || process.cwd(),
    platform: process.platform,
    arch: process.arch
  });
  
  for (let idx = 0; idx < cmds.length; idx++) {
    const { cmd, args } = cmds[idx];
    const commandString = `${cmd} ${args.join(' ')}`;
    const attemptStartTime = Date.now();
    
    // Pre-flight check: verify command availability
    const isCommandAvailable = hasCommandSync(cmd) || fsNode.existsSync(cmd);
    
    log('debug', `Attempting extraction command ${idx + 1}/${cmds.length}`, { 
      command: commandString,
      commandPath: cmd,
      arguments: args,
      isCommandAvailable,
      workingDirectory: cwd || process.cwd()
    });
    
    const attemptInfo: AttemptInfo = {
      command: commandString,
      available: isCommandAvailable
    };
    
    if (!isCommandAvailable) {
      const notFoundError = `Command not found: ${cmd}`;
      log('debug', 'Skipping unavailable command', { 
        command: commandString,
        error: notFoundError,
        duration: Date.now() - attemptStartTime
      });
      
      attemptInfo.error = notFoundError;
      attemptedCommands.push(attemptInfo);
      continue; // Skip to next command
    }
    
    try {
      // Additional validation for file-based commands
      if (cmd.includes('/') && !fsNode.existsSync(cmd)) {
        throw new Error(`Extraction tool not found at path: ${cmd}`);
      }
      
      // Validate arguments contain required paths
      const hasArchivePath = args.some(arg => arg.includes('.'));
      const hasDestPath = args.some(arg => arg.startsWith('-o') || arg.includes('/'));
      
      if (!hasArchivePath || !hasDestPath) {
        log('warn', 'Command arguments may be incomplete', {
          command: commandString,
          hasArchivePath,
          hasDestPath,
          args
        });
      }
      
      log('debug', 'Executing extraction command', { 
        command: commandString,
        attempt: idx + 1,
        totalAttempts: cmds.length
      });
      
      // Use retry logic for the extraction command
      withRetry(
        () => runCommandSync(cmd, args, cwd),
        DEFAULT_RETRY_CONFIG,
        `7z extraction: ${commandString}`
      );
      
      const duration = Date.now() - attemptStartTime;
      const totalDuration = Date.now() - startTime;
      
      log('info', 'Successfully executed extraction command', { 
        command: commandString,
        attempt: idx + 1,
        duration: `${duration}ms`,
        totalDuration: `${totalDuration}ms`,
        workingDirectory: cwd || process.cwd()
      });
      
      // Verify extraction actually produced files
      if (cwd && fsNode.existsSync(cwd)) {
        try {
          const files = fsNode.readdirSync(cwd);
          log('debug', 'Post-extraction directory contents', {
            extractionPath: cwd,
            fileCount: files.length,
            files: files.slice(0, 10) // Show first 10 files
          });
        } catch (dirErr) {
          log('warn', 'Could not verify extraction results', {
            extractionPath: cwd,
            error: dirErr.message
          });
        }
      }
      
      return; // Success, exit early
    } catch (err) {
      const duration = Date.now() - attemptStartTime;
      const errorDetails = {
        command: commandString,
        attempt: idx + 1,
        totalAttempts: cmds.length,
        duration: `${duration}ms`,
        error: err?.message || 'Unknown error',
        exitCode: (err as any)?.exitCode,
        stdout: (err as any)?.stdout,
        stderr: (err as any)?.stderr,
        errno: (err as any)?.errno,
        code: (err as any)?.code,
        signal: (err as any)?.signal
      };
      
      log('warn', 'Archive extraction attempt failed', errorDetails);
      
      attemptInfo.error = err?.message || 'Unknown error';
      attemptInfo.exitCode = (err as any)?.exitCode;
      attemptedCommands.push(attemptInfo);
      
      // Analyze error for common issues
      const errorMessage = (err?.message || '').toLowerCase();
      const stderr = ((err as any)?.stderr || '').toLowerCase();
      const combinedError = `${errorMessage} ${stderr}`;
      
      if (combinedError.includes('permission denied') || combinedError.includes('eperm')) {
        log('warn', 'Permission issue detected', {
          command: commandString,
          suggestion: 'Check file permissions and user access rights'
        });
      } else if (combinedError.includes('no such file') || combinedError.includes('enoent')) {
        log('warn', 'File not found issue detected', {
          command: commandString,
          suggestion: 'Verify archive path and extraction tool availability'
        });
      } else if (combinedError.includes('corrupted') || combinedError.includes('invalid')) {
        log('warn', 'Archive corruption suspected', {
          command: commandString,
          suggestion: 'Archive may be corrupted or in unsupported format'
        });
      } else if (combinedError.includes('disk') || combinedError.includes('space')) {
        log('warn', 'Disk space issue suspected', {
          command: commandString,
          suggestion: 'Check available disk space'
        });
      }
      
      if (idx === cmds.length - 1) {
        // Last command failed, throw comprehensive error
        const totalDuration = Date.now() - startTime;
        const availableCommands = attemptedCommands.filter(cmd => cmd.available);
        const unavailableCommands = attemptedCommands.filter(cmd => !cmd.available);
        
        const platformSpecificHelp = process.platform === 'darwin' ? [
          'macOS-specific troubleshooting:',
          '  • Install Xcode Command Line Tools: xcode-select --install',
          '  • Install Homebrew and 7-Zip: brew install p7zip',
          '  • Install The Unarchiver: mas install 425424353',
          '  • Check Gatekeeper settings: System Preferences > Security & Privacy',
          '  • Ensure proper permissions: chmod +x /path/to/extraction/tool',
          '  • Reinstall Vortex to restore bundled extraction tools'
        ] : process.platform === 'win32' ? [
          'Windows-specific troubleshooting:',
          '  • Install 7-Zip from https://www.7-zip.org/',
          '  • Check Windows Defender or antivirus blocking',
          '  • Run as Administrator if permission issues persist',
          '  • Ensure PATH environment variable includes extraction tools'
        ] : [
          'Linux-specific troubleshooting:',
          '  • Install p7zip: sudo apt install p7zip-full (Ubuntu/Debian)',
          '  • Install p7zip: sudo yum install p7zip (RHEL/CentOS)',
          '  • Install unrar: sudo apt install unrar',
          '  • Check file permissions and SELinux policies'
        ];
        
        const diagnosticInfo = {
          totalAttempts: cmds.length,
          availableTools: availableCommands.length,
          unavailableTools: unavailableCommands.length,
          totalDuration: `${totalDuration}ms`,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          workingDirectory: cwd || process.cwd(),
          attemptedCommands: attemptedCommands.map(cmd => ({
            command: cmd.command,
            available: cmd.available,
            error: cmd.error,
            exitCode: cmd.exitCode
          }))
        };
        
        const detailedError = new Error([
          '🚨 ALL ARCHIVE EXTRACTION ATTEMPTS FAILED',
          '================================================',
          '',
          `📊 Extraction Summary:`,
          `   • Total attempts: ${cmds.length}`,
          `   • Available tools: ${availableCommands.length}`,
          `   • Unavailable tools: ${unavailableCommands.length}`,
          `   • Total duration: ${totalDuration}ms`,
          `   • Platform: ${process.platform} (${process.arch})`,
          '',
          `🔧 Attempted Commands:`,
          ...attemptedCommands.map((cmd, i) => 
            `   ${i + 1}. ${cmd.available ? '✅' : '❌'} ${cmd.command}${cmd.error ? ` → ${cmd.error}` : ''}`
          ),
          '',
          unavailableCommands.length > 0 ? [
            `❌ Unavailable Tools:`,
            ...unavailableCommands.map(cmd => `   • ${cmd.command.split(' ')[0]}`),
            ''
          ].join('\n') : '',
          `🛠️  ${platformSpecificHelp.join('\n   ')}`,
          '',
          '📋 Additional Steps:',
          '   • Check the detailed logs above for specific error information',
          '   • Verify the archive file is not corrupted',
          '   • Ensure sufficient disk space is available',
          '   • Try extracting the archive manually to test',
          '   • Contact support with these diagnostic logs if issues persist',
          '',
          '🔍 Diagnostic Information:',
          `   ${JSON.stringify(diagnosticInfo, null, 2).split('\n').join('\n   ')}`
        ].filter(line => line !== '').join('\n'));
        
        log('error', 'All archive extraction attempts failed - comprehensive diagnostic', diagnosticInfo);
        
        throw detailedError;
      }
      // Continue to next command
    }
  }
}

// Resolve a packaged 7-Zip binary that we ship with the app (if present)
async function getPackaged7zPath(): globalThis.Promise<string | undefined> {
  try {
    // Base node_modules path (handles dev and production/asar-unpacked)
    const modulesBase = getVortexPath('modules_unpacked');
    const candidates: string[] = [];
    // Prefer platform-specific directory if present
    if (process.platform === 'win32') {
      candidates.push(path.join(modulesBase, '7z-bin', 'win32', '7z.exe'));
      candidates.push(path.join(modulesBase, '7z-bin', 'bin', '7z.exe'));
      // Also check 7zip-bin package
      candidates.push(path.join(modulesBase, '7zip-bin', 'win', 'x64', '7za.exe'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'win', 'ia32', '7za.exe'));
    } else if (process.platform === 'linux') {
      candidates.push(path.join(modulesBase, '7z-bin', 'linux', '7zzs'));
      candidates.push(path.join(modulesBase, '7z-bin', 'bin', '7zzs'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'x64', '7za'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'ia32', '7za'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'arm', '7za'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'arm64', '7za'));
    } else if (process.platform === 'darwin') {
    // Prioritize 7zip-bin which has actual macOS binaries
      candidates.push(path.join(modulesBase, '7zip-bin', 'mac', 'x64', '7za'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'mac', 'arm64', '7za'));
    // 7z-bin is broken on macOS - only check as last resort
      candidates.push(path.join(modulesBase, '7z-bin', 'bin', '7z'));
    }

    for (const p of candidates) {
      try {
        const st = await fs.statAsync(p);
        if (st && st.isFile()) {
          // Ensure executable permissions on Unix
          if (process.platform !== 'win32') {
            try { await fs.chmodAsync(p, 0o755 as any); } catch (_) { /* ignore */ }
          }
          return p;
        }
      } catch (_) {
        // continue
      }
    }

    // As a last resort, try resolving via package exports (may point into asar-unpacked)
    // On macOS, prioritize 7zip-bin over 7z-bin since 7z-bin is broken
    if (process.platform === 'darwin') {
      // Try 7zip-bin package first on macOS
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sevenZipBin = require('7zip-bin');
        if (sevenZipBin) {
          // 7zip-bin exports an object with path7za property, not a string
          const sevenZipBinPath = sevenZipBin.path7za || sevenZipBin;
          if (sevenZipBinPath) {
            try {
              const st = await fs.statAsync(sevenZipBinPath);
              if (st && st.isFile()) {
                try { await fs.chmodAsync(sevenZipBinPath, 0o755 as any); } catch (_) { /* ignore */ }
                return sevenZipBinPath;
              }
            } catch (_) { /* ignore */ }
          }
        }
      } catch (_) { /* ignore */ }

      // Then try 7z-bin package as last resort on macOS
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sevenBinPath: string = require('7z-bin');
        if (sevenBinPath) {
          try {
            const st = await fs.statAsync(sevenBinPath);
            if (st && st.isFile()) {
              try { await fs.chmodAsync(sevenBinPath, 0o755 as any); } catch (_) { /* ignore */ }
              return sevenBinPath;
            }
          } catch (_) { 
            // On macOS, the 7z-bin package may return a path like .../darwin/7z that doesn't exist
            // but the actual binary is at .../bin/7z. Let's check if this is the case.
            if (sevenBinPath.includes('/darwin/')) {
              const correctedPath = sevenBinPath.replace('/darwin/', '/bin/');
              try {
                const st = await fs.statAsync(correctedPath);
                if (st && st.isFile()) {
                  try { await fs.chmodAsync(correctedPath, 0o755 as any); } catch (_) { /* ignore */ }
                  return correctedPath;
                }
              } catch (_) { /* ignore */ }
            }
          }
        }
      } catch (_) { /* ignore */ }
    } else {
      // On non-macOS platforms, try 7z-bin first
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sevenBinPath: string = require('7z-bin');
        if (sevenBinPath) {
          try {
            const st = await fs.statAsync(sevenBinPath);
            if (st && st.isFile()) {
              if (process.platform !== 'win32') {
                try { await fs.chmodAsync(sevenBinPath, 0o755 as any); } catch (_) { /* ignore */ }
              }
              return sevenBinPath;
            }
          } catch (_) { /* ignore */ }
        }
      } catch (_) { /* ignore */ }

      // Then try 7zip-bin package
       try {
         // eslint-disable-next-line @typescript-eslint/no-var-requires
         const sevenZipBin = require('7zip-bin');
         if (sevenZipBin) {
           // 7zip-bin exports an object with path7za property, not a string
           const sevenZipBinPath = sevenZipBin.path7za || sevenZipBin;
           if (sevenZipBinPath) {
             try {
               const st = await fs.statAsync(sevenZipBinPath);
               if (st && st.isFile()) {
                 if (process.platform !== 'win32') {
                   try { await fs.chmodAsync(sevenZipBinPath, 0o755 as any); } catch (_) { /* ignore */ }
                 }
                 return sevenZipBinPath;
               }
             } catch (_) { /* ignore */ }
           }
         }
       } catch (_) { /* ignore */ }
     }

    return undefined;
  } catch (_) {
    return undefined;
  }
}

/**
 * Retry configuration for 7z extraction operations
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration for 7z operations
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};

/**
 * Executes a function with retry logic and exponential backoff
 * @param operation Function to execute
 * @param config Retry configuration
 * @param operationName Name of the operation for logging
 * @returns Result of the operation
 */
function withRetry<T>(
  operation: () => T,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName: string = 'operation'
): T {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      log('debug', `Attempting ${operationName}`, {
        attempt,
        maxAttempts: config.maxAttempts,
        isRetry: attempt > 1
      });
      
      const result = operation();
      
      if (attempt > 1) {
        log('info', `${operationName} succeeded after retry`, {
          attempt,
          totalAttempts: attempt,
          previousFailures: attempt - 1
        });
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      log('warn', `${operationName} failed on attempt ${attempt}`, {
        attempt,
        maxAttempts: config.maxAttempts,
        error: error.message,
        willRetry: attempt < config.maxAttempts
      });
      
      // Don't delay after the last attempt
      if (attempt < config.maxAttempts) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        );
        
        log('debug', `Waiting before retry`, {
          delayMs: delay,
          nextAttempt: attempt + 1
        });
        
        // Synchronous delay using busy wait (not ideal but necessary for sync context)
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
      }
    }
  }
  
  log('error', `${operationName} failed after all retry attempts`, {
    totalAttempts: config.maxAttempts,
    finalError: lastError?.message
  });
  
  throw lastError || new Error(`${operationName} failed after ${config.maxAttempts} attempts`);
}

// Validate that a 7z binary is functional by testing it with a simple command
  function validate7zBinarySync(binaryPath: string): boolean {
    const startTime = Date.now();
    
    log('debug', 'Validating 7z binary functionality', {
      binaryPath,
      exists: fsNode.existsSync(binaryPath)
    });
    
    if (!fsNode.existsSync(binaryPath)) {
      log('debug', '7z binary validation failed: file does not exist', { binaryPath });
      return false;
    }
    
    try {
      // Test the binary with a simple command (no arguments should show help/version)
      // runCommandSync throws on failure, returns void on success
      runCommandSync(binaryPath, []);
      
      const duration = Date.now() - startTime;
      log('debug', '7z binary validation successful', {
        binaryPath,
        duration: `${duration}ms`,
        method: 'execution-test'
      });
      return true;
    } catch (err) {
      const duration = Date.now() - startTime;
      
      // Check if it's a command execution error with details
      if (err.exitCode !== undefined) {
        // Some 7z tools return non-zero exit codes for help/version commands
        // but still indicate they're functional if they produce output
        if (err.stdout || err.stderr) {
          log('debug', '7z binary validation successful (non-zero exit but has output)', {
            binaryPath,
            exitCode: err.exitCode,
            hasStdout: !!err.stdout,
            hasStderr: !!err.stderr,
            duration: `${duration}ms`,
            method: 'execution-test-with-output'
          });
          return true;
        } else {
          log('warn', '7z binary validation failed: no output produced', {
            binaryPath,
            exitCode: err.exitCode,
            duration: `${duration}ms`,
            suggestion: 'Binary may be corrupted or incompatible'
          });
          return false;
        }
      } else {
        log('warn', '7z binary validation failed: execution error', {
          binaryPath,
          error: err.message,
          duration: `${duration}ms`,
          suggestion: 'Binary may be corrupted or have permission issues'
        });
        return false;
      }
    }
  }

  // Resolve a packaged 7-Zip binary that we ship with the app (if present) - synchronous version
  function getPackaged7zPathSync(): string | undefined {
  const startTime = Date.now();
  
  log('debug', 'Starting bundled 7z tool resolution', {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version
  });
  
  try {
    // Base node_modules path (handles dev and production/asar-unpacked)
    const modulesBase = getVortexPath('modules_unpacked');
    
    log('debug', 'Resolved modules base path', {
      modulesBase,
      exists: fsNode.existsSync(modulesBase)
    });
    
    if (!fsNode.existsSync(modulesBase)) {
      log('warn', 'Modules base directory does not exist', {
        modulesBase,
        suggestion: 'Check Vortex installation integrity'
      });
      return undefined;
    }
    
    const candidates: string[] = [];
    
    // Prefer platform-specific directory if present
    if (process.platform === 'win32') {
      candidates.push(path.join(modulesBase, '7z-bin', 'win32', '7z.exe'));
      candidates.push(path.join(modulesBase, '7z-bin', 'bin', '7z.exe'));
      // Also check 7zip-bin package
      candidates.push(path.join(modulesBase, '7zip-bin', 'win', 'x64', '7za.exe'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'win', 'ia32', '7za.exe'));
    } else if (process.platform === 'linux') {
      candidates.push(path.join(modulesBase, '7z-bin', 'linux', '7zzs'));
      candidates.push(path.join(modulesBase, '7z-bin', 'bin', '7zzs'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'x64', '7za'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'ia32', '7za'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'arm', '7za'));
      candidates.push(path.join(modulesBase, '7zip-bin', 'linux', 'arm64', '7za'));
    } else if (process.platform === 'darwin') {
      // Use enhanced architecture detection
      const systemArch = getMacOSArchitecture();
      
      // Prioritize ARM64 binaries on ARM64 systems
      if (systemArch === 'arm64') {
        candidates.push(path.join(modulesBase, '7zip-bin', 'mac', 'arm64', '7za'));
        candidates.push(path.join(modulesBase, '7zip-bin', 'mac', 'x64', '7za'));
      } else {
        candidates.push(path.join(modulesBase, '7zip-bin', 'mac', 'x64', '7za'));
        candidates.push(path.join(modulesBase, '7zip-bin', 'mac', 'arm64', '7za'));
      }
      // 7z-bin is broken on macOS - only check as last resort
      candidates.push(path.join(modulesBase, '7z-bin', 'bin', '7z'));
    }
    
    log('debug', 'Generated candidate paths for bundled 7z tools', {
      candidateCount: candidates.length,
      candidates: candidates.map(p => ({
        path: p,
        package: p.includes('7zip-bin') ? '7zip-bin' : '7z-bin'
      }))
    });

    // Check file system candidates first
    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];
      const candidateStartTime = Date.now();
      
      log('debug', `Checking candidate ${i + 1}/${candidates.length}`, {
        path: p,
        package: p.includes('7zip-bin') ? '7zip-bin' : '7z-bin'
      });
      
      try {
        if (!fsNode.existsSync(p)) {
          log('debug', 'Candidate file does not exist', {
            path: p,
            duration: `${Date.now() - candidateStartTime}ms`
          });
          continue;
        }
        
        const st = fs.statSync(p);
        if (st && st.isFile()) {
          // Validate file size (should be > 0 bytes)
          if (st.size === 0) {
            log('warn', 'Found zero-byte 7z binary', {
              path: p,
              size: st.size,
              suggestion: 'Binary may be corrupted or incomplete'
            });
            continue;
          }
          
          log('debug', 'Found valid 7z binary candidate', {
            path: p,
            size: st.size,
            mode: st.mode.toString(8),
            isExecutable: (st.mode & parseInt('111', 8)) !== 0
          });
          
          // Ensure executable permissions on Unix
          if (process.platform !== 'win32') {
            try { 
              fsNode.chmodSync(p, 0o755 as any);
              log('debug', 'Set executable permissions on 7z binary', { path: p });
            } catch (chmodErr) { 
              log('warn', 'Failed to set executable permissions', {
                path: p,
                error: chmodErr.message,
                suggestion: 'May cause execution failures'
              });
            }
          }
          
          // Validate the binary before returning it
           if (validate7zBinarySync(p)) {
             const duration = Date.now() - startTime;
             log('info', 'Successfully resolved and validated bundled 7z tool via file system', {
               path: p,
               package: p.includes('7zip-bin') ? '7zip-bin' : '7z-bin',
               method: 'filesystem',
               duration: `${duration}ms`,
               size: st.size,
               validated: true
             });
             
             return p;
           } else {
             log('warn', 'Found 7z binary but validation failed', {
               path: p,
               package: p.includes('7zip-bin') ? '7zip-bin' : '7z-bin',
               size: st.size,
               suggestion: 'Binary may be corrupted, continuing to next candidate'
             });
             continue;
           }
        } else {
          log('debug', 'Candidate exists but is not a file', {
            path: p,
            isDirectory: st.isDirectory(),
            isSymlink: st.isSymbolicLink()
          });
        }
      } catch (statErr) {
        log('debug', 'Failed to stat candidate file', {
          path: p,
          error: statErr.message,
          duration: `${Date.now() - candidateStartTime}ms`
        });
        continue;
      }
    }

    log('debug', 'No file system candidates found, trying package resolution');

    // As a last resort, try resolving via package exports (may point into asar-unpacked)
    // On macOS, prioritize 7zip-bin over 7z-bin since 7z-bin is broken
    if (process.platform === 'darwin') {
      // Try 7zip-bin package first on macOS
      try {
        log('debug', 'Attempting to resolve 7zip-bin package on macOS');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sevenZipBin = require('7zip-bin');
        if (sevenZipBin) {
          // 7zip-bin exports an object with path7za property, not a string
          const sevenZipBinPath = sevenZipBin.path7za || sevenZipBin;
          if (sevenZipBinPath) {
            log('debug', 'Found 7zip-bin package path', {
              path: sevenZipBinPath,
              hasPath7za: !!sevenZipBin.path7za
            });
            
            try {
              const st = fs.statSync(sevenZipBinPath);
              if (st && st.isFile()) {
                if (st.size === 0) {
                  log('warn', 'Found zero-byte 7zip-bin binary', {
                    path: sevenZipBinPath,
                    suggestion: 'Package may be corrupted'
                  });
                } else {
                  try { 
                    fsNode.chmodSync(sevenZipBinPath, 0o755 as any);
                    log('debug', 'Set executable permissions on 7zip-bin binary', { path: sevenZipBinPath });
                  } catch (chmodErr) { 
                    log('warn', 'Failed to set executable permissions on 7zip-bin', {
                      path: sevenZipBinPath,
                      error: chmodErr.message
                    });
                  }
                  
                  // Validate the binary before returning it
                   if (validate7zBinarySync(sevenZipBinPath)) {
                     const duration = Date.now() - startTime;
                     log('info', 'Successfully resolved and validated bundled 7z tool via 7zip-bin package', {
                       path: sevenZipBinPath,
                       package: '7zip-bin',
                       method: 'package-resolution',
                       duration: `${duration}ms`,
                       size: st.size,
                       validated: true
                     });
                     
                     return sevenZipBinPath;
                   } else {
                     log('warn', 'Found 7zip-bin package binary but validation failed', {
                       path: sevenZipBinPath,
                       package: '7zip-bin',
                       size: st.size,
                       suggestion: 'Package binary may be corrupted'
                     });
                   }
                }
              }
            } catch (statErr) { 
              log('debug', 'Failed to stat 7zip-bin package path', {
                path: sevenZipBinPath,
                error: statErr.message
              });
            }
          } else {
            log('warn', '7zip-bin package found but no valid path property', {
              packageContent: Object.keys(sevenZipBin),
              suggestion: 'Package structure may have changed'
            });
          }
        }
      } catch (requireErr) { 
        log('debug', 'Failed to require 7zip-bin package', {
          error: requireErr.message,
          suggestion: 'Package may not be installed'
        });
      }

      // Then try 7z-bin package as last resort on macOS
      try {
        log('debug', 'Attempting to resolve 7z-bin package on macOS (last resort)');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sevenBinPath: string = require('7z-bin');
        if (sevenBinPath) {
          log('debug', 'Found 7z-bin package path', { path: sevenBinPath });
          
          try {
            const st = fs.statSync(sevenBinPath);
            if (st && st.isFile()) {
              try { 
                fsNode.chmodSync(sevenBinPath, 0o755 as any);
                log('debug', 'Set executable permissions on 7z-bin binary', { path: sevenBinPath });
              } catch (chmodErr) { 
                log('warn', 'Failed to set executable permissions on 7z-bin', {
                  path: sevenBinPath,
                  error: chmodErr.message
                });
              }
              
              // Validate the binary before returning it
               if (validate7zBinarySync(sevenBinPath)) {
                 const duration = Date.now() - startTime;
                 log('info', 'Successfully resolved and validated bundled 7z tool via 7z-bin package', {
                   path: sevenBinPath,
                   package: '7z-bin',
                   method: 'package-resolution',
                   duration: `${duration}ms`,
                   size: st.size,
                   validated: true
                 });
                 
                 return sevenBinPath;
               } else {
                 log('warn', 'Found 7z-bin package binary but validation failed', {
                   path: sevenBinPath,
                   package: '7z-bin',
                   size: st.size,
                   suggestion: 'Package binary may be corrupted'
                 });
               }
            }
          } catch (statErr) { 
            log('debug', 'Failed to stat 7z-bin package path, trying path correction', {
              path: sevenBinPath,
              error: statErr.message
            });
            
            // On macOS, the 7z-bin package may return a path like .../darwin/7z that doesn't exist
            // but the actual binary is at .../bin/7z. Let's check if this is the case.
            if (sevenBinPath.includes('/darwin/')) {
              const correctedPath = sevenBinPath.replace('/darwin/', '/bin/');
              log('debug', 'Trying corrected path for 7z-bin on macOS', {
                originalPath: sevenBinPath,
                correctedPath
              });
              
              try {
                const st = fs.statSync(correctedPath);
                if (st && st.isFile()) {
                  try { 
                    fsNode.chmodSync(correctedPath, 0o755 as any);
                    log('debug', 'Set executable permissions on corrected 7z-bin path', { path: correctedPath });
                  } catch (chmodErr) { 
                    log('warn', 'Failed to set executable permissions on corrected 7z-bin path', {
                      path: correctedPath,
                      error: chmodErr.message
                    });
                  }
                  
                  const duration = Date.now() - startTime;
                  log('info', 'Successfully resolved bundled 7z tool via corrected 7z-bin path', {
                    path: correctedPath,
                    package: '7z-bin',
                    method: 'package-resolution-corrected',
                    duration: `${duration}ms`,
                    size: st.size
                  });
                  
                  return correctedPath;
                }
              } catch (correctedStatErr) { 
                log('debug', 'Corrected path also failed', {
                  correctedPath,
                  error: correctedStatErr.message
                });
              }
            }
          }
        }
      } catch (requireErr) { 
        log('debug', 'Failed to require 7z-bin package', {
          error: requireErr.message,
          suggestion: 'Package may not be installed'
        });
      }
    } else {
      // On non-macOS platforms, try 7z-bin first
      try {
        log('debug', 'Attempting to resolve 7z-bin package on non-macOS platform');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sevenBinPath: string = require('7z-bin');
        if (sevenBinPath) {
          log('debug', 'Found 7z-bin package path', { path: sevenBinPath });
          
          try {
            const st = fs.statSync(sevenBinPath);
            if (st && st.isFile()) {
              if (process.platform !== 'win32') {
                try { 
                  fsNode.chmodSync(sevenBinPath, 0o755 as any);
                  log('debug', 'Set executable permissions on 7z-bin binary', { path: sevenBinPath });
                } catch (chmodErr) { 
                  log('warn', 'Failed to set executable permissions on 7z-bin', {
                    path: sevenBinPath,
                    error: chmodErr.message
                  });
                }
              }
              
              // Validate the binary before returning it
               if (validate7zBinarySync(sevenBinPath)) {
                 const duration = Date.now() - startTime;
                 log('info', 'Successfully resolved and validated bundled 7z tool via 7z-bin package', {
                   path: sevenBinPath,
                   package: '7z-bin',
                   method: 'package-resolution',
                   duration: `${duration}ms`,
                   size: st.size,
                   validated: true
                 });
                 
                 return sevenBinPath;
               } else {
                 log('warn', 'Found 7z-bin package binary but validation failed', {
                   path: sevenBinPath,
                   package: '7z-bin',
                   size: st.size,
                   suggestion: 'Package binary may be corrupted'
                 });
               }
            }
          } catch (statErr) { 
            log('debug', 'Failed to stat 7z-bin package path', {
              path: sevenBinPath,
              error: statErr.message
            });
          }
        }
      } catch (requireErr) { 
        log('debug', 'Failed to require 7z-bin package', {
          error: requireErr.message,
          suggestion: 'Package may not be installed'
        });
      }

      // Then try 7zip-bin package
      try {
        log('debug', 'Attempting to resolve 7zip-bin package on non-macOS platform');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sevenZipBin = require('7zip-bin');
        if (sevenZipBin) {
          // 7zip-bin exports an object with path7za property, not a string
          const sevenZipBinPath = sevenZipBin.path7za || sevenZipBin;
          if (sevenZipBinPath) {
            log('debug', 'Found 7zip-bin package path', {
              path: sevenZipBinPath,
              hasPath7za: !!sevenZipBin.path7za
            });
            
            try {
              const st = fs.statSync(sevenZipBinPath);
              if (st && st.isFile()) {
                if (process.platform !== 'win32') {
                  try { 
                    fsNode.chmodSync(sevenZipBinPath, 0o755 as any);
                    log('debug', 'Set executable permissions on 7zip-bin binary', { path: sevenZipBinPath });
                  } catch (chmodErr) { 
                    log('warn', 'Failed to set executable permissions on 7zip-bin', {
                      path: sevenZipBinPath,
                      error: chmodErr.message
                    });
                  }
                }
                
                // Validate the binary before returning it
               if (validate7zBinarySync(sevenZipBinPath)) {
                 const duration = Date.now() - startTime;
                 log('info', 'Successfully resolved and validated bundled 7z tool via 7zip-bin package', {
                   path: sevenZipBinPath,
                   package: '7zip-bin',
                   method: 'package-resolution',
                   duration: `${duration}ms`,
                   size: st.size,
                   validated: true
                 });
                 
                 return sevenZipBinPath;
               } else {
                 log('warn', 'Found 7zip-bin package binary but validation failed', {
                   path: sevenZipBinPath,
                   package: '7zip-bin',
                   size: st.size,
                   suggestion: 'Package binary may be corrupted'
                 });
               }
              }
            } catch (statErr) { 
              log('debug', 'Failed to stat 7zip-bin package path', {
                path: sevenZipBinPath,
                error: statErr.message
              });
            }
          }
        }
      } catch (requireErr) { 
        log('debug', 'Failed to require 7zip-bin package', {
          error: requireErr.message,
          suggestion: 'Package may not be installed'
        });
      }
    }

    const duration = Date.now() - startTime;
    log('warn', 'No bundled 7z tools found', {
      platform: process.platform,
      arch: process.arch,
      modulesBase,
      candidatesChecked: candidates.length,
      duration: `${duration}ms`,
      suggestion: 'Install system 7z tools or reinstall Vortex to restore bundled tools'
    });

    return undefined;
  } catch (err) {
    const duration = Date.now() - startTime;
    log('error', 'Error during bundled 7z tool resolution', {
      error: err.message,
      platform: process.platform,
      arch: process.arch,
      duration: `${duration}ms`,
      suggestion: 'Check Vortex installation and file permissions'
    });
    return undefined;
  }
}

// Check if a command exists in PATH (macOS/Unix) - synchronous version
function hasCommandSync(cmd: string): boolean {
  try {
    runCommandSync(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32'
      ? [cmd]
      : ['-c', `command -v ${cmd} >/dev/null 2>&1`] );
    return true;
  } catch (_) {
    return false;
  }
}

// Check if a command exists in PATH (macOS/Unix)
async function hasCommand(cmd: string): globalThis.Promise<boolean> {
  try {
    runCommandSync(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32'
      ? [cmd]
      : ['-c', `command -v ${cmd} >/dev/null 2>&1`] );
    return true;
  } catch (_) {
    return false;
  }
}
