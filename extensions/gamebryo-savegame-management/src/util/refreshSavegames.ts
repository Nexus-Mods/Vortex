import { ISavegame } from '../types/ISavegame';

import { CORRUPTED_NAME, MAX_SAVEGAMES } from '../constants';

import Promise from 'bluebird';
import * as savegameLib from 'gamebryo-savegame';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import { fs } from 'vortex-api';

// TODO essentially disables cache clearing since we can as many screenshots as the max of
// savegames we will display.
// The reason being that the thumbnails on the list weren't rerendered after having been removed
// from the cache and then reloaded and I don't have the time to investigate that.
const MIN_CACHE_SIZE = 200;
const MAX_CACHE_SIZE = MIN_CACHE_SIZE + 20;

const screenshotCache: {
  [id: string]: {
    data: Uint8ClampedArray,
    lastAccess: number,
  },
} = {};

function maintainCache() {
  const ids = Object.keys(screenshotCache);
  if (ids.length > MAX_CACHE_SIZE) {
    ids
      .sort((lhs, rhs) => screenshotCache[lhs].lastAccess - screenshotCache[rhs].lastAccess)
      .slice(0, ids.length - MIN_CACHE_SIZE)
      .forEach(id => delete screenshotCache[id]);
  }
}

export interface IRefreshResult {
  failedReads: string[];
  truncated: boolean;
}

function isSavegame(input: IEntry) {
  return !input.isDirectory
    && ['.ess', '.fos'].indexOf(path.extname(input.filePath).toLowerCase()) !== -1;
}

/**
 * reads the savegame dir and adds savegames missing in our database
 *
 * @param {string} savesPath
 * @param {(save: ISavegame) => void} onAddSavegame
 */
export function refreshSavegames(savesPath: string,
                                 onAddSavegame: (save: ISavegame) => void,
                                 allowTruncate: boolean): Promise<IRefreshResult> {
  const failedReads: string[] = [];
  let truncated = false;
  let saves: IEntry[] = [];

  return turbowalk(savesPath, entries => {
    saves = saves.concat(entries.filter(file => isSavegame(file)));
  }, { recurse: false })
    .catch(err => (['ENOENT', 'ENOTFOUND'].indexOf(err.code) !== -1)
      ? Promise.resolve()
      : Promise.reject(err))
    .then(() => {
      saves = saves.sort((lhs, rhs) => rhs.mtime - lhs.mtime);
      if (allowTruncate && (saves.length > MAX_SAVEGAMES)) {
        truncated = true;
        saves = saves.slice(0, MAX_SAVEGAMES);
      }
      return Promise.map(saves, save => loadSaveGame(save.filePath, save.size, onAddSavegame, false)
        .catch(err => {
          failedReads.push(`[b]${path.basename(save.filePath)}[/b] - ${err.message}`);
        }));
    })
    .then(() => ({ failedReads, truncated }));
}

function timestampFormat(timestamp: number) {
  const date: Date = new Date(timestamp * 1000);
  return date;
}

export function getScreenshot(id: string): Uint8ClampedArray {
  if (screenshotCache[id] !== undefined) {
    screenshotCache[id].lastAccess = Date.now();
    return screenshotCache[id].data;
  } else {
    return undefined;
  }
}

export function loadSaveGame(filePath: string, fileSize: number,
                             onAddSavegame: (save: ISavegame) => void,
                             full: boolean, tries: number = 2): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      savegameLib.create(filePath, !full, (err, sg) => {
        const id = path.basename(filePath);
        if (err !== null) {
          onAddSavegame({
            id,
            filePath,
            fileSize,
            attributes: {
              id: 0,
              name: CORRUPTED_NAME,
              location: 'N/A',
              playTime: 'N/A',
              level: 0,
              filename: id,
              plugins: [],
              loadedTime: Date.now(),
              corrupted: true,
            },
          });
          return reject(err);
        }
        if (full) {
          screenshotCache[id] = {
            lastAccess: Date.now(),
            data: new Uint8ClampedArray(sg.screenshot),
          };
        }
        const save: ISavegame = {
          id,
          filePath,
          fileSize,
          attributes: {
            id: sg.saveNumber,
            name: sg.characterName,
            level: sg.characterLevel,
            filename: id,
            location: sg.location,
            plugins: sg.plugins,
            screenshot: full ? {
              width: sg.screenshotSize.width,
              height: sg.screenshotSize.height,
            } : undefined,
            loadedTime: Date.now(),
            creationtime: timestampFormat(sg.creationTime),
            playTime: sg.playTime,
          },
        };

        onAddSavegame(save);
        resolve();
      });
    } catch (err) {
      if (err.message.startsWith('failed to open')) {
        // error messages from the lib aren't very enlightening unfortunately.
        // it could be a temporary problem (i.e. the game currently writing the
        // save and thus it would be locked so try again).
        // this opens the file with a js function, if that fails too we get a
        // better error message we may be able to handle
        fs.openAsync(filePath, 'r')
          .then(() => reject(err))
          .catch(fserr => reject(fserr));
      } else {
        reject(err);
      }
    }
  })
    .then(() => maintainCache())
    .catch(err => (tries > 0)
      ? loadSaveGame(filePath, fileSize, onAddSavegame, full, tries - 1)
      : Promise.reject(err));
}
