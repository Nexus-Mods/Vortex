import * as util from "util";

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
  archiveId?: string;
  categoryId?: string;
  customName?: string;
}

export interface IFileEntry {
  fileSource: string;
  fileDestination: string;
  isActive: boolean;
  filePriority: number;
}

export type ModsMap = { [modId: string]: IModEntry };
export type ProgressCB = (err: Error, mod: string) => void;

export function ParseError(message) {
  this.message = message;
  Error.captureStackTrace(this, ParseError);
}

util.inherits(ParseError, Error);

ParseError.prototype.name = "ParseError";
