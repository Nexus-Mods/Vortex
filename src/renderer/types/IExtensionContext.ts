import type PromiseBB from "bluebird";
import type { IHashResult, IServer } from "modmeta-db";
import type { ILookupResult, IModInfo, IQuery, IReference } from "modmeta-db";
import type * as React from "react";
import type * as Redux from "redux";
import type { ComplexActionCreator } from "redux-act";
import type { ThunkDispatch } from "redux-thunk";

import type { IDownloadsAPIExtension } from "../extensions/download_management/types/IDownloadsAPIExtension";
import type { ILoadOrderGameInfo } from "../extensions/file_based_loadorder/types/types";
import type {
  GameVersionProviderFunc,
  GameVersionProviderTest,
  IGameVersionProviderOptions,
} from "../extensions/gameversion_management/types/IGameVersionProvider";
import type {
  IHistoryEvent,
  IHistoryStack,
} from "../extensions/history_management/types";
import type { IGameLoadOrderEntry } from "../extensions/mod_load_order/types/types";
import type {
  IDeployedFile,
  IDeploymentMethod,
  IFileChange,
} from "../extensions/mod_management/types/IDeploymentMethod";
import type {
  IInstallResult,
  IInstruction,
  InstructionType,
} from "../extensions/mod_management/types/IInstallResult";
import type { IModsAPIExtension } from "../extensions/mod_management/types/IModsAPIExtension";
import type {
  InstallFunc,
  ProgressDelegate,
} from "../extensions/mod_management/types/InstallFunc";
import type {
  ISupportedResult,
  TestSupported,
} from "../extensions/mod_management/types/TestSupported";
import type { INexusAPIExtension } from "../extensions/nexus_integration/types/INexusAPIExtension";
import type ReduxProp from "../ReduxProp";
import type { SanityCheck } from "../store/reduxSanity";
import type { Archive } from "../util/archives";
import type { i18n, TFunction } from "../util/i18n";
import type {
  DialogActions,
  IDialogContent,
  IModReference,
  IModRepoId,
  IOverlayOptions,
  IPosition,
} from "./api";
import type { ICollectionsGameSupportEntry } from "./collections/api";
import type { IAvailableExtension, IExtensionDownloadInfo } from "./extensions";
import type { IRegisteredExtension } from "./extensions";
import type { IActionOptions } from "./IActionDefinition";
import type { IBannerOptions } from "./IBannerOptions";
import type { DialogType, IDialogResult } from "./IDialog";
import type { IGame } from "./IGame";
import type { IGameStore } from "./IGameStore";
import type { ILookupOptions, IModLookupResult } from "./IModLookupResult";
import type { INotification, INotificationAction } from "./INotification";
import type { IDiscoveryResult, IMod, IState } from "./IState";
import type { ITableAttribute } from "./ITableAttribute";
import type { ITestResult } from "./ITestResult";

export type {
  TestSupported,
  IInstallResult,
  IInstruction,
  IDeployedFile,
  IDeploymentMethod,
  IFileChange,
  ILookupResult,
  IModInfo,
  IQuery,
  InstructionType,
  IReference,
  InstallFunc,
  ISupportedResult,
  ProgressDelegate,
};

import type { PersistorKey, IPersistor } from "@vortex/shared/state";
export type { PersistorKey, IPersistor };

// tslint:disable-next-line:interface-name
export interface ThunkStore<S> extends Redux.Store<S> {
  dispatch: ThunkDispatch<S, null, Redux.Action>;
}

export type PropsCallback = () => { [key: string]: unknown };
export type PropsCallbackTyped<T> = () => T;

/**
 * determines where persisted state is stored and when it gets loaded.
 * global: global Vortex state, loaded on startup
 * game: state regarding the managed game. Will be swapped out when the game mode changes
 * profile: state regarding the managed profile. Will be swapped out when the profile changes
 */
export type PersistingType = "global" | "game" | "profile";

export type CheckFunction = () => PromiseBB<ITestResult>;

export type RegisterSettings = (
  title: string,
  element: React.ComponentClass<any> | React.StatelessComponent<any>,
  props?: PropsCallback,
  visible?: () => boolean,
  priority?: number,
) => void;

export type RegisterAction = (
  group: string,
  position: number,
  iconOrComponent: string | React.ComponentType<any>,
  options: IActionOptions,
  titleOrProps?: string | PropsCallback,
  actionOrCondition?: (instanceIds?: string[]) => void | boolean,
  condition?: (instanceIds?: string[]) => boolean | string,
) => void;

export type RegisterControlWrapper = (
  group: string,
  priority: number,
  wrapper: React.ComponentType<any>,
) => void;

export type RegisterFooter = (
  id: string,
  element: React.ComponentClass<any>,
  props?: PropsCallback,
) => void;

export type RegisterBanner = (
  group: string,
  component: React.ComponentType<any>,
  options: IBannerOptions,
) => void;

export interface IModSourceOptions {
  /**
   * condition for this source to show up. Please make sure this returns quickly, cache if
   * necessary.
   */
  condition?: () => boolean;
  icon?: string;
  supportsModId?: boolean;
}

export interface IMainPageOptions {
  /**
   * id for this page. If none is specified the page title is used. Use the id to avoid
   * name collisions if another extension is already using the same title.
   */
  id?: string;
  /**
   * A hotkey to be pressed together with Ctrl+Shift to open that page
   */
  hotkey?: string;
  /**
   * A hotkey to be pressed to open that page. In this case the caller has to specify any modifiers
   * in the format required by electron
   */
  hotkeyRaw?: string;
  visible?: () => boolean;
  group: "dashboard" | "global" | "per-game" | "support" | "hidden";
  isClassicOnly?: boolean;
  isModernOnly?: boolean;
  priority?: number;
  props?: PropsCallback;
  badge?: ReduxProp<any>;
  activity?: ReduxProp<boolean>;
  onReset?: () => void;
  mdi?: string;
}

export type RegisterMainPage = (
  icon: string,
  title: string,
  element: React.ComponentType<any>,
  options: IMainPageOptions,
) => void;

export interface IDashletOptions {
  fixed?: boolean;
  closable?: boolean;
}

/**
 * @param height Height of the dashlet in rows. Please note that 1 row is very slim, it's not
 *               commonly used in practice
 */
export type RegisterDashlet = (
  title: string,
  width: 1 | 2 | 3,
  height: 1 | 2 | 3 | 4 | 5 | 6,
  position: number,
  component: React.ComponentClass<any> | React.FunctionComponent<any>,
  isVisible: (state) => boolean,
  props: PropsCallback,
  options: IDashletOptions,
) => void;

