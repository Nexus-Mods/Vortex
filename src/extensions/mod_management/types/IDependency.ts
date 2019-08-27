import {ILookupResult, IReference} from 'modmeta-db';
import { IFileListItem } from './IMod';

export interface IDependency {
  download: string;
  reference: IReference;
  lookupResults: ILookupResult[];
  fileList?: IFileListItem[];
}

export interface IDependencyError {
  error: string;
}

export type Dependency = IDependency | IDependencyError;
