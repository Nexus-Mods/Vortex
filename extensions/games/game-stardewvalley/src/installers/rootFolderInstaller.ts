/**
 * Installs Stardew archives that deploy directly into the game root.
 */
import Bluebird from 'bluebird';
import path from 'path';

import type { types } from 'vortex-api';

import type { IInstallerTestResult } from '../types';
import { classifyArchive, makeInstallerTestResult } from './archiveClassifier';

/** Tests whether an archive should be handled as a root-folder install. */
export function testRootFolder(files: string[], gameId: string): Bluebird<IInstallerTestResult> {
  const archiveInfo = classifyArchive(files, gameId);
  const supported = archiveInfo.isGameArchive && archiveInfo.hasContentFolder;

  return Bluebird.resolve(makeInstallerTestResult(supported));
}

/** Generates copy instructions that place archive files into the game root. */
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

const PTRN_CONTENT = path.sep + 'Content' + path.sep;
