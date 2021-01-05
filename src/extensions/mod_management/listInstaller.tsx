import { fileMD5 } from '../../util/checksum';
import { IInstruction } from './types/IInstallResult';
import { IFileListItem } from './types/IMod';
import { ISupportedInstaller } from './types/IModInstaller';
import { ProgressDelegate } from './types/InstallFunc';
import { ISupportedResult } from './types/TestSupported';

import Promise from 'bluebird';
import * as path from 'path';

function testSupported(): Promise<ISupportedResult> {
  return Promise.resolve({
    supported: true,
    requiredFiles: [],
  });
}

/**
 * installer designed to unpack a specific list of files
 * from an archive, ignoring any install script
 */
function makeListInstaller(extractList: IFileListItem[],
                           basePath: string)
                           : Promise<ISupportedInstaller> {
  return Promise.resolve({
    installer: {
      id: 'list-installer',
      priority: 0,
      testSupported,
      install: (files: string[], destinationPath: string, gameId: string,
                progressDelegate: ProgressDelegate) => {
        // build lookup table of the existing files on disk md5 -> source path
        return Promise.reduce(files.filter(relPath => !relPath.endsWith(path.sep)),
                              (prev, relPath, idx, length) => {
          return fileMD5(path.join(basePath, relPath))
            .then(md5Sum => {
              prev[md5Sum] = relPath;
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
                if (lookup[item.md5] === undefined) {
                  missingItems.push(item);
                  instruction = {
                    type: 'error',
                    source: `${item.path} (md5: ${item.md5}) missing`,
                    value: 'warn',
                  };
                } else {
                  instruction = {
                    type: 'copy',
                    source: lookup[item.md5],
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
