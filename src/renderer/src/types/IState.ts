import type { EndorsedStatus, ICollection, IRevision } from "@nexusmods/nexus-api";
import type { IParameters } from "@vortex/shared/cli";
import type { DownloadCheckpoint } from "@vortex/shared/download";

import type { ICategoryDictionary } from "../extensions/category_management/types/ICategoryDictionary";
import type { IDownload } from "../extensions/download_management/types/IDownload";
import type { IDiscoveryResult } from "../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type { IHealthCheckPersistentState } from "../extensions/health_check/reducers/persistent";
import type { IHealthCheckSessionState } from "../extensions/health_check/reducers/session";
import type { IHistoryPersistent, IHistoryState } from "../extensions/history_management/reducers";
import type { IMod } from "../extensions/mod_management/types/IMod";
import type { IProfile } from "../extensions/profile_management/types/IProfile";
import type { IUpdaterSessionState } from "../extensions/updater/reducers";
import type { ICollectionInstallState } from "./collections/ICollectionInstallSession";
import type { ExtensionType, IAvailableExtension, IExtension } from "./extensions";
import type { IAttributeState } from "./IAttributeState";
import type { IDialog } from "./IDialog";
import type { INotification } from "./INotification";
import type { VortexInstallType } from "./VortexInstallType";

// re-export these to keep the imports from extensions local
export type { IDownload, IDiscoveryResult, IGameStored, IMod, IProfile };
import type { IDimensions, IPosition, IWindow } from "@vortex/shared/state";
export type { IDimensions, IPosition, IWindow };

/**
 * state regarding all manner of user interaction
 *
 * @export
 * @interface INotificationState
 */
export interface INotificationState {
  notifications: INotification[];
  global_notifications: INotification[];
  dialogs: IDialog[];
}

export type ExtensionLoadFailureException = {
  id: "exception";
  args: {
    message: string;
  };
};

export type ExtensionLoadFailureDependency = {
  id: "dependency";
  args: {
    dependencyId: string;
    version?: string;
  };
};

export type IExtensionLoadFailure =
  | {
      id: "unsupported-api" | "unsupported-version";
    }
  | ExtensionLoadFailureException
  | ExtensionLoadFailureDependency;

export interface IExtensionOptional {
  id: string;
  extensionPath: string;
  args: { [key: string]: any };
}

export interface IProgress {
  text: string;
  percent: number;
}

export interface IRunningTool {
  started: number;
  exclusive: boolean;
  pid: number;
}

export interface IUIBlocker {
  icon: string;
  description: string;
  mayCancel: boolean;
}

export interface IProgressWithProfile {
  profile?: IProgressProfile;
}

export interface IProgressProfile {
  deploying?: IProgressProfileDeploying;
}

export interface IProgressProfileDeploying {
  percent: number;
  text: string;
}

/**
 * "ephemeral" session state.
 * This state is generated at startup and forgotten at application exit
 *
 * @export
 * @interface ISession
 */
export interface ISession {
  displayGroups: { [id: string]: string };
  overlayOpen: boolean;
  visibleDialog: string;
  mainPage: string;
  secondaryPage: string;
  activity: { [id: string]: string[] };
  progress: {
    [group: string]: { [id: string]: IProgress };
  } & IProgressWithProfile;
  settingsPage: string;
  extLoadFailures: { [extId: string]: IExtensionLoadFailure[] };
  toolsRunning: { [exeId: string]: IRunningTool };
  uiBlockers: { [id: string]: IUIBlocker };
  networkConnected: boolean;
  commandLine: IParameters;
  downloadGameFilter: string | null;
}

export interface IRowState {
  selected: boolean;
  highlighted: boolean;
}

export interface ITableState {
  attributes: { [id: string]: IAttributeState };
  rows: { [id: string]: IRowState };
  groupBy?: string;
  filter?: { [id: string]: any };
}

export interface IExtensionState {
  enabled: boolean | "failed";

  /** Set true for extensions pending removal. */
  remove: boolean;

  /** Display name of the extension. */
  name: string;
  /** Human-readable description of the extension. */
  description: string;
  /** Extension author display name. */
  author: string;
  /** File version */
  version: string;

  /** Path to the extension folder on disk. */
  path: string;

