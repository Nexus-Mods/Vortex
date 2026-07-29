/**
 * Shared test-data builders for collection install/session tests.
 *
 * These consolidate the per-file factories that had been copy-pasted across the
 * install-session suites (collectionInstallTracking, collectionInstallSession,
 * itemRows, ...). Each builder returns a fully-valid object with sensible defaults
 * and accepts a partial override - the Test Data Builder pattern - so a test only
 * states the fields it cares about.
 *
 * The data builders (makeMod, makeRule, makeReference, makeSession, ...) are deliberately PLAIN
 * FUNCTIONS, not vitest fixtures (test.extend). They are stateless, deterministic, and allocate
 * nothing that needs teardown, and their whole value is the partial-override args - wrapping them
 * as fixtures would only add indirection and lose that ergonomics. Fixtures earn their keep for
 * per-test setup/teardown + laziness, which here applies only to the STATEFUL harness below
 * (makeApiHarness / makeDriverHarness register a fake game in a worker-global registry that must
 * be cleared between tests); that lifecycle is wrapped by the harnessTest / driverTest fixtures,
 * not by these builders.
 *
 * Test-only: nothing in the production tree imports this module.
 */
import { EventEmitter } from "events";
import * as path from "path";

import type { IFileInfo } from "@nexusmods/nexus-api";
import type NexusT from "@nexusmods/nexus-api";
import type { WireDownloadCheckpoint, WireResolvedResource } from "@vortex/shared/ipc";
import type { Api, DownloaderApi } from "@vortex/shared/preload";
import { batch } from "redux-act";
import { vi } from "vitest";

import type { MixpanelEvent } from "../extensions/analytics/mixpanel/MixpanelEvents";
import type { ICategory } from "../extensions/category_management/types/ICategoryDictionary";
import { MOD_TYPE } from "../extensions/collections/constants";
import type {
  ICollectionMod,
  ICollectionModRule,
} from "../extensions/collections/types/ICollection";
import type InstallDriver from "../extensions/collections/util/InstallDriver";
import { downloadPathForGame } from "../extensions/download_management/selectors";
import type { IDownload, IModInfo } from "../extensions/download_management/types/IDownload";
import type { ILoadOrderEntry } from "../extensions/file_based_loadorder/types/types";
import type UpdateSet from "../extensions/file_based_loadorder/UpdateSet";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type { HealthCheckRegistry } from "../extensions/health_check/core/HealthCheckRegistry";
import type { HealthCheckId } from "../extensions/health_check/types";
import type InstallContext from "../extensions/mod_management/InstallContext";
import type InstallManager from "../extensions/mod_management/InstallManager";
import { modsReducer } from "../extensions/mod_management/reducers/mods";
import type {
  IChoiceType,
  IFileListItem,
  IMod,
  IModPatches,
  IModReference,
  IModRule,
} from "../extensions/mod_management/types/IMod";
import type { InstallPhaseTracker } from "../extensions/mod_management/util/InstallPhaseTracker";
import type { IModLookupInfo } from "../extensions/mod_management/util/testModReference";
import { persistentReducer as nexusPersistentReducer } from "../extensions/nexus_integration/reducers/persistent";
import { sessionReducer as nexusSessionReducer } from "../extensions/nexus_integration/reducers/session";
import type { IValidateKeyDataV2 } from "../extensions/nexus_integration/types/IValidateKeyData";
import type { IProfile, IProfileMod } from "../extensions/profile_management/types/IProfile";
import type { IPCDownloadAdapter } from "../IPCDownloadAdapter";
import trackingReducer from "../reducers/collectionInstallTracking";
import type {
  CollectionModStatus,
  ICollectionInstallSession,
  ICollectionInstallState,
  ICollectionModInstallInfo,
} from "../types/collections/ICollectionInstallSession";
import type { DialogActions, DialogType, IDialogContent, IDialogResult } from "../types/IDialog";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IGame } from "../types/IGame";
import type { IHealthCheckResult, IModCheckContext, IModHealthCheck } from "../types/IHealthCheck";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
} from "../types/IHealthCheck";
import type { IState } from "../types/IState";
import local from "../util/local";
import type { IStarterInfo } from "../util/StarterInfo";
import type {
  IApiHarness,
  IConcurrencyProbe,
  IDownloadAdapterHarness,
  IDownloadAdapterOpts,
  IDriverHarness,
  IDriverHarnessState,
  IFbloHarness,
  IFbloHarnessOpts,
  IHealthCheckHarness,
  IHealthCheckHarnessOpts,
  IInstallContextHarness,
  IInstallManagerHarness,
  IModCheckOpts,
  IModChangeHarness,
  INxmHarness,
  IParkCheckOpts,
  IParkedCheck,
  IRevisionFixture,
  IRevisionMemberSpec,
  ITrackedAction,
} from "./harnessTypes";