export type RegisterDialog = (
  id: string,
  element: React.ComponentType<any>,
  props?: PropsCallback,
) => void;

export type RegisterOverlay = (
  id: string,
  element: React.ComponentType<any>,
  props?: PropsCallback,
) => void;

export type ToDoType = "settings" | "search" | "workaround" | "more";

export interface IToDoButton {
  text: string;
  icon: string;
  onClick: () => void;
}

export type RegisterToDo = (
  id: string,
  type: ToDoType,
  props: (state: any) => any,
  icon: ((props: any) => JSX.Element) | string,
  text: ((t: TFunction, props: any) => JSX.Element) | string,
  action: (props: any) => void,
  condition: (props: any) => boolean,
  value: ((t: TFunction, props: any) => JSX.Element) | string,
  priority: number,
) => void;

export interface IRegisterProtocol {
  (
    protocol: string,
    def: boolean,
    callback: (url: string, install: boolean) => void,
  );
}

export interface IRegisterRepositoryLookup {
  (
    repositoryId: string,
    preferOverMD5: boolean,
    callback: (id: IModRepoId) => PromiseBB<IModLookupResult[]>,
  );
}

export interface IFileFilter {
  name: string;
  extensions: string[];
}

export interface IOpenOptions {
  title?: string;
  defaultPath?: string;
  filters?: IFileFilter[];
  create?: boolean;
}

export interface ISaveOptions {
  title?: string;
  buttonLabel?: string;
  defaultPath?: string;
  filters?: IFileFilter[];
}

export type StateChangeCallback<T = any> = (previous: T, current: T) => void;

/**
 * additional detail to further narrow down which file is meant
 * in a lookup
 *
 * @export
 * @interface ILookupDetails
 */
export interface ILookupDetails {
  filePath?: string;
  // name of the file. Used only for caching purposes if filePath is undefined
  fileName?: string;
  fileMD5?: string;
  fileSize?: number;
  gameId?: string;
}

/**
 * options that can be passed to archive handler on opening
 */
export interface IArchiveOptions {
  // if set, the archive should be integrity-checked on loading (i.e. crc checks) if possible
  // whether this is supported and how much it slows down loading depends on the file type.
  verify?: boolean;
  // if set, give a hint to the archive handler what game this archive is of. This is useful
  // when similar formats are used in different games with differences in format.
  gameId?: string;
  // give a hint to the archive handler what format the archive is. Usually a file should identify
  // its format but you can never know. Can also be very useful when creating a new archive
  version?: string;
  // if set, (re-)create the archive
  create?: boolean;
}

/**
 * interface for archive handlers, exposing files inside archives to to other extensions
 *
 * @export
 * @interface IArchiveHandler
 */
export interface IArchiveHandler {
  readDir(archPath: string): PromiseBB<string[]>;
  readFile?(filePath: string): NodeJS.ReadableStream;
  extractFile?(filePath: string, outputPath: string): PromiseBB<void>;
  extractAll(outputPath: string): PromiseBB<void>;
  addFile?(filePath: string, sourcePath: string): PromiseBB<void>;
  create?(sourcePath: string): PromiseBB<void>;
  write?(): PromiseBB<void>;
}

export type ArchiveHandlerCreator = (
  fileName: string,
  options: IArchiveOptions,
) => PromiseBB<IArchiveHandler>;

/**
 * callback used to extract download information into mod info.
 * This also gets called a lot when displaying uninstalled mods in the mod list
 * (the modPath is going to be undefined) so when that flag is set, the extractor should
 * not be accessing the disk or network or do any complex coomputation
 */
export type AttributeExtractor = (
  modInfo: any,
  modPath: string,
) => PromiseBB<{ [key: string]: any }>;

export interface IGameDetail {
  title: string;
  value: any;
  type?: string;
}

export interface IAttachment {
  type: "file" | "data";
  data: any;
  id: string;
  description: string;
}

export interface IErrorOptions {
  id?: string;
  message?: string;
  isBBCode?: boolean;
  isHTML?: boolean;
  allowReport?: boolean;
  // show as warning instead of error, also disables reporting
  warning?: boolean;
  allowSuppress?: boolean;
  hideDetails?: boolean;
  replace?: { [key: string]: string };
  attachments?: IAttachment[];
  extensionName?: string;
  extension?: IRegisteredExtension;
  extensionRemote?: IAvailableExtension;
  actions?: INotificationAction[];
}

/**
 * a query function that will be called to retrieve information about a game.
 * The game object passed in in a union of the IGameStored and IDiscoveryResult data
 * structures for the game but keep in mind that the game may not be discovered or
 * it may be a custom-added game so either structure may be empty. When accessing any
 * field that doesn't exist in both IGameStored and IDiscoveryResult, please assume
 * it may be undefined.
 */
export type GameInfoQuery = (
  game: any,
) => PromiseBB<{ [key: string]: IGameDetail }>;

export interface IMergeFilter {
  // files to use as basis for merge, will be copied to the merge
  // directory during deployment (from in (absolute) to out (relative to working directory)
  baseFiles: (
    deployedFiles: IDeployedFile[],
  ) => Array<{ in: string; out: string }>;
  // filter function, needs to match all files (relative paths) in the mod to consider
  // for merging
  filter: (fileName: string) => boolean;
}

/**
 * callback to determine if a merge function applies to a game. If so, return an
 * object that describes what files to merge, otherwise return undefined
 */
export type MergeTest = (
  game: IGame,
  gameDiscovery: IDiscoveryResult,
) => IMergeFilter;
/**
 * callback to do the actual merging
 */
export type MergeFunc = (
  filePath: string,
  mergePath: string,
) => PromiseBB<void>;

/**
 * options used when starting an external application through runExecutable
 */
export interface IRunOptions {
  cwd?: string;
  env?: { [key: string]: string };
  suggestDeploy?: boolean;
  shell?: boolean;
  detach?: boolean;
  // if true, a non-zero exit code will be treated as an error. default is false
  //   because too many windows applications don't report proper exit codes
  expectSuccess?: boolean;
  // called after the process has been spawned. If possible the pid of the spawned process
  // is set but in some cases (e.g. when the target process is run elevated) we don't know
  // the pid so this will be undefined.
  onSpawned?: (pid?: number) => void;
}

/**
 * all parameters passed to runExecutable. This is used to support interpreters
 * changing the parameters
 */
export interface IRunParameters {
  executable: string;
  args: string[];
  options: IRunOptions;
}

/**
 * callback to be used to determine list of variables for the tool command line
 */
export type ToolParameterCB = (options: IRunParameters) => {
  [key: string]: string;
};

