import type { ILookupResult, IModInfo } from "modmeta-db";

import type { IMod, IModInstallSpec, IModReference } from "./IMod";

export interface IModInfoEx extends IModInfo {
  referer?: string | (() => PromiseLike<string>);
  sourceURI: string | (() => PromiseLike<string>);
}

export interface ILookupResultEx extends ILookupResult {
  value: IModInfoEx;
}

export interface IDependency extends IModInstallSpec {
  download: string;
  reference: IModReference;
  lookupResults: ILookupResultEx[];
  mod?: IMod;
  extra?: { [key: string]: any };
  phase?: number;
}

export interface IDependencyError {
  error: string;
}

export type Dependency = IDependency | IDependencyError;
