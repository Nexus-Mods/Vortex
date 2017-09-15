import * as util from 'util';

export interface IModEntry {
  nexusId: string;
  vortexId: string;
  downloadId: number;
  modName: string;
  modFilename: string;
  archivePath: string;
  modVersion: string;
  archiveMD5: string;
  importFlag: boolean;
  isAlreadyManaged: boolean;
  fileEntries: IFileEntry[];
  categoryId?: number;
}

export interface IFileEntry {
  fileSource: string;
  fileDestination: string;
  isActive: boolean;
  filePriority: number;
}

export function ParseError(message) {
  this.message = message;
  Error.captureStackTrace(this, ParseError);
}

util.inherits(ParseError, Error);

ParseError.prototype.name = 'ParseError';
