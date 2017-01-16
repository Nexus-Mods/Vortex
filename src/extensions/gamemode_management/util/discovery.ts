import { IDiscoveredTool } from '../../../types/IDiscoveredTool';
import { IGame } from '../../../types/IGame';
import { ITool } from '../../../types/ITool';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { IDiscoveryResult } from '../types/IStateEx';

import getNormalizeFunc, { Normalize } from '../../../util/getNormalizeFunc';

import Progress from './Progress';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

import * as util from 'util';

export type DiscoveredCB = (gameId: string, result: IDiscoveryResult) => void;
export type DiscoveredToolCB = (toolId: string, result: IDiscoveredTool) => void;

function quickDiscoveryTools(tools: ITool[], onDiscoveredTool: DiscoveredToolCB) {
  if (tools === null) {
    return;
  }

  for (let tool of tools) {
    if (tool.queryPath === undefined) {
      continue;
    }

    let toolPath = tool.queryPath();
    if (typeof(toolPath) === 'string') {
      if (toolPath) {
        onDiscoveredTool(tool.id, Object.assign({}, tool, {
          path: toolPath,
          hidden: false,
          parameters: [],
          custom: false,
          currentWorkingDirectory: toolPath,
        }));
      } else {
        log('debug', 'tool not found', tool.id);
      }
    } else {
      (toolPath as Promise<string>)
          .then((resolvedPath) => {
            if (resolvedPath) {
              onDiscoveredTool(tool.id, Object.assign({}, tool, {
                path: resolvedPath,
                hidden: false,
                parameters: [],
                custom: false,
                currentWorkingDirectory: resolvedPath,
              }));
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
                               onDiscoveredTool: DiscoveredToolCB) {
  for (let game of knownGames) {
    quickDiscoveryTools(game.supportedTools, onDiscoveredTool);
    if (game.queryPath === undefined) {
      continue;
    }
    try {
      let gamePath = game.queryPath();
      if (typeof (gamePath) === 'string') {
        if (gamePath) {
          log('info', 'found game', { name: game.name, location: gamePath });
          onDiscoveredGame(game.id, {
            path: gamePath,
            modPath: game.queryModPath(),
            tools: {},
            hidden: false,
          });
        } else {
          log('debug', 'game not found', game.id);
        }
      } else {
        (gamePath as Promise<string>).then((resolvedPath) => {
          if (resolvedPath) {
            log('info', 'found game', { name: game.name, location: resolvedPath });
            onDiscoveredGame(game.id, {
              path: resolvedPath,
              modPath: game.queryModPath(),
            });
          }
          return null;
        }).catch((err) => {
          log('debug', 'game not found', { id: game.id, err: err.message });
        });
      }
    } catch (err) {
      log('warn', 'failed to use game support plugin', { id: game.id, err: err.message });
    }
  }
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
              blackList: Set<string>,
              resultCB: (path: string) => void,
              progress: Progress,
              normalize: Normalize) {
  if (blackList.has(searchPath)) {
    return null;
  }

  let statPaths: string[] = [];

  return fs.readdirAsync(searchPath)
    .then((fileNames: string[]) => {
      for (let fileName of fileNames) {
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
    }).then((res: Promise.Inspection<fs.Stats>[]) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      let dirPaths: string[] = res.reduce(
        (prev, cur: Promise.Inspection<fs.Stats>, idx: number) => {
          if (cur.isFulfilled() && cur.value().isDirectory()) {
            return prev.concat(idx);
          } else if (!cur.isFulfilled()) {
            if ([ 'EPERM', 'ENOENT' ].indexOf(cur.reason().code) === -1) {
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
      if (progress !== undefined) {
        // count number of directories to be used as the step counter in the progress bar
        progress.setStepCount(dirPaths.length);
      }
      // allow the gc to drop the stats results
      res = [];
      if (dirPaths === undefined) {
        return undefined;
      }
      return Promise.mapSeries(dirPaths, (idx) => {
        let subProgess = progress !== undefined ? progress.derive() : undefined;
        if (progress !== undefined) {
          progress.completed(statPaths[idx]);
        }
        return walk(statPaths[idx], matchList, blackList, resultCB, subProgess, normalize);
      });
    }).catch((err) => {
      log('warn', 'walk failed', { msg: err.message });
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
        let game = application as IGame;
        if (game.queryModPath !== undefined) {
          onDiscoveredGame(gameId, {
            path: testPath,
            modPath: game.queryModPath(),
          });
        } else {
          onDiscoveredTool(gameId, Object.assign({}, application, {
            path: path.join(testPath, application.executable()),
            hidden: false,
            custom: false,
            currentWorkingDirectory: testPath,
          }));
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
export function searchDiscovery(knownGames: IGame[],
                                discoveredGames: { [id: string]: any },
                                searchPaths: string[],
                                onDiscoveredGame: DiscoveredCB,
                                onDiscoveredTool: DiscoveredToolCB,
                                progressObj: Progress): Promise<any[]> {
  type FileEntry = {
    fileName: string,
    gameId: string,
    application: ITool
  };

  let files: FileEntry[] = [];

  knownGames.forEach((knownGame: IGame) => {
    if (!(knownGame.id in discoveredGames)) {
      for (let required of knownGame.requiredFiles) {
        files.push({ fileName: required, gameId: knownGame.id, application: knownGame });
      }
    }
    if (knownGame.supportedTools !== null) {
      knownGame.supportedTools.forEach((supportedTool: ITool) => {
        if (getSafe(discoveredGames, [knownGame.id, 'tools', supportedTool.id, 'path'], undefined)
            === undefined) {
          for (let required of supportedTool.requiredFiles) {
            files.push({fileName: required, gameId: knownGame.id, application: supportedTool});
          }
        }
      });
    }
  }, []);

  log('info', 'searching for', util.inspect(files));

  // retrieve only the basenames of required files because the walk only ever looks
  // at the last path component of a file
  const matchList: string[] = files.map((entry: FileEntry) => {
    return path.basename(entry.fileName);
  });

  progressObj.setStepCount(searchPaths.length);

  return Promise.mapSeries(searchPaths,
      (searchPath: string) => {
        log('info', 'searching for games & tools', { searchPaths });
        // recurse through the search path and look for known files. use the appropriate file name
        // normalization
        return getNormalizeFunc(searchPath)
          .then((normalize: Normalize) => {
            let matchListNorm = new Set(matchList.map(normalize));
            return walk(searchPath, matchListNorm, new Set<string>(), (foundPath: string) => {
              let matches: FileEntry[] = files.filter((entry: FileEntry) => {
                return normalize(foundPath).endsWith(normalize(entry.fileName));
              });

              for (let match of matches) {
                let testPath: string =
                  foundPath.substring(0, foundPath.length - match.fileName.length);
                let application: ITool = match.application;
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
      }
    );
}
