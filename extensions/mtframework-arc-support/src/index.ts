import ARCWrapper from './ARCWrapper';
import { arcGameId, arcVersion } from './gameSupport';
import {ArcGame} from './types';

import * as Promise from 'bluebird';
import * as fs from 'fs';
import * as path from 'path';
import { types } from 'vortex-api';

class ARCHandler implements types.IArchiveHandler {
  private mArc: ARCWrapper;
  private mArchivePath: string;
  private mGame: ArcGame;
  private mVersion: number;

  constructor(fileName: string, options: types.IArchiveOptions) {
    this.mArchivePath = fileName;
    this.mGame = arcGameId(options.gameId);
    this.mVersion = arcVersion(options.gameId);
    this.mArc = new ARCWrapper();
  }

  public readDir(dirPath: string): Promise<string[]> {
    return this.mArc.list(this.mArchivePath,
                          { game: this.mGame, version: this.mVersion })
      .then(list => list
        .filter(entry => entry.startsWith(dirPath))
        .map(entry => entry.substr(dirPath.length)));
  }

  public extractAll(outputPath: string): Promise<void> {
    return this.mArc.extract(this.mArchivePath, outputPath,
                             { game: this.mGame, version: this.mVersion });
  }

  public create(sourcePath: string): Promise<void> {
    return this.mArc.create(this.mArchivePath, sourcePath,
                            { game: this.mGame, version: this.mVersion });
  }
}

function createARCHandler(fileName: string,
                          options: types.IArchiveOptions): Promise<types.IArchiveHandler> {
  return Promise.resolve(new ARCHandler(fileName, options));
}

function init(context: types.IExtensionContext) {
  if (!fs.statSync(path.join(__dirname, 'ARCtool.exe'))) {
    return false;
  }

  context.registerArchiveType('arc', createARCHandler);
  return true;
}

export default init;