export interface IPreviewFile {
  /**
   * label to display to the user if applicable
   */
  label: string;
  /**
   * full path to the file to preview
   */
  filePath: string;
}

export interface IApiFuncOptions {
  /**
   * minimum number of arguments the caller has to pass to a api extension function
   */
  minArguments?: number;
}

export interface IExtensionApiExtension
  extends INexusAPIExtension,
    IModsAPIExtension,
    IDownloadsAPIExtension {
  ensureLoggedIn?: () => PromiseBB<void>;
  awaitProfileSwitch?: () => PromiseBB<string>;
  showOverlay?: (
    id: string,
    title: string,
    content: string | React.ComponentType<any>,
    pos?: IPosition,
    options?: IOverlayOptions,
  ) => void;
  showHistory?: (stack: string) => void;
  addToHistory?: (stack: string, entry: IHistoryEvent) => void;
  [key: string]: (...args: any[]) => any;
}

// (id: string, title: string, content: string | React.ComponentType<any>, pos: IPosition = undefined, options: IOverlayOptions) =>

/**
 * interface for convenience functions made available to extensions
 *
 * @export
 * @interface IExtensionApi
 */
export interface IExtensionApi {
  /**
   * name of the extension to use this api with
   */
  extension?: IRegisteredExtension;

  /**
   * show a notification to the user.
   * This is not available in the call to registerReducer
   *
   * @return the notification id
   *
   * @type {INotification}
   * @memberOf IExtensionApi
   */
  sendNotification?: (notification: INotification) => string;

  /**
   * show an error message to the user.
   * This is a convenience wrapper for sendNotification.
   * This is not available in the call to registerReducer
   *
   * @memberOf IExtensionApi
   */
  showErrorNotification?: (
    message: string,
    detail: string | Error | any,
    options?: IErrorOptions,
  ) => void;

