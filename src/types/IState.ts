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
}

/**
 * interface for the top-level state object
 * this should precisely mirror the reducer structure
 * 
 * @export
 * @interface IState
 */
export interface IState {
  window: IWindow;
}
