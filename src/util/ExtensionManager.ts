import { addNotification, dismissNotification } from '../actions/notifications';

import { IExtensionInit } from '../types/Extension';
import { IExtensionApi, IExtensionContext, ILookupDetails,
         IOpenOptions, IStateChangeCallback } from '../types/IExtensionContext';
import { INotification } from '../types/INotification';
import { log } from '../util/log';
import { showError } from '../util/message';
import { getSafe } from '../util/storeHelper';

import * as Promise from 'bluebird';
import { app as appIn, dialog as dialogIn, remote } from 'electron';
import * as fs from 'fs';
import { IHashResult, ILookupResult, IModInfo, IReference, ModDB, genHash } from 'modmeta-db';
import * as path from 'path';
import { types as ratypes } from 'redux-act';
import ReduxWatcher = require('redux-watcher');

import Module = require('module');

// these imports are only here so that tsc knows there is a dependency
// on the extensions and re-compiles them properly. They are completely
// removed during compilation
import {} from '../extensions/about_dialog';
import {} from '../extensions/category_management';
import {} from '../extensions/download_management';
import {} from '../extensions/gamemode_management';
import {} from '../extensions/hardlink_activator';
import {} from '../extensions/installer_fomod';
import {} from '../extensions/mod_management';
import {} from '../extensions/nexus_integration';
import {} from '../extensions/nuts_local';
import {} from '../extensions/profile_management';
import {} from '../extensions/settings_interface';
import {} from '../extensions/settings_metaserver';
import {} from '../extensions/symlink_activator';
import {} from '../extensions/symlink_activator_elevate';
import {} from '../extensions/updater';
import {} from '../extensions/welcome_screen';

let app = appIn;
let dialog = dialogIn;

if (remote !== undefined) {
  app = remote.app;
  dialog = remote.dialog;
}

// TODO: this inserts the nmm module-path globally so that dynamically loaded
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

type WatcherRegistry = { [watchPath: string]: IStateChangeCallback[] };

interface IInitCall {
  extension: string;
  key: string;
  arguments: any[];
  optional: boolean;
}

