import {IProgressDelegate} from '../types/IInstall';
import {ISupportedResult} from '../types/ITestSupported';

import * as Promise from 'bluebird';

export function testSupported(files: string[]): Promise<ISupportedResult> {
  let result: ISupportedResult = { supported: true, requiredFiles: [] };
  return Promise.resolve(result);
}

export function install(files: string[], destinationPath: string,
                        gameId: string, progress: IProgressDelegate): Promise<any> {
  return Promise.resolve({
    message: 'Success',
    files: files.map((name: string) => ({ source: name, destination: name })),
  });
}