  /** True for extensions shipped with Vortex. */
  bundled?: boolean;
  /** Extension type. */
  type?: ExtensionType;
  /** Author provided extension ID from the info.json file. Only relevant for extension dependency check, should never
   * be used directly otherwise.*/
  infoJsonId?: string;

  /** Nexus Mods mod ID for this extension. */
  modId?: number;
  /** Nexus Mods file ID for this specific version of the extension. */
  fileId?: number;
  /** Nexus Mods endorsed status of the extension mod page. */
  endorsed: EndorsedStatus;
}

/**
 * settings relating to the vortex application itself
 */
export interface IApp {
  instanceId: string;
  version: string;
  appVersion: string;
  extensions: { [id: string]: IExtensionState };
  warnedAdmin: number;
  installType: VortexInstallType;
  /** Whether the updater runs at all. Decided in main, see isUpdaterActive. */
  updaterActive: boolean;
  migrations: string[];
}

/**
 * settings relating to the user (os account) personally
 * even in a multi-user environment
 *
 * @export
 * @interface IUser
 */
export interface IUser {
  multiUser: boolean;
}

export interface ITableStates {
  [id: string]: ITableState;
}

/** What the user pinned to, or took off, one toolbar — keyed by action id. */
export interface IToolbarState {
  pinned: { [actionId: string]: boolean };
}

export interface IToolbarStates {
  [toolbarId: string]: IToolbarState;
}

export interface IStateDownloads {
  speed: number;
  speedHistory: number[];
  files: { [id: string]: IDownload };
  checkpoints: { [id: string]: DownloadCheckpoint<string> };
}

export interface IDashletSettings {
  enabled: boolean;
  width: number;
  height: number;
}

export interface ISettingsInterface {
  language: string;
  advanced: boolean;
  profilesVisible: boolean;
  desktopNotifications: boolean;
  hideTopLevelCategory: boolean;
  relativeTimes: boolean;
  dashboardLayout: string[];
  foregroundDL: boolean;
  dashletSettings: { [dashletId: string]: IDashletSettings };
  usage: { [usageId: string]: boolean };
  tools?: {
    addToolsToTitleBar: boolean;
    order?: { [gameId: string]: string[] };
    pinned?: { [gameId: string]: { [toolId: string]: boolean } };
  };
  primaryTool?: { [gameId: string]: string };
}

export interface ISettingsAutomation {
  deploy: boolean;
  install: boolean;
  enable: boolean;
  start: boolean;
  minimized: boolean;
}

export interface ISettingsProfiles {
  activeProfileId: string;
  nextProfileId: string;
  lastActiveProfile: { [gameId: string]: string };
}

export interface ISettingsGameMode {
  discovered: { [id: string]: IDiscoveryResult };
  searchPaths: string[];
  pickerLayout: "list" | "small" | "large";
  sortManaged: string;
  sortUnmanaged: string;
}

export interface ISettingsDownloads {
  minChunkSize: number;
  maxChunks: number;
  maxParallelDownloads: number;
  maxBandwidth: number;
  path: string;
  showDropzone: boolean;
  showGraph: boolean;
  copyOnIFF: boolean;
  collectionsInstallWhileDownloading: boolean;
}

export interface IStatePaths {
  base: string;
  download: string;
  install: string;
}

export type InstallPathMode = "userData" | "suggested";

export interface ISettingsMods {
  installPath: { [gameId: string]: string };
  modlistState: { [id: string]: IAttributeState };
  activator: { [gameId: string]: string };
  installPathMode: InstallPathMode;
  suggestInstallPathDirectory: string;
  showDropzone: boolean;
  confirmPurge: boolean;
  cleanupOnDeploy: boolean;
  installerSandbox: boolean;
}

export interface ISettingsNotification {
  suppress: { [notificationId: string]: boolean };
}

export const UPDATE_CHANNELS = ["stable", "beta", "none"] as const;

type ValuesOf<T extends readonly any[]> = T[number];

export type UpdateChannel = ValuesOf<typeof UPDATE_CHANNELS>;

/**
 * Persisted state may still hold a retired channel: "next" existed for years and was only ever
 * a second name for beta. Anything unrecognised reads as stable rather than being passed on.
 */
export function toUpdateChannel(value: unknown): UpdateChannel {
  return UPDATE_CHANNELS.includes(value as UpdateChannel) ? (value as UpdateChannel) : "stable";
}

export interface ISettingsUpdate {
  channel: UpdateChannel;
}

