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
import type { WireDownloadCheckpoint, WireResolvedResource } from "@vortex/shared/ipc";
import type { Api, DownloaderApi } from "@vortex/shared/preload";
import { batch } from "redux-act";
import { vi } from "vitest";

import type { MixpanelEvent } from "../extensions/analytics/mixpanel/MixpanelEvents";
import { MOD_TYPE } from "../extensions/collections/constants";
import type {
  ICollectionMod,
  ICollectionModRule,
} from "../extensions/collections/types/ICollection";
import type InstallDriver from "../extensions/collections/util/InstallDriver";
import { downloadPathForGame } from "../extensions/download_management/selectors";
import type { IDownload, IModInfo } from "../extensions/download_management/types/IDownload";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
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
import type { IState } from "../types/IState";
import local from "../util/local";
import type {
  IApiHarness,
  IDownloadAdapterHarness,
  IDownloadAdapterOpts,
  IDriverHarness,
  IDriverHarnessState,
  IInstallContextHarness,
  IInstallManagerHarness,
  IModChangeHarness,
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
    },
    session: { collections: slices.session },
    settings: {
      // download path pattern so downloadPathForGame resolves a concrete per-game folder
      downloads: { collectionsInstallWhileDownloading: false, path: "{USERDATA}\\downloads" },
      interface: { language: "en" },
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
  };

  const dispatch = (action: ITrackedAction) => {
    apply(action);
    return action;
  };

  const events = new EventEmitter();
  events.setMaxListeners(0);

  let nextDialog: IDialogResult = { action: "Continue", input: {} };
  const dialogCalls: Array<{ type: DialogType; title: string }> = [];

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
    sendNotification: () => undefined,
    dismissNotification: () => undefined,
    showErrorNotification: () => undefined,
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
  };
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
