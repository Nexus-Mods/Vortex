import { IAttributeState } from './IAttributeState';
import { IDialog } from './IDialog';
import { INotification } from './INotification';

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
 * state regarding application settings
 * 
 * @export
 * @interface ISettings
 */
export interface ISettings {
  gameMode: string;
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

/**
 * interface for the top-level state object
 * this should precisely mirror the reducer structure
 * 
 * @export
 * @interface IState
 */
export interface IState {
  account: { };
  window: { base: IWindow };
  notifications: INotificationState;
  session: { base: ISession };
  settings: { };
  persistent: { tables: ITableStates };
  gameSettings: { };
}
