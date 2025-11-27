import * as util from 'util';

export interface IModEntry {
  nexusId: string;
  vortexId: string;
  downloadId: number;
  modName: string;
  archiveName: string;
  modVersion: string;
  importFlag: boolean;
  isAlreadyManaged: boolean;
  categoryId?: number;
}
