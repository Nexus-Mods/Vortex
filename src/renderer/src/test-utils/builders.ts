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

import { batch } from "redux-act";

import type InstallDriver from "../extensions/collections/util/InstallDriver";
import type { IDownload, IModInfo } from "../extensions/download_management/types/IDownload";
import { modsReducer } from "../extensions/mod_management/reducers/mods";
import type {
  IChoiceType,
  IFileListItem,
  IMod,
  IModPatches,
  IModReference,
  IModRule,
} from "../extensions/mod_management/types/IMod";
import type { IModLookupInfo } from "../extensions/mod_management/util/testModReference";
import type { IProfile, IProfileMod } from "../extensions/profile_management/types/IProfile";
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

export type { CollectionModStatus };

/** A dispatched redux-act action as the harness sees it. */
interface ITrackedAction {
  type: string;
  payload?: unknown;
}

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

/** The redux slices an InstallDriver test arranges, each a builder-style override. */
export interface IDriverHarnessState {
  // installed mods, keyed by gameId then modId (state.persistent.mods)
  mods: Record<string, Record<string, IMod>>;
  // downloads, keyed by download id (state.persistent.downloads.files)
  downloads: Record<string, IDownload>;
  // profiles, keyed by profile id (state.persistent.profiles)
  profiles: Record<string, IProfile>;
  // the install-tracking slice (state.session.collections)
  session: ICollectionInstallState;
}

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
      downloads: { collectionsInstallWhileDownloading: false },
      interface: { language: "en" },
      gameMode: { discovered: {} },
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

export interface IApiHarness {
  api: IExtensionApi;
  // every dispatched action, batched actions flattened, in order
  dispatched: ITrackedAction[];
  // emit a global event (runs any registered on/onAsync listeners synchronously)
  emit: (event: string, ...args: unknown[]) => void;
  // read the live fake state
  getState: () => IState;
  // mutate the state mid-test (to model churn between events)
  setState: (mutate: (draft: IState) => void) => void;
  // configure what the next showDialog call resolves to
  setNextDialog: (result: IDialogResult) => void;
  // showDialog calls, recorded in order
  dialogCalls: Array<{ type: DialogType; title: string }>;
}

export interface IDriverHarness extends IApiHarness {
  // the driver under test, constructed against the fake api
  driver: InstallDriver;
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
