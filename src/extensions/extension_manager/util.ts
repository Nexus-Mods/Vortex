import { IExtensionApi } from '../../types/IExtensionContext';
import { IDownload, IState } from '../../types/IState';
import { DataInvalid, ProcessCanceled, ServiceTemporarilyUnavailable, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { writeFileAtomic } from '../../util/fsAtomic';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { jsonRequest, rawRequest } from '../../util/network';
import { getSafe } from '../../util/storeHelper';
import { INVALID_FILENAME_RE, truthy } from '../../util/util';

import { addLocalDownload, setDownloadModInfo } from '../download_management/actions/state';
import { AlreadyDownloaded } from '../download_management/DownloadManager';
import { downloadPathForGame } from '../download_management/selectors';
import { SITE_ID } from '../gamemode_management/constants';

import installExtension from './installExtension';
import { ExtensionType, IAvailableExtension, IExtension,
         IExtensionDownloadInfo, IExtensionManifest, ISelector } from './types';

import Promise from 'bluebird';
import * as _ from 'lodash';
import SevenZip from 'node-7z';
import * as path from 'path';
import { SemVer } from 'semver';
import { generate as shortid } from 'shortid';

const caches: {
  __availableExtensions?: Promise<{ time: Date, extensions: IAvailableExtension[] }>,
  __installedExtensions?: Promise<{ [extId: string]: IExtension }>,
} = {};

// don't fetch more than once per hour
const UPDATE_FREQUENCY = 60 * 60 * 1000;
const GAMES_BRANCH = 'release';

function githubApiUrl(repo: string, api: string, args: string) {
  return `https://api.github.com/repos/${repo}/${api}/${args}`;
}

function githubRawUrl(repo: string, branch: string, repoPath: string) {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${repoPath}`;
}

//const EXTENSION_FORMAT = '1_8';
const EXTENSION_FILENAME = `extensions-manifest.json`;
const EXTENSION_PATH = 'out/';
const EXTENSION_URL = githubRawUrl('Nexus-Mods/Vortex-Backend', 'main', EXTENSION_PATH + EXTENSION_FILENAME);

function getAllDirectories(searchPath: string): Promise<string[]> {
  return fs.readdirAsync(searchPath)
    .filter((fileName: string) => {
      if (path.extname(fileName) === '.installing') {
        // ignore directories during installation
        return Promise.resolve(false);
      }
      return fs.statAsync(path.join(searchPath, fileName))
        .then(stat => stat.isDirectory())
        .catch(err => {
          if (err.code !== 'ENOENT') {
            log('error', 'failed to stat file/directory', {
              searchPath, fileName, error: err.message,
            });
          }
          // the stat may fail if the directory has been removed/renamed between reading the dir
          // and the stat. Specifically this can happen while installing an extension for the
          // temporary ".installing" directory
          return Promise.resolve(false);
        });
    })
    .catch({ code: 'ENOENT' }, () => []);
}

function applyExtensionInfo(id: string, bundled: boolean, values: any, fallback: any): IExtension {
  const res = {
    name: values.name || fallback.name || id,
    author: values.author || fallback.author || 'Unknown',
    version: values.version || fallback.version || '0.0.0',
    description: values.description || fallback.description || 'Missing',
  };

  // add optional settings if we have them
  const add = (key: string, value: any, fallbackValue: any) => {
    if (value !== undefined) {
      res[key] = value;
    } else if (fallbackValue !== undefined) {
      res[key] = fallbackValue;
    }
  };

  add('type', values.type, fallback.type);
  add('path', values.path, fallback.path);
  add('bundled', bundled, undefined);
  add('modId', values.modId, fallback.modId);

  return res;
}

export function selectorMatch(ext: IAvailableExtension, selector: ISelector): boolean {
  if (selector === undefined) {
    return false;
  } else if (truthy(selector.modId)) {
    return ext.modId === selector.modId;
  } else if (truthy(selector.githubRawPath)) {
    return (ext.github === selector.github) && (ext.githubRawPath === selector.githubRawPath);
  } else {
    return (ext.github === selector.github);
  }
}

export function sanitize(input: string): string {
  return input.replace(INVALID_FILENAME_RE, '_');
}

export function readExtensionInfo(extensionPath: string,
                                  bundled: boolean,
                                  fallback: any = {}): Promise<{ id: string, info: IExtension }> {
  const finalPath = extensionPath.replace(/\.installing$/, '');

  return fs.readFileAsync(path.join(extensionPath, 'info.json'), { encoding: 'utf-8' })
    .then(info => {
      const data: IExtension = JSON.parse(info);
      data.path = finalPath;
      const id = data.id || path.basename(finalPath);
      return {
        id,
        info: applyExtensionInfo(id, bundled, data, fallback),
      };
    })
    .catch(() => {
      const id = path.basename(finalPath);
      return {
        id,
        info: applyExtensionInfo(id, bundled, {}, fallback),
      };
    });
}

function readExtensionDir(pluginPath: string,
                          bundled: boolean)
                          : Promise<Array<{ id: string, info: IExtension }>> {
  return getAllDirectories(pluginPath)
    .map((extPath: string) => path.join(pluginPath, extPath))
    .map((fullPath: string) => readExtensionInfo(fullPath, bundled));
}

export function readExtensions(force: boolean): Promise<{ [extId: string]: IExtension }> {
  if ((caches.__installedExtensions === undefined) || force) {
    caches.__installedExtensions = doReadExtensions();
  }
  return caches.__installedExtensions;
}

function doReadExtensions(): Promise<{ [extId: string]: IExtension }> {
  const bundledPath = getVortexPath('bundledPlugins');
  const extensionsPath = path.join(getVortexPath('userData'), 'plugins');

  return Promise.all([readExtensionDir(bundledPath, true),
                      readExtensionDir(extensionsPath, false)])
    .then(extLists => [].concat(...extLists))
    .reduce((prev, value: { id: string, info: IExtension }) => {
      prev[value.id] = value.info;
      return prev;
    }, {})
    ;
}

export function fetchAvailableExtensions(forceCache: boolean, forceDownload: boolean = false)
    : Promise<{ time: Date, extensions: IAvailableExtension[] }> {
  if ((caches.__availableExtensions === undefined) || forceCache || forceDownload) {
    caches.__availableExtensions = doFetchAvailableExtensions(forceDownload);
  }
  return caches.__availableExtensions;
}

function downloadExtensionList(cachePath: string): Promise<IAvailableExtension[]> {
  log('info', 'downloading extension list', { url: EXTENSION_URL });
  return Promise.resolve(jsonRequest<IExtensionManifest>(EXTENSION_URL))
    .then(manifest => {
      log('debug', 'extension list received');
      return manifest.extensions.filter(ext => ext.name !== undefined);
    })
    .tap(extensions => writeFileAtomic(cachePath, JSON.stringify({ extensions }, undefined, 2)))
    .tapCatch(err => log('error', 'failed to download extension list', err));
  }

function doFetchAvailableExtensions(forceDownload: boolean)
                                    : Promise<{ time: Date, extensions: IAvailableExtension[] }> {
  const cachePath = path.join(getVortexPath('temp'), EXTENSION_FILENAME);
  let time = new Date();

  const checkCache = forceDownload
    ? Promise.resolve(true)
    : fs.statAsync(cachePath).then(stat => {
      if ((Date.now() - stat.mtimeMs) > UPDATE_FREQUENCY) {
        return true;
      } else {
        time = stat.mtime;
        return false;
      }
    });

  return checkCache
    .then(needsDownload => {
      if (needsDownload) {
        log('info', 'extension list outdated, will update');
      } else {
        log('info', 'extension list up-to-date');
      }
      return needsDownload
        ? downloadExtensionList(cachePath)
        : fs.readFileAsync(cachePath, { encoding: 'utf8' })
          .then(data => {
            try {
              return JSON.parse(data).extensions;
            } catch (err) {
              return Promise.reject(
                new DataInvalid('Extension cache invalid, please try again later'));
            }
          });
    })
    .catch({ code: 'ENOENT' }, () => {
      log('info', 'extension list missing, will update');
      return downloadExtensionList(cachePath);
    })
    .catch(err => {
      log('error', 'failed to fetch list of extensions', err);
      return Promise.resolve([]);
    })
    .filter((ext: IAvailableExtension) => ext.description !== undefined)
    .then(extensions => ({ time, extensions }));
}

export function downloadAndInstallExtension(api: IExtensionApi,
                                            ext: IExtensionDownloadInfo)
                                            : Promise<boolean> {
  let download: IDownload;

  let dlPromise: Promise<string[]>;

  if (truthy(ext.modId)) {
    dlPromise = downloadFromNexus(api, ext);
  } else if (truthy(ext.githubRawPath)) {
    dlPromise = downloadGithubRaw(api, ext);
  } else if (truthy(ext.githubRelease)) {
    dlPromise = downloadGithubRelease(api, ext);
  } else {
    // don't report an error if the extension list contains invalid data
    return Promise.resolve(false);
  }

  const sourceName: string = truthy(ext.modId)
    ? 'nexusmods.com'
    : 'github.com';

  return dlPromise
    .then((dlIds: string[]) => {
      const state: IState = api.store.getState();

      if ((dlIds === undefined) || (dlIds.length !== 1)) {
        return Promise.reject(new ProcessCanceled('No download found'));
      }
      api.store.dispatch(setDownloadModInfo(dlIds[0], 'internal', true));
      download = getSafe(state, ['persistent', 'downloads', 'files', dlIds[0]], undefined);
      if (download === undefined) {
        return Promise.reject(new Error('Download not found'));
      }

      return fetchAvailableExtensions(false);
    })
    .then((availableExtensions: { time: Date, extensions: IAvailableExtension[] }) => {
      const extDetail = availableExtensions.extensions
        .find(iter => ((ext.modId === undefined) || (iter.modId === ext.modId))
                   && ((ext.fileId === undefined) || (iter.fileId === ext.fileId))
                   && (ext.name === iter.name));

      const info: IExtension = (extDetail !== undefined)
        ? {
          ..._.pick(extDetail, ['id', 'name', 'author', 'version', 'type']),
          bundled: false,
          description: extDetail.description.short,
          modId: ext.modId,
        }
        : undefined;

      const state: IState = api.store.getState();
      const downloadPath = downloadPathForGame(state, SITE_ID);
      return installExtension(api, path.join(downloadPath, download.localPath), info);
    })
    .then(() => Promise.resolve(true))
    .catch(UserCanceled, () => null)
    .catch(ProcessCanceled, () => {
      api.showDialog('error', 'Installation failed', {
        text: 'Failed to install the extension "{{extensionName}}" from "{{sourceName}}", '
            + 'please check the notifications.',
        parameters: {
          extensionName: ext.name,
          sourceName,
        },
        options: {
          hideMessage: true,
        },
      }, [
        { label: 'Close' },
      ]);
      return Promise.resolve(false);
    })
    .catch(ServiceTemporarilyUnavailable, err => {
      log('warn', 'Failed to download from github', { message: err.message });
      return Promise.resolve(false);
    })
    .catch(err => {
      api.showDialog('error', 'Installation failed', {
        text: 'Failed to install the extension "{{extensionName}}" from "{{sourceName}}"',
        parameters: {
          extensionName: ext.name,
          sourceName,
        },
        message: err.stack,
        options: {
          hideMessage: true,
        },
      }, [
        { label: 'Close' },
      ]);
      return Promise.resolve(false);
    });
}

const UPDATE_PREFIX = 'Vortex Extension Update -';

function archiveFileName(ext: IExtensionDownloadInfo): string {
  const name = ext.name.startsWith('Game:')
    ? ext.name.replace('Game:', UPDATE_PREFIX)
    : UPDATE_PREFIX + ' ' + ext.name;
  return (ext['version'] !== undefined)
    ? `${sanitize(name)} v${ext['version']}.7z`
    : `${sanitize(name)}.7z`;
}

export function downloadFromNexus(api: IExtensionApi,
                                  ext: IExtensionDownloadInfo)
                                  : Promise<string[]> {
  if ((ext.fileId === undefined) && (ext.modId !== undefined)) {
    const state = api.getState();
    const availableExt = state.session.extensions.available.find(iter => iter.modId === ext.modId);
    if (availableExt !== undefined) {
      ext.fileId = availableExt.fileId;
    } else {
      return Promise.reject(new Error('unavailable nexus extension'));
    }
  }

  log('debug', 'download from nexus', archiveFileName(ext));
  return api.emitAndAwait('nexus-download',
    SITE_ID, ext.modId, ext.fileId, archiveFileName(ext), false);
}

export function downloadGithubRelease(api: IExtensionApi,
                                      ext: IExtensionDownloadInfo)
                                  : Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    api.events.emit('start-download', [ext.githubRelease], { game: SITE_ID }, archiveFileName(ext),
                    (err: Error, dlId: string) => {
      if (err !== null) {
        if (err instanceof AlreadyDownloaded) {
          const state = api.getState();
          const downloads = state.persistent.downloads.files;
          const existingId = Object.keys(downloads).find(iter =>
            downloads[iter].localPath === err.fileName);

          return (existingId !== undefined)
            ? resolve([existingId])
            : reject(err);
        }
        return reject(err);
      } else {
        return resolve([dlId]);
      }
    }, 'always', { allowInstall: false });
  })
  .catch(AlreadyDownloaded, (err: AlreadyDownloaded) => {
    const state = api.getState();
    const downloads = state.persistent.downloads.files;
    const dlId = Object.keys(downloads).find(iter => downloads[iter].localPath === err.fileName);
    return [dlId];
  });
}

export function downloadFile(url: string, outputPath: string): Promise<void> {
  return Promise.resolve(rawRequest(url))
    .then((data: Buffer) => fs.writeFileAsync(outputPath, data));
}

function downloadGithubRawRecursive(repo: string, source: string, destination: string) {
  const apiUrl = githubApiUrl(repo, 'contents', source) + '?ref=' + GAMES_BRANCH;

  return Promise.resolve(rawRequest(apiUrl, { encoding: 'utf8' }))
    .then((content: string) => {
      const data = JSON.parse(content);
      if (!Array.isArray(data)) {
        if ((typeof (data) === 'object') && (data.message !== undefined)) {
          return Promise.reject(new ServiceTemporarilyUnavailable(data.message));
        } else {
          log('info', 'unexpected response from github', content);
          return Promise.reject(new Error('Unexpected response from github (see log file)'));
        }
      }

      const repoFiles: string[] =
        data.filter(iter => iter.type === 'file').map(iter => iter.name);

      const repoDirs: string[] =
        data.filter(iter => iter.type === 'dir').map(iter => iter.name);

      return Promise.map(repoFiles, fileName => downloadFile(
        githubRawUrl(repo, GAMES_BRANCH, `${source}/${fileName}`),
                     path.join(destination, fileName)))
        .then(() => Promise.map(repoDirs, fileName => {
          const sourcePath = `${source}/${fileName}`;
          const outPath = path.join(destination, fileName);
          return fs.mkdirAsync(outPath)
            .then(() => downloadGithubRawRecursive(repo, sourcePath, outPath));
        }));
    });
}

export function downloadGithubRaw(api: IExtensionApi,
                                  ext: IExtensionDownloadInfo)
                                  : Promise<string[]> {
  const state: IState = api.store.getState();
  const downloadPath = downloadPathForGame(state, SITE_ID);

  const archiveName = archiveFileName(ext);

  const { files } = state.persistent.downloads;
  const existing = Object.keys(files).find(dlId =>
    (files[dlId].game ?? []).includes(SITE_ID) && files[dlId].localPath === archiveName);

  // the only plausible reason the file could already exist is if a previous install failed
  // or if we don't know the version. We could create a new new, numbered, download, but considering
  // these are small files I think that is more likely to frustrate the user
  const cleanProm: Promise<void> = existing !== undefined
    ? fs.removeAsync(path.join(downloadPath, archiveName))
      .then(() => { api.events.emit('remove-download', existing); })
    : Promise.resolve();

  return cleanProm.then(() => fs.withTmpDir((tmpPath: string) => {
    const archivePath = path.join(tmpPath, archiveName);

    return downloadGithubRawRecursive(ext.github, ext.githubRawPath, tmpPath)
      .then(() => {
        return fs.readdirAsync(tmpPath);
      })
      .then((repoFiles: string[]) => {
        const pack = new SevenZip();
        return pack.add(archivePath, repoFiles.map(fileName => path.join(tmpPath, fileName)));
      })
      .then(() => fs.moveAsync(archivePath, path.join(downloadPath, archiveName)))
      .then(() => {
        const archiveId = shortid();
        api.store.dispatch(addLocalDownload(archiveId, SITE_ID, archiveName, 0));
        return [archiveId];
      });
  }));
}

export function readExtensibleDir(extType: ExtensionType, bundledPath: string, customPath: string) {
  const readBaseDir = (baseName: string): Promise<string[]> => {
    return fs.readdirAsync(baseName)
      .filter((name: string) => fs.statAsync(path.join(baseName, name))
        .then(stats => stats.isDirectory()))
      .map((name: string) => path.join(baseName, name))
      .catch({ code: 'ENOENT' }, () => []);
  };

  return readExtensions(false)
    .then(extensions => {
      const extDirs = Object.keys(extensions)
        .filter(extId => extensions[extId].type === extType)
        .map(extId => extensions[extId].path);

      return Promise.join(
        readBaseDir(bundledPath),
        ...extDirs.map(extPath => readBaseDir(extPath)),
        readBaseDir(customPath),
        );
    })
    .then(lists => [].concat(...lists));
}
