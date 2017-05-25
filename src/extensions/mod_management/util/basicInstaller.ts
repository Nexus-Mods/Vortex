import {IProgressDelegate} from '../types/IInstall';
import {ISupportedResult} from '../types/ITestSupported';

import * as Promise from 'bluebird';

export function testSupported(files: string[]): Promise<ISupportedResult> {
  const result: ISupportedResult = { supported: true, requiredFiles: [] };
  return Promise.resolve(result);
}

export function install(files: string[], destinationPath: string,
                        gameId: string, progress: IProgressDelegate): Promise<any> {
  return Promise.resolve({
    message: 'Success',
    instructions: files.map((name: string) => ({ type: 'copy', source: name, destination: name })),
  });
}
