import { IGame } from '../../../types/IGame';
import { ISupportedTool } from '../../../types/ISupportedTool';
import { log } from '../../../util/log';

import { IDiscoveryResult } from '../types/IStateEx';

import { Normalize, getNormalizeFunc } from './getNormalizeFunc';

import Progress from './Progress';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export type DiscoveredCB = (gameId: string, result: IDiscoveryResult) => void;
export type DiscoveredToolCB = (gameId: string, result: ISupportedTool) => void;

/**
 * run discovery for the specified game
 * 
 * @export
 * @param {IGame} game
 * @param {DiscoveredToolCB} onDiscoveredTool
 */
export function discoverTools(game: IGame, onDiscoveredTool: DiscoveredToolCB) {
  let supportedTools: ISupportedTool[] = game.supportedTools;
  if (supportedTools === null) {
    return;
  }
  supportedTools.map((supportedTool: ISupportedTool) => {
    onDiscoveredTool(game.id, { id: supportedTool.id, missing: true });

    let location: string | Promise<string> = supportedTool.location();
    if (typeof (location) === 'string') {
      if (location !== '') {
        onDiscoveredTool(game.id, {
          id: supportedTool.id,
          path: location,
          missing: false,
        });
      } else {
        log('debug', 'tool not found', supportedTool.name);
      }
    } else {
      (location as Promise<string>).then((resolvedPath) => {
        onDiscoveredTool(game.id, {
          id: supportedTool.id,
          path: resolvedPath,
          missing: false,
       });
        return null;
      }).catch((err) => {
        log('debug', 'tool not found', { id: supportedTool.name, err });
      });
    }
  });
}

/**
 * run the "quick" discovery using functions provided by the game extension
 * 
 * @export
 * @param {IGame[]} knownGames
 * @param {DiscoveredCB} onDiscoveredGame
 */
export function quickDiscovery(knownGames: IGame[], onDiscoveredGame: DiscoveredCB) {
  for (let game of knownGames) {
    if (game.queryGamePath === undefined) {
      continue;
    }
    try {
      let gamePath = game.queryGamePath();
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

      return Promise.mapSeries(statPaths, (statPath: string) => {
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
            if (!(cur.reason().code in [ 'EPERM', 'ENOENT' ])) {
              log('warn', 'stat failed',
                  { path: cur.reason().path, error: cur.reason().code });
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

function testGameDirValid(game: IGame, testPath: string, onDiscoveredGame: DiscoveredCB): void {
  Promise.mapSeries(game.requiredFiles, (fileName: string) => {
    return fs.statAsync(path.join(testPath, fileName));
  }).then(() => {
    log('info', 'valid', { game: game.id, path: testPath });
    onDiscoveredGame(game.id, {
      path: testPath,
      modPath: game.queryModPath(),
    });
  }).catch(() => {
    log('info', 'invalid', { game: game.id, path: testPath });
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
                                progressObj: Progress): Promise<any[]> {
  type FileEntry = { fileName: string, game: IGame };

  let files: FileEntry[] = [];
  let games: { [gameId: string]: string[] } = {};

  knownGames.forEach((value: IGame) => {
    if (!(value.id in discoveredGames)) {
      games[value.id] = value.requiredFiles;
      for (let required of value.requiredFiles) {
        files.push({ fileName: required, game: value });
      }
    }
  }, []);

  // retrieve only the basenames of required files because the walk only ever looks
  // at the last path component of a file
  const matchList: string[] = files.map((entry: FileEntry) => {
    return path.basename(entry.fileName);
  });

  progressObj.setStepCount(searchPaths.length);

  return Promise.all(
    Promise.map(searchPaths,
      (searchPath: string) => {
        log('info', 'searching for games', { searchPaths });
        // recurse through the search path and look for known files. use the appropriate file name
        // normalization
        return getNormalizeFunc(searchPath)
          .then((normalize: Normalize) => {
            let matchListNorm = new Set(matchList.map(normalize));
            log('info', 'matches', { matchList: matchListNorm.keys() });
            return walk(searchPath, matchListNorm, new Set<string>(), (foundPath: string) => {
              log('debug', 'potential match', { foundPath });
              let matches: FileEntry[] = files.filter((entry: FileEntry) => {
                return foundPath.endsWith(entry.fileName);
              });

              for (let match of matches) {
                let testPath: string =
                  foundPath.substring(0, foundPath.length - match.fileName.length);
                let game: IGame = match.game;
                testGameDirValid(game, testPath, onDiscoveredGame);
              }
              return false;
            }, progressObj, normalize);
          })
          .then(() => {
            progressObj.completed(searchPath);
            return null;
          });
      })
    );

}
