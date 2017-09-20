import {ProgressDelegate} from '../types/InstallFunc';
import {ISupportedResult} from '../types/TestSupported';

import * as Promise from 'bluebird';

export function testSupported(files: string[]): Promise<ISupportedResult> {
  const result: ISupportedResult = { supported: true, requiredFiles: [] };
  return Promise.resolve(result);
}

export function install(files: string[], destinationPath: string,
                        gameId: string, progress: ProgressDelegate): Promise<any> {
  return Promise.resolve({
    message: 'Success',
    instructions: files.map((name: string) => ({ type: 'copy', source: name, destination: name })),
  });
}
