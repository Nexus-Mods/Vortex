import { createHash } from 'crypto';
import path from 'path';
import { TFunction } from 'react-i18next';
import { pathToFileURL } from 'url';
import { fs, log, types, util } from 'vortex-api';
import * as winapi from 'winapi-bindings';

import { isConfigEmpty } from './nmmVirtualConfigParser';
import { ModsCapacityMap, ICapacityInfo } from '../types/capacityTypes';
import { IModEntry, ModsMap, ProgressCB } from '../types/nmmEntries';

// Doesn't seem to be used any longer, but going to keep it here just in case we need it one day.
const _LINKS = {
  // tslint:disable-next-line: max-line-length
    TO_CONSIDER: 'https://wiki.nexusmods.com/index.php/Importing_from_Nexus_Mod_Manager:_Things_to_consider',
  // tslint:disable-next-line: max-line-length
    UNMANAGED: 'https://wiki.nexusmods.com/index.php/Importing_from_Nexus_Mod_Manager:_Things_to_consider#Unmanaged_Files',
  // tslint:disable-next-line: max-line-length
    FILE_CONFLICTS: 'https://wiki.nexusmods.com/index.php/File_Conflicts:_Nexus_Mod_Manager_vs_Vortex',
    MANAGE_CONFLICTS: 'https://wiki.nexusmods.com/index.php/Managing_File_Conflicts',
    DOCUMENTATION: 'https://wiki.nexusmods.com/index.php/Category:Vortex',
};
  

// Used to reduce the amount of detected free space by 500MB.
//  This is done to avoid situations where the user may be left
//  with no disk space after the import process is finished.
const MIN_DISK_SPACE_OFFSET = (500 * (1e+6));

// Set of known/acceptable archive extensions.
const archiveExtLookup = new Set<string>([
  '.zip', '.7z', '.rar', '.bz2', '.bzip2', '.gz', '.gzip', '.xz', '.z',
]);

export function getCategoriesFilePath(modsPath: string) {
  return path.join(modsPath, 'categories', 'Categories.xml');
}

export function getVirtualConfigFilePath(source: string) {
  return path.join(source, 'VirtualInstall', 'VirtualModConfig.xml');
}

export async function calculateArchiveSize(mod: IModEntry): Promise<number> {
  try {
    const stats = await fs.statAsync(path.join(mod.archivePath, mod.modFilename));
    return Promise.resolve(stats.size);
  } catch (err) {
    return (err instanceof util.UserCanceled)
      ? Promise.resolve(0)
      : Promise.reject(err);
  }
}

export function getCapacityInformation(dirPath: string): ICapacityInfo {
  const rootPath = winapi.GetVolumePathName(dirPath);
  // It is beyond the scope of the disk space calculation logic to check or ensure
  //  that the installation/download paths exist (this should've been handled before this
  //  stage);
  //  reason why we're simply going to use the root paths for the calculation.
  //
  //  This is arguably a band-aid fix for https://github.com/Nexus-Mods/Vortex/issues/2624;
  //  but the only reason why these folders would be missing in the first place is if they
  //  have been removed manually or by an external application WHILE Vortex is running!
  //
  //  The import process will create these directories when mod/archive files are copied over
  //  if they're missing.
  const totalFreeBytes = winapi.GetDiskFreeSpaceEx(rootPath).free - MIN_DISK_SPACE_OFFSET;
  return {
    rootPath,
    totalFreeBytes,
  }
}

export async function testAccess(t: TFunction, source: string): Promise<void> {
  // Technically we only need read access, we're going to
  //  run the MD5 hash generation logic on a random archive
  //  as that requires Vortex to open the file and that's as
  //  invasive as the import tool can get.
  //
  // If this fails, there's no point to continue the import
  //  process as it would just fail later down the line.
  if (source === undefined) {
    // How did we even get here ?
    return Promise.resolve();
  }

  const dirElements: string[] = await fs.readdirAsync(source)
    .filter(el => archiveExtLookup.has(path.extname(el)));
  if (dirElements.length === 0) {
    return Promise.resolve();
  }

  const filePath = path.join(path.join(source, dirElements[0]));
  try {
    await fileChecksum(filePath);
  } catch (err) {
    log('error', 'Failed to generate MD5 hash', err);
    return (err.code !== 'EPERM')
      ? Promise.reject(err)
      : Promise.reject(new Error(t('Vortex is unable to read/open one or more of '
        + 'your archives - please ensure you have full permissions to those files, and '
        + 'that NMM is not running in the background before trying again. '
        + 'Additionally, now would be a good time to add an exception for Vortex to '
        + 'your Anti-Virus software (if you have one)', { ns: 'common' })));
  }
}

export async function fileChecksum(filePath: string): Promise<string> {
  const stackErr = new Error();
  return new Promise<string>((resolve, reject) => {
    try {
      const hash = createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => {
        hash.update(data);
      });
      stream.on('end', () => {
        stream.close();
        stream.destroy();
        return resolve(hash.digest('hex'));
      });
      stream.on('error', (err) => {
        err.stack = stackErr.stack;
        reject(err);
      });
    } catch (err) {
      err.stack = stackErr.stack;
      reject(err);
    }
  });
}

