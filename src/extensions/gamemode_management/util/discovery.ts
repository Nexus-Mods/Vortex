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
          onDiscoveredGame(game.id, {
            path: gamePath,
            tools: {},
            hidden: false,
            environment: game.environment,
          });
          resolve(game.name);
        } else {
          log('debug', 'game not found', game.id);
          resolve();
        }
      } else {
        // asynchronous
        (gamePath as Promise<string>)
        .then(resolvedPath => {
          if (resolvedPath) {
            log('info', 'found game', { name: game.name, location: resolvedPath });
            onDiscoveredGame(game.id, {
              path: resolvedPath,
            });
          }
          resolve(game.name);
        }).catch((err) => {
          log('debug', 'game not found', { id: game.id, err: err.message });
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
 * @param {Set<string>} blackList
 * @param {(path: string) => void} resultCB
 * @param {Progress} progress
 * @param {normalize} a function to normalize a filename for the
 *                    search folder, i.e. in a case-insensitive fs
 *                    it will upper-case the input. the entries of
 *                    matchList and blackList will be normalized within
 *                    the same function.
 * @returns
 */
function walk(searchPath: string,
              matchList: Set<string>,
              exclude: RegExp,
              resultCB: (path: string) => void,
              progress: Progress,
              normalize: Normalize) {
  if (!searchPath.endsWith(path.sep)) {
    searchPath += path.sep;
  }

  if (exclude.test(searchPath)) {
    return null;
  }

  const statPaths: string[] = [];

  return fs.readdirAsync(searchPath)
    .then((fileNames: string[]) => {
      for (const fileName of fileNames) {
        const filePath = path.join(searchPath, fileName);
        if (matchList.has(normalize(fileName))) {
          log('info', 'potential match', fileName);
          // notify that a searched file was found. If the CB says so
          // we stop looking at this directory
          resultCB(filePath);
        } else {
          statPaths.push(filePath);
        }
      }

      return Promise.map(statPaths, (statPath: string) => {
        return fs.statAsync(statPath).reflect();
      });
    }).then((res: Array<Promise.Inspection<fs.Stats>>) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      const dirIdxs: number[] = res.reduce(
        (prev, cur: Promise.Inspection<fs.Stats>, idx: number) => {
          if (cur.isFulfilled() && cur.value().isDirectory()) {
            return prev.concat(idx);
          } else if (!cur.isFulfilled()) {
            if ([ 'EPERM', 'ENOENT', 'EBUSY' ].indexOf(cur.reason().code) === -1) {
              log('warn', 'stat failed',
                  { path: cur.reason().path, error: cur.reason().code,
                    type: typeof(cur.reason().code) });
            } else {
              log('debug', 'failed to access',
                  { path: cur.reason().path, error: cur.reason().code });
            }
          }
          return prev;
        }, []);
      if (progress) {
        // count number of directories to be used as the step counter in the progress bar
        progress.setStepCount(dirIdxs.length);
      }
      // allow the gc to drop the stats results
      res = [];
      if (dirIdxs === undefined) {
        return undefined;
      }
      return Promise.mapSeries(dirIdxs, idx => {
        let subProgress;
        if (truthy(progress)) {
          subProgress = progress.derive();
          progress.completed(statPaths[idx]);
        }
        return walk(statPaths[idx], matchList, exclude, resultCB,
         subProgress, normalize);
      });
    }).catch(err => {
      if ([ 'EPERM' ].indexOf(err.code) !== -1) {
        // TODO: this can happen if the recursion hits a junction point and I
        // couldn't figure out how to recognize a junction point in node.js
        log('info', 'walk failed', { msg: err.message });
      } else {
        log('warn', 'walk failed', { msg: err.message });
      }
    });
}

function testApplicationDirValid(application: ITool, testPath: string, gameId: string,
                                 onDiscoveredGame: DiscoveredCB,
                                 onDiscoveredTool: DiscoveredToolCB): void {
  Promise.mapSeries(application.requiredFiles,
                    (fileName: string) => {
                      return fs.statAsync(path.join(testPath, fileName));
                    })
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

const blackList = [
  String.raw`.:\\\$Recycle.Bin\\.*`,
  String.raw`.:\\\$\$PendingFiles\\.*`,
  String.raw`C:\\windows`,
];

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
            files.push({fileName: required, gameId: knownGame.id, application: supportedTool});
          }
        }
      });
    }
  }, []);

  // retrieve only the basenames of required files because the walk only ever looks
  // at the last path component of a file
  const matchList: string[] = files.map((entry: IFileEntry) => {
    return path.basename(entry.fileName);
  });

  const blExp = new RegExp(blackList.join('|'));

  return Promise.map(searchPaths,
      (searchPath: string, index: number) => {
        log('info', 'searching for games & tools', { searchPaths });
        const progressObj = new Progress(0, 100, (percent, label) =>
          progressCB(index, percent, label));
        // recurse through the search path and look for known files. use the appropriate file name
        // normalization
        return getNormalizeFunc(searchPath)
          .then((normalize: Normalize) => {
            const matchListNorm = new Set(matchList.map(normalize));
            return walk(
                searchPath, matchListNorm, blExp, (foundPath: string) => {
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
