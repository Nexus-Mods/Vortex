import { IAttributeState } from './IAttributeState';
import { IDialog } from './IDialog';
import { INotification } from './INotification';

import { IDownload } from '../extensions/download_management/types/IDownload';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import { IMod } from '../extensions/mod_management/types/IMod';
import { IProfile } from '../extensions/profile_management/types/IProfile';

/**
 * interface to represent a position on the screen
 * 
 * @export
 * @interface IPosition
 */
export interface IPosition {
  x: number;
  y: number;
}

/**
 * interface to represent pixel-dimensions on the screen 
 * 
 * @export
 * @interface IDimensions
 */
export interface IDimensions {
  height: number;
  width: number;
}

/**
 * interface for window state
 * 
 * @export
 * @interface IWindow
 */
export interface IWindow {
  maximized: boolean;
  position?: IPosition;
  size: IDimensions;
  tabsMinimized: boolean;
}

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

/**
 * "ephemeral" session state. 
 * This state is generated at startup and forgotten at application exit
 *
 * @export
 * @interface ISession
 */
export interface ISession {
  displayGroups: { [id: string]: string };
}

export interface IRowState {
  selected: boolean;
}

export interface ITableState {
  attributes: { [id: string]: IAttributeState };
  rows: { [id: string]: IRowState };
}

export interface ITableStates {
  [id: string]: ITableState;
}

export interface IStateDownloads {
  speed: number;
  speedHistory: number[];
  files: { [id: string]: IDownload };
}

export interface ISettingsInterface {
  language: string;
}

export interface ISettingsProfiles {
  activeProfileId: string;
}

export interface ISettingsGameMode {
  lastActiveProfile: { [gameId: string]: string };
  discovered: { [id: string]: IDiscoveryResult };
  searchPaths: string[];
}

export interface ISettingsDownloads {
    minChunkSize: number;
    maxChunks: number;
    maxParallelDownloads: number;
}

export interface ISettings {
  interface: ISettingsInterface;
  gameMode: ISettingsGameMode;
  profiles: ISettingsProfiles;
  window: IWindow;
  downloads: ISettingsDownloads;
}

export interface ISessionGameMode {
  known: IGameStored[];
}

/**
 * interface for the top-level state object
 * this should precisely mirror the reducer structure
 * 
 * @export
 * @interface IState
 */
export interface IState {
  confidential: {
    account: { },
  };
  session: {
    base: ISession,
    gameMode: ISessionGameMode,
    discovery: IDiscoveryState,
    notifications: INotificationState;
  };
  settings: ISettings;
  persistent: {
    tables: ITableStates,
    profiles: { [profileId: string]: IProfile },
    mods: { [gameId: string]: { [modId: string]: IMod } },
    downloads: IStateDownloads,
  };
}

/**
 * state of the (lengthy) gamemode discovery
 * 
 * @export
 * @interface IDiscoveryState
 */
export interface IDiscoveryState {
  running: boolean;
  progress: number;
  directory: string;
}

/**
 * gamemode-related application settings
 * 
 * @export
 * @interface ISettings
 */
export interface IGameModeSettings {
}