export async function getArchives(source: string, parsedMods: { [id: string]: IModEntry }): Promise<string[]> {
  const knownArchiveExt = (filePath: string): boolean => (!!filePath)
    ? archiveExtLookup.has(path.extname(filePath).toLowerCase())
    : false;

  // Set of mod files which we already have meta information on.
  const modFileNames = new Set<string>(Object.keys(parsedMods)
    .map(key => parsedMods[key].modFilename));

  return fs.readdirAsync(source)
    .filter((filePath: string) => knownArchiveExt(filePath))
    .then((archives: string[]) => archives.filter(archive => !modFileNames.has(archive)))
    .catch((err: Error) => {
      this.nextState.error = err.message;
      return Promise.resolve([]);
    });
}

export function createModEntry(sourcePath: string,
  input: string,
  existingDownloads: Set<string>): Promise<IModEntry> {
  // Attempt to query cache/meta information from NMM and return a mod entry
  //  to use in the import process.
  const getInner = (ele: Element): string => {
    if ((ele !== undefined) && (ele !== null)) {
      const node = ele.childNodes[0];
      if (node !== undefined) {
        return node.nodeValue;
      }
    }
    return undefined;
  };

  const isDuplicate = () => {
    return (existingDownloads !== undefined)
      ? existingDownloads.has(input)
      : false;
  };

  const id = path.basename(input, path.extname(input));
  const cacheBasePath = path.resolve(sourcePath, 'cache', id);
  return fileChecksum(path.join(sourcePath, input))
    .then(md5 => fs.readFileAsync(path.join(cacheBasePath, 'cacheInfo.txt'))
      .then(data => {
        const fields = data.toString().split('@@');
        return fs.readFileAsync(path.join(cacheBasePath,
          (fields[1] === '-') ? '' : fields[1], 'fomod', 'info.xml'));
      })
      .then(infoXmlData => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(infoXmlData.toString(), 'text/xml');
        const modName = getInner(xmlDoc.querySelector('Name')) || id;
        const version = getInner(xmlDoc.querySelector('Version')) || '';
        const modId = getInner(xmlDoc.querySelector('Id')) || '';
        const downloadId = () => {
          try {
            return Number.parseInt(getInner(xmlDoc.querySelector('DownloadId')), 10);
          } catch (err) {
            return 0;
          }
        };

        return Promise.resolve({
          nexusId: modId,
          vortexId: '',
          downloadId: downloadId(),
          modName,
          modFilename: input,
          archivePath: sourcePath,
          modVersion: version,
          archiveMD5: md5,
          importFlag: true,
          isAlreadyManaged: isDuplicate(),
        });
      })
      .catch(err => {
        log('error', 'could not parse the mod\'s cache information', err);
        return Promise.resolve({
          nexusId: '',
          vortexId: '',
          downloadId: 0,
          modName: path.basename(input, path.extname(input)),
          modFilename: input,
          archivePath: sourcePath,
          modVersion: '',
          archiveMD5: md5,
          importFlag: true,
          isAlreadyManaged: isDuplicate(),
        });
      }));
}

export function isNMMRunning(): boolean {
  const processes = winapi.GetProcessList();
  const runningExes: { [exeId: string]: winapi.ProcessEntry } =
    processes.reduce((prev, entry) => {
      prev[entry.exeFile.toLowerCase()] = entry;
      return prev;
    }, {});

  return Object.keys(runningExes).find(key => key === 'nexusclient.exe') !== undefined;
}

export async function validate(source: string) {
  const res = await isConfigEmpty(path.join(source, 'VirtualInstall', 'VirtualModConfig.xml'));
  const nmmRunning = isNMMRunning();
  return Promise.resolve({
    nmmModsEnabled: !res,
    nmmRunning,
  });
}

export async function calculateModsCapacity(modList: IModEntry[], cb: (err: Error, mod: string) => void): Promise<ModsCapacityMap> {
  const modCapacityInfo: ModsCapacityMap = {};
  for (const mod of modList) {
    cb(null, mod.modFilename);
    try {
      const archiveSizeBytes = await calculateArchiveSize(mod);
      modCapacityInfo[mod.modFilename] = archiveSizeBytes;
    } catch (err) {
      cb(err, mod.modFilename);
      modCapacityInfo[mod.modFilename] = 0;
    }
  }
  return Promise.resolve(modCapacityInfo);
}

export async function generateModEntries(api: types.IExtensionApi,
                                         source: string[],
                                         parsedMods: ModsMap,
                                         cb: ProgressCB): Promise<ModsMap> {
  const state = api.getState();
  let existingDownloads: Set<string>;
  const downloads = util.getSafe(state, ['persistent', 'downloads', 'files'], undefined);
  if ((downloads !== undefined) && (Object.keys(downloads).length > 0)) {
    existingDownloads = new Set<string>(
      Object.keys(downloads).map(key => downloads[key].localPath));
  }
  const archives = await getArchives(source[0], parsedMods);
  const generated: ModsMap = {};
  for (const archive of archives) {
    const mod = await createModEntry(source[2], archive, existingDownloads);
    cb(null, mod.modFilename);
    generated[mod.modFilename] = mod;
  }
  return Promise.resolve(generated);
}

export function getLocalAssetUrl(fileName: string) {
  return pathToFileURL(path.join(__dirname, fileName)).href;
}