  /**
   * show a dialog
   */
  showDialog?: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
    id?: string,
  ) => PromiseBB<IDialogResult>;

  /**
   * close a dialog
   */
  closeDialog?: (id: string, actionKey?: string, input?: any) => void;

  /**
   * hides a notification by its id
   *
   * @memberOf IExtensionApi
   */
  dismissNotification?: (id: string) => void;

  /*
   * hides all active notifications
   */
  dismissAllNotifications?: () => void;

  /**
   * hides a notification and don't show it again
   * if this is called with the second parameter set to false, it re-enables the notification
   * instead
   */
  suppressNotification?: (id: string, suppress?: boolean) => void;

  /**
   * show a system dialog to open a single file
   *
   * @memberOf IExtensionApi
   */
  selectFile: (options: IOpenOptions) => PromiseBB<string>;

  /**
   * show a system dialog to save a single file
   *
   * @memberOf IExtensionApi
   */
  saveFile: (options: ISaveOptions) => PromiseBB<string>;

  /**
   * show a system dialog to select an executable file
   *
   * @memberOf IExtensionApi
   */
  selectExecutable: (options: IOpenOptions) => PromiseBB<string>;

  /**
   * show a system dialog to open a single directory
   *
   * @memberOf IExtensionApi
   */
  selectDir: (options: IOpenOptions) => PromiseBB<string>;

  /**
   * the redux store containing all application state & data
   *
   * Please note: this store object will remain valid for the whole
   *   application runtime so you can store it, bind it to functions
   *   and so on. The state object (store.getState()) is immutable and
   *   will be a different object whenever the state is changed.
   *   Thus you should *not* store/bind the state directly unless you
   *   actually want a "snapshot" of the state.
   *
   * @type {Redux.Store<any>}
   * @memberOf IExtensionApi
   */
  store?: ThunkStore<any>;

  /**
   * event emitter
   *
   * @type {NodeJS.EventEmitter}
   * @memberOf IExtensionApi
   */
  events: NodeJS.EventEmitter;

  /**
   * translation function
   */
  translate: TFunction;

  /**
   * prepare a string to be translated further down the line.
   */
  laterT: TFunction;

  /**
   * active locale
   */
  locale: () => string;

  /**
   * get direct access to the i18next object managing localisation.
   * This is only needed to influence how localisation works in general,
   * to just translate a text, use "translate"
   */
  getI18n: () => i18n;

  /**
   * retrieve path for a known directory location.
   *
   * Note: This uses electrons ids for known folder locations.
   * Please write your extensions to always use the appropriate
   * folder location returned from this function, especially
   * 'userData' should be used for all settings/state/temporary data
   * if you don't want to/can't use the store.
   * If Vortex introduces a way for users to customise storage locations
   * then getPath will return the customised path so you don't have to
   * adjust your extension.
   *
   * @type {Electron.AppPathName}
   * @memberOf IExtensionApi
   */
  getPath: (name: string) => string;

  /**
   * register a callback for changes to the state
   *
   * @param {string[]} path path in the state-tree to watch for changes,
   *                   i.e. ['settings', 'interface', 'language'] would call the callback
   *                   for all changes to the interface language
   *
   * @memberOf IExtensionApi
   */
  onStateChange?: <T = any>(
    path: string[],
    callback: StateChangeCallback<T>,
  ) => void;

  /**
   * registers an uri protocol to be handled by this application. If the "def"ault parameter
   * is set to true, this application will also be inserted as the system wide default handler
   * for the protocol. Use with caution, as this will overwrite the previous value, which
   * can't be undone automatically
   *
   * @type {IRegisterProtocol}
   * @memberOf IExtensionContext
   */
  registerProtocol: IRegisterProtocol;

  /**
   * registers a lookup mechanism that can be used to look up information about a mod based on ids.
   * This will either work as a fallback or as a replacement to the md5 based lookup for
   * applicable mods.
   * The "repositoryId" should be the same as the "source" used.
   * It's possible to return multiple results if the input data doesn't definitively identify a
   * single item but this might be a bit of a mess to figure out later.
   */
  registerRepositoryLookup: IRegisterRepositoryLookup;

  /**
   * deregister an uri protocol currently being handled by us
   *
   * @memberOf IExtensionApi
   */
  deregisterProtocol: (protocol: string) => void;

  /**
   * find meta information about a mod
   *
   * @memberOf IExtensionApi
   */
  lookupModReference: (
    ref: IModReference,
    options?: ILookupOptions,
  ) => PromiseBB<IModLookupResult[]>;

  /**
   * add a meta server
   * Please note that setting a server with the same id again will replace the existing one
   * with that id and setting it to undefined removes it
   */
  addMetaServer: (id: string, server: IServer) => void;

  /**
   * generate an md5 hash for the specified file
   * @param data Either a string containing the file path or a Buffer containing the data to hash
   * @param progressFunc optional function to report progress
   * @returns a promise resolving to the md5 hash result
   */
  genMd5Hash: (
    data: string | Buffer,
    progressFunc?: (progress: number, total: number) => void,
  ) => PromiseBB<IHashResult>;

  /**
   * find meta information about a mod
   * this will calculate a hash and the file size of the specified file
   * for the lookup unless those details are already provided.
   * Please note that it's still possible for the file to get multiple
   * matches, i.e. if it has been re-uploaded, potentially for a different
   * game.
   *
   * @memberOf IExtensionApi
   */
  lookupModMeta: (
    details: ILookupDetails,
    ignoreCache?: boolean,
  ) => PromiseBB<ILookupResult[]>;

  /**
   * save meta information about a mod
   *
   * @memberOf IExtensionApi
   */
  saveModMeta: (modInfo: IModInfo) => PromiseBB<void>;

  /**
   * opens an archive
   */
  openArchive: (
    archivePath: string,
    options?: IArchiveOptions,
    extension?: string,
  ) => PromiseBB<Archive>;

  /**
   * clear the stylesheet cache to ensure it gets rebuilt even if the list of files hasn't changed
   */
  clearStylesheet: () => void;

  /**
   * insert or replace a sass-stylesheet. It gets integrated into the existing sheets based
   * on the key:
   * By default, the sheets "variables", "details" and "style" are intended to customize the
   * look of the application.
   * - "variables" is a set of variables representing colors, sizes and
   *   margins that will be used throughout the application.
   * - "details" applies these variables to different generic controls (like tabs, lists, ...)
   * - "style" is where you should customize individual controls with css rules
   *
   * If your extension sets a sheet that didn't exist before then that sheet will be inserted
   * before the "style" sheet but after everything else. This allows themes to affect extension
   * styles.
   *
   * @note Important: As usual with css, rules you add affect the entire application, without
   *  severely restricting themes and extensions we can not automatically restrict your stylesheets
   *  to the controls added by your extension. This means it's your responsibility to make sure
   *  your stylesheet doesn't modify foreign controls.
   *
   * @param {string} key identify the key to set. If this is an existing sheet, that sheet will be
   *                     replaced
   * @param {string} filePath path of the corresponding stylesheet file
   *
   * @memberOf IExtensionContext
   */
  setStylesheet: (key: string, filePath: string) => void;

  /**
   * run an executable. This is comparable to node.js child_process.spawn but it allows us to add
   * extensions, like support interpreters and hooks.
   * It will also automatically ask the user to authorize elevation if the executable requires it
   * The returned promise is resolved when the started process has run to completion.
   * IRunOptions.onSpawned can be used to react to when the process has been started.
   */
  runExecutable: (
    executable: string,
    args: string[],
    options: IRunOptions,
  ) => PromiseBB<void>;

  /**
   * emit an event and allow every receiver to return a Promise. This call will only return
   * after all these Promises are resolved.
   * If the event handlers return a value, this returns an array of results
   */
  emitAndAwait: <T = any>(eventName: string, ...args: any[]) => PromiseBB<T>;

  /**
   * handle an event emitted with emitAndAwait. The listener can return a promise and the emitter
   * will only return after all promises from handlers are returned.
   * Note that listeners should report all errors themselves, it is considered a bug if the listener
   * returns a rejected promise.
   * If errors do need to be reported they have to be part of the resolved valued
   */
  onAsync: (
    eventName: string,
    listener: (...args: any[]) => PromiseLike<any>,
  ) => void;

  /**
   * wraps a function such that it will emitAndAwait will-eventName and did-eventName events
   * before and after invoking the actual callback.
   * both these events receive the arguments passed to the callback, the did-event also receives
   * the result of the callback if any (the result is the first argument because the number
   * of arguments may be variable)
   */
  withPrePost: <T>(
    eventName: string,
    callback: (...args: any[]) => PromiseBB<T>,
  ) => (...args: any[]) => PromiseBB<T>;

  /**
   * returns true if the running version of Vortex is considered outdated. This is mostly used
   * to determine if feedback should be sent to Nexus Mods.
   */
  isOutdated: () => boolean;

  /**
   * highlight a control for a short time to direct the users attention to it.
   * The control (or controls) is identified by a css selector.
   * A text can be added, but no promise that it actually looks good in practice
   *
   * Usually the css style used to draw the outline contains a bit of hackery to offset the
   * padding and border width it adds so that the contents doesn't get moved around.
   * If altStyle is set we use absolute positioning to get the same effect. This requires
   * us to make the target item "position: relative" though which is more intrusive and can
   * break the styling of the contents more severely.
   */
  highlightControl: (
    selector: string,
    durationMS: number,
    text?: string,
    altStyle?: boolean,
  ) => void;

  /**
   * returns a promise that resolves once the ui has been displayed.
   * This is useful if you have a callback that may be triggered before the ui is
   * displayed but may require the UI to be processed.
   * Specifically events can only be sent once this event has been triggered
   */
  awaitUI: () => PromiseBB<void>;

  /**
   * wrapper for api.store.getState() with the benefit that it automatically assigns a type
   */
  getState: <T extends IState = IState>() => T;

  /**
   * get a list of extensions currently loaded into Vortex
   */
  getLoadedExtensions: () => IRegisteredExtension[];

  /**
   * functions made available from extension to extension. Callers have to make
   * sure they handle gracefully the case where a function doesn't exist
   */
  ext: IExtensionApiExtension;

  // namespace to be used for localization of this extension
  NAMESPACE: string;
}

export interface IStateVerifier {
  // Human readable description of the problem, emitted if this verifier detects a problem
  description: (input: any) => string;
  // the expected datatype
  type?: "map" | "string" | "boolean" | "number" | "object" | "array";
  // if set, can't be undefined
  noUndefined?: boolean;
  // if set, can't be null
  noNull?: boolean;
  // if set, the array or object can't be empty - if it's a string, that can't be empty either
  noEmpty?: boolean;
  // if set, look at the object elements inside
  elements?: { [key: string]: IStateVerifier };
  // if set, this entry has to exist
  required?: boolean;
  // if set, delete this element or an ancestor element if this one doesn't
  // match the verifier.
  deleteBroken?: boolean | "parent";
  // if set, this function is called to generate the "repaired" value
  repair?: (input: any, def: any) => any;
}

/**
 * The repair function can't fix a value so delete it instead
 */
export class VerifierDrop extends Error {
  constructor() {
    super("verifier drop");
    this.name = this.constructor.name;
  }
}

