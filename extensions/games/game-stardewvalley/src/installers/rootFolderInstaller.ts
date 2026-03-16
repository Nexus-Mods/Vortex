/* eslint-disable */
import Bluebird from 'bluebird';
import path from 'path';
import { types } from 'vortex-api';

import { GAME_ID } from '../common';

/**
 * Root-folder installer for Stardew Valley "Content replacer" archives.
 *
 * These archives are deployed into the game root and usually include a
 * top-level `Content/` directory (sometimes alongside `Mods/`).
 *
 * Exports:
 * - `testRootFolder`: installer matcher for this archive pattern.
 * - `installRootFolder`: installer that emits copy instructions into root.
 */
const PTRN_CONTENT = path.sep + 'Content' + path.sep;

export function testRootFolder(files: string[], gameId: string) {
  // We assume that any mod containing "/Content/" in its directory
  //  structure is meant to be deployed to the root folder.
  const filtered = files.filter(file => file.endsWith(path.sep))
    .map(file => path.join('fakeDir', file));
  const contentDir = filtered.find(file => file.endsWith(PTRN_CONTENT));
  const supported = ((gameId === GAME_ID)
    && (contentDir !== undefined));

  return Bluebird.resolve({ supported, requiredFiles: [] });
}

export function installRootFolder(files: string[], destinationPath: string) {
  // We're going to deploy "/Content/" and whatever folders come alongside it.
  //  i.e. SomeMod.7z
  //  Will be deployed     => ../SomeMod/Content/
  //  Will be deployed     => ../SomeMod/Mods/
  //  Will NOT be deployed => ../Readme.doc
  const contentFile = files.find(file => path.join('fakeDir', file).endsWith(PTRN_CONTENT));
  if (contentFile === undefined) {
    return Bluebird.reject(new Error('Content directory not found'));
  }
  const idx = contentFile.indexOf(PTRN_CONTENT) + 1;
  const rootDir = path.basename(contentFile.substring(0, idx));
  const filtered = files.filter(file => !file.endsWith(path.sep)
    && (file.indexOf(rootDir) !== -1)
    && (path.extname(file) !== '.txt'));
  const instructions: types.IInstruction[] = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: file.substr(idx),
    };
  });

  return Bluebird.resolve({ instructions });
}
