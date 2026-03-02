import type { ICategoryDictionary } from "../extensions/category_management/types/ICategoryDictionary";
import type { ICollectionInstallState } from "../extensions/collections_integration/types";
import type { IDownload } from "../extensions/download_management/types/IDownload";
import type { IDiscoveryResult } from "../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type {
  IHistoryPersistent,
  IHistoryState,
} from "../extensions/history_management/reducers";
import type { IMod } from "../extensions/mod_management/types/IMod";
import type { IProfile } from "../extensions/profile_management/types/IProfile";
import type { IParameters } from "@vortex/shared/cli";
import type { IAvailableExtension, IExtension } from "./extensions";
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
  dialogs: IDialog[];
}

export interface IExtensionLoadFailure {
  id: string;
  args?: { [key: string]: any };
}

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
  activity: { [id: string]: string };
  progress: {
    [group: string]: { [id: string]: IProgress };
  } & IProgressWithProfile;
  settingsPage: string;
  extLoadFailures: { [extId: string]: IExtensionLoadFailure[] };
  toolsRunning: { [exeId: string]: IRunningTool };
  uiBlockers: { [id: string]: IUIBlocker };
  networkConnected: boolean;
  commandLine: IParameters;
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
  version: string;
  remove: boolean;
  endorsed: string;
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

export interface IStateDownloads {
  speed: number;
  speedHistory: number[];
  files: { [id: string]: IDownload };
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

export const UPDATE_CHANNELS = ["stable", "beta", "next", "none"] as const;

type ValuesOf<T extends readonly any[]> = T[number];

export type UpdateChannel = ValuesOf<typeof UPDATE_CHANNELS>;

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
  update: ISettingsUpdate;
  workarounds: ISettingsWorkarounds;
}

export interface IStateTransactions {
  transfer: {};
}

export interface ISessionGameMode {
  known: IGameStored[];
  addDialogVisible: boolean;
  disabled: { [gameId: string]: string };
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
export interface IState {
  app: IApp;
  user: IUser;
  confidential: {
    account: {};
  };
  session: {
    base: ISession;
    collections: ICollectionInstallState;
    gameMode: ISessionGameMode;
    discovery: IDiscoveryState;
    notifications: INotificationState;
    browser: IBrowserState;
    history: IHistoryState;
    overlays: IOverlaysState;
    extensions: {
      available: IAvailableExtension[];
      optional: { [extId: string]: IExtensionOptional[] };
      installed: { [extId: string]: IExtension };
      updateTime: number;
    };
  };
  settings: ISettings;
  persistent: {
    profiles: { [profileId: string]: IProfile };
    mods: IModTable;
    downloads: IStateDownloads;
    categories: { [gameId: string]: ICategoryDictionary };
    gameMode: IStateGameMode;
    deployment: { needToDeploy: { [gameId: string]: boolean } };
    transactions: IStateTransactions;
    history: IHistoryPersistent;
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