/**
 * The repair function can't fix a value so delete the parent object instead
 */
export class VerifierDropParent extends Error {
  constructor() {
    super("verifier drop parent");
    this.name = this.constructor.name;
  }
}

export type PayloadT<Type> =
  Type extends ComplexActionCreator<infer X> ? X : never;

export function addReducer<ActionT, StateT>(
  action: ActionT,
  handler: (state: StateT, payload: PayloadT<ActionT>) => StateT,
) {
  return {
    [action as any]: handler,
  };
}

/**
 * specification a reducer registration has to follow.
 * defaults must be an object with the same keys as
 * reducers
 *
 * @export
 * @interface IReducerSpec
 */
export interface IReducerSpec<T = { [key: string]: any }> {
  reducers: { [key: string]: (state: T, payload: any) => T };
  defaults: T;
  verifiers?: { [key: string]: IStateVerifier };
}

export interface IModTypeOptions {
  // if set, the merge behavior specified here overrides the one specified for the game
  mergeMods?: boolean | ((mod: IMod) => string);
  // if set, may be used as a user-readable name for the mod type
  name?: string;
  // if set, the default mechanism to install dependencies for mods of this mod type is disabled.
  // Vortex will show that dependencies are unfulfilled but not act upon it.
  // I have to admit this is fairly specific to collections, not sure if this flag is useful in
  // any other context
  customDependencyManagement?: boolean;
  // if set (the default), the deployment method will not be available if this mod type can't be
  // deployed with it. Otherwise the user would only get a warning notification informing them
  // that some features might not work but continue otherwise.
  deploymentEssential?: boolean;
  noConflicts?: boolean;
}

/**
 * The extension context is an object passed into all extensions during initialisation.
 *
 * There are three main parts to this object:
 * a) api. This is an object that contains various functions and objects to interact with the
 *    main application. During runtime of the application (that is: after the startup phase)
 *    this will be the only part of the context object you need.
 *    Most importantly it gives you access to the application store (maintaining all state)
 *    and a bunch of "stateful" convenience functions (stuff like displaying notifications/
 *    dialogs in a way consistent with the remaining application).
 * b) register functions. These must be called immediately inside the init function and they
 *    "inject" your extension functionality into the main function. That is: you register ui
 *    controls, callbacks, ... and the main function will then use that as necessary.
 *    Please note that a call to a register function has no immediate effect, those calls are
 *    stored and evaluated once all extensions have been initialised.
 *    An extension can add new register functions by simply assigning to the context object.
 *    There is one limitation though: Due to the way those functions are called you can't have
 *    optional parameters in register functions, the caller always have to provide the exact number
 *    of arguments to get the function to be called correctly. Vortex will pass additional
 *    parameters to the function that help identify the extension that called the function.
 *    These functions are then available to all other extensions, the order in which extensions
 *    are loaded is irrelevant (and can't be controlled).
 *    If an extension uses a register function from another extension it becomes implicitly
 *    dependent on it. If the register function isn't available (because that other extension
 *    isn't installed) the dependent extension isn't loaded either.
 *    To avoid this, call context.optional.registerXYZ(). Such a call will be evaluated if possible
 *    but won't cause an error if it isn't.
 *    Please note that context is a "Proxy" object that will accept calls to any "registerXYZ"
 *    function no matter if it's available or not. You can't "introspect" this object reliably,
 *    it will not show the available register functions.
 * c) once-callback. This is a callback that will be run after all extensions have been initialized
 *    and all register functions have been evaluated. This is still *before* a gamemode has been
 *    activated so you can't access game-specific data immediately inside once.
 *    It will be called only once at application startup whereas init is called once per process
 *    (that is: twice in total). It should be used for all your extension setup except for the
 *    register calls (i.e. installing event handlers, doing startup calculations).
 *    This is because at the time once is called, the context.api
 *    object is fully initialised and once is only caused if your extension should really load
 *    (as in: it's compatible with the current api).
 */
export interface IExtensionContext {
  /**
   * register a settings page
   *
   * @type {IRegisterSettings}
   * @memberOf IExtensionContext
   */
  registerSettings: RegisterSettings;

  /**
   * register a mod deployment method
   *
   * @memberof IExtensionContext
   */
  registerDeploymentMethod: (method: IDeploymentMethod) => void;

  /**
   * register an installer
   * @param {string} id id for the installer. currently only used for logging
   * @param {number} priority the priority of the installer. The supported installer with the
   *                          highest priority (smallest number) gets to handle the mod.
   *                          Note: scripted fomods are handled at prio 20 and there is a fallback
   *                          installer that will handle practically any archive at prio 100 so
   *                          you want to place your installer in the range 21-99.
   *                          If your installer has priority > 100 it will probably never be
   *                          considered, if it has priority < 20 it will disable fomod installers
   *                          which only makes sense if you implement a scripted installer system
   *                          as well that is superior to fomod.
   * @param {TestSupported} testSupported function called to determine if the handler can deal
   *                                      with a mod
   * @param {InstallFunc} install function called to actually install a mod
   */
  registerInstaller: (
    id: string,
    priority: number,
    testSupported: TestSupported,
    install: InstallFunc,
  ) => void;

  /**
   * register an action (can be a button or a menu item)
   *
   * @type {IRegisterIcon}
   * @memberOf IExtensionContext
   */
  registerAction: RegisterAction;

  /**
   * register a wrapper for an existing control. Only controls designed for extension can
   * be used.
   */
  registerControlWrapper: RegisterControlWrapper;

  /**
   * registers a page for the main content area
   *
   * @type {IRegisterMainPage}
   * @memberOf IExtensionContext
   */
  registerMainPage: RegisterMainPage;

  /**
   * register a dashlet to be displayed on the welcome screen
   */
  registerDashlet: RegisterDashlet;

  /**
   * register a dialog (or any control that is rendered independent of the main content area
   * really)
   * This dialog has to control its own visibility
   */
  registerDialog: RegisterDialog;

  /**
   * registers a component to be rendered very high in the DOM, overlaying the main window.
   * Similar to registerDialogs, except that Vortex won't control whether the overlay gets rendered.
   */
  registerOverlay: RegisterOverlay;

  /**
   * registers a element to be displayed in the footer
   *
   * @type {IRegisterFooter}
   * @memberOf IExtensionContext
   */
  registerFooter: RegisterFooter;

  /**
   * register an todo message that will be shown to new users until they
   * dismiss it. You can provide a condition under which it will appear.
   * Please don't overuse this as to not intimidate the user. Also keep in mind that the
   * user can dismiss any todo message without taking action and it will never appear
   * again.
   */
  registerToDo: RegisterToDo;

