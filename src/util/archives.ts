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

  public get readDir(): (archivePath: string) => Promise<string[]> {
    return (this.mHandler.readDir !== undefined)
      ? (archivePath: string) => this.mHandler.readDir(archivePath)
      : undefined;
  }

  public get readFile(): (filePath: string) => NodeJS.ReadableStream {
    return (this.mHandler.readFile !== undefined)
      ? (filePath: string) => this.mHandler.readFile(filePath)
      : undefined;
  }

  public get extractFile(): (filePath: string, outputPath: string) => Promise<void> {
    return (this.mHandler.extractFile !== undefined)
      ? (filePath: string, outputPath: string) => this.mHandler.extractFile(filePath, outputPath)
      : undefined;
  }

  public get extractAll(): (outputPath: string) => Promise<void> {
    return (this.mHandler.extractAll !== undefined)
      ? (outputPath: string) => this.mHandler.extractAll(outputPath)
      : undefined;
  }

  public get create(): (sourcePath: string) => Promise<void> {
    return (this.mHandler.create !== undefined)
      ? (sourcePath: string) => this.mHandler.create(sourcePath)
      : undefined;
  }
}
