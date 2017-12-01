import { IDiscoveredTool } from '../../../types/IDiscoveredTool';
import { IGame } from '../../../types/IGame';
import { ITool } from '../../../types/ITool';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { IDiscoveryResult } from '../types/IDiscoveryResult';

import getNormalizeFunc, { Normalize } from '../../../util/getNormalizeFunc';

import Progress from './Progress';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import turbowalk from 'turbowalk';

export type DiscoveredCB = (gameId: string, result: IDiscoveryResult) => void;
export type DiscoveredToolCB = (toolId: string, result: IDiscoveredTool) => void;

function quickDiscoveryTools(tools: ITool[], onDiscoveredTool: DiscoveredToolCB) {
  if (tools === undefined) {
    return;
  }

  for (const tool of tools) {
    if (tool.queryPath === undefined) {
      continue;
    }

    const toolPath = tool.queryPath();
    if (typeof(toolPath) === 'string') {
      if (toolPath) {
        onDiscoveredTool(tool.id, {
          ...tool,
          path: toolPath,
          hidden: false,
          parameters: [],
          custom: false,
          workingDirectory: toolPath,
        });
      } else {
        log('debug', 'tool not found', tool.id);
      }
    } else {
      (toolPath as Promise<string>)
          .then((resolvedPath) => {
            if (resolvedPath) {
              onDiscoveredTool(tool.id, {
                ...tool,
                path: resolvedPath,
                hidden: false,
                parameters: [],
                custom: false,
                workingDirectory: resolvedPath,
              });
            }
            return null;
          })
          .catch((err) => {
            log('debug', 'tool not found', {id: tool.id, err: err.message});
          });
    }
  }
}

/**
 * run the "quick" discovery using functions provided by the game extension
 *
 * @export
 * @param {IGame[]} knownGames
 * @param {DiscoveredCB} onDiscoveredGame
 */
export function quickDiscovery(knownGames: IGame[],
                               onDiscoveredGame: DiscoveredCB,
                               onDiscoveredTool: DiscoveredToolCB): Promise<string[]> {
  return Promise.map(knownGames, game => new Promise<string>((resolve, reject) => {
    quickDiscoveryTools(game.supportedTools, onDiscoveredTool);
    if (game.queryPath === undefined) {
      return resolve();
    }
    try {
      const gamePath = game.queryPath();
      if (typeof (gamePath) === 'string') {
        // synchronous
        if (gamePath) {
          log('info', 'found game', { name: game.name, location: gamePath });
          verifyToolDir(game, gamePath)
            .then(() => {
              onDiscoveredGame(game.id, {
                path: gamePath,
                tools: {},
                hidden: false,
                environment: game.environment,
              });
              resolve(game.id);
            })
            .catch(err => {
              if (err.code === 'ENOENT') {
                log('warn', 'game directory not valid', { gamePath });
              } else {
                log('error', 'failed to verify game directory',
                  { gamePath, error: err.message });
              }
              resolve();
            });
        } else {
          log('debug', 'game not found', game.id);
          resolve();
        }
      } else {
        // asynchronous
        (gamePath as Promise<string>)
        .then(resolvedPath => truthy(resolvedPath)
          ? verifyToolDir(game, resolvedPath)
            .then(() => resolvedPath)
            .catch(err => {
              if (err.code === 'ENOENT') {
                log('warn', 'game directory not valid', { resolvedPath });
              } else {
                log('error', 'failed to verify game directory',
                  { gamePath, error: err.message });
              }
              return Promise.resolve();
            })
          : Promise.resolve(undefined))
        .then(resolvedPath => {
          if (truthy(resolvedPath)) {
            log('info', 'found game', { name: game.name, location: resolvedPath });
            onDiscoveredGame(game.id, {
              path: resolvedPath,
            });
            resolve(game.id);
          } else {
            resolve();
          }
        }).catch((err) => {
          log('debug', 'game not found',
            { id: game.id, err: err.message.replace(/(?:\r\n|\r|\n)/g, '; ') });
          resolve();
        });
      }
    } catch (err) {
      log('warn', 'failed to use game support plugin', { id: game.id, err: err.message });
      // TODO: this may not be the right thing to do, just because one game support plugin doesn't
      //   work we shouldn't cancel the whole discovery?
      reject(err);
    }
  })).then(gameNames => gameNames.filter(name => name !== undefined));
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
 * @returns
 */
function walk(searchPath: string,
              matchList: Set<string>,
              resultCB: (path: string) => void,
              progress: Progress,
              normalize: Normalize): Promise<void> {
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
            // 80% of previous estimate plus 30% of new estimate
            // this will estimate a bit more than it mathematically should,
            // so the progress doesn't hang at 100%
            estimatedDirectories = (
              estimatedDirectories * 0.8 +
              seenDirectories * (seenTL.size / processedTL) * 0.3
            );
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
        progress.setStepCount(estimatedDirectories);
        progress.completed(lastCompleted, doneCount);
      }
    }, { terminators: true });
}

