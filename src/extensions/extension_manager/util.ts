import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import { IExtension } from './types';
import { INVALID_FILENAME_RE } from '../../util/util';

function getAllDirectories(searchPath: string): Promise<string[]> {
  return fs.readdirAsync(searchPath)
    .filter(fileName =>
      fs.statAsync(path.join(searchPath, fileName))
        .then(stat => stat.isDirectory()));
}

function applyExtensionInfo(id: string, bundled: boolean, values: any): IExtension {
  return {
    name: values.name || id,
    author: values.author || 'Unknown',
    version: values.version || '0.0.0',
    description: values.description || 'Missing',
    bundled,
  };
}

export function sanitize(input: string): string {
  return input.replace(INVALID_FILENAME_RE, '_');
}

export function readExtensionInfo(extensionPath: string,
                                  bundled: boolean): Promise<{ id: string, info: IExtension }> {
  return fs.readFileAsync(path.join(extensionPath, 'info.json'), { encoding: 'utf-8' })
    .then(info => {
      const data: IExtension = JSON.parse(info);
      const id = sanitize(data.name);
      return {
        id, info: applyExtensionInfo(id, bundled, data),
      };
    })
    .catch(() => {
      const id = path.basename(extensionPath);
      return {
        id, info: applyExtensionInfo(id, bundled, {}),
      }
    });
}

function readExtensionDir(pluginPath: string, bundled: boolean) {
  return getAllDirectories(pluginPath)
    .map((extPath: string) => path.join(pluginPath, extPath))
    .map((fullPath: string) => readExtensionInfo(fullPath, bundled));
}

export function readExtensions(): Promise<{ [extId: string]: IExtension }> {
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

export interface IAvailableExtension {
  name: string;
  description: {
    short: string;
    long: string;
  };
  image: string;
  author: string;
  version: string;
  modId: number;
  fileId: number;
  downloads: number;
  endorsements: number;
  tags: string[];
}

export function fetchAvailableExtensions(): Promise<IAvailableExtension[]> {
  return fs.readFileAsync('extensions.json', { encoding: 'utf-8' })
    .then(data => JSON.parse(data));
}