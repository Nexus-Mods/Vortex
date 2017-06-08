export interface IModEntry {
  nexusId: string;
  vortexId: string;
  downloadId: string;
  modName: string;
  modFilename: string;
  archivePath: string;
  modVersion: string;
  archiveMD5: string;
  fileEntries: IFileEntry[];
}

export interface IFileEntry {
  fileSource: string;
  fileDestination: string;
  isActive: boolean;
  filePriority: number;
}