function verifyToolDir(tool: ITool, testPath: string): Promise<void> {
  return Promise.mapSeries(tool.requiredFiles,
    (fileName: string) => {
      return fs.statAsync(path.join(testPath, fileName));
    })
    .then(() => undefined);
}

function testApplicationDirValid(application: ITool, testPath: string, gameId: string,
                                 onDiscoveredGame: DiscoveredCB,
                                 onDiscoveredTool: DiscoveredToolCB): void {
  verifyToolDir(application, testPath)
    .then(() => {
      const game = application as IGame;
      if (game.queryModPath !== undefined) {
        onDiscoveredGame(gameId, {
          path: testPath,
        });
      } else {
        onDiscoveredTool(gameId, {
          ...application,
          path: path.join(testPath, application.executable()),
          hidden: false,
          custom: false,
          workingDirectory: testPath,
        });
      }
    })
    .catch(() => {
      log('info', 'invalid', {game: application.id, path: testPath});
    });
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
    knownGames: IGame[], discoveredGames: {[id: string]: any},
    searchPaths: string[], onDiscoveredGame: DiscoveredCB,
    onDiscoveredTool: DiscoveredToolCB,
    progressCB: (idx: number, percent: number, label: string) => void): Promise<any> {
  interface IFileEntry {
    fileName: string;
    gameId: string;
    application: ITool;
  }

  const files: IFileEntry[] = [];

  knownGames.forEach((knownGame: IGame) => {
    if (!(knownGame.id in discoveredGames)) {
      for (const required of knownGame.requiredFiles) {
        files.push({ fileName: required, gameId: knownGame.id, application: knownGame });
      }
    }
    if (knownGame.supportedTools !== undefined) {
      knownGame.supportedTools.forEach((supportedTool: ITool) => {
        if (getSafe(discoveredGames, [knownGame.id, 'tools', supportedTool.id, 'path'], undefined)
            === undefined) {
          for (const required of supportedTool.requiredFiles) {
            files.push({ fileName: required, gameId: knownGame.id, application: supportedTool });
          }
        }
      });
    }
  }, []);

  // retrieve only the basenames of required files because the walk only ever looks
  // at the last path component of a file
  const matchList: string[] = files.map(entry => path.basename(entry.fileName));

  return Promise.map(
    // the node.js path module has a few bugs related to windows paths, replacing c: with c:\\ fixes
    // at least this one: https://github.com/nodejs/node/issues/17413
    searchPaths.map(searchPath => searchPath.endsWith(':') ? searchPath + path.sep : searchPath),
    (searchPath: string, index: number) => {
      log('info', 'searching for games & tools', { searchPath });
      const progressObj = new Progress(0, 100, (percent, label) =>
        progressCB(index, percent, label));
      // recurse through the search path and look for known files. use the appropriate file name
      // normalization
      return getNormalizeFunc(searchPath, { separators: false, unicode: false, relative: false })
        .then((normalize: Normalize) => {
          const matchListNorm = new Set(matchList.map(normalize));
          return walk(
              searchPath, matchListNorm, (foundPath: string) => {
                const matches: IFileEntry[] =
                    files.filter((entry: IFileEntry) => {
                      return normalize(foundPath)
                          .endsWith(normalize(entry.fileName));
                    });

                for (const match of matches) {
                  const testPath: string = foundPath.substring(
                      0, foundPath.length - match.fileName.length);
                  const application: ITool = match.application;
                  testApplicationDirValid(application, testPath, match.gameId,
                                          onDiscoveredGame, onDiscoveredTool);
                }
                return false;
              }, progressObj, normalize);
        })
        .then(() => {
          progressObj.completed(searchPath);
          return null;
        });
    });
}
