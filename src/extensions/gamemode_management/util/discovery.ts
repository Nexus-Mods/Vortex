import { IDiscoveredTool } from '../../../types/IDiscoveredTool';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';
import { GameEntryNotFound } from '../../../types/IGameStore';
import { IGameStoreEntry } from '../../../types/IGameStoreEntry';
import { ITool } from '../../../types/ITool';
import { ProcessCanceled, SetupError } from '../../../util/CustomErrors';
import extractExeIcon from '../../../util/exeIcon';
import * as fs from '../../../util/fs';
import GameStoreHelper from '../../../util/GameStoreHelper';
import getNormalizeFunc, { Normalize } from '../../../util/getNormalizeFunc';
import getVortexPath from '../../../util/getVortexPath';
import { log } from '../../../util/log';
import { isWindows } from '../../../util/platform';
import StarterInfo from '../../../util/StarterInfo';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { modPathsForGame } from '../../mod_management/selectors';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import {IToolStored} from '../types/IToolStored';

import Progress from './Progress';

// TODO: Remove Bluebird import - using native Promise;
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import turbowalk from 'turbowalk';
import { discoverMacOSGames } from '../../../util/macOSGameDiscovery';
import { checkFileWithMacOSFallback } from '../../../util/macOSGameCompatibility';
import { isMacOS } from '../../../util/platform';
const winapi = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;

export type DiscoveredCB = (gameId: string, result: IDiscoveryResult) => void;
export type DiscoveredToolCB = (gameId: string, result: IDiscoveredTool) => void;

interface IFileEntry {
  fileName: string;
  gameId: string;
  application: ITool;
}

export function quickDiscoveryTools(gameId: string,
                                    tools: ITool[],
                                    onDiscoveredTool: DiscoveredToolCB)
                                    : Promise<void> {
  if (tools === undefined) {
    return Promise.resolve();
  }

  return Promise.all(tools.map(tool => {
    if (tool.queryPath === undefined) {
      return Promise.resolve();
    }

    try {
      const toolPath = tool.queryPath();
      if (typeof(toolPath) === 'string') {
        if (toolPath) {
          return autoGenIcon(tool, toolPath, gameId)
            .then(() => {
              onDiscoveredTool(gameId, {
                ...tool,
                path: path.join(toolPath, tool.executable(toolPath)),
                hidden: false,
                parameters: tool.parameters || [],
                custom: false,
              });
            });
        } else {
          log('debug', 'tool not found', tool.id);
          return Promise.resolve();
        }
      } else {
        return (toolPath as Promise<string>)
          .then((resolvedPath) => {
            if (resolvedPath) {
              return autoGenIcon(tool, resolvedPath, gameId)
                .then(() => {
                  onDiscoveredTool(gameId, {
                    ...tool,
                    path: path.join(resolvedPath, tool.executable(resolvedPath)),
                    hidden: false,
                    parameters: tool.parameters || [],
                    custom: false,
                  });
                });
            }
            return Promise.resolve();
          })
          .catch((err) => {
            log('debug', 'tool not found', {id: tool.id, err: err.message});
          });
      }
    } catch (err) {
      log('error', 'failed to determine tool setup', err);
      return Promise.resolve();
    }
  }))
    .then(() => null);
}

function updateManuallyConfigured(discoveredGames: {[id: string]: IDiscoveryResult},
                                  game: IGame,
                                  onDiscoveredGame: DiscoveredCB)
                                  : Promise<void> {
  if ((discoveredGames[game.id]?.path !== undefined)
    && (discoveredGames[game.id]?.store === undefined)) {
    return GameStoreHelper.identifyStore(discoveredGames[game.id]?.path)
      .then(store => {
        if (store !== undefined) {
          log('debug', 'updating previously discovered game', {
            gameId: game.id,
            store,
          });

          onDiscoveredGame(game.id, {
            ...discoveredGames[game.id],
            store,
          });
        }
      })
      .catch(err => {
        log('error', 'failed to identify store for game', err.message);
      });
  } else {
    log('debug', 'leaving alone previously discovered game', {
      gameId: game.id,
      path: discoveredGames[game.id]?.path,
      store: discoveredGames[game.id]?.store,
    });

    return Promise.resolve();
  }
}

