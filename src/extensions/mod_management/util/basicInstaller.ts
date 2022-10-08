import {ProgressDelegate} from '../types/InstallFunc';
import {ISupportedResult} from '../types/TestSupported';

import Bluebird from 'bluebird';
import * as path from 'path';

export function testSupported(files: string[]): Bluebird<ISupportedResult> {
  const result: ISupportedResult = { supported: true, requiredFiles: [] };
  return Bluebird.resolve(result);
}

export function install(files: string[], destinationPath: string,
                        gameId: string, progress: ProgressDelegate): Bluebird<any> {
  return Bluebird.resolve({
    message: 'Success',
    instructions: files
      .filter((name: string) => !name.endsWith(path.sep))
      .map((name: string) => ({ type: 'copy', source: name, destination: name })),
  });
}
