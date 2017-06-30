import { IArchiveHandler } from '../types/IExtensionContext';

import * as Promise from 'bluebird';

/**
 * wrapper around an format-specific archive handler
 *
 * @export
 * @class Archive
 */
export class Archive {
  private mHandler: IArchiveHandler;

  constructor(handler: IArchiveHandler) {
    this.mHandler = handler;
  }

  public readDir(dirPath: string): Promise<string[]> {
    return this.mHandler.readDir(dirPath);
  }

  public readFile(filePath: string): NodeJS.ReadableStream {
    return this.mHandler.readFile(filePath);
  }

  public extractFile(filePath: string, outputPath: string): Promise<void> {
    return this.mHandler.extractFile(filePath, outputPath);
  }

  public extractAll(outputPath: string): Promise<void> {
    return this.mHandler.extractAll(outputPath);
  }
}