function queryByArgs(discoveredGames: { [id: string]: IDiscoveryResult },
                     game: IGame): Promise<IGameStoreEntry> {
  return GameStoreHelper.find(game.queryArgs)
    .then(results => Promise.all<IGameStoreEntry>(results.map(res =>
      fs.statAsync(res.gamePath)
        .then(() => res)
        .catch(() => undefined)
    )))
    .then(results => results.filter(res => res !== undefined))
    .then(results => {
      if (results.length === 0) {
        return Promise.resolve(undefined);
      }
      const discoveredStore = discoveredGames[game.id]?.store;
      const prio = (entry: IGameStoreEntry) => {
        if ((discoveredStore !== undefined)
          && (entry.gameStoreId === discoveredStore)) {
          return 0;
        } else {
          return entry.priority ?? 100;
        }
      };

      results = results.sort((lhs: IGameStoreEntry, rhs: IGameStoreEntry) =>
        prio(lhs) - prio(rhs));
      return Promise.resolve(results[0]);
    });
}

function queryByCB(game: IGame): Promise<Partial<IGameStoreEntry>> {
  let gamePath: string | Promise<string | IGameStoreEntry>;

  try {
    gamePath = game.queryPath();
    if (typeof gamePath === 'function') {
      throw new SetupError('queryPath must be a string or a promise that resolves to a string');
    }
  } catch (err) {
    log('warn', 'failed to query game location', {
      game: game.id,
      error: err.message,
    });
    return Promise.reject(err);
  }
  const prom = (typeof (gamePath) === 'string')
    ? Promise.resolve(gamePath)
    : (gamePath ?? Promise.resolve(undefined));

  let store: string;

  return prom
    .then(resolvedInfo => {
      if (typeof (resolvedInfo) === 'string') {
        return GameStoreHelper.identifyStore(resolvedInfo)
          .catch(err => {
            log('error', 'failed to identify store for game', err.message);
            return undefined;
          })
          .then((storeDetected: string) => {
            // storeDetected may be undefined, in that case we use default handling
            store = storeDetected;
            return resolvedInfo;
          });
      } else if (resolvedInfo === undefined) {
        return Promise.reject(new GameEntryNotFound(game.id, 'unknown'));
      } else {
        store = resolvedInfo.gameStoreId;
        return resolvedInfo.gamePath;
      }
    })
    .then(resolvedPath => resolvedPath === undefined
      ? Promise.resolve(undefined)
      : fs.statAsync(resolvedPath)
        .then(() => ({ gamePath: resolvedPath, gameStoreId: store }))
        .catch(err => {
          if (err.code === 'ENOENT') {
            log('warn', 'rejecting game discovery, directory doesn\'t exist',
                resolvedPath);
            return Promise.resolve(undefined);
          }
          return Promise.reject(err);
        }))
}

function handleDiscoveredGame(game: IGame,
                              resolvedPath: string,
                              store: string,
                              discoveredGames: {[id: string]: IDiscoveryResult},
                              onDiscoveredGame: DiscoveredCB,
                              onDiscoveredTool: DiscoveredToolCB)
                              : Promise<string> {
  if (!truthy(resolvedPath)) {
    return undefined;
  }
  log('info', 'found game', { name: game.name, location: resolvedPath, store });
  const exe = game.executable(resolvedPath);
  const disco: IDiscoveryResult = {
    path: resolvedPath,
    executable: (exe !== game.executable()) ? exe : undefined,
    store,
  };
  onDiscoveredGame(game.id, disco);
  return getNormalizeFunc(resolvedPath)
    .then(normalize =>
      discoverRelativeTools(
        game, resolvedPath, discoveredGames,
        onDiscoveredTool, normalize))
    .then(() => game.id)
    .catch((err) => {
      onDiscoveredGame(game.id, undefined);
      if (err.message !== undefined) {
        log('debug', 'game not found',
            { id: game.id, err: err.message.replace(/(?:\r\n|\r|\n)/g, '; ') });
      } else {
        log('warn', 'game not found - invalid exception', { id: game.id, err });
      }
      return undefined;
    });
}

/**
 * run the "quick" discovery using functions provided by the game extension
 *
 * @export
 * @param {IGame[]} knownGames
 * @param {DiscoveredCB} onDiscoveredGame
 * @param {DiscoveredToolCB} onDiscoveredTool
 * @param {Function} onProgress optional progress callback
 * @return the list of gameIds that were discovered
 */