export function makeReference(overrides: Partial<IModReference> = {}): IModReference {
  return { tag: "ref-tag", ...overrides };
}

// a repo-pinned EXACT reference (no fuzzy versionMatch): its stable identity is the pinned file's
// fileMD5
export function makeExactRef(overrides: Partial<IModReference> = {}): IModReference {
  return makeReference({
    repo: { repository: "nexus", gameId: "skyrimse", modId: "100", fileId: "5" },
    fileMD5: "abc123",
    ...overrides,
  });
}

// a fuzzy-version (prefers/latest) reference: it resolves to a varying file across versions, so
// its stable identity is the mod page (repo.modId) rather than the version-specific fileMD5
export function makeFuzzyRef(overrides: Partial<IModReference> = {}): IModReference {
  return makeExactRef({ versionMatch: "*", ...overrides });
}

export function makeRule(overrides: Partial<IModRule> = {}): IModRule {
  return {
    type: "requires",
    reference: { tag: "ref-tag" },
    ...overrides,
  };
}

// A collection rule whose source and reference are both references (before/after/conflicts/...).
// Distinct from makeRule, which builds an IModRule.
export function makeCollectionModRule(
  overrides: Partial<ICollectionModRule> = {},
): ICollectionModRule {
  return {
    source: makeReference(),
    type: "after",
    reference: makeReference(),
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<ICategory> = {}): ICategory {
  return { name: "Category", parentCategory: undefined, order: 0, ...overrides };
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

export function makeFileInfo(overrides: Partial<IFileInfo> = {}): IFileInfo {
  return {
    file_id: 1,
    category_id: 1,
    category_name: "MAIN",
    changelog_html: "",
    content_preview_link: "",
    name: "file",
    description: "",
    version: "1.0.0",
    size: 0,
    size_kb: 0,
    file_name: "file.7z",
    uploaded_timestamp: 0,
    uploaded_time: "",
    mod_version: "1.0.0",
    external_virus_scan_url: "",
    is_primary: true,
    ...overrides,
  };
}

/**
 * The membership as Vortex stores it, i.e. after the api's role strings have been folded into
 * flags. Defaults to a plain premium account; override the flags for the free/supporter cases.
 */
export function makeUserInfo(overrides: Partial<IValidateKeyDataV2> = {}): IValidateKeyDataV2 {
  return {
    userId: 7,
    name: "test-user",
    email: "test@example.com",
    profileUrl: "https://example.com/avatar.png",
    isPremium: true,
    isSupporter: false,
    isLifetime: false,
    ...overrides,
  };
}

export function makeProfileMod(overrides: Partial<IProfileMod> = {}): IProfileMod {
  return { enabled: true, enabledTime: 0, ...overrides };
}

export function makeProfile(overrides: Partial<IProfile> = {}): IProfile {
  return {
    id: "profile-1",
    gameId: "skyrimse",
    name: "Profile",
    modState: {},
    lastActivated: 0,
    ...overrides,
  };
}

// A launch target as StarterInfo.run receives it. Defaults to the skyrimse game exe (isGame),
// launched directly (no store); override isGame/store/defaultPrimary to model store/tool/SE launches.
export function makeStarterInfo(overrides: Partial<IStarterInfo> = {}): IStarterInfo {
  return {
    id: "skyrimse",
    gameId: "skyrimse",
    isGame: true,
    iconOutPath: "",
    name: "Skyrim Special Edition",
    exePath: "C:/games/skyrimse/SkyrimSE.exe",
    commandLine: [],
    workingDirectory: "",
    exclusive: false,
    detach: true,
    shell: false,
    store: "",
    environment: {},
    extensionPath: "",
    logoName: "",
    ...overrides,
  };
}

// A cached game entry. Defaults to skyrimse with its nexus page id under `details`, so
// convertGameIdReverse resolves "skyrimspecialedition" to "skyrimse" through this entry rather
// than its hardcoded fallback.
export function makeGameStored(overrides: Partial<IGameStored> = {}): IGameStored {
  return {
    id: "skyrimse",
    name: "Skyrim Special Edition",
    requiredFiles: [],
    executable: "SkyrimSE.exe",
    details: { nexusPageId: "skyrimspecialedition" },
    ...overrides,
  };
}

export function makeLookup(overrides: Partial<IModLookupInfo> = {}): IModLookupInfo {
  return { fileMD5: "", fileSizeBytes: 0, fileName: "", version: "", ...overrides };
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

export function makeInstallerChoices(overrides: Partial<IChoiceType> = {}): IChoiceType {
  return { type: "fomod", options: [], ...overrides };
}

export function makePatches(overrides: IModPatches = {}): IModPatches {
  return { "meshes/example.nif": "deadbeefdeadbeef", ...overrides };
}

export function makeFileListItem(overrides: Partial<IFileListItem> = {}): IFileListItem {
  return { path: "textures/example.dds", md5: "abc123", ...overrides };
}

export function makeModInfo(overrides: Partial<IModInfo> = {}): IModInfo {
  return { ...overrides };
}

export function makeHealthCheckResult(
  overrides: Partial<IHealthCheckResult> = {},
): IHealthCheckResult {
  return {
    checkId: "test-check",
    status: "passed",
    severity: HealthCheckSeverity.Info,
    message: "ok",
    executionTime: 0,
    timestamp: new Date(0),
    ...overrides,
  };
}

// a per-mod health check; `gameId` scopes it to one game, and omitting it runs for every game
export function makeModHealthCheck(
  overrides: Partial<IModHealthCheck & { gameId: string }> = {},
): IModHealthCheck & { gameId?: string } {
  return {
    id: "test-check",
    name: "Test",
    description: "",
    category: HealthCheckCategory.Mods,
    severity: HealthCheckSeverity.Warning,
    triggers: [HealthCheckTrigger.Manual],
    checkMod: async () => makeHealthCheckResult(),
    ...overrides,
  };
}

export function makeModCheckContext(overrides: Partial<IModCheckContext> = {}): IModCheckContext {
  return {
    modId: "mod-1",
    files: [],
    readFile: async () => Buffer.alloc(0),
    attributes: {},
    ...overrides,
  };
}

/**
 * The modInfo of a collection-archive download: the nexus `ids` the driver reads
 * (nexusIdsFromDownloadId, the collectionId getter). No collectionSlug, so the driver's
 * initCollectionInfo gets an undefined slug and getCollectionInfo short-circuits instead of
 * hitting the network.
 */
export function makeCollectionModInfo(
  overrides: { collectionId?: number; revisionId?: number; gameId?: string } = {},
): IModInfo {
  const { collectionId = 1, revisionId = 1, gameId = "skyrimse" } = overrides;
  return makeModInfo({ nexus: { ids: { collectionId, revisionId, gameId } } });
}

// A collection-manifest mod entry (ICollectionMod), as produced by authoring / read on install.
// Defaults to a nexus-sourced member; override `source` wholesale (matching how the rule
// transform reads mod.source) to model bundles, manual sources, missing ids, etc.
export function makeCollectionMod(overrides: Partial<ICollectionMod> = {}): ICollectionMod {
  return {
    name: "Test Mod",
    version: "1.2.3",
    optional: false,
    domainName: "skyrimspecialedition",
    source: {
      type: "nexus",
      modId: 100,
      fileId: 200,
      md5: "abc",
      fileSize: 1024,
      logicalFilename: "TestMod",
      updatePolicy: "exact",
    },
    ...overrides,
  };
}

export function makeRevision(
  revisionNumber: number,
  members: IRevisionMemberSpec[],
  overrides: { collectionId?: string } = {},
): IRevisionFixture {
  const collectionId = overrides.collectionId ?? "col-1";
  const rules: IModRule[] = [];
  const installed: IMod[] = [];
  const manifestMods: ICollectionMod[] = [];

  for (const { tag, version, optional = false } of members) {
    rules.push(
      makeRule({
        type: optional ? "recommends" : "requires",
        reference: makeReference({
          tag,
          ...(version !== undefined ? { versionMatch: version } : {}),
        }),
      }),
    );
    installed.push(
      makeMod({
        id: `inst-${tag}`,
        attributes: {
          referenceTag: tag,
          installedAsDependency: true,
          ...(version !== undefined ? { version } : {}),
        },
      }),
    );
    manifestMods.push(makeCollectionMod({ name: tag, version: version ?? "1.0.0", optional }));
  }

  const collection = makeMod({
    id: collectionId,
    type: MOD_TYPE,
    archiveId: `dl-${collectionId}`,
    installationPath: `mods/${collectionId}`,
    rules,
    attributes: { revisionNumber },
  });

  return { revisionNumber, collection, rules, installed, manifestMods };
}

export type { CollectionModStatus };

const BATCH_TYPE: string = (batch as unknown as { getType: () => string }).getType();
const sessionReducers = trackingReducer.reducers as Record<
  string,
  (state: ICollectionInstallState, payload: unknown) => ICollectionInstallState
>;
// the real mods reducer, applied to state.persistent.mods so the durable writes the driver
// makes alongside the session (addModRule with `ignored`, setModAttribute install-spec stamps)
// are observable by read-back, not just recordable as dispatched actions. keyed by gameId.
type ModsSlice = Record<string, Record<string, IMod>>;
const modsReducers = modsReducer.reducers as Record<
  string,
  (state: ModsSlice, payload: unknown) => ModsSlice
>;

function makeDriverState(overrides: Partial<IDriverHarnessState> = {}): IState {
  const slices: IDriverHarnessState = {
    mods: {},
    downloads: {},
    profiles: {},
    session: trackingReducer.defaults,
    knownGames: [],
    availableExtensions: [],
    userInfo: undefined,
    ...overrides,
  };
  // a structurally-partial IState holding only the slices the driver reads; the single cast
  // mirrors test-utils/sessionStore.asIState (a full IState is impractical to construct)
  return {
    persistent: {
      mods: slices.mods,
      downloads: { files: slices.downloads },
      profiles: slices.profiles,
      collections: { collections: {}, revisions: {} },
      nexus: { ...nexusPersistentReducer.defaults, userInfo: slices.userInfo },
    },
    session: {
      collections: slices.session,
      nexus: { ...nexusSessionReducer.defaults },
      // knownGames() dereferences this, so it has to exist even for suites that register none
      gameMode: { known: slices.knownGames },
      extensions: { available: slices.availableExtensions },
    },
    settings: {
      // download path pattern so downloadPathForGame resolves a concrete per-game folder
      downloads: { collectionsInstallWhileDownloading: false, path: "{USERDATA}\\downloads" },
      interface: { language: "en", foregroundDL: false },
      gameMode: { discovered: {} },
      // empty skeletons so tests can assign settings.mods.installPath[gameId] /
      // settings.profiles.activeProfileId through the typed draft without a cast (the single
      // as-unknown-as-IState below covers the omitted fields)
      mods: { installPath: {} },
      profiles: { activeProfileId: undefined, nextProfileId: undefined, lastActiveProfile: {} },
    },
  } as unknown as IState;
}

/**
 * Register a fake game in the process-`local` registries getGame() reads, so the driver's
 * startImpl can resolve the installed game version (a global singleton, not redux, and not
 * covered by the game-extension vortex-api mocks). vitest isolates these per test file, and
 * registration is idempotent.
 */
function registerHarnessGame(gameId: string): void {
  const gameReg = local<{
    gameModeManager: unknown;
    extensionGames: IGame[];
    extensionStubs: unknown[];
  }>("gamemode-management", {
    gameModeManager: undefined,
    extensionGames: [],
    extensionStubs: [],
  });
  if (!gameReg.extensionGames.some((game) => game.id === gameId)) {
    gameReg.extensionGames.push({
      id: gameId,
      name: gameId,
      queryModPath: () => "mods",
    } as unknown as IGame);
  }

  const gvReg = local<{
    gameVersionManager: { getGameVersion: () => Promise<string> } | undefined;
  }>("gameversion-manager", { gameVersionManager: undefined });
  if (gvReg.gameVersionManager === undefined) {
    gvReg.gameVersionManager = { getGameVersion: () => Promise.resolve("1.0.0") };
  }
}

/**
 * Clear the process-`local` registries registerHarnessGame populates. The registries live on
 * the worker global, so without this a fake game (or version manager) registered by one test
 * would persist and could mask a different test's expectation. Call from afterEach.
 */
export function resetHarnessRegistries(): void {
  const gameReg = local<{
    gameModeManager: unknown;
    extensionGames: IGame[];
    extensionStubs: unknown[];
  }>("gamemode-management", {
    gameModeManager: undefined,
    extensionGames: [],
    extensionStubs: [],
  });
  gameReg.extensionGames.length = 0;

  const gvReg = local<{ gameVersionManager: unknown }>("gameversion-manager", {
    gameVersionManager: undefined,
  });
  gvReg.gameVersionManager = undefined;
}

/**
 * A controllable fake IExtensionApi over a seeded, structurally-partial IState. This is the
 * seam for code that reads state + dispatches actions + reacts to the global event bus.
 *
 * - `events` is a real EventEmitter, so `emit(...)` actually runs any `on`/`onAsync` listeners
 *   (a vi.fn() stub could not).
 * - `dispatch` applies the real install-tracking reducer to `state.session.collections` AND the
 *   real mods reducer to `state.persistent.mods` (so both the session and durable writes are
 *   observable by read-back), and records every action (so writes with no harness reducer are
 *   still assertable). Batched actions are unwrapped.
 * - the persistent / session slices are seeded from `overrides` (builder-style) and can be
 *   mutated mid-test via `setState`.
 */
export function makeApiHarness(overrides: Partial<IDriverHarnessState> = {}): IApiHarness {
  const state = makeDriverState(overrides);
  const dispatched: ITrackedAction[] = [];

  const apply = (action: ITrackedAction | null | undefined): void => {
    if (action == null) {
      return;
    }
    // redux-act batches several actions into one; unwrap so each is applied + recorded
    if (action.type === BATCH_TYPE && Array.isArray(action.payload)) {
      (action.payload as ITrackedAction[]).forEach(apply);
      return;
    }
    dispatched.push(action);
    const sessionReducer = sessionReducers[action.type];
    if (sessionReducer !== undefined) {
      state.session.collections = sessionReducer(state.session.collections, action.payload);
    }
    const modsReducerFn = modsReducers[action.type];
    if (modsReducerFn !== undefined) {
      state.persistent.mods = modsReducerFn(state.persistent.mods, action.payload);
    }
    const nexusSession = nexusSessionReducer.reducers[action.type];
    if (nexusSession !== undefined) {
      state.session["nexus"] = nexusSession(state.session["nexus"], action.payload);
    }
    const nexusPersistent = nexusPersistentReducer.reducers[action.type];
    if (nexusPersistent !== undefined) {
      state.persistent["nexus"] = nexusPersistent(state.persistent["nexus"], action.payload);
    }
  };

  const dispatch = (action: ITrackedAction) => {
    apply(action);
    return action;
  };

  const events = new EventEmitter();
  events.setMaxListeners(0);

  let nextDialog: IDialogResult = { action: "Continue", input: {} };
  const dialogCalls: Array<{ type: DialogType; title: string }> = [];
  const errorNotifications: IApiHarness["errorNotifications"] = [];
  const notifications: IApiHarness["notifications"] = [];

  const api = {
    getState: () => state,
    store: { getState: () => state, dispatch },
    events,
    // a driver registers will-install-mod via onAsync; route it onto the same bus so a
    // plain emit() runs it (the returned promise is ignored, which is fine for assertions)
    onAsync: (event: string, cb: (...args: unknown[]) => unknown) => {
      events.on(event, cb);
    },
    onStateChange: () => undefined,
    sendNotification: (notification: { type: string; message: string }) => {
      notifications.push(notification);
    },
    dismissNotification: () => undefined,
    showErrorNotification: (
      title: string,
      message: unknown,
      options?: { allowReport?: boolean },
    ) => {
      errorNotifications.push({ title, message, allowReport: options?.allowReport });
    },
    showDialog: (
      type: DialogType,
      title: string,
      _content: IDialogContent,
      _actions: DialogActions,
    ) => {
      dialogCalls.push({ type, title });
      return Promise.resolve(nextDialog);
    },
    translate: (key: string) => key,
    ext: { awaitProfileSwitch: () => Promise.resolve() },
    emitAndAwait: () => Promise.resolve([]),
  } as unknown as IExtensionApi;

  return {
    api,
    dispatched,
    emit: (event: string, ...args: unknown[]) => {
      events.emit(event, ...args);
    },
    getState: () => state,
    setState: (mutate: (draft: IState) => void) => {
      mutate(state);
    },
    setNextDialog: (result: IDialogResult) => {
      nextDialog = result;
    },
    dialogCalls,
    errorNotifications,
    notifications,
  };
}

/**
 * A file-based load order harness: a fake api seeded with an active profile and the game's mods,
 * plus an UpdateSet constructed against it. UpdateSet is injected so builders.ts stays free of the
 * renderer view layer, mirroring makeDriverHarness.
 */
export function makeFbloHarness(
  UpdateSetCtor: new (api: IExtensionApi, isFBLO: (gameId: string) => boolean) => UpdateSet,
  opts: IFbloHarnessOpts = {},
): IFbloHarness {
  const gameId = opts.gameId ?? "skyrimse";
  const profileId = opts.profileId ?? "profile-1";
  const base = makeApiHarness({
    profiles: { [profileId]: makeProfile({ id: profileId, gameId }) },
    mods: { [gameId]: opts.mods ?? {} },
  });
  base.setState((draft) => {
    draft.settings.profiles.activeProfileId = profileId;
    draft.settings.profiles.lastActiveProfile = { [gameId]: profileId };
  });
  const updateSet = new UpdateSetCtor(base.api, opts.isFBLO ?? (() => true));
  return { ...base, updateSet, gameId, profileId };
}

/**
 * Resolve once the driver reaches `step`. The driver fires onUpdate on every step transition, so
 * this awaits that exact event rather than a fixed delay (a fixed tick races the async
 * did-install-dependencies handler under load). A driver that never reaches the step is bounded by
 * the caller's per-test timeout.
 */
export function waitForDriverStep(driver: InstallDriver, step: string): Promise<void> {
  return new Promise((resolve) => {
    if (driver.step === step) {
      resolve();
      return;
    }
    const dispose = driver.onUpdate(() => {
      if (driver.step === step) {
        dispose();
        resolve();
      }
    });
  });
}

/**
 * Harness for InstallDriver orchestration tests. The driver is a singleton reacting to a
 * GLOBAL event bus while mutating a SINGLE redux install session - the surface that
 * misbehaves under churn (many member mods installing/updating/downgrading at once, events
 * for non-member mods, several collections in a setup). Drives the REAL driver through the
 * fake api (makeApiHarness) plus a fake game registered in the local() registry getGame reads.
 */
export function makeDriverHarness(
  DriverCtor: new (api: IExtensionApi) => InstallDriver,
  overrides: Partial<IDriverHarnessState> = {},
  gameId = "skyrimse",
): IDriverHarness {
  registerHarnessGame(gameId);
  const base = makeApiHarness(overrides);
  const driver = new DriverCtor(base.api);
  return { driver, ...base };
}

/**
 * Harness for InstallManager phase-engine tests. Constructs the REAL InstallManager against the
 * fake api (makeApiHarness), so its event handlers (install-from-dependencies, did-finish-download,
 * ...) are wired onto the same bus a harness.emit drives. The ctor is passed in (like
 * makeDriverHarness) to keep the heavy InstallManager import out of builders. Seeds
 * settings.mods.installPath so installPathForGame resolves a concrete staging folder.
 */
export function makeInstallManagerHarness(
  ManagerCtor: new (api: IExtensionApi, installPath: (gameId: string) => string) => InstallManager,
  overrides: Partial<IDriverHarnessState> = {},
  gameId = "skyrimse",
): IInstallManagerHarness {
  registerHarnessGame(gameId);
  const base = makeApiHarness(overrides);
  base.setState((draft) => {
    draft.settings.mods.installPath[gameId] = `C:/staging/${gameId}`;
  });
  const manager = new ManagerCtor(base.api, (gid: string) => `C:/staging/${gid}`);
  // single seam: reach the manager's private phase map once here so suites get a typed handle
  // instead of casting the manager per test
  const phaseTracker = (manager as unknown as { mPhaseTracker: InstallPhaseTracker }).mPhaseTracker;
  return { manager, phaseTracker, ...base };
}

/**
 * Harness for InstallContext analytics tests. Constructs the REAL InstallContext against the fake
 * api (makeApiHarness) - its ctor wires every callback from the api, so no external stubs are
 * needed - and collects the per-mod analytics it emits on the bus. A test seeds the member's
 * download, then drives ctx.startInstallCB / finishInstallCB and asserts mixpanelEvents. The ctor
 * is passed in (like the other harnesses) to keep the heavy InstallContext import out of builders.
 */
/** Collects every mixpanel event emitted on an api's bus, in order, into the returned array. */
export function collectMixpanelEvents(api: IExtensionApi): MixpanelEvent[] {
  const mixpanelEvents: MixpanelEvent[] = [];
  api.events.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => mixpanelEvents.push(e));
  return mixpanelEvents;
}

export function makeInstallContextHarness(
  ContextCtor: new (gameMode: string, api: IExtensionApi, silent: boolean) => InstallContext,
  overrides: Partial<IDriverHarnessState> = {},
  opts: { gameId?: string; silent?: boolean } = {},
): IInstallContextHarness {
  const gameId = opts.gameId ?? "skyrimse";
  const base = makeApiHarness(overrides);
  const mixpanelEvents = collectMixpanelEvents(base.api);
  const ctx = new ContextCtor(gameId, base.api, opts.silent ?? false);
  return { ctx, mixpanelEvents, ...base };
}

/**
 * Records the high-water mark of concurrent operations. Bracket each holder's window with
 * enter()/leave(): a bounded fan-out peaks at its cap, an unbounded one at the item count.
 */
export function makeConcurrencyProbe(): IConcurrencyProbe {
  let live = 0;
  let peak = 0;
  return {
    enter: () => {
      live += 1;
      peak = Math.max(peak, live);
    },
    leave: () => {
      live -= 1;
    },
    peak: () => peak,
  };
}

/**
 * Harness for HealthCheckRegistry scheduling tests. Constructs the REAL registry against the fake
 * api (makeApiHarness) with an active profile, so activeGameId resolves and the registry routes
 * per-mod checks the way it does in the app. The ctor is passed in (like makeDriverHarness) to keep
 * the registry import out of builders.
 *
 * `parkCheck` registers a body that works until released, so a test can observe what the registry
 * does with a run it has given up on. Every parked body must be released, so suites go through the
 * healthCheckTest fixture rather than constructing this directly.
 */
export function makeHealthCheckHarness(
  RegistryCtor: new (api: IExtensionApi) => HealthCheckRegistry,
  opts: IHealthCheckHarnessOpts = {},
): IHealthCheckHarness {
  const gameId = opts.gameId ?? "skyrimse";
  const profileId = opts.profileId ?? "profile-1";
  const base = makeApiHarness({
    profiles: { [profileId]: makeProfile({ id: profileId, gameId }) },
  });
  base.setState((draft) => {
    draft.settings.profiles.activeProfileId = profileId;
    draft.settings.profiles.lastActiveProfile = { [gameId]: profileId };
  });

  const registry = new RegistryCtor(base.api);
  const releases: Array<() => void> = [];
  // one entry per body invocation, resolved when that body returns
  const bodies: Array<Promise<void>> = [];

  const parkCheck = ({
    id,
    timeout,
    tickMs = 10,
    respectAbort = true,
  }: IParkCheckOpts): IParkedCheck => {
    let starts = 0;
    let ticks = 0;
    let inFlight = 0;
    let parked = true;
    releases.push(() => {
      parked = false;
    });

    registry.register({
      id,
      name: id,
      description: "",
      category: HealthCheckCategory.System,
      severity: HealthCheckSeverity.Info,
      triggers: [HealthCheckTrigger.Manual],
      timeout,
      check: async (_api, signal) => {
        starts += 1;
        inFlight += 1;
        let done!: () => void;
        bodies.push(
          new Promise<void>((resolve) => {
            done = resolve;
          }),
        );
        try {
          while (parked && !(respectAbort && signal?.aborted === true)) {
            ticks += 1;
            await new Promise<void>((resolve) => setTimeout(resolve, tickMs));
          }
          return makeHealthCheckResult({ checkId: id, message: "released" });
        } finally {
          inFlight -= 1;
          done();
        }
      },
    });

    return {
      id,
      starts: () => starts,
      ticks: () => ticks,
      hasSettled: () => starts > 0 && inFlight === 0,
    };
  };

  const registerModCheck = ({ id, gameId: checkGameId }: IModCheckOpts): string => {
    registry.register(
      makeModHealthCheck({
        id,
        gameId: checkGameId,
        name: id,
        triggers: [HealthCheckTrigger.ModsChanged, HealthCheckTrigger.Manual],
        checkMod: async () => makeHealthCheckResult({ checkId: id }),
      }),
    );
    return id;
  };

  return {
    ...base,
    registry,
    gameId,
    parkCheck,
    registerModCheck,
    // the registry keys off arbitrary extension-supplied ids, not just the built-in union
    run: (id: string) => registry.runHealthCheck(id as HealthCheckId, base.api, true),
    resultFor: (id: string) => registry.get(id as HealthCheckId)?.lastResult,
    releaseParked: async () => {
      releases.forEach((release) => release());
      await Promise.all(bodies);
      // Let the fire-and-forget completion handling that follows a settled body run - and, with
      // it, any rerun that handling schedules after a collision - before cancelling it below.
      await new Promise((resolve) => setTimeout(resolve, 0));
      registry.cancelPendingReruns();
    },
  };
}

/**
 * Api harness for the mod enable/disable/remove analytics: a seeded fake api plus a mixpanel
 * collector. Tests seed mods/profiles via `overrides` then either call the emit helpers directly
 * or drive the real (exported) onRemoveMods and assert the mods_state_changed / mods_removed events.
 */
export function makeModChangeHarness(
  overrides: Partial<IDriverHarnessState> = {},
): IModChangeHarness {
  const base = makeApiHarness(overrides);
  const mixpanelEvents = collectMixpanelEvents(base.api);
  return { ...base, mixpanelEvents };
}

/**
 * Harness for the IPCDownloadAdapter (the renderer side of the download IPC). Seeds one paused
 * download and constructs the REAL adapter against the fake api (makeApiHarness), then replaces the
 * window.api.downloader IPC boundary with a mock - unlike the driver/manager harnesses there is no
 * in-process collaborator to fake, only the main-process seam. start() invokes the resolve handler
 * the adapter registers (as main would) and resolves `started` so a test can await a restart. The
 * ctor is passed in (like makeDriverHarness) to keep the heavy adapter import out of builders.
 *
 * The suite owns the window.api save/restore and fake timers (the adapter's poll loop): capture
 * window.api in beforeEach and restore it in afterEach.
 */
export function makeDownloadAdapterHarness(
  AdapterCtor: new (api: IExtensionApi) => IPCDownloadAdapter,
  opts: IDownloadAdapterOpts = {},
): IDownloadAdapterHarness {
  const downloadId = "dl-0";
  const download = makeDownload({
    id: downloadId,
    state: "paused",
    game: ["skyrimse"],
    urls: ["https://cdn.example/file.bin"],
    localPath: "file.bin",
    size: 100,
    ...opts.download,
  });

  const base = makeApiHarness({ downloads: { [downloadId]: download } });
  base.setState((draft) => {
    // the collection harness only seeds session.collections; the adapter also reads knownGames
    // (session.gameMode.known), the automation setting, and the checkpoints slice
    const state = draft as unknown as {
      session: { gameMode: { known: unknown[] } };
      settings: { automation: { install: boolean } };
      persistent: { downloads: { checkpoints: Record<string, WireDownloadCheckpoint> } };
    };
    state.session.gameMode = { known: [] };
    state.settings.automation = { install: opts.automationInstall ?? false };
    state.persistent.downloads.checkpoints =
      opts.checkpoint !== undefined ? { [downloadId]: { ...opts.checkpoint, downloadId } } : {};
  });

  // the same computation the adapter runs, so a test can assert start() was called with this exact
  // destination regardless of how downloadPathForGame resolves the path pattern
  const dest = path.join(
    downloadPathForGame(base.getState(), download.game[0]),
    download.localPath ?? "",
  );

  // window.api.downloader is the IPC boundary to the main-process downloader; mock it. start()
  // drives the resolve handler the adapter registered, then resolves `started`.
  let resolveHandler: ((collationId: number) => Promise<WireResolvedResource>) | undefined;
  const started = { resolve: (): void => undefined, promise: Promise.resolve() };
  started.promise = new Promise<void>((r) => (started.resolve = r));

  const resume = vi.fn().mockResolvedValue(undefined);
  const getStates = vi.fn().mockResolvedValue({});
  const start = vi
    .fn()
    .mockImplementation(async (_dest: string, collationId: number, id?: string) => {
      await resolveHandler?.(collationId);
      started.resolve();
      return { downloadId: id ?? `new-${collationId}` };
    });
  const downloader = {
    onResolve: vi.fn((handler: (collationId: number) => Promise<WireResolvedResource>) => {
      resolveHandler = handler;
      return () => undefined;
    }),
    getState: vi.fn(),
    getStates,
    configure: vi.fn().mockResolvedValue(undefined),
    start,
    resume,
    pause: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
  } as unknown as DownloaderApi;
  window.api = { log: vi.fn(), downloader } as unknown as Api;

  const adapter = new AdapterCtor(base.api);

  return {
    ...base,
    adapter,
    downloadId,
    dest,
    events: base.api.events,
    started,
    start,
    resume,
    getStates,
  };
}

let loEntrySeq = 0;

export function makeLoadOrderEntry(overrides: Partial<ILoadOrderEntry> = {}): ILoadOrderEntry {
  const id = overrides.id ?? `entry-${(loEntrySeq += 1)}.pak`;
  return {
    id,
    name: id,
    enabled: true,
    ...overrides,
  };
}

/**
 * The shared api harness plus an observable Nexus connection, for the nxm protocol handler.
 * Defaults to one known game so an nxm domain resolves without every suite spelling that out.
 *
 * The nexus methods are vi.fn()s that reject by default: a test states the one call it exercises,
 * and any unexpected request fails loudly instead of resolving to undefined.
 */
export function makeNxmHarness(opts: Partial<IDriverHarnessState> = {}): INxmHarness {
  const base = makeApiHarness({ knownGames: [makeGameStored()], ...opts });

  const rejectUnexpected = (name: string) => () =>
    Promise.reject(new Error(`unexpected nexus.${name} call`));

  const getDownloadURLs = vi.fn(rejectUnexpected("getDownloadURLs"));
  const getCollectionRevisionGraph = vi.fn(rejectUnexpected("getCollectionRevisionGraph"));
  const getCollectionDownloadLink = vi.fn(rejectUnexpected("getCollectionDownloadLink"));
  const getModFiles = vi.fn(rejectUnexpected("getModFiles"));

  const nexus = {
    getDownloadURLs,
    getCollectionRevisionGraph,
    getCollectionDownloadLink,
    getModFiles,
  } as unknown as NexusT;

  return {
    ...base,
    nexus,
    freeUserQueue: () => base.getState().session["nexus"].freeUserDLQueue ?? [],
    setUserInfo: (userInfo) => {
      base.setState((draft) => {
        draft.persistent["nexus"].userInfo = userInfo;
      });
    },
    getDownloadURLs,
    getCollectionRevisionGraph,
    getCollectionDownloadLink,
    getModFiles,
  };
}
