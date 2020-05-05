import { IExtensionApi } from '../../types/IExtensionContext';
import { IDownload, IState } from '../../types/IState';
import { DataInvalid, ProcessCanceled, ServiceTemporarilyUnavailable, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { jsonRequest, rawRequest } from '../../util/network';
import { getSafe } from '../../util/storeHelper';
import { INVALID_FILENAME_RE, truthy, withTmpDir } from '../../util/util';

import { addLocalDownload } from '../download_management/actions/state';
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

const EXTENSION_FORMAT = '1_2';

const EXTENSION_URL = githubRawUrl('Nexus-Mods/Vortex', 'announcements', `extensions_${EXTENSION_FORMAT}.json`);

function getAllDirectories(searchPath: string): Promise<string[]> {
  return fs.readdirAsync(searchPath)
    .filter(fileName =>
      fs.statAsync(path.join(searchPath, fileName))
        .then(stat => stat.isDirectory()));
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
  return fs.readFileAsync(path.join(extensionPath, 'info.json'), { encoding: 'utf-8' })
    .then(info => {
      const data: IExtension = JSON.parse(info);
      data.path = extensionPath;
      const id = data.id || path.basename(extensionPath, '.installing');
      return {
        id,
        info: applyExtensionInfo(id, bundled, data, fallback),
      };
    })
    .catch(() => {
      const id = path.basename(extensionPath, '.installing');
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

  return Promise.join(readExtensionDir(bundledPath, true),
                      readExtensionDir(extensionsPath, false))
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
  return Promise.resolve(jsonRequest<IExtensionManifest>(EXTENSION_URL))
    .then(manifest => manifest.extensions.filter(ext => ext.name !== undefined))
    .tap(extensions =>
      fs.writeFileAsync(cachePath,
                        JSON.stringify({ extensions }, undefined, 2),
                        { encoding: 'utf8' }));
}

function doFetchAvailableExtensions(forceDownload: boolean)
                                    : Promise<{ time: Date, extensions: IAvailableExtension[] }> {
  const cachePath = path.join(getVortexPath('temp'), 'extensions.json');
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
    .then(needsDownload => needsDownload
        ? downloadExtensionList(cachePath)
        : fs.readFileAsync(cachePath, { encoding: 'utf8' })
          .then(data => {
            try {
              return JSON.parse(data).extensions;
            } catch (err) {
              return Promise.reject(
                new DataInvalid('Extension cache invalid, please try again later'));
            }
          }))
    .catch({ code: 'ENOENT' }, () => downloadExtensionList(cachePath))
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
    dlPromise = Promise.reject(new ProcessCanceled('Failed to download'));
  }

  return dlPromise
    .then((dlIds: string[]) => {
      const state: IState = api.store.getState();

      if ((dlIds === undefined) || (dlIds.length !== 1)) {
        return Promise.reject(new ProcessCanceled('No download found'));
      }
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
        text: 'Failed to install the extension, please check the notifications.',
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
        text: 'Failed to install the extension',
        message: err.stack,
      }, [
        { label: 'Close' },
      ]);
      return Promise.resolve(false);
    });
}

export function downloadFromNexus(api: IExtensionApi,
                                  ext: IExtensionDownloadInfo)
                                  : Promise<string[]> {
  return api.emitAndAwait('nexus-download', SITE_ID, ext.modId, ext.fileId);
}

export function downloadGithubRelease(api: IExtensionApi,
                                      ext: IExtensionDownloadInfo)
                                  : Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    api.events.emit('start-download', [ext.githubRelease], { game: SITE_ID }, undefined,
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
    }, 'never');
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

export function downloadGithubRaw(api: IExtensionApi,
                                  ext: IExtensionDownloadInfo)
                                  : Promise<string[]> {
  const archiveName = ext['version'] !== undefined
    ? `${ext.githubRawPath}_${ext['version']}.7z`
    : `${ext.githubRawPath}.7z`;

  const state: IState = api.store.getState();
  const downloadPath = downloadPathForGame(state, SITE_ID);

  const { files } = state.persistent.downloads;
  const existing = Object.keys(files).find(dlId =>
    files[dlId].game.includes(SITE_ID) && files[dlId].localPath === archiveName);

  // the only plausible reason the file could already exist is if a previous install failed
  // or if we don't know the version. We could create a new new, numbered, download, but considering
  // these are small files I think that is more likely to frustrate the user
  const cleanProm: Promise<void> = existing !== undefined
    ? fs.removeAsync(path.join(downloadPath, archiveName))
      .then(() => { api.events.emit('remove-download', existing); })
    : Promise.resolve();

  return cleanProm.then(() => withTmpDir((tmpPath: string) => {
    const archivePath = path.join(tmpPath, archiveName);

    const apiUrl = githubApiUrl(ext.github, 'contents', ext.githubRawPath);

    return Promise.resolve(rawRequest(apiUrl, { encoding: 'utf8' }))
      .then((content: string) => {
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
          if ((typeof(data) === 'object') && (data.message !== undefined)) {
            return Promise.reject(new ServiceTemporarilyUnavailable(data.message));
          } else {
            log('info', 'unexpected response from github', content);
            return Promise.reject(new Error('Unexpected response from github (see log file)'));
          }
        }

        const repoFiles: string[] =
          data.filter(iter => iter.type === 'file').map(iter => iter.name);

        return Promise.map(repoFiles, fileName => downloadFile(
          githubRawUrl(ext.github, GAMES_BRANCH, `${ext.githubRawPath}/${fileName}`),
          path.join(tmpPath, fileName)))
          .then(() => {
            const pack = new SevenZip();
            return pack.add(archivePath, repoFiles.map(fileName => path.join(tmpPath, fileName)));
          })
          .then(() => fs.moveAsync(archivePath, path.join(downloadPath, archiveName)))
          .then(() => {
            const archiveId = shortid();
            api.store.dispatch(addLocalDownload(archiveId, SITE_ID, archiveName, 0));
            return [archiveId];
          });
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
