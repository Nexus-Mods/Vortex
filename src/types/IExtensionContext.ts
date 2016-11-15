import { INotification } from './INotification';
import * as Promise from 'bluebird';
import { IModInfo } from 'modmeta-db';
import * as React from 'react';

export type PropsCallback = () => Object;

export interface IRegisterSettings {
  (title: string, element: React.ComponentClass<any>, props?: PropsCallback): void;
}

export interface IRegisterIcon {
  (group: string,
   icon: string | React.ComponentClass<any>,
   title?: string | PropsCallback,
   action?: () => void): void;
}

export interface IRegisterFooter {
  (id: string, element: React.ComponentClass<any>, props?: PropsCallback): void;
}

export interface IMainPageOptions {
  hotkey?: string;
}

export interface IRegisterMainPage {
  (icon: string, title: string, element: React.ComponentClass<any>,
   options: IMainPageOptions): void;
}

export interface IRegisterProtocol {
  (protocol: string, callback: (url: string) => void);
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

export interface IStateChangeCallback {
  (previous: any, current: any): void;
}

/**
 * additional detail to further narrow down which file is meant
 * in a lookup
 * 
 * @export
 * @interface ILookupDetails
 */
export interface ILookupDetails {
  gameId?: string;
  modId?: string;
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
   * show a system dialog to select an executable file
   * 
   * @memberOf IExtensionApi
   */
  selectExecutable: (options: IOpenOptions) => Promise<string>;

  /**
   * show a system dialog to open a single directory
   * 
   * @memberOf IExtensionApi
   */
  selectDir: (options: IOpenOptions) => Promise<string>;

  /**
   * the redux store
   * 
   * @type {Redux.Store<any>}
   * @memberOf IExtensionApi
   */
  store?: Redux.Store<any>;

  /**
   * event emitter
   * 
   * @type {NodeJS.EventEmitter}
   * @memberOf IExtensionApi
   */
  events: NodeJS.EventEmitter;

  /**
   * retrieve path for a known directory location.
   * 
   * Note: This uses electrons ids for known folder locations.
   * Please write your extensions to always use the appropriate
   * folder location returned from this function, especially
   * 'userData' should be used for all settings/state/temporary data
   * if you don't want to/can't use the store.
   * If NMM2 introduces a way for users to customise storage locations
   * then getPath will return the customised path so you don't have to
   * adjust your extension.
   * 
   * @type {Electron.AppPathName}
   * @memberOf IExtensionApi
   */
  getPath: (name: Electron.AppPathName) => string;

  /**
   * register a callback for changes to the state
   * 
   * @param {string[]} path path in the state-tree to watch for changes,
   *                   i.e. [ 'settings', 'interface', 'language' ] would call the callback
   *                   for all changes to the interface language  
   * 
   * @memberOf IExtensionApi
   */
  onStateChange?: (path: string[], callback: IStateChangeCallback) => void;

  /**
   * registers an uri protocol to be handled by this application
   * 
   * @type {IRegisterProtocol}
   * @memberOf IExtensionContext
   */
  registerProtocol: IRegisterProtocol;

  /**
   * deregister an uri protocol currently being handled by us
   * 
   * @memberOf IExtensionApi
   */
  deregisterProtocol: (protocol: string) => void;

  /**
   * find meta information about a mod
   * this will calculate a hash and the file size of the specified file
   * for the lookup.
   * Please note that it's still possible for the file to get multiple
   * matches, i.e. if it has been re-uploaded, potentially for a different
   * game.
   * 
   * @memberOf IExtensionApi
   */
  lookupModMeta: (filePath: string, details: ILookupDetails) => Promise<ILookupDetails[]>;

  /**
   * save meta information about a mod
   * 
   * @memberOf IExtensionApi
   */
  saveModMeta: (modInfo: IModInfo) => Promise<void>;
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
   * registers a element to be displayed in the footer
   * 
   * @type {IRegisterFooter}
   * @memberOf IExtensionContext
   */
  registerFooter: IRegisterFooter;

  /**
   * register a reducer to introduce new set-operations on the application
   * state.
   * Note: For obvious reasons this is executed before the store is set up so
   * many api operations are not possible during this call
   * 
   * The first part of the path decides how and if settings are persisted:
   *   * window, settings, account are always persisted and automatically restored
   *   * gameSettings are persisted on a per-game basis and will be restored when
   *     the game mode changes
   *   * session and all other will not be persisted at all. Although session is not
   *     treated different than any other path, please use this path  for all
   *     ephemeral state
   *
   * Another word on the path: You can introduce additional reducers for any "leaf" of
   *   the settings tree and you can introduce new "subnodes" in the tree at any depth.
   *   For technical reasons it is however not possible to introduce subnodes to a leaf
   *   or vice-verso.
   *   I.e. settings.interface contains all settings regarding the ui. Your extension
   *   can register a reducer with path ['settings', 'interface'] and ['settings', 'whatever']
   *   but NOT ['settings'] and NOT ['settings', 'interface', 'somethingelse']
   *
   * And one more thing about the spec: All things you store inside the store need to be
   *   serializable. This means: strings, numbers, booleans, arrays, objects are fine but
   *   functions are not. If you absolutely need to store a callback or something then create
   *   a "registry" or factory and store just an id that allows you to retrieve or generate
   *   the function on demand. 
   * 
   * @param path The path within the settings store
   * @param spec a IReducerSpec object that contains reducer functions and defaults
   *        for the newly introduced settings
   * 
   * @memberOf IExtensionContext
   */
  registerReducer: (path: string[], spec: IReducerSpec) => void;

  /**
   * register an extension function which allows other extensions to extend this one.
   * React components can also use the extend() function from ExtensionProvider for
   * the same purpose
   * 
   * @memberOf IExtensionContext
   */
  registerExtensionFunction: (name: string, callback: Function) => void;

  /**
   * register a stylesheet file to be loaded in the page
   * This is expected to be a less file and it will be compiled to css at startup
   * time together will all other extensions and variables.less. This means you can
   * access all the variables defined there.
   * 
   * @memberOf IExtensionContext
   */
  registerStyle: (filePath: string) => void;

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
