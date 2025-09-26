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
 * Retry utility for validation operations that may fail due to timing issues on macOS
 * @param operation The operation to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param delayMs Delay between retries in milliseconds (default: 200)
 * @param operationName Name for logging purposes
 */
async function retryValidationOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 200,
  operationName: string = 'validation operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('debug', `Attempting ${operationName}`, { attempt, maxRetries });
      const result = await operation();
      if (attempt > 1) {
        log('debug', `${operationName} succeeded on retry`, { attempt });
      }
      return result;
    } catch (error) {
      lastError = error;
      log('debug', `${operationName} failed on attempt ${attempt}`, { 
        attempt, 
        maxRetries, 
        error: error.message 
      });
      
      if (attempt < maxRetries) {
        log('debug', `Retrying ${operationName} in ${delayMs}ms`, { attempt, delayMs });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  log('warn', `${operationName} failed after ${maxRetries} attempts`, { 
    error: lastError.message 
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

function removeOldVersion(api: IExtensionApi, info: IExtension): Promise<void> {
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

  previousVersions.forEach(key => api.store.dispatch(removeExtension(key)));
  return Promise.resolve();
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
      return Bluebird.map(dirNames, dirName =>
        fs.readdirAsync(path.join(extPath, dirName))
          .then(files => {
            if (!files.includes('variables.scss')
                && !files.includes('style.scss')
                && !files.includes('fonts.scss')) {
              return Promise.reject(
                new DataInvalid('Theme not found'));
            } else {
              return Promise.resolve();
            }
          }))
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
        return fs.readdirAsync(path.join(extPath, dirNames[0]))
          .then(files => {
            if (files.find(fileName => path.extname(fileName) === '.json') === undefined) {
              return Promise.reject(new DataInvalid('No translation files'));
            }
            return Promise.resolve();
          });
      })
  );
}

/**
 * validate an extension. It has to contain an entry script and info.json on the top-level
 */
function validateExtension(extPath: string): Promise<void> {
  return Promise.resolve(
    fs.statAsync(path.join(extPath, 'info.json'))
      .then(() => findEntryScript(extPath))
      .then(entry => {
        if (entry) {
          return Promise.resolve();
        }
        return Promise.reject(
          new DataInvalid('Extension needs to include an entry script (index.js or package.json main) and info.json on top-level'));
      })
      .catch(err => {
        if ((err as any).code === 'ENOENT') {
          return Promise.reject(
            new DataInvalid('Extension needs to include an entry script (index.js or package.json main) and info.json on top-level'));
        }
        return Promise.reject(err);
      })
  );
}

function validateInstall(extPath: string, info?: IExtension): Promise<ExtensionType> {
  if (info === undefined) {
    let validAsTheme: boolean = true;
    let validAsTranslation: boolean = true;
    let validAsExtension: boolean = true;

    const guessedType: ExtensionType = undefined;
    // if we don't know the type we can only check if _any_ extension type applies
    return validateTheme(extPath)
      .catch(err => {
        if (err instanceof DataInvalid) {
          validAsTheme = false;
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => validateTranslation(extPath))
      .catch(err => {
        if (err instanceof DataInvalid) {
          validAsTranslation = false;
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => validateExtension(extPath))
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
    return validateTheme(extPath).then(() => Promise.resolve('theme' as ExtensionType));
  } else if (info.type === 'translation') {
    return validateTranslation(extPath).then(() => Promise.resolve('translation' as ExtensionType));
  } else {
    return validateExtension(extPath).then(() => Promise.resolve(undefined));
  }
}

function installExtension(api: IExtensionApi,
                          archivePath: string,
                          info?: IExtension): Promise<void> {
  const extensionsPath = path.join(getVortexPath('userData'), 'plugins');
  let destPath: string;
  const tempPath = path.join(extensionsPath, path.basename(archivePath)) + '.installing';

  // Removed direct node-7z extractor creation; we choose implementation per-platform below
  let fullInfo: any = info || {};

  let type: ExtensionType;
  let manifestOnly = false;

  let extName: string;
  // Ensure target directories exist to avoid ENOENT when writing manifest or extracting
  const chain = fs.ensureDirAsync(extensionsPath)
    .then(() => fs.ensureDirAsync(tempPath))
    .then(() => {
      if (process.platform === 'darwin') {
        log('debug', 'Starting synchronous extraction on macOS', { archivePath, tempPath });
        extractArchiveNativeSync(archivePath, tempPath);
        log('debug', 'Synchronous extraction completed, waiting for file system to settle', { tempPath });
        // Add a delay to ensure file system operations are fully settled on macOS
        return new Promise<void>(resolve => setTimeout(() => {
          log('debug', 'File system settle delay completed, proceeding with validation', { tempPath });
          resolve();
        }, 1000));
      } else {
        const Zip: any = require('node-7z');
        const extractor = new Zip();
        return extractor.extractFull(archivePath, tempPath, { ssc: false },
                                     () => undefined, () => undefined).then(() => undefined);
      }
    })
    .then(() => flattenNestedRoot(tempPath))
    .then(() => readExtensionInfo(tempPath, false, info))
      // merge the caller-provided info with the stuff parsed from the info.json file because there
      // is data we may only know at runtime (e.g. the modId)
    .then(manifestInfo => {
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
      if (err && (err as any).code === 'ENOENT') {
        if (info !== undefined) {
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
        .then(() => manifestInfo))
    .then((manifestInfo: { id: string, info: IExtension }) => {
      extName = manifestInfo.id;

      const dirName = sanitize(manifestInfo.id);
      destPath = path.join(extensionsPath, dirName);
      if (manifestInfo.info.type !== undefined) {
        type = manifestInfo.info.type;
      }
      // Determine whether this is a manifest-only update (no acceptable entry script in archive)
      return retryValidationOperation(
        () => findEntryScript(tempPath),
        3, // 3 retries
        300, // 300ms delay
        `findEntryScript for temp path ${tempPath}`
      ).then(tempEntry => {
        if (!tempEntry) {
          return retryValidationOperation(
            () => findEntryScript(destPath),
            3, // 3 retries
            300, // 300ms delay
            `findEntryScript for dest path ${destPath}`
          ).then(destEntry => {
            if (destEntry) {
              manifestOnly = true;
              // Apply manifest update into existing install and remove temp
              return fs.copyAsync(path.join(tempPath, 'info.json'), path.join(destPath, 'info.json'), { overwrite: true })
                .then(() => fs.removeAsync(tempPath))
                .then(() => undefined);
            } else {
              // No entry in archive and no existing installed extension to update
              throw new DataInvalid('Extension package missing entry script (expected index.js or package.json main)');
            }
          });
        }
        return undefined;
      }).then(() => {
        // Only validate a full extension install (skip for manifest-only updates)
        if (!manifestOnly) {
          return retryValidationOperation(
            () => validateInstall(tempPath, info),
            3, // 3 retries
            300, // 300ms delay
            `validateInstall for ${tempPath}`
          ).then(guessedType => {
            if (type === undefined) {
              type = guessedType;
            }
            return manifestInfo.info;
          });
        }
        return manifestInfo.info;
      });
    })
      // we don't actually expect the output directory to exist
    .then((infoForRemoval) => manifestOnly ? Promise.resolve() : removeOldVersion(api, infoForRemoval))
    .then(() => manifestOnly ? Promise.resolve() : fs.removeAsync(destPath))
    .then(() => manifestOnly ? Promise.resolve() : fs.renameAsync(tempPath, destPath))
    .then(() => {
      if (manifestOnly) {
        return Promise.resolve();
      }
      if (type === 'translation') {
        return fs.readdirAsync(destPath)
          .map((entry: string) => fs.statAsync(path.join(destPath, entry))
            .then(stat => ({ name: entry, stat })))
          .then(() => undefined);
      } else if (type === 'theme') {
        return Promise.resolve();
      } else {
          // don't install dependencies for extensions that are already loaded because
          // doing so could cause an exception
        if (api.getLoadedExtensions().find(ext => ext.name === extName) === undefined) {
          return installExtensionDependencies(api, destPath);
        } else {
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
            await new Promise<void>(resolve => setTimeout(resolve, 500));
          }
          
          // Force a fresh read of extensions
          const extensions = readExtensionsSync(true);
          
          // Verify our extension is in the list
          if (!extensions[extName]) {
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
          const maxRetries = 3;
          for (let retry = 0; retry < maxRetries; retry++) {
            const delay = 1000 * Math.pow(2, retry);
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
                  nextDelay: 1000 * Math.pow(2, retry + 1)
                });
              }
            }
          }
        }
      };
      
      return updateExtensionList();
    })
    .catch(err => {
      try {
        fs.removeSync(tempPath);
      } catch (removeErr) {
        // Ignore removal errors
      }
      if (err instanceof DataInvalid) {
        return api.showErrorNotification('Invalid Extension', err,
                                         { allowReport: false, message: archivePath });
      }
      return Promise.reject(err);
    });

  return Promise.resolve(chain);
}

export default installExtension;

/**
 * Attempts to resolve an extension entry script inside extPath.
 * Accepted entries:
 *  - index.js (top-level)
 *  - dist/index.js
 *  - package.json with a valid "main" that points to an existing file
 */
function findEntryScript(extPath: string): Promise<string | undefined> {
  const tryExists = (p: string) => fs.statAsync(p).then(() => true).catch(() => false);
  const tryReadPkgMain = () =>
    fs.readFileAsync(path.join(extPath, 'package.json'), { encoding: 'utf8' })
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
      .catch(() => undefined as undefined);

  const attemptFind = () => {
    return tryExists(path.join(extPath, 'index.js')).then(idxExists => {
      if (idxExists) { return path.join(extPath, 'index.js'); }
      return tryExists(path.join(extPath, 'dist', 'index.js')).then(distExists => {
        if (distExists) { return path.join(extPath, 'dist', 'index.js'); }
        return tryReadPkgMain();
      });
    });
  };

  // Use robust retry mechanism for finding entry script
  return retryValidationOperation(
    () => Promise.resolve(attemptFind()),
    3, // 3 retries
    300, // 300ms delay between retries
    `findEntryScript for ${extPath}`
  );
}

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
  for (let idx = 0; idx < cmds.length; idx++) {
    const { cmd, args } = cmds[idx];
    try {
      runCommandSync(cmd, args, cwd);
      return; // Success, exit early
    } catch (err) {
      log('warn', 'archive extraction attempt failed', { cmd, args, error: err && err.message });
      if (idx === cmds.length - 1) {
        // Last command failed, throw error
        throw new Error('No suitable extractor available on this system.');
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

// Resolve a packaged 7-Zip binary that we ship with the app (if present) - synchronous version
function getPackaged7zPathSync(): string | undefined {
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
        const st = fs.statSync(p);
        if (st && st.isFile()) {
          // Ensure executable permissions on Unix
          if (process.platform !== 'win32') {
            try { fsNode.chmodSync(p, 0o755 as any); } catch (_) { /* ignore */ }
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
              const st = fs.statSync(sevenZipBinPath);
              if (st && st.isFile()) {
                try { fsNode.chmodSync(sevenZipBinPath, 0o755 as any); } catch (_) { /* ignore */ }
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
            const st = fs.statSync(sevenBinPath);
            if (st && st.isFile()) {
              try { fsNode.chmodSync(sevenBinPath, 0o755 as any); } catch (_) { /* ignore */ }
              return sevenBinPath;
            }
          } catch (_) { 
            // On macOS, the 7z-bin package may return a path like .../darwin/7z that doesn't exist
            // but the actual binary is at .../bin/7z. Let's check if this is the case.
            if (sevenBinPath.includes('/darwin/')) {
              const correctedPath = sevenBinPath.replace('/darwin/', '/bin/');
              try {
                const st = fs.statSync(correctedPath);
                if (st && st.isFile()) {
                  try { fsNode.chmodSync(correctedPath, 0o755 as any); } catch (_) { /* ignore */ }
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
            const st = fs.statSync(sevenBinPath);
            if (st && st.isFile()) {
              if (process.platform !== 'win32') {
                try { fsNode.chmodSync(sevenBinPath, 0o755 as any); } catch (_) { /* ignore */ }
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
               const st = fs.statSync(sevenZipBinPath);
               if (st && st.isFile()) {
                 if (process.platform !== 'win32') {
                   try { fsNode.chmodSync(sevenZipBinPath, 0o755 as any); } catch (_) { /* ignore */ }
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

// Native macOS (and general CLI) archive extraction supporting .7z, .zip, .rar (synchronous)
function extractArchiveNativeSync(archivePath: string, destPath: string): void {
  const ext = path.extname(archivePath).toLowerCase();
  const isDarwin = process.platform === 'darwin';

  // Resolve bundled 7z first so we can prefer it where appropriate
  const packaged7z = getPackaged7zPathSync();

  if (ext === '.zip') {
    // Prefer macOS-native ditto, fallback to unzip, then bundled 7z if present
    const cmds: Array<{ cmd: string, args: string[] }> = [
      { cmd: 'ditto', args: ['-x', '-k', archivePath, destPath] },
      { cmd: 'unzip', args: ['-oq', archivePath, '-d', destPath] },
    ];
    if (packaged7z) {
      cmds.push({ cmd: packaged7z, args: ['x', '-y', archivePath, `-o${destPath}`] });
    }

    // Preflight on macOS: ensure at least one tool is available
    if (isDarwin) {
      const c1 = hasCommandSync('ditto');
      const c2 = hasCommandSync('unzip');
      if (!packaged7z && !c1 && !c2) {
        throw new Error('No ZIP extractor found. Vortex requires either macOS "ditto", "unzip", or the bundled 7z tool.');
      }
    }

    return tryCommandsSync(cmds);
  } else if (ext === '.7z') {
    const cmds: Array<{ cmd: string, args: string[] }> = [];
    if (packaged7z) {
      cmds.push({ cmd: packaged7z, args: ['x', '-y', archivePath, `-o${destPath}`] });
    }
    cmds.push(
      { cmd: '7zz', args: ['x', '-y', archivePath, `-o${destPath}`] },
      { cmd: '7z', args: ['x', '-y', archivePath, `-o${destPath}`] },
      { cmd: 'unar', args: ['-force-overwrite', '-o', destPath, archivePath] },
    );

    if (isDarwin) {
      const avail1 = hasCommandSync('7zz');
      const avail2 = hasCommandSync('7z');
      const avail3 = hasCommandSync('unar');
      if (!packaged7z && !avail1 && !avail2 && !avail3) {
        throw new Error('No 7z extractor found. Vortex requires 7-Zip (7zz/7z), The Unarchiver (unar), or the bundled 7z tool to extract .7z archives.');
      }
    }

    try {
      return tryCommandsSync(cmds);
    } catch (err) {
      const help = 'Please install 7-Zip (7zz/7z) or The Unarchiver (unar), or use the bundled 7z tool to extract .7z archives on macOS.';
      const wrapped: any = new Error(`${err.message}\n${help}`);
      wrapped.cause = err;
      throw wrapped;
    }
  } else if (ext === '.rar') {
    const cmds: Array<{ cmd: string, args: string[] }> = [
      { cmd: 'unar', args: ['-force-overwrite', '-o', destPath, archivePath] },
      { cmd: 'unrar', args: ['x', '-y', archivePath, destPath] },
    ];
    // 7z can extract many RAR archives; include bundled 7z as a last fallback
    if (packaged7z) {
      cmds.push({ cmd: packaged7z, args: ['x', '-y', archivePath, `-o${destPath}`] });
    }

    if (isDarwin) {
      const avail1 = hasCommandSync('unar');
      const avail2 = hasCommandSync('unrar');
      if (!packaged7z && !avail1 && !avail2) {
        throw new Error('No RAR extractor found. Vortex requires The Unarchiver (unar), unrar, or the bundled 7z tool to extract .rar archives.');
      }
    }

    try {
      return tryCommandsSync(cmds);
    } catch (err) {
      const help = 'Please install The Unarchiver (unar) or unrar, or rely on the bundled 7z tool to extract .rar archives on macOS.';
      const wrapped: any = new Error(`${err.message}\n${help}`);
      wrapped.cause = err;
      throw wrapped;
    }
  }
  // Fallback: try tar for common tarballs
  if (ext === '.tar' || ext === '.gz' || ext === '.bz2' || ext === '.xz' || archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    return tryCommandsSync([
      { cmd: 'tar', args: ['-xf', archivePath, '-C', destPath] },
    ]);
  }
  throw new Error(`Unsupported archive type: ${ext}`);
}