  /**
   * registers a banner, which is a control that will show in a fixed location with fixed
   * size (determined by the group). If there are multiple banners in the same spot,
   * they will cycle.
   */
  registerBanner: RegisterBanner;

  /**
   * register a source (usually a website) that the mod was retrieved from and that will
   * be used as the reference for features like checking for updates and such.
   * Please note that registering this source has no other effect than adding an option
   * to the selection of mod sources, the corresponding extension has to implement
   * actual features
   * The source can also be used to browse for further mods
   */
  registerModSource: (
    id: string,
    name: string,
    onBrowse?: () => void,
    options?: IModSourceOptions,
  ) => void;

  /**
   * register a reducer to introduce new set-operations on the application
   * state.
   * Note: For obvious reasons this is executed before the store is set up so
   * many api operations are not possible during this call
   *
   * The first part of the path decides how and if state persisted:
   *   * window, settings, persistent are always persisted and automatically restored
   *   * session and all other will not be persisted at all. Although session is not
   *     treated different than any other path, please use this path  for all
   *     ephemeral state
   *
   * Another word on the path: You can introduce additional reducers for any "leaf" of
   *   the settings tree and you can introduce new "subnodes" in the tree at any depth.
   *   For technical reasons it is however not possible to introduce subnodes to a leaf
   *   or vice-versa.
   *   I.e. settings.interface contains all settings regarding the ui. Your extension
   *   can register a reducer with path ['settings', 'interface'] and ['settings', 'whatever']
   *   but not ['settings'] and not ['settings', 'interface', 'somethingelse']
   *
   * And one more thing about the spec: All things you store inside the store need to be
   *   serializable. This means: strings, numbers, booleans, arrays, objects are fine but
   *   functions are not. If you absolutely need to store a callback or something then create
   *   a "registry" or factory and store just an id that allows you to retrieve or generate
   *   the function on demand.
   *
   * @param {string[]} path The path within the settings store
   * @param {IReducerSpec} spec a IReducerSpec object that contains reducer functions and defaults
   *        for the newly introduced settings
   *
   * @memberOf IExtensionContext
   * @note If you have registerReducer calls you should call them first thing in the init function.
   *       Usually if your init call fails your extension shouldn't load at all but in case that
   *       doesn't work, registering any functionality that depends on state that never got loaded
   *       would load to further bug reports that are a lot harder to investigate
   */
  registerReducer: (path: string[], spec: IReducerSpec) => void;

  /**
   * register a hive in the store to be persisted. A hive is a top-level branch in the state,
   * like "settings", "state", ...
   * You must not register a hive that is already being persisted or you get data inconsistency.
   * Do not use this on a hive that is registered with "registerPersistor". With this function,
   * Vortex takes care of storing/restoring the data, with registerPersistor you can customize the
   * file format.
   *
   * @param {PersistingType} type controls where the state is stored and when it is loaded
   * @param {string} hive the top-level key inside the state.
   *
   * @memberOf IExtensionContext
   */
  registerSettingsHive: (type: PersistingType, hive: string) => void;

  /**
   * register a new persistor that will hook a data file into the application store,
   * meaning any part of the application can access that data like any other data in the application
   * state and the UI will automatically refresh if it's tied to that data.
   * This way you can unify the access to foreign data files
   *
   * @param {string} hive the top-level key inside the state that this persistor will add
   *                      it's data to. We can't add persistors inside an existing node (
   *                      technical reasons) but you can implement an aggregator-persistor
   *                      that syncs sub-nodes with different files
   * @param {IPersistor} persistor the persistor. Adhere to the interface and it should be fine
   * @param {number} debounce this value (in milliseconds) determins how frequent the file will
   *                          be updated on disk. Higher values reduce load and disk activity
   *                          but more data could be lost in case of an application crash.
   *                          Defaults to 200 ms
   *
   * @memberOf IExtensionContext
   */
  registerPersistor: (
    hive: string,
    persistor: IPersistor,
    debounce?: number,
  ) => void;

  /**
   * add an attribute to a table. An attribute can appear as a column inside the table or as a
   * detail field in the side panel.
   * The tableId identifies, obviously, the table to which the attribute should be added. Please
   * find the right id in the documentation of the corresponding extension.
   * Please prefer specifying the attribute as a function returning the ITableAttribute instead of
   * the attribute directly
   */
  registerTableAttribute: (tableId: string, attribute: ITableAttribute) => void;

  /**
   * add a check that will automatically be run on the specified event.
   * Such checks can be used by extensions to check the integrity of their own data, of the
   * application setup or that of the game and present them to the user in a common way.
   *
   * @memberOf IExtensionContext
   */
  registerTest: (id: string, event: string, check: CheckFunction) => void;

  /**
   * register a handler for archive types so the content of such archives is exposed to
   * the application (especially other extensions)
   *
   * @memberOf IExtensionContext
   */
  registerArchiveType: (
    extension: string,
    handler: ArchiveHandlerCreator,
  ) => void;

  /**
   * registers support for a game
   *
   * @param {IGame} game
   */
  registerGame: (game: IGame) => void;

  /**
   * register a game stub. This is to ease the transition for games that used to be bundled with
   * Vortex and might already be in use but are now maintained by a third party.
   */
  registerGameStub: (game: IGame, ext: IExtensionDownloadInfo) => void;

  /**
   * registers support for a game store.
   *
   * @param {IGameStore} gameStore
   */
  registerGameStore: (gameStore: IGameStore) => void;

  /**
   * registers a provider for general information about a game
   * @param {string} id unique id identifying the provider
   * @param {number} priority if two providers provide the same info (same key) the one with the
   *                          higher priority (smaller number) ends up providing that piece of info
   * @param {number} expireMS the time (in milliseconds) before the info "expires". After expiry it
   *                          will be re-requested. You usually want this to be several days, not
   *                          seconds or milliseconds
   * @param {string[]} keys the keys this provider will provide. If the query function doesn't
   *                        return a value for one of these keys, a null is stored. If the query
   *                        returns keys that aren't listed here they will still be stored, but
   *                        the query will only be run if a listed key is missing or the expiry time
   *                        runs out
   * @param {Function} query the query function
   */
  registerGameInfoProvider: (
    id: string,
    priority: number,
    expireMS: number,
    keys: string[],
    query: GameInfoQuery,
  ) => void;

