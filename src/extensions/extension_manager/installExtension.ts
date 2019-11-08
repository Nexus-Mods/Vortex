import * as fs from '../../util/fs';

import { ExtensionType, IExtension } from './types';
import { readExtensionInfo } from './util';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as _ from 'lodash';
import ZipT = require('node-7z');
import * as path from 'path';
import * as rimraf from 'rimraf';

const app = appIn || remote.app;

const rimrafAsync: (removePath: string, options: any) => Promise<void> = Promise.promisify(rimraf);

function installExtension(archivePath: string, info?: IExtension): Promise<void> {
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
        destPath = path.join(extensionsPath, manifestInfo.id);
        type = manifestInfo.info.type;
        return fs.removeAsync(destPath);
      })
      .then(() => fs.renameAsync(tempPath, destPath))
      .then(() => {
        if (type === 'translation') {
          return fs.readdirAsync(destPath)
            .map(entry => fs.statAsync(path.join(destPath, entry))
              .then(stat => ({ name: entry, stat })))
            .then(() => null);
        } else {
          return Promise.resolve();
        }
      })
      .catch(err =>
        rimrafAsync(tempPath, { glob: false })
        .then(() => Promise.reject(err)));
}

export default installExtension;
