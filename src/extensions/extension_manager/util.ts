import { IExtensionApi } from '../../types/IExtensionContext';
import { IDownload, IState } from '../../types/IState';
import { ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import { jsonRequest } from '../../util/network';
import { getSafe } from '../../util/storeHelper';
import { INVALID_FILENAME_RE } from '../../util/util';

import { downloadPathForGame } from '../download_management/selectors';

import installExtension from './installExtension';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as _ from 'lodash';
import * as path from 'path';
import { ExtensionType, IAvailableExtension, IExtension,
         IExtensionDownloadInfo, IExtensionManifest } from './types';

const caches: {
  __availableExtensions?: Promise<IAvailableExtension[]>,
  __installedExtensions?: Promise<{ [extId: string]: IExtension }>,
} = {};

const EXTENSIONS_URL =
  'https://raw.githubusercontent.com/Nexus-Mods/Vortex/announcements/extensions.json';

function getAllDirectories(searchPath: string): Promise<string[]> {
  return fs.readdirAsync(searchPath)
    .filter(fileName =>
      fs.statAsync(path.join(searchPath, fileName))
        .then(stat => stat.isDirectory()));
}

function applyExtensionInfo(id: string, bundled: boolean, values: any): IExtension {
  const res = {
    name: values.name || id,
    author: values.author || 'Unknown',
    version: values.version || '0.0.0',
    description: values.description || 'Missing',
  };

  // add optional settings if we have them
  const add = (key: string, value: any) => {
    if (value !== undefined) {
      res[key] = value;
    }
  };

  add('type', values.type);
  add('path', values.path);
  add('bundled', bundled);
  add('modId', values.modId);

  return res;
}

export function sanitize(input: string): string {
  return input.replace(INVALID_FILENAME_RE, '_');
}

export function readExtensionInfo(extensionPath: string,
                                  bundled: boolean): Promise<{ id: string, info: IExtension }> {
  return fs.readFileAsync(path.join(extensionPath, 'info.json'), { encoding: 'utf-8' })
    .then(info => {
      const data: IExtension = JSON.parse(info);
      data.path = extensionPath;
      const id = path.basename(extensionPath, '.installing');
      return {
        id,
        info: applyExtensionInfo(id, bundled, data),
      };
    })
    .catch(() => {
      const id = path.basename(extensionPath, '.installing');
      return {
        id,
        info: applyExtensionInfo(id, bundled, {}),
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
  const extensionsPath = path.join(remote.app.getPath('userData'), 'plugins');

  return Promise.join(readExtensionDir(bundledPath, true),
                      readExtensionDir(extensionsPath, false))
    .then(extLists => [].concat(...extLists))
    .reduce((prev, value: { id: string, info: IExtension }) => {
      prev[value.id] = value.info;
      return prev;
    }, {});
}

export function fetchAvailableExtensions(force: boolean): Promise<IAvailableExtension[]> {
  if ((caches.__availableExtensions === undefined) || force) {
    caches.__availableExtensions = doFetchAvailableExtensions();
  }
  return caches.__availableExtensions;
}

function doFetchAvailableExtensions(): Promise<IAvailableExtension[]> {
  return Promise.resolve(jsonRequest<IExtensionManifest>(EXTENSIONS_URL))
    .then(manifest => manifest.extensions.filter(ext => ext.name !== undefined));
  /*return fs.readFileAsync(path.join(__dirname, 'extensions.json'), { encoding: 'utf8' })
    .then(data => JSON.parse(data).extensions.filter(ext => ext.name !== undefined));*/
}

export function downloadAndInstallExtension(api: IExtensionApi,
                                            ext: IExtensionDownloadInfo)
                                            : Promise<boolean> {
  let download: IDownload;

  return api.emitAndAwait('nexus-download', 'site', ext.modId, ext.fileId)
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
    .then(availableExtensions => {
      const extDetail = availableExtensions
        .find(iter => (iter.modId === ext.modId) && (iter.fileId === ext.fileId));

      const info: IExtension = (extDetail !== undefined)
        ? {
          ..._.pick(extDetail, ['name', 'author', 'version', 'type']),
          bundled: false,
          description: extDetail.description.short,
          modId: ext.modId,
        }
        : undefined;

      const state: IState = api.store.getState();
      const downloadPath = downloadPathForGame(state, 'site');
      return installExtension(path.join(downloadPath, download.localPath), info);
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

export function readExtensibleDir(extType: ExtensionType, bundledPath: string, customPath: string) {
  const readBaseDir = (baseName: string): Promise<string[]> => {
    return fs.readdirAsync(baseName)
      .filter(name => fs.statAsync(path.join(baseName, name)).then(stats => stats.isDirectory()))
      .map(name => path.join(baseName, name));
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
