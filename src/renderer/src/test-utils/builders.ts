/**
 * Shared test-data builders for collection install/session tests.
 *
 * These consolidate the per-file factories that had been copy-pasted across the
 * install-session suites (collectionInstallTracking, collectionInstallSession,
 * itemRows, ...). Each builder returns a fully-valid object with sensible defaults
 * and accepts a partial override - the Test Data Builder pattern - so a test only
 * states the fields it cares about.
 *
 * Test-only: nothing in the production tree imports this module.
 */
import type { IDownload } from "../extensions/download_management/types/IDownload";
import type { IMod, IModReference, IModRule } from "../extensions/mod_management/types/IMod";
import type { IProfileMod } from "../extensions/profile_management/types/IProfile";
import type {
  CollectionModStatus,
  ICollectionInstallSession,
  ICollectionInstallState,
  ICollectionModInstallInfo,
} from "../types/collections/ICollectionInstallSession";

export function makeReference(overrides: Partial<IModReference> = {}): IModReference {
  return { tag: "ref-tag", ...overrides };
}

export function makeRule(overrides: Partial<IModRule> = {}): IModRule {
  return {
    type: "requires",
    reference: { tag: "ref-tag" },
    ...overrides,
  };
}

export function makeMod(overrides: Partial<IMod> = {}): IMod {
  return {
    id: "mod-1",
    state: "installed",
    type: "",
    installationPath: "mods/mod-1",
    attributes: {},
    ...overrides,
  };
}

export function makeDownload(overrides: Partial<IDownload> = {}): IDownload {
  return {
    id: "dl-1",
    state: "started",
    urls: [],
    game: ["skyrimse"],
    modInfo: {},
    startTime: 0,
    fileTime: 0,
    size: 0,
    received: 0,
    verified: 0,
    ...overrides,
  };
}

export function makeProfileMod(overrides: Partial<IProfileMod> = {}): IProfileMod {
  return { enabled: true, enabledTime: 0, ...overrides };
}

export function makeModInstallInfo(
  overrides: Partial<ICollectionModInstallInfo> = {},
): ICollectionModInstallInfo {
  return {
    rule: makeRule(),
    status: "pending",
    type: "requires",
    ...overrides,
  };
}

export function makeSession(
  overrides: Partial<ICollectionInstallSession> = {},
): ICollectionInstallSession {
  return {
    sessionId: "col1_prof1",
    collectionId: "col1",
    profileId: "prof1",
    gameId: "skyrimse",
    // keyed by ruleId
    mods: {},
    totalRequired: 0,
    totalOptional: 0,
    downloadedCount: 0,
    installedCount: 0,
    failedCount: 0,
    ignoredCount: 0,
    ...overrides,
  };
}

export function makeInstallState(
  overrides: Partial<ICollectionInstallState> = {},
): ICollectionInstallState {
  return {
    activeSession: undefined,
    lastActiveSessionId: undefined,
    // keyed by sessionId
    sessionHistory: {},
    ...overrides,
  };
}

/**
 * Assemble a session's `mods` map from a compact list, keyed by an explicit ruleId.
 * Saves tests from spelling out a full ICollectionModInstallInfo per member mod.
 */
export function modsByRule(
  entries: Array<{ ruleId: string } & Partial<ICollectionModInstallInfo>>,
): Record<string, ICollectionModInstallInfo> {
  // keyed by ruleId
  const result: Record<string, ICollectionModInstallInfo> = {};
  for (const { ruleId, ...info } of entries) {
    result[ruleId] = makeModInstallInfo(info);
  }
  return result;
}

export type { CollectionModStatus };
