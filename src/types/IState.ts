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

export interface IAccount {
  APIKey: string;
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
 * interface for the top-level state object
 * this should precisely mirror the reducer structure
 * 
 * @export
 * @interface IState
 */
export interface IState {
  account: { base: IAccount };
  window: { base: IWindow };
  notifications: INotificationState;
  session: { };
  settings: { };
  gameSettings: { };
}
