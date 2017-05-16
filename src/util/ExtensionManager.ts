import { addNotification, dismissNotification } from '../actions/notifications';

import { IExtensionInit } from '../types/Extension';
import { ArchiveHandlerCreator, IArchiveHandler, IExtensionApi, IExtensionContext,
         ILookupDetails, IOpenOptions, StateChangeCallback } from '../types/IExtensionContext';
import { INotification } from '../types/INotification';
import lazyRequire from '../util/lazyRequire';

import { Archive } from './archives';
import { log } from './log';
import { showError } from './message';
import { activeGameId } from './selectors';
import { getSafe } from './storeHelper';

import * as Promise from 'bluebird';
import { app as appIn, dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs';
import { IHashResult, ILookupResult, IModInfo, IReference } from 'modmeta-db';
import * as modmetaT from 'modmeta-db';
const modmeta = lazyRequire<typeof modmetaT>('modmeta-db');
import * as path from 'path';
import { types as ratypes } from 'redux-act';
import ReduxWatcher = require('redux-watcher');

import Module = require('module');

// these imports are only here so that tsc knows there is a dependency
// on the extensions and re-compiles them properly. They are completely
// removed during compilation
import {} from '../extensions/about_dialog';
import {} from '../extensions/category_management';
import {} from '../extensions/dashboard';
import {} from '../extensions/diagnostics_files';
import {} from '../extensions/download_management';
import {} from '../extensions/firststeps_dashlet';
import {} from '../extensions/gamemode_management';
import {} from '../extensions/hardlink_activator';
import {} from '../extensions/installer_fomod';
import {} from '../extensions/installer_nested_fomod';
import {} from '../extensions/mod_highlight';
import {} from '../extensions/mod_management';
import {} from '../extensions/nexus_integration';
import {} from '../extensions/profile_management';
import {} from '../extensions/settings_interface';
import {} from '../extensions/settings_metaserver';
import {} from '../extensions/starter_dashlet';
import {} from '../extensions/symlink_activator';
import {} from '../extensions/symlink_activator_elevate';
import {} from '../extensions/test_runner';
import {} from '../extensions/updater';

let app = appIn;
let dialog = dialogIn;

if (remote !== undefined) {
  app = remote.app;
  dialog = remote.dialog;
}

// TODO: this inserts the Vortex module-path globally so that dynamically loaded
//   extensions can access them. It would be nicer if we could limit this to
//   only the extensions and without using the internal function _initPaths
//   but I didn't find out how (at least not without accessing even more
//   internals)
process.env.NODE_PATH = path.resolve(__dirname, '..', '..', 'node_modules');
Module._initPaths();

interface IRegisteredExtension {
  name: string;
  initFunc: IExtensionInit;
}

interface IWatcherRegistry {
  [watchPath: string]: StateChangeCallback[];
}

interface IInitCall {
  extension: string;
  key: string;
  arguments: any[];
  optional: boolean;
}

interface IApiAddition {
  key: string;
  callback: (...args: any[]) => void;
}

class ContextProxyHandler implements ProxyHandler<any> {
  private mContext: any;
  private mInitCalls: IInitCall[];
  private mApiAdditions: IApiAddition[];
  private mCurrentExtension: string;
  private mOptional: {};

  constructor(context: any) {
    this.mContext = context;
    this.mInitCalls = [];
    this.mApiAdditions = [];
    const that = this;
    this.mOptional = new Proxy({}, {
      get(target, key: PropertyKey): any {
        return (...args) => {
          that.mInitCalls.push({
            extension: that.mCurrentExtension,
            key: key.toString(),
            arguments: args,
            optional: true,
          });
        };
      },
    });
  }

  /**
   * returns the parameters of calls to the specified function
   */
  public getCalls(name: string): any[][] {
    return this.mInitCalls.filter((call: IInitCall) =>
      call.key === name)
    .map((call: IInitCall) => call.arguments);
  }

  public invokeAdditions() {
    this.mApiAdditions.forEach((addition: IApiAddition) => {
      this.getCalls(addition.key).forEach((args: any[]) => {
        addition.callback(...args);
      });
    });
  }

  /**
   * remove all init calls from incompatible extesions
   */
  public unloadIncompatible(furtherAPIs: Set<string>) {
    const addAPIs: string[] = this.mApiAdditions.map((addition: IApiAddition) => addition.key);
    const fullAPI = new Set([...furtherAPIs, ...this.staticAPIs, ...addAPIs]);

    const incompatibleExtensions = new Set<string>();

    this.mInitCalls.filter(
      (call: IInitCall) => !call.optional && !fullAPI.has(call.key))
    .forEach((call: IInitCall) => {
      log('debug', 'unsupported api call', { extension: call.extension, api: call.key });
      incompatibleExtensions.add(call.extension);
    });
    if (incompatibleExtensions.size > 0) {
      log('info', 'extensions ignored for using unsupported api',
          { extensions: Array.from(incompatibleExtensions).join(', ') });
      this.mInitCalls = this.mInitCalls.filter((call: IInitCall) =>
        !incompatibleExtensions.has(call.extension));
    } else {
      if (remote !== undefined) {
        log('debug', 'all extensions compatible');
      }
    }
  }

  /**
   * change the extension name currently being loaded
   */
  public setExtension(extension: string) {
    this.mCurrentExtension = extension;
  }

  public has(target, key: PropertyKey): boolean {
    return true;
  }

  public get(target, key: PropertyKey): any {
    if (key in this.mContext) {
      return this.mContext[key];
    } else if (key === 'optional') {
      return this.mOptional;
    }

    return (key in this.mContext)
      ? this.mContext[key]
      : (...args) => {
        this.mInitCalls.push({
          extension: this.mCurrentExtension,
          key: key.toString(),
          arguments: args,
          optional: false,
        });
      };
  }

  public set(target, key: PropertyKey, value: any, receiver: any) {
    this.mApiAdditions.push({
      key: key.toString(),
      callback: value,
    });
    return true;
  }

  private get staticAPIs() {
    // trick so we get a compile time error from tsc if this object doesn't
    // match the interface
    const dummy: IExtensionContext = {
      registerMainPage: undefined,
      registerDashlet: undefined,
      registerDialog: undefined,
      registerSettings: undefined,
      registerAction: undefined,
      registerFooter: undefined,
      registerReducer: undefined,
      registerStyle: undefined,
      registerPersistor: undefined,
      registerSettingsHive: undefined,
      registerTableAttribute: undefined,
      registerTest: undefined,
      registerArchiveType: undefined,
      api: undefined,
      once: undefined,
      onceMain: undefined,
      optional: undefined,
    };

    return Object.keys(dummy);
  }

}

/**
 * interface to extensions. This loads extensions and provides the api extensions
 * use
 *
 * @class ExtensionManager
 */
class ExtensionManager {
  public static registerUIAPI(name: string) {
    ExtensionManager.sUIAPIs.add(name);
  }

  private static sUIAPIs: Set<string> = new Set<string>();

  private mExtensions: IRegisteredExtension[];
  private mApi: IExtensionApi;
  private mTranslator: I18next.I18n;
  private mEventEmitter: NodeJS.EventEmitter;
  private mReduxWatcher: any;
  private mWatches: IWatcherRegistry = {};
  private mProtocolHandlers: { [protocol: string]: (url: string) => void } = {};
  private mArchiveHandlers: { [extension: string]: ArchiveHandlerCreator };
  private mModDB: modmetaT.ModDB;
  private mModDBGame: string;
  private mModDBAPIKey: string;
  private mPid: number;
  private mContextProxyHandler: ContextProxyHandler;

  constructor(eventEmitter?: NodeJS.EventEmitter) {
    this.mPid = process.pid;
    this.mEventEmitter = eventEmitter;
    this.mApi = {
      showErrorNotification:
        (message: string, details: string | Error | any, isHTML: boolean = false) => {
        if (typeof(details) === 'string') {
          dialog.showErrorBox(message, details);
        } else {
          dialog.showErrorBox(message, details.message);
        }
      },
      selectFile: this.selectFile,
      selectExecutable: this.selectExecutable,
      selectDir: this.selectDir,
      events: this.mEventEmitter,
      translate: (input: string, options?: I18next.TranslationOptions) => {
        return this.mTranslator !== undefined ? this.mTranslator.t(input, options) : input;
      },
      getPath: this.getPath,
      onStateChange: (path: string[], callback: StateChangeCallback) => undefined,
      registerProtocol: this.registerProtocol,
      deregisterProtocol: this.deregisterProtocol,
      lookupModReference: this.lookupModReference,
      lookupModMeta: this.lookupModMeta,
      saveModMeta: this.saveModMeta,
      openArchive: this.openArchive,
    };
    this.mExtensions = this.loadExtensions();
    this.initExtensions();
  }

  public setTranslation(translator: I18next.I18n) {
    this.mTranslator = translator;
  }

  /**
   * sets up the extension manager to work with the specified store
   *
   * @template S State interface
   * @param {Redux.Store<S>} store
   *
   * @memberOf ExtensionManager
   */
  public setStore<S>(store: Redux.Store<S>) {
    this.mReduxWatcher = new ReduxWatcher(store);

    this.mApi.sendNotification = (notification: INotification) => {
      store.dispatch(addNotification(notification));
    };
    this.mApi.showErrorNotification =
      (message: string, details: string | Error | any, isHTML: boolean = false) => {
      showError(store.dispatch, message, details, isHTML);
    };
    this.mApi.dismissNotification = (id: string) => {
      store.dispatch(dismissNotification(id));
    };
    this.mApi.store = store;
    this.mApi.onStateChange = this.stateChangeHandler;

    const {ipcRenderer} = require('electron');
    ipcRenderer.on(
        'send-notification',
        (event, notification) => this.mApi.sendNotification(notification));
    ipcRenderer.on('show-error-notification',
                   (event, message, details) =>
                       this.mApi.showErrorNotification(message, details));
  }

  /**
   * set up the api for the main process.
   *
   * @param {Redux.Store<S>} store
   * @param {NodeJS.Events} ipc channel to the renderer process, in case a call has to be
   *                            delegated there
   *
   * @memberOf ExtensionManager
   */
  public setupApiMain<S>(store: Redux.Store<S>, ipc: Electron.WebContents) {
    this.mApi.sendNotification = (notification: INotification) =>
        ipc.emit('send-notification', notification);
    this.mApi.showErrorNotification =
        (message: string, details: string | Error) => {
          // unfortunately it appears we can't send an error object via ipc
          const errMessage = typeof(details) === 'string' ? details : details.message;
          ipc.send('show-error-notification', message, errMessage);
        };
    this.mApi.store = store;
    this.mApi.onStateChange = this.stateChangeHandler;
  }

  /**
   * gain acces to the extension api
   *
   * @returns
   *
   * @memberOf ExtensionManager
   */
  public getApi() {
    return this.mApi;
  }

  /**
   * retrieve list of all reducers registered by extensions
   */
  public getReducers() {
    const reducers = [];
    this.apply('registerReducer', (path: string[], reducer: any) => {
      reducers.push({ path, reducer });
    });
    return reducers;
  }

  /**
   * apply all extensions that were registered by extensions
   *
   * @memberOf ExtensionManager
   */
  public applyExtensionsOfExtensions() {
    this.mContextProxyHandler.invokeAdditions();
  }

  /**
   * runs the extension init function with the specified register-function
   * set
   *
   * @param {string} funcName
   * @param {Function} func
   *
   * @memberOf ExtensionManager
   */
  public apply(funcName: string, func: (...args: any[]) => void) {
    this.mContextProxyHandler.getCalls(funcName).forEach((args: any[]) => {
      func(...args);
    });
  }

  /**
   * call the "once" function for all extensions. This should really only be called
   * once.
   */
  public doOnce() {
    this.mContextProxyHandler.getCalls(remote !== undefined ? 'once' :
                                                              'onceMain')
        .forEach((args: any[]) => {
          try {
            args[0]();
          } catch (err) {
            log('warn', 'failed to call once',
                {err: err.message, stack: err.stack});
          }
        });
  }

  public getProtocolHandler(protocol: string) {
    return this.mProtocolHandlers[protocol] || null;
  }

  get modDB(): modmetaT.ModDB {
    const currentGame = activeGameId(this.mApi.store.getState());
    const currentKey =
        getSafe(this.mApi.store.getState(),
                ['confidential', 'account', 'nexus', 'APIKey'], '');
    // TODO this is a hack!
    if ((this.mModDB === undefined)
        || (currentGame !== this.mModDBGame)
        || (currentKey !== this.mModDBAPIKey)) {
      log('info', 'init moddb connection');
      this.mModDB = new modmeta.ModDB(
        path.join(app.getPath('userData'), 'metadb'),
        currentGame, [
        {
          protocol: 'nexus',
          url: 'https://api.nexusmods.com/v1',
          apiKey: currentKey,
          cacheDurationSec: 86400,
        },
      ]);
      this.mModDBGame = currentGame;
      this.mModDBAPIKey = currentKey;
    }
    // TODO: the mod db doesn't depend on the store but it must only be instantiated
    //   in one process and this is a cheap way of achieving that
    // TODO: the fallback to nexus api should somehow be set up in nexus_integration, not here
    return this.mModDB;
  }

  private stateChangeHandler = (watchPath: string[],
                                callback: StateChangeCallback) => {
    let lastValue;
    const key = watchPath.join('.');
    if (this.mWatches[key] === undefined) {
      this.mWatches[key] = [];
      this.mReduxWatcher.watch(watchPath,
                               // tslint:disable-next-line: no-unused-variable
                               ({cbStore, selector, prevState, currentState,
                                 prevValue, currentValue}) => {
                                 // TODO redux-watch seems to trigger even if
                                 // the value has not changed. This can
                                 //   lead to an endless loop where a state
                                 //   change handler re-sets the same value
                                 //   causing an infinite loop
                                 if (currentValue === lastValue) {
                                   return;
                                 }
                                 lastValue = currentValue;
                                 for (const cb of this.mWatches[key]) {
                                   try {
                                     cb(prevValue, currentValue);
                                   } catch (err) {
                                     log('error', 'state change handler failed',
                                         {
                                           message: err.message,
                                           stack: err.stack,
                                         });
                                   }
                                 }
                               });
    }
    this.mWatches[key].push(callback);
  }

  /**
   * initialize all extensions
   */
  private initExtensions() {
    const context = {
      api: this.mApi,
    };

    this.mContextProxyHandler = new ContextProxyHandler(context);
    const contextProxy = new Proxy(context, this.mContextProxyHandler);
    this.mExtensions.forEach(ext => {
      if (remote !== undefined) {
        // log this only once so we don't spam the log file with this
        log('info', 'init extension', {name: ext.name});
      }
      this.mContextProxyHandler.setExtension(ext.name);
      try {
        ext.initFunc(contextProxy as IExtensionContext);
      } catch (err) {
        log('warn', 'couldn\'t initialize extension', {name: ext.name, err: err.message});
      }
    });
    this.mContextProxyHandler.unloadIncompatible(ExtensionManager.sUIAPIs);
    if (remote !== undefined) {
      log('info', 'all extensions initialized');
    }
  }

  private getPath(name: Electron.AppPathName) {
    return app.getPath(name);
  }

  private selectFile(options: IOpenOptions) {
    return new Promise<string>((resolve, reject) => {
      const fullOptions = Object.assign({}, options, {
        properties: ['openFile'],
      });
      dialog.showOpenDialog(null, fullOptions, (fileNames: string[]) => {
        if ((fileNames !== undefined) && (fileNames.length > 0)) {
          resolve(fileNames[0]);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  private selectExecutable(options: IOpenOptions) {
    return new Promise<string>((resolve, reject) => {
      const fullOptions = Object.assign({}, options, {
        properties: ['openFile'],
        filters: [
          { name: 'All Executables', extensions: ['exe', 'cmd', 'bat', 'jar', 'py'] },
          { name: 'Native', extensions: ['exe', 'cmd', 'bat'] },
          { name: 'Java', extensions: ['jar'] },
          { name: 'Python', extensions: ['py'] },
        ],
      });
      dialog.showOpenDialog(null, fullOptions, (fileNames: string[]) => {
        if ((fileNames !== undefined) && (fileNames.length > 0)) {
          resolve(fileNames[0]);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  private selectDir(options: IOpenOptions) {
    return new Promise<string>((resolve, reject) => {
      const fullOptions = Object.assign({}, options, {
        properties: ['openDirectory'],
      });
      dialog.showOpenDialog(null, fullOptions, (fileNames: string[]) => {
        if ((fileNames !== undefined) && (fileNames.length > 0)) {
          resolve(fileNames[0]);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  private registerProtocol = (protocol: string, callback: (url: string) => void) => {
    log('info', 'register protocol', { protocol });
    if (process.execPath.endsWith('electron.exe')) {
      // make it work when using the development version
      app.setAsDefaultProtocolClient(protocol, process.execPath,
                                     [ path.resolve(__dirname, '..', '..'), '-d' ]);
    } else {
      app.setAsDefaultProtocolClient(protocol, process.execPath, [ '-d' ]);
    }
    this.mProtocolHandlers[protocol] = callback;
  }

  private registerArchiveHandler = (extension: string, handler: ArchiveHandlerCreator) => {
    this.mArchiveHandlers[extension] = handler;
  }

  private deregisterProtocol(protocol: string) {
    log('info', 'deregister protocol');
    if (process.execPath.endsWith('electron.exe')) {
      // make it work when using the development version
      app.removeAsDefaultProtocolClient(protocol, process.execPath,
                                        [ path.resolve(__dirname, '..', '..') ]);
    } else {
      app.removeAsDefaultProtocolClient(protocol);
    }
  }

  private lookupModReference = (reference: IReference): Promise<ILookupResult[]> => {
    return this.modDB.getByKey(reference.fileMD5);
  }

  private lookupModMeta = (detail: ILookupDetails): Promise<ILookupResult[]> => {
    let fileMD5 = detail.fileMD5;
    let fileSize = detail.fileSize;

    if ((fileMD5 === undefined) && (detail.filePath === undefined)) {
      return Promise.resolve([]);
    }

    let promise: Promise<void>;

    if (fileMD5 === undefined) {
      promise = modmeta.genHash(detail.filePath).then((res: IHashResult) => {
        fileMD5 = res.md5sum;
        fileSize = res.numBytes;
        this.getApi().events.emit('filehash-calculated', detail.filePath, fileMD5, fileSize);
      });
    } else {
      promise = Promise.resolve();
    }
    return promise
      .then(() => this.modDB.lookup(detail.filePath, fileMD5,
          fileSize, detail.gameId))
      .then((result: ILookupResult[]) => Promise.resolve(result));
  }

  private saveModMeta = (modInfo: IModInfo): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      this.modDB.insert(modInfo);
      resolve();
    });
  }

  private openArchive = (archivePath: string): Promise<Archive> => {
    if (this.mArchiveHandlers === undefined) {
      // lazy loading the archive handlers
      this.mArchiveHandlers = {};
      this.apply('registerArchiveType', this.registerArchiveHandler);
    }
    const ext = path.extname(archivePath).substr(1);
    const creator = this.mArchiveHandlers[ext];
    if (creator === undefined) {
      return Promise.reject(new Error('unsupported archive format ' + ext));
    }
    return creator(archivePath, {})
      .then((handler: IArchiveHandler) => {
        return Promise.resolve(new Archive(handler));
      });
  }

  private loadDynamicExtension(extensionPath: string): IRegisteredExtension {
    const indexPath = path.join(extensionPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      // TODO: workaround. redux-act stores a global set of action creator ids and throws if
      //  there would be a duplicate. Since extensions might import actions we already have loaded
      //  here, that mechanism would fail.
      ratypes.clear();

      return { name: path.basename(extensionPath), initFunc: require(indexPath).default };
    } else {
      return undefined;
    }
  }

  private loadDynamicExtensions(extensionsPath: string): IRegisteredExtension[] {
    if (!fs.existsSync(extensionsPath)) {
      log('info', 'failed to load dynamic extensions, path doesn\'t exist', extensionsPath);
      fs.mkdirSync(extensionsPath);
      return [];
    }

    const res = fs.readdirSync(extensionsPath)
      .filter(name => fs.statSync(path.join(extensionsPath, name)).isDirectory())
      .map(name => {
        try {
          const before = new Date().getTime();
          const ext = this.loadDynamicExtension(path.join(extensionsPath, name));
          const loadTime = new Date().getTime() - before;
          log('debug', 'loaded extension', { name, loadTime });
          return ext;
        } catch (err) {
          log('warn', 'failed to load dynamic extension',
              { name, error: err.message, stack: err.stack });
          return undefined;
        }
      });
    return res.filter((reg: IRegisteredExtension) => reg !== undefined);
  }

  /**
   * retrieves all extensions to the base functionality, both the static
   * and external ones.
   * This loads external extensions from disc synchronously
   *
   * @returns {IExtensionInit[]}
   */
  private loadExtensions(): IRegisteredExtension[] {
    const staticExtensions = [
      'settings_interface',
      'about_dialog',
      'diagnostics_files',
      'dashboard',
      'starter_dashlet',
      'firststeps_dashlet',
      'mod_management',
      'category_management',
      'profile_management',
      'nexus_integration',
      'mod_highlight',
      'download_management',
      'gamemode_management',
      'symlink_activator',
      'symlink_activator_elevate',
      'hardlink_activator',
      'updater',
      'installer_fomod',
      'installer_nested_fomod',
      'settings_metaserver',
      'test_runner',
    ];

    const bundledPath = path.resolve(__dirname, '..', 'bundledPlugins');
    log('info', 'bundle at', bundledPath);
    const extensionsPath = path.join(app.getPath('userData'), 'plugins');
    return staticExtensions
      .map((name: string) => ({
          name,
          initFunc: require(`../extensions/${name}/index`).default,
        }))
        .concat(this.loadDynamicExtensions(bundledPath),
                this.loadDynamicExtensions(extensionsPath));
  }
}

export default ExtensionManager;
