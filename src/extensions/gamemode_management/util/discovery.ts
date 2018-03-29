import { IDiscoveredTool } from '../../../types/IDiscoveredTool';
import { IGame } from '../../../types/IGame';
import { ITool } from '../../../types/ITool';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import {IToolStored} from '../types/IToolStored';

import getNormalizeFunc, { Normalize } from '../../../util/getNormalizeFunc';

import Progress from './Progress';

import * as Promise from 'bluebird';
import * as path from 'path';
import turbowalk from 'turbowalk';

export type DiscoveredCB = (gameId: string, result: IDiscoveryResult) => void;
export type DiscoveredToolCB = (toolId: string, result: IDiscoveredTool) => void;

interface IFileEntry {
  fileName: string;
  gameId: string;
  application: ITool;
}

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
                               discoveredGames: {[id: string]: IDiscoveryResult},
                               onDiscoveredGame: DiscoveredCB,
                               onDiscoveredTool: DiscoveredToolCB): Promise<string[]> {
  return Promise.map(knownGames, game => new Promise<string>((resolve, reject) => {
    quickDiscoveryTools(game.supportedTools, onDiscoveredTool);
    if (game.queryPath === undefined) {
      return resolve();
    }
    try {
      const gamePath = game.queryPath();
      const prom = (typeof (gamePath) === 'string')
        ? Promise.resolve(gamePath)
        : gamePath;

      prom
        .then(resolvedPath => assertToolDir(game, resolvedPath))
        .then(resolvedPath => {
          if (!truthy(resolvedPath)) {
            return resolve(undefined);
          }
          log('info', 'found game', { name: game.name, location: resolvedPath });
          onDiscoveredGame(game.id, {
            path: resolvedPath,
          });
          getNormalizeFunc(resolvedPath)
          .then(normalize =>
            discoverRelativeTools(game, resolvedPath, discoveredGames, onDiscoveredTool, normalize))
          .then(() => resolve(game.id));
        }).catch((err) => {
          log('debug', 'game not found',
            { id: game.id, err: err.message.replace(/(?:\r\n|\r|\n)/g, '; ') });
          resolve();
        });
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
            // 80% of previous estimate plus a bit more than 20% of new estimate.
            // this will estimate a bit more than it mathematically should,
            // so the progress doesn't hang at 100%
            estimatedDirectories = (
              estimatedDirectories * 0.8 +
              seenDirectories * (seenTL.size / processedTL) * 0.202
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
    }, { terminators: true, skipLinks: true });
}

function verifyToolDir(tool: ITool, testPath: string): Promise<void> {
  return Promise.mapSeries(tool.requiredFiles,
    (fileName: string) => fs.statAsync(path.join(testPath, fileName)))
    .then(() => undefined);
}

function assertToolDir(tool: ITool, testPath: string): Promise<string> {
  if (!truthy(testPath)) {
    return Promise.resolve(undefined);
  }

  return verifyToolDir(tool, testPath)
    .then(() => testPath)
    .catch(err => {
      if (err.code === 'ENOENT') {
        log('warn', 'game directory not valid', { testPath });
      } else {
        log('error', 'failed to verify game directory',
          { testPath, error: err.message });
      }
      return Promise.resolve(undefined);
    });
}

const nop = () => undefined;

export function discoverRelativeTools(game: IGame, gamePath: string,
                                      discoveredGames: {[id: string]: IDiscoveryResult},
                                      onDiscoveredTool: DiscoveredToolCB, normalize: Normalize)
                               : Promise<void> {
  const discoveredTools = getSafe(discoveredGames[game.id], ['tools'], {});
  const relativeTools = (game.supportedTools || [])
    .filter(tool => tool.relative === true)
    .filter(tool => discoveredTools[tool.id] === undefined);

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
  return walk(gamePath, matchList, onFileCB, undefined, normalize);
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
        onDiscoveredGame(gameId, {
          path: testPath,
        });

        return discoverRelativeTools(game, testPath, discoveredGames,
                                     onDiscoveredTool, normalize);
      } else {
        onDiscoveredTool(gameId, {
          ...application,
          path: path.join(testPath, application.executable()),
          hidden: false,
          custom: false,
          workingDirectory: testPath,
        });
        return Promise.resolve();
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
  const matches: IFileEntry[] =
    files.filter(entry => normalize(filePath).endsWith(entry.fileName));

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
    progressCB: (idx: number, percent: number, label: string) => void): Promise<any> {

  return Promise.map(
    // windows has separate cwds per drive. If we used c: as the search path it would not actually
    // search in the root of drive c but in whatever is currently the working directory on c, so
    // we have to append a backslash. Damn you windows...
    searchPaths.map(searchPath => searchPath.endsWith(':') ? searchPath + path.sep : searchPath),
    (searchPath: string, index: number) => {
      log('info', 'searching for games & tools', { searchPath });
      const progressObj = new Progress(0, 100, (percent, label) =>
        progressCB(index, percent, label));
      // recurse through the search path and look for known files. use the appropriate file name
      // normalization
      return getNormalizeFunc(searchPath, { separators: false, unicode: false, relative: false })
        .then((normalize: Normalize) => {
          // gather files to look for
          const files: IFileEntry[] = [];

          knownGames.forEach((knownGame: IGame) => {
            const discoveredGame = discoveredGames[knownGame.id];
            // the game itself
            if (discoveredGame === undefined) {
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
          return walk(searchPath, matchList, onFileCB, progressObj, normalize);
        })
        .then(() => {
          progressObj.completed(searchPath);
          return null;
        });
    });
}
