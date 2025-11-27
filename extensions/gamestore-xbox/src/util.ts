/* eslint-disable */
/*
  Special thanks to the LOOT team for the original C++ implementation used to decipher the .gamingroot file.
*/
import * as path from 'path';
import * as fs from 'fs';
import walk from 'turbowalk';
import { log, types, util } from 'vortex-api';
import { parseStringPromise } from 'xml2js';

import { APP_MANIFEST } from './common';
import { GamePathMap } from './types';

export async function findInstalledGames(api: types.IExtensionApi): Promise<GamePathMap> {
  const gamingRootPaths = await findXboxGamingRootPaths(api);
  const gamePathMap: GamePathMap = {};

  for (const gamingRootPath of gamingRootPaths) {
    const manifests = await findManifests(gamingRootPath, true);
    for (const manifest of manifests) {
      const gamePath = path.dirname(manifest);
      const data = await getAppManifestData(gamePath);
      const appId: string = data?.Package?.Identity?.[0]?.$?.Name;
      if (appId) {
        gamePathMap[appId] = gamePath;
      }
    }
  }
  return gamePathMap;
}

export async function findXboxGamingRootPaths(api: types.IExtensionApi): Promise<string[]> {
  let drives = api.store.getState().settings.gameMode.searchPaths;
  if (drives.length === 0) {
    drives = await util.getDriveList(api);
  }
  const gamingRootPaths = [];
  for (const drive of drives) {
    const normalizedDrive = ensurePathSeparator(drive);
    const gamingRootPath = await findXboxGamingRootPath(normalizedDrive);
    if (gamingRootPath !== null) {
      gamingRootPaths.push(gamingRootPath);
    }
  }
  return gamingRootPaths;
}

export async function findXboxGamingRootPath(driveRootPath: string): Promise<string> {
  const gamingRootFilePath = `${driveRootPath}.GamingRoot`;

  try {
    const fileStats = await fs.promises.stat(gamingRootFilePath);

    if (!fileStats.isFile()) {
      return null;
    }

    const fileContent: Buffer = await fs.promises.readFile(gamingRootFilePath);

    // Log the content in hexadecimal format for debugging
    const hexBytes = Array.from(fileContent, byte => `0x${byte.toString(16)}`);
    log('debug', `Read the following bytes from ${gamingRootFilePath}: ${hexBytes.join(' ')}`);

    // The content of .GamingRoot is the byte sequence 52 47 42 58 01 00 00 00
    // followed by the null-terminated UTF-16LE location of the Xbox games folder
    // on the same drive.

    if (fileContent.length % 2 !== 0) {
      log('error', `Found a non-even number of bytes in the file at ${gamingRootFilePath}, cannot interpret it as UTF-16LE`);
      throw new Error(`Found a non-even number of bytes in the file at "${gamingRootFilePath}"`);
    }

    const content = [];
    for (let i = 0; i < fileContent.length; i += 2) {
      const highByte = fileContent[i];
      const lowByte = fileContent[i + 1];
      const value = highByte | (lowByte << 8); // Combine bytes for little-endian
      content.push(value);
    }

    const CHAR16_PATH_OFFSET = 4;
    if (content.length < CHAR16_PATH_OFFSET + 1) {
      log('error', `.GamingRoot content was unexpectedly short at ${content.length} char16_t long`);
      throw new Error(`The file at "${gamingRootFilePath}" is shorter than expected.`);
    }

    // Cut off the null char16_t at the end.
    const relativePath = String.fromCharCode.apply(null, content.slice(CHAR16_PATH_OFFSET, -1));

    log('debug', `Read the following relative path from .GamingRoot: ${relativePath}`);

    const resultPath = `${driveRootPath}${relativePath}`;
    if (!isPathValid(resultPath)) {
      // Sanity check
      return null;
    }

    return fs.promises.stat(resultPath).then(() => resultPath).catch(() => null);
  } catch (err) {
    log('debug', 'Not a valid xbox gaming path', err);
    // Don't propagate this error as it could be due to a legitimate failure
    // case like the drive not being ready (e.g. a removable disk drive with
    // nothing in it).
    return null;
  }
}

export async function findManifests(rootPath: string, recurse: boolean): Promise<string[]> {
  let fileList: string[] = [];
  return walk(rootPath, entries => {
    fileList = fileList.concat(
      entries
        .filter(iter => path.basename(iter.filePath) === APP_MANIFEST)
        .map(iter => iter.filePath));
  }, { recurse, skipHidden: true, skipLinks: true, skipInaccessible: true })
  .then(() => fileList)
  .catch(err => {
    log('error', 'failed to search for manifests', err);
    // fileList might actually hold _some_ entries at this point.
    return fileList;
  });
}

export async function getAppManifestData(filePath: string) {
  const appManifestFilePath = path.join(filePath, APP_MANIFEST);
  return fs.promises.readFile(appManifestFilePath, { encoding: 'utf8' })
    .then((data) => parseStringPromise(data))
    .then((parsed) => Promise.resolve(parsed))
    .catch(err => Promise.resolve(undefined));
}

function ensurePathSeparator(rootPath: string): string {
  // Not sure why drivelist isn't returning a normalized
  //  drive path, but this should fix it.
  const normalizedPath = path.normalize(rootPath);
  if (!normalizedPath.endsWith(path.sep)) {
    return normalizedPath + path.sep;
  }
  return normalizedPath;
}

function isPathValid(inputString: string): boolean {
  if (path.isAbsolute(inputString) === false) {
    return false;
  }

  // C:\\D:\\whatever will still be considered absolute.
  //  https://github.com/Nexus-Mods/Vortex/issues/14912
  const match = inputString.match(/([A-Z]:\\)/gm);
  if (match.length > 1) {
    return false;
  }

  return true;
}