export function quickDiscovery(knownGames: IGame[],
                               discoveredGames: {[id: string]: IDiscoveryResult},
                               onDiscoveredGame: DiscoveredCB,
                               onDiscoveredTool: DiscoveredToolCB,
                               onProgress?: (gameId: string, step: string, percent: number) => void): Promise<string[]> {
  // On macOS, use platform-specific discovery with priority ordering
  if (isMacOS()) {
    return discoverMacOSGames(knownGames, discoveredGames, onDiscoveredGame, onDiscoveredTool, onProgress)
      .then(macResults => {
        // Continue with standard discovery for any games not found by macOS discovery
        const remainingGames = knownGames.filter(game => 
          !macResults.includes(game.id) && 
          !getSafe(discoveredGames, [game.id, 'pathSetManually'], false)
        );
        
        if (remainingGames.length === 0) {
          return macResults;
        }
        
        return standardQuickDiscovery(remainingGames, discoveredGames, onDiscoveredGame, onDiscoveredTool)
          .then(standardResults => [...macResults, ...standardResults]);
      });
  }
  
  // Use standard discovery for non-macOS platforms
  return standardQuickDiscovery(knownGames, discoveredGames, onDiscoveredGame, onDiscoveredTool);
}

function standardQuickDiscovery(knownGames: IGame[],
                               discoveredGames: {[id: string]: IDiscoveryResult},
                               onDiscoveredGame: DiscoveredCB,
                               onDiscoveredTool: DiscoveredToolCB): Promise<string[]> {
  return Promise.all(knownGames.map(game =>
    quickDiscoveryTools(game.id, game.supportedTools, onDiscoveredTool)
      .then(() => {
        if (getSafe(discoveredGames, [game.id, 'pathSetManually'], false)) {
          // don't override manually set game location but maybe update some settings
          return updateManuallyConfigured(discoveredGames, game, onDiscoveredGame)
            .then(() => Promise.resolve(undefined));
        }
        log('debug', 'discovering game', game.id);
        let prom: Promise<string>;

        if (game.queryArgs !== undefined) {
          prom = queryByArgs(discoveredGames, game)
            .then(result => {
              if (result !== undefined) {
                return handleDiscoveredGame(
                  game, result.gamePath, result.gameStoreId,
                  discoveredGames, onDiscoveredGame, onDiscoveredTool);
              } else {
                return Promise.resolve(undefined);
              }
            });
        } else if (game.queryPath !== undefined) {
          prom = queryByCB(game)
            .then(result => {
              if (result === undefined) {
                return Promise.resolve(undefined);                
              }
              return handleDiscoveredGame(
                game, result.gamePath, result.gameStoreId,
                discoveredGames, onDiscoveredGame, onDiscoveredTool);
            });
        } else {
          prom = Promise.resolve(undefined);
        }
        return prom.catch(err => {
          if (!(err instanceof GameEntryNotFound)
              && !(err instanceof ProcessCanceled)
              // probably an extension using registry for discovery but I don't like
              // ignoring these
              && !(err.name === 'WinApiException')) {
            log('error', 'failed to use game support plugin',
                { id: game.id, err: err.message, stack: err.stack });
          }
          // don't escalate exception because a single game shouldn't break everything
          return Promise.resolve(undefined);
        });
      })))
    .then(gameNames => gameNames.filter(name => name !== undefined));
}

/**
 * recursively walk the specified directory, calling
 * the resultCB whenever a file or directory from the
 * matchList was hit.
 *
 * @param {string} searchPath
 * @param {Set<string>} matchList
 * @param {(path: string) => void} resultCB
 * @param {Progress} progress
 * @param {Normalize} normalize a function to normalize a filename for the
 *                    search folder, i.e. in a case-insensitive fs
 *                    it will upper-case the input. the entries of
 *                    matchList and blackList will be normalized within
 *                    the same function.
 * @returns number of directories read
 */
