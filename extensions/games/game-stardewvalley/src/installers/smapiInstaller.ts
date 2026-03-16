/**
 * Detects and installs SMAPI archives for Stardew Valley.
 */
import Bluebird from 'bluebird';
import path from 'path';
import { fs, log, util } from 'vortex-api';
import type { types } from 'vortex-api';

import { _SMAPI_BUNDLED_MODS, getBundledMods } from '../common';
import { classifyArchive, makeInstallerTestResult } from './archiveClassifier';
import type { IInstallerTestResult } from '../types';

// TODO: Linux support (this executable name is Windows-specific).
/** Canonical SMAPI executable file name used by discovery and deployment logic. */
export const SMAPI_EXE = 'StardewModdingAPI.exe';

/** Detects whether a set of install instructions contains the SMAPI executable. */
export function isSMAPIModType(instructions: types.IInstruction[]): Bluebird<boolean> {
  // Find the SMAPI exe file.
  const smapiData = instructions.find(inst => (inst.type === 'copy')
    && (typeof inst.source === 'string')
    && inst.source.endsWith(SMAPI_EXE));

  return Bluebird.resolve(smapiData !== undefined);
}

/** Tests whether an archive contains the SMAPI installer payload. */
export function testSMAPI(files: string[], gameId: string): Bluebird<IInstallerTestResult> {
  const archiveInfo = classifyArchive(files, gameId);
  const supported = archiveInfo.isGameArchive && archiveInfo.hasSmapiInstallerDll;
  return Bluebird.resolve(makeInstallerTestResult(supported));
}

/** Extracts platform-specific SMAPI files and returns installation instructions. */
export async function installSMAPI(getGameInstallPath: () => string,
                                   files: string[],
                                   destinationPath: string): Promise<types.IInstallResult> {
  const folder = process.platform === 'win32'
    ? 'windows'
    : process.platform === 'linux'
      ? 'linux'
      : 'macos';
  const fileHasCorrectPlatform = (file: string) => {
    const segments = file.split(path.sep).map(seg => seg.toLowerCase());
    return (segments.includes(folder));
  }
  // Find the SMAPI data archive
  const dataFile = files.find(file => {
    const isCorrectPlatform = fileHasCorrectPlatform(file);
    return isCorrectPlatform && SMAPI_DATA.includes(path.basename(file).toLowerCase())
  });
  if (dataFile === undefined) {
    return Promise.reject(new util.DataInvalid('Failed to find the SMAPI data files - download appears '
      + 'to be corrupted; please re-download SMAPI and try again'));
  }
  let data = '';
  try {
    data = await fs.readFileAsync(path.join(getGameInstallPath(), 'Stardew Valley.deps.json'), { encoding: 'utf8' });
  } catch (err) {
    log('error', 'failed to parse SDV dependencies', err);
  }

  // file will be outdated after the walk operation so prepare a replacement.
  const updatedFiles: string[] = [];

  const szip = new (util.SevenZip as any)();
  // Unzip the files from the data archive. This doesn't seem to behave as described here: https://www.npmjs.com/package/node-7z#events
  await szip.extractFull(path.join(destinationPath, dataFile), destinationPath);

  // Find any files that are not in the parent folder.
  await util.walk(destinationPath, (iter, stats) => {
      const relPath = path.relative(destinationPath, iter);
      // Filter out files from the original install as they're no longer required.
      if (!files.includes(relPath) && stats.isFile() && !files.includes(relPath + path.sep)) updatedFiles.push(relPath);
      const segments = relPath.toLocaleLowerCase().split(path.sep);
      const modsFolderIdx = segments.indexOf('mods');
      if (modsFolderIdx !== -1) {
        const bundledMod = segments[modsFolderIdx + 1];
        if (bundledMod !== undefined) {
          _SMAPI_BUNDLED_MODS.push(bundledMod);
        }
      }
      return Bluebird.resolve();
  });

  // Find the SMAPI exe file.
  const smapiExe = updatedFiles.find(file => file.toLowerCase().endsWith(SMAPI_EXE.toLowerCase()));
  if (smapiExe === undefined) {
    return Promise.reject(new util.DataInvalid(`Failed to extract ${SMAPI_EXE} - download appears `
      + 'to be corrupted; please re-download SMAPI and try again'));
  }
  const idx = smapiExe.indexOf(path.basename(smapiExe));

  // Build the instructions for installation.
  const instructions: types.IInstruction[] = updatedFiles.map(file => {
      return {
          type: 'copy',
          source: file,
          destination: path.join(file.substr(idx)),
      }
  });

  instructions.push({
    type: 'attribute',
    key: 'smapiBundledMods',
    value: getBundledMods(),
  });

  instructions.push({
    type: 'generatefile',
    data,
    destination: 'StardewModdingAPI.deps.json',
  });

  return Promise.resolve({ instructions });
}

const SMAPI_DATA = ['windows-install.dat', 'install.dat'];
