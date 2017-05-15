import { IModLookupInfo } from './IModLookupInfo';

export interface IConflict {
  otherMod: IModLookupInfo;
  files: string[];
}
