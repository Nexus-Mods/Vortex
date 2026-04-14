/**
 * Minimal vortex-api mock for collections extension unit tests.
 *
 * Only the utilities actually exercised by the code under test are implemented.
 * Everything else is a no-op / passthrough so imports don't explode.
 */

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------

function getSafe(state: any, path: (string | number)[], fallback: any): any {
  let current = state;
  for (const key of path) {
    if (current === undefined || current === null) {
      return fallback;
    }
    current = current[key];
  }
  return current ?? fallback;
}

function setSafe<T extends object>(
  state: T,
  path: Array<string | number>,
  value: any,
): T {
  if (path.length === 0) {
    return { ...value };
  }
  const firstElement = path[0];
  const copy = Array.isArray(state) ? (state.slice() as any) : { ...state };

  if (path.length === 1) {
    copy[firstElement] = value;
  } else {
    if (!Object.prototype.hasOwnProperty.call(copy, firstElement)) {
      copy[firstElement] =
        typeof path[1] === "number" ? [] : {};
    }
    copy[firstElement] = setSafe(copy[firstElement], path.slice(1), value);
  }
  return copy;
}

function merge<T extends object>(
  state: T,
  path: Array<string | number>,
  value: any,
): T {
  const newVal = { ...getSafe(state, path, {}), ...value };
  return setSafe(state, path, newVal);
}

function generateCollectionSessionId(
  collectionId: string,
  profileId: string,
): string {
  if (!profileId || !collectionId) {
    return null as any;
  }
  return `${collectionId}_${profileId}`;
}

function renderModName(mod: any, opts?: any): string {
  return (
    mod?.attributes?.customFileName ??
    mod?.attributes?.logicalFileName ??
    mod?.attributes?.name ??
    mod?.id ??
    "<unknown>"
  );
}

function renderModReference(ref: any, mod?: any): string {
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
  if (ref?.id && mod?.id === ref.id) {
    return true;
  }
  return false;
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

class UserCanceled extends Error {
  constructor() {
    super("User canceled");
    this.name = "UserCanceled";
  }
}

class ProcessCanceled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessCanceled";
  }
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
  // Make it behave as a passthrough proxy for property access
  return new Proxy(proxy, {
    get(_target, prop) {
      const obj = proxy();
      return (obj as any)?.[prop];
    },
  });
}

export const util = {
  getSafe,
  setSafe,
  merge,
  generateCollectionSessionId,
  renderModName,
  renderModReference,
  findModByRef,
  makeModReference,
  testModReference,
  coerceToSemver,
  convertGameIdReverse,
  lazyRequire,
  UserCanceled,
  ProcessCanceled,
  opn: async () => {},
  nexusModsURL: (...args: any[]) => "https://example.com",
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
  deleteOrNop: <T extends object>(state: T, path: Array<string | number>): T => {
    if (path.length === 0) return state;
    const copy: any = Array.isArray(state) ? state.slice() : { ...state };
    if (path.length === 1) {
      delete copy[path[0]];
    } else {
      const child = copy[path[0]];
      if (child !== undefined) {
        copy[path[0]] = util.deleteOrNop(child, path.slice(1));
      }
    }
    return copy;
  },
  toPromise: (fn: any) => new Promise((resolve) => fn(resolve)),
  makeQueue: () => {
    const fn = (cb: () => any, _parallel?: boolean) => cb();
    return fn;
  },
  DataInvalid: class DataInvalid extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DataInvalid";
    }
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
export const FlexLayout = Object.assign(() => null, { Flex: () => null, Fixed: () => null });
export const Icon = () => null;
export const More = () => null;
export const Usage = () => null;
export const MainPage = Object.assign(() => null, { Body: () => null, Header: () => null });
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
