import {ProgressDelegate} from '../types/InstallFunc';
import {ISupportedResult} from '../types/TestSupported';

// TODO: Remove Bluebird import - using native Promise;
import * as path from 'path';

export function testSupported(files: string[]): Promise<ISupportedResult> {
  const result: ISupportedResult = { supported: true, requiredFiles: [] };
  return Promise.resolve(result);
}

export function install(files: string[], destinationPath: string,
                        gameId: string, progress: ProgressDelegate): Promise<any> {
  return Promise.resolve({
    message: 'Success',
    instructions: files
      .filter((name: string) => !name.endsWith(path.sep))
      .map((name: string) => ({ type: 'copy', source: name, destination: name })),
  });
}
