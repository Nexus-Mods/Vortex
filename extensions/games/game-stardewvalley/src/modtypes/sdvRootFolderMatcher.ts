/* eslint-disable */
import Bluebird from 'bluebird';
import path from 'path';

import type { types } from 'vortex-api';

import { MANIFEST_FILE } from '../installers/stardewValleyInstaller';
import { defaultModsRelPath } from '../util';

/**
 * Mod-type matcher for automatic `sdvrootfolder` classification.
 *
 * Detects root installs by looking for `Content/` copy destinations, while
 * still handling mixed archives that also include regular SMAPI content.
 */
export function isSdvRootFolderModType(instructions: types.IInstruction[]) {
  const copyInstructions = instructions.filter(instr => instr.type === 'copy');

  const hasManifest = copyInstructions.some(instr =>
    instr.destination?.endsWith(MANIFEST_FILE) === true);
  const hasModsFolder = copyInstructions.some(instr =>
    instr.destination?.startsWith(defaultModsRelPath() + path.sep) === true);
  const hasContentFolder = copyInstructions.some(instr =>
    instr.destination?.startsWith('Content' + path.sep) === true);

  return (hasManifest)
    ? Bluebird.resolve(hasContentFolder && hasModsFolder)
    : Bluebird.resolve(hasContentFolder);
}