export interface ISettingsWorkarounds {
  userSymlinks: boolean;
}

export interface ISettings {
  interface: ISettingsInterface;
  automation: ISettingsAutomation;
  gameMode: ISettingsGameMode;
  profiles: ISettingsProfiles;
  window: IWindow;
  downloads: ISettingsDownloads;
  mods: ISettingsMods;
  notifications: ISettingsNotification;
  tables: ITableStates;
  toolbars: IToolbarStates;
  update: ISettingsUpdate;
  workarounds: ISettingsWorkarounds;
}

export interface IStateTransactions {
  transfer: {};
  // keyed by profile id, then by collection mod id: a durable "this profile still needs its
  // plugins sorted/enabled" marker. Set when a collection install begins, cleared only when a
  // plugin sort actually succeeds, so an interrupted install is recovered on the next activation
  // of the profile (deploy then sort). Written by the collections install flow but read/cleared by
  // gamebryo plugin management, so it lives in this cross-extension slice rather than on either
  // extension's own state. The value is the epoch-ms time the marker was queued.
  pendingPluginSort: Record<string, Record<string, number>>;
}

export interface ISessionGameMode {
  known: IGameStored[];
  addDialogVisible: boolean;
  disabled: { [gameId: string]: string };
  showHidden: boolean;
}

export interface IGameInfoEntry {
  key: string;
  provider: string;
  priority: number;
  expires: number;
  title: string;
  value: any;
  type?: string;
}

export interface IStateGameMode {
  gameInfo: {
    [gameId: string]: {
      [key: string]: IGameInfoEntry;
    };
  };
}

export interface IBrowserState {
  url: string;
  instructions: string;
  subscriber: string;
  skippable: boolean;
}

export interface IModTable {
  [gameId: string]: {
    [modId: string]: IMod;
  };
}

export interface IOverlay {
  title: string;
  content?: string; // Text/markdown content
  componentId?: string; // Registry ID for React components
  position: IPosition;
  options?: IOverlayOptions;
}

export interface IOverlayOptions {
  containerTitle?: string;
  showIcon?: boolean;
  className?: string;
  disableCollapse?: boolean;
  id?: string;
  props?: any;
}

export interface IOverlaysState {
  overlays: { [key: string]: IOverlay };
}

/**
 * interface for the top-level state object
 * this should precisely mirror the reducer structure
 *
 * @export
 * @interface IState
 */
// persistent state owned by the collections extension: the cached collection and
// revision info fetched from the API
export interface ICollectionsPersistentState {
  // keyed by collection id
  collections: Record<string, { timestamp: number; info: ICollection }>;
  // keyed by revision id
  revisions: Record<string, { timestamp: number; info: IRevision }>;
  // keyed by revision id; queued success votes awaiting submission
  pendingVotes: Record<string, { collectionSlug: string; revisionNumber: number; time: number }>;
}

export interface ISessionState {
  base: ISession;
  collections: ICollectionInstallState;
  gameMode: ISessionGameMode;
  discovery: IDiscoveryState;
  notifications: INotificationState;
  browser: IBrowserState;
  history: IHistoryState;
  overlays: IOverlaysState;
  healthCheck: IHealthCheckSessionState;
  updater: IUpdaterSessionState;
}

export interface IState {
  app: IApp;
  user: IUser;
  confidential: {
    account: {};
  };
  session: ISessionState;
  settings: ISettings;
  persistent: {
    profiles: { [profileId: string]: IProfile };
    mods: IModTable;
    downloads: IStateDownloads;
    collections: ICollectionsPersistentState;
    categories: { [gameId: string]: ICategoryDictionary };
    gameMode: IStateGameMode;
    deployment: {
      needToDeploy: { [gameId: string]: boolean };
      deploymentCounter: { [gameId: string]: number };
    };
    transactions: IStateTransactions;
    history: IHistoryPersistent;
    healthCheck: IHealthCheckPersistentState;
  };
}

export interface IDiscoveryPhase {
  progress: number;
  directory: string;
}

/**
 * state of the (lengthy) gamemode discovery
 *
 * @export
 * @interface IDiscoveryState
 */
export interface IDiscoveryState {
  running: boolean;
  phases: { [id: number]: IDiscoveryPhase };
}

/**
 * gamemode-related application settings
 *
 * @export
 * @interface ISettings
 */
export interface IGameModeSettings {}
