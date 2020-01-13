import { removeExtension } from '../../actions';
import { IExtensionApi } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { INVALID_FILENAME_RE } from '../../util/util';

import { ExtensionType, IExtension } from './types';
import { readExtensionInfo } from './util';

import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as _ from 'lodash';
import ZipT = require('node-7z');
import * as path from 'path';
import rimraf from 'rimraf';
import { dynreq } from 'vortex-run';

const app = appIn || remote.app;

const rimrafAsync: (removePath: string, options: any) => Promise<void> = Promise.promisify(rimraf);

class ContextProxyHandler implements ProxyHandler<any> {
  private mDependencies: string[] = [];

  public get(target, key: PropertyKey): any {
    if (key === 'requireExtension') {
      return (dependencyId: string) => {
        this.mDependencies.push(dependencyId);
      };
    } else {
      return () => undefined;
    }
  }

  public get dependencies(): string[] {
    return this.mDependencies;
  }
}

function installExtensionDependencies(api: IExtensionApi, extPath: string): Promise<void> {
  const handler = new ContextProxyHandler();
  const context = new Proxy({}, handler);

  try {
    const extension = dynreq(path.join(extPath, 'index.js'));

    extension.default(context);

    const state: IState = api.store.getState();

    return Promise.map(handler.dependencies, depId => {
      const ext = state.session.extensions.available.find(iter =>
        (!iter.type && ((iter.name === depId) || (iter.id === depId))));

      if (ext !== undefined) {
        return api.emitAndAwait('install-extension', ext);
      } else {
        return Promise.resolve();
      }
    })
    .then(() => null);
  } catch (err) {
    return Promise.reject(err);
  }
}

function sanitize(input: string): string {
  return input.replace(INVALID_FILENAME_RE, '_');
}

function removeOldVersion(api: IExtensionApi, info: IExtension): Promise<void> {
  const state: IState = api.store.getState();
  const { installed }  = state.session.extensions;

  // should never be more than one but let's handle multiple to be safe
  const previousVersions = Object.keys(installed)
    .filter(key => (info.id !== undefined) && (installed[key].id === info.id)
                || (info.modId !== undefined) && (installed[key].modId === info.modId)
                || (installed[key].name === info.name));
  log('info', 'removing previous versions of the extension', previousVersions);

  previousVersions.forEach(key => api.store.dispatch(removeExtension(key)));
  return Promise.resolve();
}

function installExtension(api: IExtensionApi,
                          archivePath: string,
                          info?: IExtension): Promise<void> {
  const extensionsPath = path.join(app.getPath('userData'), 'plugins');
  let destPath: string;
  const tempPath = path.join(extensionsPath, path.basename(archivePath)) + '.installing';

  const Zip: typeof ZipT = require('node-7z');
  const extractor = new Zip();

  let type: ExtensionType;

  return extractor.extractFull(archivePath, tempPath, {ssc: false}, () => undefined,
                        () => undefined)
      .then(() => readExtensionInfo(tempPath, false, info))
      // merge the caller-provided info with the stuff parsed from the info.json file because there
      // is data we may only know at runtime (e.g. the modId)
      .then(manifestInfo => ({
        id: manifestInfo.id,
        info: { ...(manifestInfo.info || {}), ...(info || {}) },
      }))
      .catch({ code: 'ENOENT' }, () => (info !== undefined)
        ? Promise.resolve({ id: path.basename(tempPath, '.installing'), info })
        : Promise.reject(new Error('not an extension, info.json missing')))
      .then(manifestInfo =>
        // update the manifest on disc, in case we had new info from the caller
        fs.writeFileAsync(path.join(tempPath, 'info.json'),
                          JSON.stringify(manifestInfo.info, undefined, 2))
          .then(() => manifestInfo))
      .then((manifestInfo: { id: string, info: IExtension }) => {
        const dirName = sanitize(manifestInfo.id);
        destPath = path.join(extensionsPath, dirName);
        type = manifestInfo.info.type;
        return removeOldVersion(api, manifestInfo.info);
      })
      // we don't actually expect the output directory to exist
      .then(() => fs.removeAsync(destPath))
      .then(() => fs.renameAsync(tempPath, destPath))
      .then(() => {
        if (type === 'translation') {
          return fs.readdirAsync(destPath)
            .map(entry => fs.statAsync(path.join(destPath, entry))
              .then(stat => ({ name: entry, stat })))
            .then(() => null);
        } else if (type === 'theme') {
          return Promise.resolve();
        } else {
          return installExtensionDependencies(api, destPath);
        }
      })
      .catch(err =>
        rimrafAsync(tempPath, { glob: false })
        .then(() => Promise.reject(err)));
}

export default installExtension;
