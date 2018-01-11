import { IHashResult } from './types';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';

/**
 * generate a hash of the specified file using the same hash
 * algorithm the db uses for keys (md5 currently).
 *
 * @param {string} filePath
 * @returns {Promise<IHashResult>}
 *
 * @memberOf ModDB
 */
export function genHash(filePath: string): Promise<IHashResult> {
  return new Promise<IHashResult>((resolve, reject) => {
    try {
      const { createHash } = require('crypto');
      const hash = createHash('md5');
      let size = 0;
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => {
        hash.update(data);
        size += data.length;
      });
      stream.on('end', () => resolve({
                         md5sum: hash.digest('hex'),
                         numBytes: size,
                       }));
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