function walk(searchPath: string,
              matchList: Set<string>,
              resultCB: (path: string) => void,
              progress: Progress,
              normalize: Normalize): Promise<number> {
  // we can't actually know the progress percentage because for
  // that we'd need to search the disk twice, first to know the number of directories
  // just so we can show progress for the second run.
  // So instead we start with an extremely high directory total and gradually converge
  // towards an extrapolation based on progress so far, to get a smoother progress.
  let estimatedDirectories: number = Math.pow(2, 24);
  const seenTL = new Set<string>();
  let processedTL: number = 0;
  let seenDirectories: number = 0;
  let isTL = true;
  return turbowalk(searchPath, entries => {
    let doneCount = 0;
    let lastCompleted;
    entries.forEach(entry => {
      if (entry.isTerminator) {
        if (seenTL.has(entry.filePath)) {
          ++processedTL;
            // 80% of previous estimate plus a bit more than 20% of new estimate.
            // this will estimate a bit more than it mathematically should,
            // so the progress doesn't hang at 100%
          const estPerTL = seenDirectories / processedTL;
          estimatedDirectories = (
            Math.max(estimatedDirectories, seenDirectories) * 0.8 +
              estPerTL * seenTL.size * 0.202
          );
          log('debug', 'updated estimate',
              { searchPath, estimatedDirectories, seenDirectories,
                topLevelTotal: seenTL.size, processedTL });
          if (progress) {
            progress.setStepCount(estimatedDirectories);
          }
        }
        ++doneCount;
        lastCompleted = entry.filePath;
      } else if (entry.isDirectory) {
        ++seenDirectories;
        if (isTL) {
          if (path.relative(searchPath, entry.filePath).indexOf(path.sep) !==
                -1) {
            isTL = false;
          } else {
            seenTL.add(entry.filePath);
          }
        }
      } else if (matchList.has(normalize(path.basename(entry.filePath)))) {
        log('info', 'potential match', entry.filePath);
          // notify that a searched file was found. If the CB says so
          // we stop looking at this directory
        resultCB(entry.filePath);
      }
    });
    if (progress) {
        // count number of directories to be used as the step counter in the progress bar
      if (estimatedDirectories < seenDirectories) {
        estimatedDirectories = seenDirectories * ((seenTL.size + 1) / Math.max(processedTL, 1));
        progress.setStepCount(estimatedDirectories);
      }
      progress.completed(lastCompleted, doneCount);
    }
  }, { terminators: true })
    .then(() => seenDirectories);
}

function verifyToolDir(tool: ITool, testPath: string): Promise<void> {
  return tool.requiredFiles.reduce((promise, fileName) => {
    return promise.then(() => {
      // our fs overload would try to acquire access to the directory if it's locked, which
      // is not something we want at this point because we don't even know yet if the user
      // wants to manage the game at all.
      // Use macOS compatibility layer for file validation
      if (isMacOS()) {
        return checkFileWithMacOSFallback(testPath, fileName, tool.id)
          .then((exists) => {
            if (!exists) {
              const error = new Error(`File not found: ${fileName}`);
              (error as any).code = 'ENOENT';
              (error as any).path = path.join(testPath, fileName);
              throw error;
            }
            return undefined;
          });
      } else {
        return fsExtra.stat(path.join(testPath, fileName))
          .then(() => undefined)
          .catch(err => {
            return Promise.reject(err);
          });
      }
    });
  }, Promise.resolve())
    .then(() => undefined);
}

export function assertToolDir(tool: ITool, testPath: string)
                              : Promise<string> {
  if (!truthy(testPath)) {
    return Promise.resolve(undefined);
  }

  // Add retry logic for macOS timing issues
  const attemptVerification = (retryCount: number = 0): Promise<string> => {
    return verifyToolDir(tool, testPath)
      .then(() => testPath)
      .catch(err => {
        if (err.code === 'ENOENT' && retryCount < 2 && process.platform === 'darwin') {
          // On macOS, retry once after a brief delay for timing issues
          log('debug', 'game directory verification failed, retrying', { 
            game: tool.name, 
            testPath, 
            missing: err.path,
            retryCount 
          });
          return new Promise<void>((resolve) => setTimeout(() => resolve(), 150 * (retryCount + 1)))
            .then(() => attemptVerification(retryCount + 1));
        } else if (err.code === 'ENOENT') {
          log('warn', 'game directory not valid', { game: tool.name, testPath, missing: err.path });
        } else if (err.code === 'EPERM') {
          log('warn', 'game directory can\'t be read due to file permissions',
              { game: tool.name, testPath });
          return testPath;
        } else {
          log('error', 'failed to verify game directory',
              { testPath, error: err.message });
        }
        return Promise.reject(err);
      });
  };

  return attemptVerification();
}

