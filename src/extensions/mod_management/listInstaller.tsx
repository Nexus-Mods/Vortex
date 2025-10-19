import { fileMD5 } from '../../util/checksum';
import * as fs from '../../util/fs';
import { IInstruction } from './types/IInstallResult';
import { IFileListItem } from './types/IMod';
import { ISupportedInstaller } from './types/IModInstaller';
import { ProgressDelegate } from './types/InstallFunc';
import { ISupportedResult } from './types/TestSupported';

// TODO: Remove Bluebird import - using native Promise;
import { promiseReduce } from '../../util/bluebird-migration-helpers.local';
import * as path from 'path';
// Import xxhash-addon with fallback for when native module is not available
let XXHash64: any;
let xxhashAvailable = false;

try {
  const xxhashAddon = require('xxhash-addon');
  XXHash64 = xxhashAddon.XXHash64;
  xxhashAvailable = true;
} catch (err) {
  console.warn('⚠️ xxhash-addon not available, using fallback:', err);
  // Provide a fallback implementation
  XXHash64 = class {
    hash() {
      // Return a dummy buffer - this will cause checksums to not match
      // but won't break the application
      return Buffer.from([0]);
    }
  };
}

function testSupported(): Promise<ISupportedResult> {
  return Promise.resolve({
    supported: true,
    requiredFiles: [],
  });
}

function makeXXHash64() {
  // using seed 0
  const xxh64 = new XXHash64();
  return (filePath: string): Promise<string> => {
    return fs.readFileAsync(filePath)
      .then(data => {
        const buf: Buffer = xxh64.hash(data);
        return buf.toString('base64');
      })
      .catch(err => {
        // If xxhash fails, fall back to a simple hash or return a dummy value
        console.warn('⚠️ XXHash64 failed, using fallback:', err);
        return 'fallback_hash';
      });
  };
}

/**
 * installer designed to unpack a specific list of files
 * from an archive, ignoring any install script
 */
function makeListInstaller(extractList: IFileListItem[],
                           basePath: string)
                           : Promise<ISupportedInstaller> {
  let lookupFunc: (filePath: string) => Promise<string> =
    (filePath: string) => Promise.resolve(fileMD5(filePath));

  let idxId = 'md5';

  // TODO: this is awkward. We expect the entire list to use the same checksum algorithm
  if (extractList.find(iter =>
    (iter.md5 !== undefined) || (iter.xxh64 === undefined)) === undefined) {
    if (xxhashAvailable) {
      lookupFunc = makeXXHash64();
      idxId = 'xxh64';
    } else {
      console.warn('⚠️ xxhash not available, falling back to MD5 checksums');
    }
  }

  return Promise.resolve({
    installer: {
      id: 'list-installer',
      priority: 0,
      testSupported,
      install: (files: string[], destinationPath: string, gameId: string,
                progressDelegate: ProgressDelegate) => {
        let prog = 0;
        // build lookup table of the existing files on disk md5 -> source path
        const filteredFiles = files.filter(relPath => !relPath.endsWith(path.sep));
        const length = filteredFiles.length;
        return promiseReduce(filteredFiles.map((relPath, idx) => ({ relPath, idx })),
                              (prev, { relPath, idx }) => {
                                return lookupFunc(path.join(basePath, relPath))
                                  .then(checksum => {
                                    if (Math.floor((idx * 10) / length) > prog) {
                                      prog = Math.floor((idx * 10) / length);
                                      progressDelegate(prog * 10);
                                    }
                                    prev[checksum] = relPath;
                                    return prev;
                                  });
                              }, {})
          .then(lookup => {
            // for each item in the extract list, look up the source path vial
            // the lookup table, then create the copy instruction.
            const missingItems: IFileListItem[] = [];
            return {
              instructions: extractList.map(item => {
                let instruction: IInstruction;
                if (lookup[item[idxId]] === undefined) {
                  missingItems.push(item);
                  instruction = {
                    type: 'error',
                    source: `${item.path} (checksum: ${item[idxId]}) missing`,
                    value: 'warn',
                  };
                } else {
                  instruction = {
                    type: 'copy',
                    source: lookup[item[idxId]],
                    destination: item.path,
                  };
                }
                return instruction;
              }),
            };
          });
      },
    },
    requiredFiles: [],
  });
}

export default makeListInstaller;