interface IApiAddition {
  key: string;
  callback: Function;
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
    let that = this;
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
      call.key === name
    ).map((call: IInitCall) => call.arguments);
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
    let addAPIs: string[] = this.mApiAdditions.map((addition: IApiAddition) => addition.key);
    let fullAPI = new Set([...furtherAPIs, ...this.staticAPIs, ...addAPIs]);

    let incompatibleExtensions = new Set<string>();

    this.mInitCalls.filter((call: IInitCall) => !call.optional && !fullAPI.has(call.key)
    ).forEach((call: IInitCall) => {
      incompatibleExtensions.add(call.extension);
    });
    if (incompatibleExtensions.size > 0) {
      log('info', 'extensions ignored for using unsupported api',
          { extensions: Array.from(incompatibleExtensions).join(', ') });
      this.mInitCalls = this.mInitCalls.filter((call: IInitCall) =>
        !incompatibleExtensions.has(call.extension)
      );
    } else {
      log('debug', 'all extensions compatible');
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
    let dummy: IExtensionContext = {
      registerMainPage: undefined,
      registerDialog: undefined,
      registerSettings: undefined,
      registerIcon: undefined,
      registerFooter: undefined,
      registerReducer: undefined,
      registerStyle: undefined,
      registerPersistor: undefined,
      registerSettingsHive: undefined,
      registerTableAttribute: undefined,
      api: undefined,
      once: undefined,
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
  private mWatches: WatcherRegistry = {};
  private mProtocolHandlers: { [protocol: string]: (url: string) => void } = {};
  private mModDB: ModDB;
  private mPid: number;
  private mContextProxyHandler: ContextProxyHandler;

  constructor(eventEmitter?: NodeJS.EventEmitter) {
    this.mPid = process.pid;
    this.mEventEmitter = eventEmitter;
    this.mApi = {
      showErrorNotification: (message: string, details: string | Error) => {
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
      onStateChange: (path: string[], callback: IStateChangeCallback) => undefined,
      registerProtocol: this.registerProtocol,
      deregisterProtocol: this.deregisterProtocol,
      lookupModReference: this.lookupModReference,
      lookupModMeta: this.lookupModMeta,
      saveModMeta: this.saveModMeta,
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
    this.mApi.showErrorNotification = (message: string, details: string | Error) => {
      showError(store.dispatch, message, details);
    };
    this.mApi.dismissNotification = (id: string) => {
      store.dispatch(dismissNotification(id));
    };
    this.mApi.store = store;
    this.mApi.onStateChange = (watchPath: string[], callback: IStateChangeCallback) => {
      let lastValue;
      let key = watchPath.join('.');
      if (this.mWatches[key] === undefined) {
        this.mWatches[key] = [];
        this.mReduxWatcher.watch(watchPath,
          // tslint:disable-next-line: no-unused-variable
          ({ cbStore, selector, prevState, currentState, prevValue, currentValue }) => {
            // TODO redux-watch seems to trigger even if the value has not changed. This can
            //   lead to an endless loop where a state change handler re-sets the same value
            //   causing an infinite loop
            if (currentValue === lastValue) {
              return;
            }
            lastValue = currentValue;
            for (let cb of this.mWatches[key]) {
              try {
                cb(prevValue, currentValue);
              } catch (err) {
                log('error', 'state change handler failed', {
                  message: err.message,
                  stack: err.stack,
                });
              }
            }
          });
      }
      this.mWatches[key].push(callback);
    };

    // TODO the mod db doesn't depend on the store but it must only be instantiated
    //   in one process and this is a cheap way of achieving that
    // TODO the fallback to nexus api should somehow be set up in nexus_integration, not here
    this.mModDB =
        new ModDB(getSafe(store.getState(), ['settings', 'gameMode', 'current'],
                          undefined),
                  [
                    {
                      protocol: 'nexus',
                      url: 'https://api.nexusmods.com/v1',
                      apiKey: getSafe(store.getState(),
                                      ['account', 'nexus', 'APIKey'], ''),
                      cacheDurationSec: 86400,
                    },
                  ]);
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
    let reducers = [];
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
  public apply(funcName: string, func: Function) {
    this.mContextProxyHandler.getCalls(funcName).forEach((args: any[]) => {
      func(...args);
    });
  }

  /**
   * call the "once" function for all extensions. This should really only be called
   * once.
   */
  public doOnce() {
    this.mContextProxyHandler.getCalls('once').forEach((args: any[]) => {
      try {
        args[0]();
      } catch (err) {
        log('warn', 'failed to call once',
            { err: err.message, stack: err.stack });
      }
    });
  }

  public getProtocolHandler(protocol: string) {
    return this.mProtocolHandlers[protocol] || null;
  }

  /**
   * initialize all extensions
   */
  private initExtensions() {
    let context = {
      api: this.mApi,
    };

    this.mContextProxyHandler = new ContextProxyHandler(context);
    let contextProxy = new Proxy(context, this.mContextProxyHandler);
    this.mExtensions.forEach((ext) => {
      log('info', 'init extension', {name: ext.name});
      this.mContextProxyHandler.setExtension(ext.name);
      try {
        ext.initFunc(contextProxy as IExtensionContext);
      } catch (err) {
        log('warn', 'couldn\'t initialize extension', {name: ext.name, err: err.message});
      }
    });
    this.mContextProxyHandler.unloadIncompatible(ExtensionManager.sUIAPIs);
    log('info', 'all extensions initialized');
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
                                     [ path.resolve(__dirname, '..', '..') ]);
    } else {
      app.setAsDefaultProtocolClient(protocol);
    }
    this.mProtocolHandlers[protocol] = callback;
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
    if (this.mModDB !== undefined) {
      // TODO support other reference type
      return this.mModDB.getByKey(reference.fileMD5);
    } else {
      return Promise.reject({ message: 'wrong process' });
    }
  }

  private lookupModMeta = (detail: ILookupDetails): Promise<ILookupResult[]> => {
    if (this.mModDB !== undefined) {
      let fileMD5 = detail.fileMD5;
      let fileSize = detail.fileSize;

      if ((fileMD5 === undefined) && (detail.filePath === undefined)) {
        return Promise.resolve([]);
      }

      let promise: Promise<void>;

      if (fileMD5 === undefined) {
        promise = genHash(detail.filePath).then((res: IHashResult) => {
          fileMD5 = res.md5sum;
          fileSize = res.numBytes;
          this.getApi().events.emit('filehash-calculated', detail.filePath, fileMD5, fileSize);
        });
      } else {
        promise = Promise.resolve();
      }

      return promise.then(() => this.mModDB.lookup(detail.filePath, fileMD5,
                                                   fileSize, detail.gameId,
                                                   detail.modId))
          .then((result: ILookupResult[]) => Promise.resolve(result));
    } else {
      return Promise.reject(new Error('wrong process'));
    }
  }

  private saveModMeta = (modInfo: IModInfo): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      this.mModDB.insert(modInfo);
      resolve();
    });
  }

  private loadDynamicExtension(extensionPath: string): IRegisteredExtension {
    let indexPath = path.join(extensionPath, 'index.js');
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

    let res = fs.readdirSync(extensionsPath)
      .filter((name) => fs.statSync(path.join(extensionsPath, name)).isDirectory())
      .map((name) => {
        try {
          return this.loadDynamicExtension(path.join(extensionsPath, name));
        } catch (err) {
          log('warn', 'failed to load dynamic extension', { name, error: err.message });
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
    let staticExtensions = [
      'settings_interface',
      'about_dialog',
      'welcome_screen',
      'mod_management',
      'category_management',
      'profile_management',
      'nexus_integration',
      'download_management',
      'gamemode_management',
      'nuts_local',
      'symlink_activator',
      'symlink_activator_elevate',
      'hardlink_activator',
      'updater',
      'installer_fomod',
      'settings_metaserver',
    ];

    const bundledPath = path.resolve(__dirname, '..', 'bundledPlugins');
    log('info', 'bundle at', bundledPath);
    const extensionsPath = path.join(app.getPath('userData'), 'plugins');
    return staticExtensions.map((name: string) => ({
      name, initFunc: require(`../extensions/${name}/index`).default,
    })).concat(this.loadDynamicExtensions(bundledPath))
      .concat(this.loadDynamicExtensions(extensionsPath));
  }
}

export default ExtensionManager;