  /**
   * register an extractor that can access all information known about a downloaded archive and
   * tranfer them into the modInfo data structure so it can be accessed when rendering/managing
   * the mod
   *
   * @param {number} priority determins the order in which the attributes are combined.
   *                          if two extractors produce the same attribute, the one with the higher
   *                          priority (smaller number) wins. The default attributes retrieved from
   *                          the meta database have priority 100.
   * @param {AttributeExtractor} extractor the function producing mod attributes
   */
  registerAttributeExtractor: (
    priority: number,
    extractor: AttributeExtractor,
  ) => void;

  /**
   * register a mod type
   * @param {string} id internal identifier for this mod type. can't be the empty string ''!
   * @param {number} priority if there is difficulty differentiating between two mod types, the
   *                          higher priority (smaller number) one wins.
   *                          Otherwise please use 100 so there is room for other extensions
   *                          with lower and higher priority
   * @param {(gameId) => boolean} isSupported return true if the mod type is supported for this
   *                                          game
   * @param {(game: IGame) => string} getPath given the specified game, return the absolute path to
   *                                          where games of this type should be installed.
   * @param {(instructions) => PromiseBB<boolean>} test given the list of install instructions,
   *                                                  determine if the installed mod is of this type
   * @param {IModTypeOptions} options options controlling the mod type
   */
  registerModType: (
    id: string,
    priority: number,
    isSupported: (gameId: string) => boolean,
    getPath: (game: IGame) => string,
    test: (installInstructions: IInstruction[]) => PromiseBB<boolean>,
    options?: IModTypeOptions,
  ) => void;

  /**
   * register an action sanity check
   * a sanity check like this is called before any redux-action of the specified type and gets
   * an opportunity to reject it with an error message.
   * This is more powerful than checking inside the reducer as you can access the entire state
   * for the check and it's more robust than checking before dispatching the action, because actions
   * may be dispatched from many places.
   * Please don't overdo this for high-frequency actions as that may affect performance. Also
   * be aware of side effects from stopping an action as all other code is still run.
   * I.e. if you'd reject the addition of a downloaded file, the file itself is still there.
   * In extreme cases you could instead throw an exception from the check (which would bubble up
   * through the dispatch call) which will likely crash Vortex.
   * That might be preferrable to corrupting state
   * Further: Most actions are processed twice, once in the UI process where they got triggered and
   *   in the main process where they get persisted to disk. If you stop an action in the UI
   *   process it will not get forwarded to the main process, so this check only runs once. If you
   *   allow it through though, this check is done a second time in the main process and you *need*
   *   to generate the same result, you can't allow an action in the UI process and then reject it
   *   in the main process!
   *   Due to checks being run twice, if you write a log message that also will happen twice. You
   *   can check "process.type === 'browser') to log only in the main (aka browser) process but
   *   again: The result of the check *has to has to has to* be the same between all processes.
   * @param {string} actionType type of the action (like STORE_WINDOW_SIZE)
   * @param {SanityCheck} check the check to run for the specified action
   */
  registerActionCheck: (actionType: string, check: SanityCheck) => void;

  /**
   * register a file merge that needs to happen during deployment.
   * modType is the mod type this applies to, so only mods from this mod type are merged
   * and the output merge is of that type as well.
   *
   * This api is - complex - as it tries to cover multiple related use cases. Please
   * make sure you understand how it works becauses trial&error might drive you mad.
   *
   * The way this works is that as part of deployment the "in" files get copied to a working
   * directory. It's ok for these files to be non-existent. It's ok for these files to be from one
   * of the deployed mods (see below) or a file generated by or shipped with the game itself.
   * Then the "merge" function is called on each matching file from each mod so you get an
   * opportunity to incorporate the modded content into the file in the working directory
   * Finally, the merged file from the working directory is deployed, just like every other file,
   * based on which mod type you specified.
   * If the "in" file was from mone of the mods, the merge function will be called with that
   * file again, so it's your own responsibility to not duplicate the content from that file.
   * If the "in" file did not exist, you get an empty file as the basis to merge into, that is not
   * an error.
   * The "out" path specified by the baseFiles is the relative path of the "temporary" file
   * in the working directory. Together with the mod type, this will control what the final output
   * path is.
   */
  registerMerge: (test: MergeTest, merge: MergeFunc, modType: string) => void;

  /**
   * register an interpreter to be used to run files of the specified type when starting with
   * IExtensionApi.runExecutable
   * @param {string} extension File extension to handle
   * @param {string} apply A filter function that will receive the run parameters as provided by
   *                       the user (with the script as the executable) and should return adjusted
   *                       parameters that will actually invoke the right interpreter.
   *                       If the interpreter is not installed/found, please throw a
   *                       "MissingInterpreter" exception so Vortex can show a nicer error message
   */
  registerInterpreter: (
    extension: string,
    apply: (call: IRunParameters) => IRunParameters,
  ) => void;

  /**
   * register a hook to be called before Vortex starts any tool and is allowed to replace parameter
   * or cancel the start by rejecting with ProcessCanceled or UserCanceled.
   * This could be used as a more powerful replacement for registerInterpreter.
   * Interpreters registered with registerInterpreter will be processed before any hooks are applied
   * @param {number} priority Hooks are applied in ascending priority order. Please choose
   *                          priorities with a bit of space between hooks you know about so that
   *                          other extension developers can insert their own hooks between.
   *                          Non-extension hooks will be applied in steps of 100
   * @param {string} id identifier for the hook. This will only be used for logging
   * @param {function} hook the hook to be called
   */
  registerStartHook: (
    priority: number,
    id: string,
    hook: (call: IRunParameters) => PromiseBB<IRunParameters>,
  ) => void;

  /**
   * register a migration step. This migration is always called when the loaded extension has
   * a different version from the one that was used last.
   * This way when the new version requires any form of migration (upgrading state for example)
   * it can be done from there. The version that was previously run is being passed to the migration
   * function so the extension can determine if the upgrade is actually necessary and if so, which
   * (if there are multiple).
   * IMPORTANT: Use the old version only to save time, your migration must not cause break anything
   *   if this version is inaccurate. E.g. if state was manipulated/damaged, Vortex may send 0.0.0
   *   for the old version even when the current version was run before.
   * If the extension was never loaded before, the version "0.0.0" is passed in.
   * Please note: Vortex will continue running, with the extension loaded, after migrate is called,
   *   it is not currently possible to delay loading an extension until the migration is complete.
   *   This means one of these must be true:
   *     - the extension is functional without the migration, at least so much so that it doesn't
   *       cause "damage"
   *     - the extension disables/blocks itself until the migration is done
   *     - the migration is synchronous so that the migrate function doesn't return until it's done.
   * Important: Migration happens in the *main process*, not in the renderer process.
   * @param {function} migrate called if the running extension version differs from the old one.
   *                           As soon as the promise returned from this is resolved, the stored
   *                           version number is updated.
   */
  registerMigration: (migrate: (oldVersion: string) => PromiseBB<void>) => void;

