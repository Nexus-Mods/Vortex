import { INotification } from './INotification';
import * as Promise from 'bluebird';
import * as React from 'react';

interface IRegisterSettings {
  (title: string, element: React.ComponentClass<any>): void;
}

interface IRegisterIcon {
  (group: string, icon: string, title: string, action: () => void): void;
}

interface IRegisterMainPage {
  (icon: string, title: string, element: React.ComponentClass<any>): void;
}

export interface IFileFilter {
  name: string;
  extensions: string[];
}

export interface IOpenOptions {
  title?: string;
  defaultPath?: string;
  filters?: IFileFilter[];
}

/**
 * interface for convenience functions made available to extensions 
 * 
 * @export
 * @interface IExtensionApi
 */
export interface IExtensionApi {
  /**
   * show a notification to the user.
   * This is not available in the call to registerReducer
   * 
   * @type {INotification}
   * @memberOf IExtensionApi
   */
  sendNotification?: (notification: INotification) => void;

  /**
   * show an error message to the user.
   * This is a convenience wrapper for sendNotification.
   * This is not available in the call to registerReducer
   * 
   * @memberOf IExtensionApi
   */
  showErrorNotification?: (message: string, detail: string) => void;

  /**
   * hides a notification by its id
   * 
   * @memberOf IExtensionApi
   */
  dismissNotification?: (id: string) => void;

  /**
   * show a system dialog to open a single file
   * 
   * @memberOf IExtensionApi
   */
  selectFile: (options: IOpenOptions) => Promise<string>;

  /**
   * the redux store
   * 
   * @type {Redux.Store<any>}
   * @memberOf IExtensionApi
   */
  store?: Redux.Store<any>;
}

/**
 * specification a reducer registration has to follow.
 * defaults must be an object with the same keys as
 * reducers
 * 
 * @export
 * @interface IReducerSpec
 */
export interface IReducerSpec {
  reducers: { [key: string]: (state: any, payload: any) => any };
  defaults: { [key: string]: any };
}

export interface IExtensionContext {
  /**
   * register a settings page
   * 
   * @type {IRegisterSettings}
   * @memberOf IExtensionContext
   */
  registerSettings: IRegisterSettings;

  /**
   * register a toolbar icon
   * 
   * @type {IRegisterIcon}
   * @memberOf IExtensionContext
   */
  registerIcon: IRegisterIcon;

  /**
   * registers a page for the main content area
   * 
   * @type {IRegisterMainPage}
   * @memberOf IExtensionContext
   */
  registerMainPage: IRegisterMainPage;

  /**
   * register a reducer to introduce new set-operations on the application
   * state.
   * Note: For obvious reasons this is called before the store is set up so
   * many api operations are not possible during this call
   * 
   * @memberOf IExtensionContext
   */
  registerReducer: (path: string[], IReducerSpec) => void;

  /**
   * called once after the store has been set up
   * 
   * @memberOf IExtensionContext
   */
  once: (callback: () => void) => void;

  /**
   * contains various utility functions. It's valid to store this object inside
   * the extension for later use.
   * 
   * @type {IExtensionApi}
   * @memberOf IExtensionContext
   */
  api: IExtensionApi;
}
