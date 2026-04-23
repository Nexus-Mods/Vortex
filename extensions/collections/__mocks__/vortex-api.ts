/**
 * Minimal vortex-api mock for collections extension unit tests.
 *
 * Prefer re-exporting real implementations from the Vortex sources.
 * Only fall back to stubs for things that would transitively pull in
 * runtime dependencies that aren't available in the test environment
 * (electron app paths, child_process, native modules, etc).
 */

import {
  getSafe as realGetSafe,
  setSafe as realSetSafe,
  merge as realMerge,
  deleteOrNop as realDeleteOrNop,
} from "../../../src/renderer/src/util/storeHelper";
import {
  UserCanceled as RealUserCanceled,
  ProcessCanceled as RealProcessCanceled,
  DataInvalid as RealDataInvalid,
} from "../../../src/shared/src/types/errors";
import { generateCollectionSessionId as realGenerateCollectionSessionId } from "../../../src/renderer/src/extensions/collections_integration/util";

// ---------------------------------------------------------------------------
// Stubs for utilities whose real implementations transitively pull in
// electron / native modules (util/util.ts, getVortexPath, logging, etc).
// These stubs intentionally implement only the behaviour the tests exercise.
// ---------------------------------------------------------------------------

function renderModName(mod: any): string {
  return (
    mod?.attributes?.customFileName ??
    mod?.attributes?.logicalFileName ??
    mod?.attributes?.name ??
    mod?.id ??
    "<unknown>"
  );
}

function renderModReference(ref: any): string {
  return (
    ref?.description ??
    ref?.logicalFileName ??
    ref?.fileExpression ??
    "<unknown ref>"
  );
}

function findModByRef(ref: any, mods: Record<string, any>): any | undefined {
  if (ref?.id && mods[ref.id]) {
    return mods[ref.id];
  }
  return undefined;
}

function makeModReference(mod: any) {
  return {
    id: mod.id,
    fileMD5: mod.attributes?.fileMD5,
    logicalFileName: mod.attributes?.logicalFileName,
    versionMatch: mod.attributes?.version,
    description: renderModName(mod),
  };
}

function testModReference(mod: any, ref: any): boolean {
  return !!(ref?.id && mod?.id === ref.id);
}

function coerceToSemver(version: string): string {
  if (!version?.trim) return undefined as any;
  version = version.trim();
  if (!version) return undefined as any;
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]}`;
  }
  const twoPartMatch = version.match(/^(\d+)\.(\d+)$/);
  if (twoPartMatch) {
    return `${twoPartMatch[1]}.${twoPartMatch[2]}.0`;
  }
  return undefined as any;
}

function convertGameIdReverse(knownGames: any[], domainName: string): string {
  const game = knownGames?.find?.((g: any) => g.domainName === domainName);
  return game?.id ?? domainName;
}

function lazyRequire<T>(factory: () => T): () => T {
  let cached: T | undefined;
  const proxy = (() => {
    if (cached === undefined) {
      try {
        cached = factory();
      } catch {
        cached = {} as T;
      }
    }
    return cached;
  }) as any;
  return new Proxy(proxy, {
    get(_target, prop) {
      const obj = proxy();
      return (obj as any)?.[prop];
    },
  });
}

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------

export const util = {
  getSafe: realGetSafe,
  setSafe: realSetSafe,
  merge: realMerge,
  deleteOrNop: realDeleteOrNop,
  generateCollectionSessionId: realGenerateCollectionSessionId,
  UserCanceled: RealUserCanceled,
  ProcessCanceled: RealProcessCanceled,
  DataInvalid: RealDataInvalid,
  renderModName,
  renderModReference,
  findModByRef,
  makeModReference,
  testModReference,
  coerceToSemver,
  convertGameIdReverse,
  lazyRequire,
  opn: async () => {},
  nexusModsURL: (..._args: any[]) => "https://example.com",
  nexusGameId: (game: any) => game?.id ?? "",
  Campaign: { GeneralNavigation: "navigation" },
  Section: { Collections: "collections" },
  SevenZip: class SevenZip {
    async list() {}
    async extract() {}
  },
  walk: async () => {},
  Debouncer: class Debouncer {
    constructor(
      _fn: any,
      _delay?: number,
      _reset?: boolean,
      _immediate?: boolean,
    ) {}
    schedule() {}
  },
  batchDispatch: (_store: any, _actions: any[]) => {},
  toPromise: (fn: any) => new Promise((resolve) => fn(resolve)),
  makeQueue: () => {
    const fn = (cb: () => any, _parallel?: boolean) => cb();
    return fn;
  },
};

// ---------------------------------------------------------------------------
// selectors
// ---------------------------------------------------------------------------

export const selectors = {
  activeGameId: (state: any) => state?.settings?.profiles?.activeProfileId,
  activeProfile: (state: any) => state?.settings?.profiles?.activeProfile,
  installPathForGame: (_state: any, _gameId: string) => "/mock/staging",
  downloadPathForGame: (_state: any, _gameId: string) => "/mock/downloads",
  profileById: (_state: any, _id: string) => ({}),
  knownGames: (_state: any) => [],
  gameById: (_state: any, _id: string) => ({}),
};

// ---------------------------------------------------------------------------
// types (re-exported as namespace)
// ---------------------------------------------------------------------------

export const types = {};

// ---------------------------------------------------------------------------
// React component base classes (needed by transitive imports)
// ---------------------------------------------------------------------------

let React: any;
try {
  React = require("react");
} catch {
  React = { Component: class {}, PureComponent: class {} };
}

export class ComponentEx extends React.Component {
  context: any = {};
}

export class PureComponentEx extends React.PureComponent {
  context: any = {};
}

// Stub UI components
export const ActionDropdown = () => null;
export const FlexLayout = Object.assign(() => null, {
  Flex: () => null,
  Fixed: () => null,
});
export const Icon = () => null;
export const More = () => null;
export const Usage = () => null;
export const MainPage = Object.assign(() => null, {
  Body: () => null,
  Header: () => null,
});
export const Toggle = () => null;
export const Spinner = () => null;
export const tooltip = { Button: () => null, IconButton: () => null };

// ---------------------------------------------------------------------------
// other
// ---------------------------------------------------------------------------

export const actions = {
  setINITweakEnabled: () => ({}),
};
export const fs = {
  statAsync: async () => ({ isDirectory: () => false }),
  readFileAsync: async () => "",
  writeFileAsync: async () => {},
  ensureDirAsync: async () => {},
  ensureDirWritableAsync: async () => {},
  removeAsync: async () => {},
  renameAsync: async () => {},
  copyAsync: async () => {},
  createReadStream: () => ({ on: () => ({}) }),
};
export const log = (..._args: any[]) => {};
