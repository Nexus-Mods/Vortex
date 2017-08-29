import ARCWrapper from './ARCWrapper';

import * as Promise from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import { types } from 'vortex-api';

class ARCHandler implements types.IArchiveHandler {
  private mArc: ARCWrapper;
  private mArchivePath: string;
  constructor(fileName: string) {
    this.mArc = new ARCWrapper();
    this.mArchivePath = fileName;
  }

  public readDir(dirPath: string): Promise<string[]> {
    return this.mArc.list(this.mArchivePath);
  }

  public extractFile(filePath: string, outputPath: string): Promise<void> {
    return Promise.resolve();
  }

  public extractAll(outputPath: string): Promise<void> {
    return this.mArc.extract(this.mArchivePath, outputPath);
  }

  public readFile(filePath: string): NodeJS.ReadableStream {
    return undefined;
  }
}

function createARCHandler(fileName: string,
                          options: types.IArchiveOptions): Promise<types.IArchiveHandler> {
  return Promise.resolve(new ARCHandler(fileName));
}

function init(context: types.IExtensionContext) {
  context.registerArchiveType('arc', createARCHandler);
  return true;
}

export default init;
