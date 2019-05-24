import * as fs from '../../util/fs';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import ZipT = require('node-7z');
import * as path from 'path';
import * as rimraf from 'rimraf';
import { readExtensionInfo } from './util';

const app = appIn || remote.app;

const rimrafAsync: (removePath: string, options: any) => Promise<void> = Promise.promisify(rimraf);

function installExtension(archivePath: string): Promise<void> {
  const extensionsPath = path.join(app.getPath('userData'), 'plugins');
  let destPath: string;
  const tempPath = path.join(extensionsPath, path.basename(archivePath)) + '.installing';

  const Zip: typeof ZipT = require('node-7z');
  const extractor = new Zip();

  return extractor.extractFull(archivePath, tempPath, {ssc: false}, () => undefined,
                        () => undefined)
      .then(() => readExtensionInfo(tempPath, false))
      .catch(err => Promise.reject(new Error('not an extension, info.json missing')))
      .then(info => {
        destPath = path.join(extensionsPath, info.id)
        return fs.removeAsync(destPath)
      })
      .then(() => fs.renameAsync(tempPath, destPath))
      .catch(err =>
        rimrafAsync(tempPath, { glob: false })
        .then(() => Promise.reject(err)));
}

export default installExtension;
