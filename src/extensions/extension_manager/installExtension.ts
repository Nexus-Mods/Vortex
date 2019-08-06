import * as fs from '../../util/fs';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import ZipT = require('node-7z');
import * as path from 'path';
import * as rimraf from 'rimraf';
import { readExtensionInfo } from './util';
import { IExtension, ExtensionType } from './types';

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
      .then(() => fs.statAsync(path.join(tempPath, 'info.json'))
        .catch({ code: 'ENOENT'}, err => (info !== undefined)
          // if the extension contains no info.json but we have that info from the caller,
          // write it to info.json and use that
          ? fs.writeFileAsync(path.join(tempPath, 'info.json'), JSON.stringify(info, undefined, 2),
                              { encoding: 'utf-8' })
          : Promise.reject(err)))
      .then(() => readExtensionInfo(tempPath, false))
      .catch(() => Promise.reject(new Error('not an extension, info.json missing')))
      .then(info => {
        destPath = path.join(extensionsPath, info.id)
        type = info.info.type;
        return fs.removeAsync(destPath)
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
