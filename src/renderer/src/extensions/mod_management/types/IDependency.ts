import type { ILookupResult, IModInfo } from "modmeta-db";

import type { IMod, IModInstallSpec, IModReference, IModRuleExtra } from "./IMod";

export interface IModInfoEx extends IModInfo {
  referer?: string | (() => PromiseLike<string>);
  sourceURI: string | (() => PromiseLike<string>);
}

export interface ILookupResultEx extends ILookupResult {
  value: IModInfoEx;
}

// a resolved mod rule: the install spec (IModInstallSpec) plus reference / phase / extra,
// with the runtime resolution fields (download / lookupResults / mod) filled in while
// gathering dependencies. Mirrors the install-relevant fields of IModRule, minus the rule
// machinery (IRule's `type`, downloadHint, ignored) which a resolved dependency has no use
// for.
export interface IDependency extends IModInstallSpec {
  download: string;
  reference: IModReference;
  lookupResults: ILookupResultEx[];
  mod?: IMod;
  phase?: number;
  extra?: IModRuleExtra;
}

export interface IDependencyError {
  error: string;
}

export type Dependency = IDependency | IDependencyError;