const nop = () => undefined;

export function discoverRelativeTools(game: IGame, gamePath: string,
                                      discoveredGames: {[id: string]: IDiscoveryResult},
                                      onDiscoveredTool: DiscoveredToolCB, normalize: Normalize)
                               : Promise<void> {
  log('info', 'discovering relative tools', gamePath);
  const start = Date.now();
  const discoveredTools: { [id: string]: IToolStored } =
    getSafe(discoveredGames[game.id], ['tools'], {});
  const relativeTools = (game.supportedTools || [])
    .filter(tool => tool.relative === true)
    .filter(tool => (discoveredTools[tool.id] === undefined)
                 || (discoveredTools[tool.id].executable === undefined));

  if (relativeTools.length === 0) {
    return Promise.resolve();
  }

  const files: IFileEntry[] = relativeTools.reduce((prev: IFileEntry[], tool: ITool) => {
    for (const required of tool.requiredFiles) {
      prev.push({
        fileName: normalize(required),
        gameId: game.id,
        application: tool,
      });
    }
    return prev;
  }, []);

  const matchList: Set<string> = new Set(files.map(entry => path.basename(entry.fileName)));

  const onFileCB =
    filePath => onFile(filePath, files, normalize, discoveredGames, nop, onDiscoveredTool);
  return walk(gamePath, matchList, onFileCB, undefined, normalize)
    .then(() => {
      log('debug', 'done discovering relative tools', { elapsed: Date.now() - start });
    });
}

function autoGenIcon(application: ITool, exePath: string, gameId: string): Promise<void> {
  const iconPath = StarterInfo.toolIconRW(gameId, application.id);
  return (application.logo === 'auto')
    ? fs.ensureDirWritableAsync(path.dirname(iconPath), () => Promise.resolve())
      .then(() => fs.statAsync(iconPath).then(() => null))
      .catch(() => extractExeIcon(exePath, iconPath))
      .catch(err => log('warn', 'failed to fetch exe icon', err.message))
    : Promise.resolve();
}

function testApplicationDirValid(application: ITool, testPath: string, gameId: string,
                                 discoveredGames: {[id: string]: IDiscoveryResult},
                                 onDiscoveredGame: DiscoveredCB,
                                 onDiscoveredTool: DiscoveredToolCB,
                                 normalize: Normalize): void {
  verifyToolDir(application, testPath)
    .then(() => {
      const game = application as IGame;
      if (game.queryModPath !== undefined) {
        const exe = game.executable(testPath);
        const disco: IDiscoveryResult = {
          path: testPath,
          executable: (exe !== game.executable()) ? exe : undefined,
        };
        onDiscoveredGame(gameId, disco);

        return discoverRelativeTools(game, testPath, discoveredGames,
                                     onDiscoveredTool, normalize);
      } else {
        const exePath = path.join(testPath, application.executable(testPath));
        return autoGenIcon(application, exePath, gameId).then(() => {
          onDiscoveredTool(gameId, {
            ...application,
            path: exePath,
            hidden: false,
            custom: false,
          });
        });
      }
    })
    .catch(() => {
      log('info', 'invalid', {game: application.id, path: testPath});
    });
}

function toolFilesForGame(game: IGame,
                          discoveredTools: { [id: string]: IToolStored },
                          normalize: Normalize) {
  const result: IFileEntry[] = [];
  if (game.supportedTools !== undefined) {
    // all the (non-relative) known tools for the game we haven't found already
    game.supportedTools
      .filter(tool => tool.relative !== true)
      .forEach((tool: ITool) => {
        if (getSafe(discoveredTools, [tool.id, 'path'], undefined) === undefined) {
          for (const required of tool.requiredFiles) {
            result.push({
              fileName: normalize(required),
              gameId: game.id,
              application: tool,
            });
          }
        }
      });
  }
  return result;
}

function onFile(filePath: string, files: IFileEntry[], normalize: Normalize,
                discoveredGames: {[id: string]: IDiscoveryResult},
                onDiscoveredGame: DiscoveredCB, onDiscoveredTool: DiscoveredToolCB) {
  const normalized = normalize(filePath);
  const matches: IFileEntry[] =
    files.filter(entry => normalized.endsWith(entry.fileName));

  for (const match of matches) {
    const testPath: string = filePath.substring(0, filePath.length - match.fileName.length);
    testApplicationDirValid(match.application, testPath, match.gameId,
                            discoveredGames, onDiscoveredGame, onDiscoveredTool, normalize);
  }
  return false;
}

