import * as fs from '../../util/fs';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import ZipT = require('node-7z');
import * as path from 'path';
import * as rimraf from 'rimraf';

const app = appIn || remote.app;

type rimrafType = (path: string, options: any, callback: (err?) => void) => void;
const rimrafAsync: (removePath: string, options: any) => Promise<void> = Promise.promisify(rimraf);

function installExtension(archivePath: string): Promise<void> {
  const extensionsPath = path.join(app.getPath('userData'), 'plugins');
  const destPath = path.join(extensionsPath, path.basename(archivePath, path.extname(archivePath)));
  const tempPath = destPath + '.installing';

  const Zip: typeof ZipT = require('node-7z');
  const extractor = new Zip();

  return extractor.extractFull(archivePath, tempPath, {ssc: false}, () => undefined,
                        () => undefined)
      .then(() => fs.statAsync(path.join(tempPath, 'info.json')))
      .catch(err => Promise.reject(new Error('not an extension, info.json missing')))
      .then(() => fs.removeAsync(destPath))
      .then(() => fs.renameAsync(tempPath, destPath))
      .catch(err =>
        rimrafAsync(tempPath, { glob: false })
        .then(() => Promise.reject(err)));
}

export default installExtension;
