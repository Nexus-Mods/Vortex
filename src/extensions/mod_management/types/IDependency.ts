import {ILookupResult, IModInfo, IReference} from 'modmeta-db';
import { IFileListItem } from './IMod';

export interface IModInfoEx extends IModInfo {
  referer?: string;
}

export interface ILookupResultEx extends ILookupResult {
  value: IModInfoEx;
}

export interface IDependency {
  download: string;
  reference: IReference;
  lookupResults: ILookupResultEx[];
  fileList?: IFileListItem[];
}

export interface IDependencyError {
  error: string;
}

export type Dependency = IDependency | IDependencyError;