  /**
   * register a file to be stored with the profile. It will always be synchronised with the current
   * profile, so when users switch to a different profile, this file will be copied to the
   * profile they're switching away from, then the corresponding file from the profile they're
   * switching to is copied to filePath.
   * filePath can either be a static string or a function returning a promise that resolves
   * to the actual file path. The latter allows for the path to be determined dynamically
   */
  registerProfileFile?: (
    gameId: string,
    filePath: string | (() => PromiseLike<string[]>),
  ) => void;

  /**
   * register a profile feature that can be toggled/configured on the profiles screen.
   * The configured value can be queried at
   * state.persistent.profiles.<profile id>.features.<feature id>
   */
  registerProfileFeature?: (
    featureId: string,
    type: string,
    icon: string,
    label: string,
    description: string,
    supported: () => boolean,
  ) => void;

  /**
   * register a game version resolution provider.
   */
  registerGameVersionProvider?: (
    id: string,
    priority: number,
    supported: GameVersionProviderTest,
    getVersion: GameVersionProviderFunc,
    options?: IGameVersionProviderOptions,
  ) => void;

  /**
   * register a handler that can be used to preview or diff files.
   * A handler can return a promise rejected with a "ProcessCanceled" exception to indicate
   * it doesn't support the file type, in which case the next handler is tried.
   * If no handler supports a file type, an error is displayed.
   *
   * Now at the lowest level a preview handler just has to be able to show a single file
   * of the file type, in which case it should show the first file from the list passed in
   * as a parameter, or offer the user a choice. More advanced handlers may show a diff between
   * the files.
   * If the "allowPick" option is specified the caller would like the user to be
   * able to pick one of the files and that choice should then be returned but
   * this is an optional feature the handler doesn't need to support.
   *
   * Handlers that support both diffing files and picking choices should have high
   * priority (0-100), handlers that support diffing but not picking should be
   * put into the range (100-200), handlers that only support showing a single
   * file should be in the range (300-infinite).
   * (Obviously the use case where the handler supports picking files but can only
   * show a single file doesn't exist because duh.)
   * This way the most feature rich handler supporting a file type will get picked.
   *
   * Note: If the viewer supports picking the Promise shall resolve after the
   *   choice is made and include the selected entry, if it doesn't it can resolve
   *   as soon as the handler knows whether it supports the file.
   */
  registerPreview?: (
    priority: number,
    handler: (
      files: IPreviewFile[],
      allowPick: boolean,
    ) => PromiseBB<IPreviewFile>,
  ) => void;

  /**
   * register a callback that will introduce additional variables that can be used as part of
   * tool command lines. The callback you provide here gets called every time a tool gets started
   * from vortex, the returned object gets merged with all other parameter object and then used
   * when resolving the final command line.
   * Please use keys that are all upper case and consist only of latin characters and underscores.
   * While this is not necessary from a technical standpoint it's more consistent and predictable
   * for users.
   * Also make sure the keys you return are sufficiently unique to avoid collisions
   * @param callback the function that gets called to generate variables. the argument
   *                 passed to this contains details about the tool being started, usually
   *                 you will probably not need this
   */
  registerToolVariables: (callback: ToolParameterCB) => void;

  // Provides game extensions with an easy way to add a load order page
  //  if they require it. (DEPRECATED - please use registerLoadOrder instead)
  registerLoadOrderPage: (gameEntry: IGameLoadOrderEntry) => void;

  /**
   * Add file based load ordering functionality to the specified game.
   *  Please use this instead of registerLoadOrderPage
   */
  registerLoadOrder: (gameInfo: ILoadOrderGameInfo) => void;

  /**
   * Sets up a stack for a history of events that can be presented to the user
   */
  registerHistoryStack: (id: string, options: IHistoryStack) => void;

  /**
   * Allows extensions to define additional data to add to a collection
   */
  registerGameSpecificCollectionsData: (
    data: ICollectionsGameSupportEntry,
  ) => void;

  /**
   * add a function to the IExtensionApi object that is made available to all other extensions
   * in the api.ext object.
   */
  registerAPI: (
    name: string,
    func: (...args: any[]) => any,
    options: IApiFuncOptions,
  ) => void;

  /**
   * specify that a certain range of versions of vortex is required
   * (see https://www.npmjs.com/package/semver for syntax documentation).
   * If you call this multiple times, all ranges have to match so that makes little sense
   */
  requireVersion: (versionRange: string) => void;

  /**
   * register a dependency on a different extension
   * @param {string} extId id of the extension that this one depends on
   * @param {string} version a semver version range that the mod is compatible with
   * @param {boolean} optional if set to true, the extension will not fail if the dependency is not found
   */
  requireExtension: (
    extId: string,
    version?: string,
    optional?: boolean,
  ) => void;

  /**
   * called once after the store has been set up and after all extensions have been initialized
   * This means that if your extension registers its own extension function
   * (@see registerExtensionFunction) then those registrations happen before once is called.
   *
   * You shouldn't make assumptions on the order in which extensions are loaded and on them to be
   * loaded synchronously, so if you have initialization code that requires another extension to
   * be initialized first, you should check if that happened already in your "once" call and react
   * to some sort of event that would indicate that other initialization to be finished (usually
   * a state change)
   *
   * @memberOf IExtensionContext
   */
  once: (callback: () => void | PromiseBB<void>) => void;

  /**
   * similar to once but this callback will be run (only) on the electron "main" process.
   * Use this only if you absolutely must (if you don't know what electron main process means, it's
   * almost certain you don't want this).
   * While almost all program logic of Vortex runs in the renderer process, some libraries will not
   * work correctly on that process so you have to run on the main process.
   *
   * @deprecated This is a very niche use case and modern Electron practices are explicitly
   * discouraging running code on the main process. This will be removed in future versions.
   *
   * If you need unrestricted NodeJS environment for your extension - use a separate NodeJS process
   * and communicate with it via IPC.
   *
   * If you need to run code before the renderer process is ready,
   * inform the Vortex team about your use case and we will investigate your requirements or
   * suggest alternatives.
   */
  onceMain: (callback: () => void) => void;

  /**
   * contains various utility functions. It's valid to store this object inside
   * the extension for later use.
   *
   * @type {IExtensionApi}
   * @memberOf IExtensionContext
   */
  api: IExtensionApi;

  /**
   * proxy to make optional register calls (if such calls are invalid in the api the extension
   * will not be unloaded)
   */
  optional: any;
}
