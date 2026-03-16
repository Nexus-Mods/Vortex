/* eslint-disable */
import Bluebird from 'bluebird';
import path from 'path';

import type { types } from 'vortex-api';

import { classifyArchive, makeInstallerTestResult } from './archiveClassifier';
import type { IInstallerTestResult } from '../types';

/**
 * Root-level installer for Stardew Valley archives that include `Content/`.
 *
 * These archives install into the game root and usually include a top-level
 * `Content/` directory (sometimes alongside `Mods/`).
 *
 * Exports:
 * - `testRootFolder`: matcher that auto-selects this installer when
 *   `Content/` is present.
 * - `installRootFolder`: copies matched archive files into the game root.
 */
const PTRN_CONTENT = path.sep + 'Content' + path.sep;

export function testRootFolder(files: string[], gameId: string): Bluebird<IInstallerTestResult> {
  const archiveInfo = classifyArchive(files, gameId);
  const supported = archiveInfo.isGameArchive && archiveInfo.hasContentFolder;

  return Bluebird.resolve(makeInstallerTestResult(supported));
}

export function installRootFolder(files: string[], destinationPath: string): Bluebird<types.IInstallResult> {
  // Deploy "Content/" and sibling folders into the game root.
  //  i.e. SomeMod.7z
  //  Will be deployed     => ../SomeMod/Content/
  //  Will be deployed     => ../SomeMod/Mods/
  //  Will NOT be deployed => ../Readme.doc
  const contentFile = files.find(file => path.join('fakeDir', file).endsWith(PTRN_CONTENT));
  if (contentFile === undefined) {
    return Bluebird.resolve<types.IInstallResult>({ instructions: [] });
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

  return Bluebird.resolve<types.IInstallResult>({ instructions });
}