/**
 * run the "search"-discovery based on required files as specified by the game extension
 *
 * @export
 * @param {IGame[]} knownGames
 * @param {{ [id: string]: any }} discoveredGames
 * @param {string[]} searchPaths
 * @param {DiscoveredCB} onDiscoveredGame
 * @param {Progress} progressObj
 * @returns {Promise<any[]>}
 */
export function searchDiscovery(
  knownGames: IGame[], discoveredGames: {[id: string]: IDiscoveryResult},
  searchPaths: string[], onDiscoveredGame: DiscoveredCB,
  onDiscoveredTool: DiscoveredToolCB,
  onError: (title: string, message: string) => void,
  progressCB: (idx: number, percent: number, label: string) => void): Promise<any> {

  let totalRead = 0;

  return Promise.all(
    // windows has separate cwds per drive. If we used c: as the search path it would not actually
    // search in the root of drive c but in whatever is currently the working directory on c, so
    // we have to append a backslash. Damn you windows...
    searchPaths.map(searchPath => searchPath.endsWith(':') ? searchPath + path.sep : searchPath)
    .map((searchPath: string, index: number) => {
      log('info', 'searching for games & tools', { searchPath });
      const progressObj = new Progress(0, 100, (percent, label) =>
        progressCB(index, percent, label));
      // recurse through the search path and look for known files. use the appropriate file name
      // normalization
      return getNormalizeFunc(searchPath, { separators: true, unicode: false, relative: false })
        .then((normalize: Normalize) => {
          // gather files to look for
          const files: IFileEntry[] = [];

          knownGames.forEach((knownGame: IGame) => {
            const discoveredGame = discoveredGames[knownGame.id];
            // the game itself
            if (discoveredGame?.path === undefined) {
              for (const required of knownGame.requiredFiles) {
                files.push({
                  fileName: normalize(required),
                  gameId: knownGame.id,
                  application: knownGame,
                });
              }
            }
            // and its tools
            files.push.apply(files,
                             toolFilesForGame(knownGame, getSafe(discoveredGame, ['tools'], {}), normalize));
          }, []);

          // retrieve only the basenames of required files because the walk only ever looks
          // at the last path component of a file
          const matchList: Set<string> = new Set(files.map(entry => path.basename(entry.fileName)));
          const onFileCB = (filePath: string) =>
            onFile(filePath, files, normalize, discoveredGames, onDiscoveredGame, onDiscoveredTool);
          return walk(searchPath, matchList, onFileCB, progressObj, normalize)
            .then(numRead => {
              totalRead += numRead;
            });
        })
        .then(() => {
          log('info', 'finished game search', { searchPath });
        })
        .catch(err => {
          log('error', 'game search failed', { error: err.message, searchPath });
          return (err.code === 'ENOENT')
            ? Promise.resolve(
              onError('A search path doesn\'t exist or is not connected', searchPath))
            : Promise.resolve(onError(err.message, searchPath));
        })
        .then(() => {
          progressObj.completed(searchPath);
          return null;
        });
    })
  )
    .then(() => totalRead);
}

export async function suggestStagingPath(api: IExtensionApi, gameId: string): Promise<string> {
  const state = api.getState();
  const modPaths = modPathsForGame(state, gameId);

  let statModPath: fs.Stats;

  const idModPath = async (testPath: string) => {
    try {
      statModPath = await fs.statAsync(testPath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        await idModPath(path.dirname(testPath));
      } else {
        throw err;
      }
    }
  }

  await idModPath(modPaths['']);
  const statUserData = await fs.statAsync(getVortexPath('userData'));

  let suggestion: string;

  if ((statModPath.dev === statUserData.dev)
      || !isWindows()) {
    // main mod folder is on same drive as userdata, use a subdirectory below that
    suggestion = path.join('{USERDATA}', '{game}', 'mods');
  } else {
    // different drives, suggest path on same drive
    const volume = winapi.GetVolumePathName(modPaths['']);
    suggestion = path.join(volume, state.settings.mods.suggestInstallPathDirectory, '{game}');
  }

  return suggestion;
}
