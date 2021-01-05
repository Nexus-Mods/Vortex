import Promise from 'bluebird';
import {ILookupResult, IModInfo, IReference} from 'modmeta-db';
import { IFileListItem, IMod, IModReference } from './IMod';

export interface IModInfoEx extends IModInfo {
  referer?: string | (() => Promise<string>);
  sourceURI: string | (() => Promise<string>);
}

export interface ILookupResultEx extends ILookupResult {
  value: IModInfoEx;
}

export interface IDependency {
  download: string;
  reference: IModReference;
  lookupResults: ILookupResultEx[];
  fileList?: IFileListItem[];
  installerChoices?: any;
  mod?: IMod;
  extra?: { [key: string]: any };
}

export interface IDependencyError {
  error: string;
}

export type Dependency = IDependency | IDependencyError;
