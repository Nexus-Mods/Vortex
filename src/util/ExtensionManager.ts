import { forgetExtension, removeExtension, setExtensionEnabled, setExtensionVersion } from '../actions/app';
import { addNotification, closeDialog, DialogActions, DialogType, dismissNotification,
         IDialogContent, showDialog } from '../actions/notifications';
import { suppressNotification } from '../actions/notificationSettings';
import { setExtensionLoadFailures } from '../actions/session';

import { IExtension } from '../extensions/extension_manager/types';
import { ExtensionInit } from '../types/Extension';
import {
  ArchiveHandlerCreator,
  IArchiveHandler,
  IArchiveOptions,
  IErrorOptions,
  IExtensionApi,
  IExtensionContext,
  ILookupDetails,
  IOpenOptions,
  IReducerSpec,
  IRunOptions,
  IRunParameters,
  StateChangeCallback,
  ThunkStore,
} from '../types/IExtensionContext';
import { INotification } from '../types/INotification';
import { IExtensionLoadFailure, IExtensionState, IState } from '../types/IState';

import { Archive } from './archives';
import { relaunch } from './commandLine';
import { COMPANY_ID } from './constants';
import { MissingDependency, NotSupportedError,
        ProcessCanceled, UserCanceled } from './CustomErrors';
import { isOutdated } from './errorHandling';
import getVortexPath from './getVortexPath';
import { i18n } from './i18n';
import lazyRequire from './lazyRequire';
import { log } from './log';
import { showError } from './message';
import { registerSanityCheck, SanityCheck } from './reduxSanity';
import runElevatedCustomTool from './runElevatedCustomTool';
import { activeGameId } from './selectors';
import { getSafe } from './storeHelper';
import StyleManager from './StyleManager';
import { setdefault, truthy } from './util';

import Promise from 'bluebird';
import { spawn, SpawnOptions } from 'child_process';
import { app as appIn, dialog as dialogIn, ipcMain, ipcRenderer, OpenDialogOptions,
         remote, WebContents } from 'electron';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import I18next from 'i18next';
import JsonSocket from 'json-socket';
import * as _ from 'lodash';
import { IHashResult, ILookupResult, IModInfo, IReference } from 'modmeta-db';
import * as modmetaT from 'modmeta-db';
const modmeta = lazyRequire<typeof modmetaT>(() => require('modmeta-db'));
import * as net from 'net';
import * as path from 'path';
import * as Redux from 'redux';
import {} from 'redux-watcher';
import * as semver from 'semver';
import { generate as shortid } from 'shortid';
import { dynreq, runElevated } from 'vortex-run';

// tslint:disable-next-line:no-var-requires
const ReduxWatcher = require('redux-watcher');

const ERROR_OUTPUT_CUTOFF = 3;

let app = appIn;
let dialog = dialogIn;

if (remote !== undefined) {
  app = remote.app;
  dialog = remote.dialog;
}

export interface IRegisteredExtension {
  name: string;
  path: string;
  dynamic: boolean;
  initFunc: ExtensionInit;
  info?: IExtension;
}

interface IWatcherRegistry {
  [watchPath: string]: StateChangeCallback[];
}

interface IInitCall {
  extension: string;
  extensionPath: string;
  key: string;
  arguments: any[];
  optional: boolean;
}

interface IApiAddition {
  key: string;
  callback: (...args: any[]) => void;
}

class APIProxyHandler implements ProxyHandler<any> {
  private mExtension: IRegisteredExtension;
  private mEnabled: boolean;

  constructor(extension: IRegisteredExtension, enable: boolean) {
    this.mExtension = extension;
    this.mEnabled = enable;
  }

  public enable() {
    this.mEnabled = true;
  }

  public get(target, key: PropertyKey): any {
    if (key === 'extension') {
      return this.mExtension;
    }
    if (key === 'translate') {
      return target[key];
    }
    if (!this.mEnabled) {
      throw new Error('extension uses api in init function');
    }
    return target[key];
  }
}

class APIProxyCreator implements ProxyHandler<any> {
  private mExtension: IRegisteredExtension;
  private mProxyHandler: APIProxyHandler;
  private mProxy: IExtensionApi;
  private mAPIEnabled: boolean = false;

  constructor(extension: IRegisteredExtension) {
    this.mExtension = extension;
  }

  public enableAPI() {
    this.mAPIEnabled = true;
    if (this.mProxyHandler !== undefined) {
      this.mProxyHandler.enable();
    }
  }

  public get(target, key: PropertyKey): any {
    if (key === 'api') {
      if (this.mProxy === undefined) {
        this.mProxyHandler = new APIProxyHandler(this.mExtension, this.mAPIEnabled);
        this.mProxy = new Proxy(target[key], this.mProxyHandler);
      }
      return this.mProxy;
    } else {
      return target[key];
    }
  }
}

class ContextProxyHandler implements ProxyHandler<any> {
  private mContext: any;
  private mInitCalls: IInitCall[];
  private mApiAdditions: IApiAddition[];
  private mCurrentExtension: string;
  private mCurrentPath: string;
  private mOptional: {};
  private mMayRegister: boolean = true;

  constructor(context: any) {
    this.mContext = context;
    this.mInitCalls = [];
    this.mApiAdditions = [];
    // TODO: check if this is necessary. Ususally the arrow lambda should
    //   bind this automatically
    // tslint:disable-next-line:no-this-assignment
    const that = this;
    this.mOptional = new Proxy({}, {
      get(target, key: PropertyKey): any {
        return (...args) => {
          if (!this.mMayRegister) {
            log('warn', 'extension tries to use register call outside init function', {
              extension: this.mCurrentExtension,
              call: key,
            });
            return;
          }

          that.mInitCalls.push({
            extension: that.mCurrentExtension,
            extensionPath: that.mCurrentPath,
            key: key.toString(),
            arguments: args,
            optional: true,
          });
        };
      },
    });
  }

  public endRegistration() {
    this.mMayRegister = false;
  }

  /**
   * returns the parameters of calls to the specified function
   */
  public getCalls(name: string): IInitCall[] {
    return this.mInitCalls.filter((call: IInitCall) =>
      call.key === name);
  }

  public invokeAdditions() {
    this.mApiAdditions.forEach((addition: IApiAddition) => {
      this.getCalls(addition.key).forEach(call => {
        addition.callback(...call.arguments, call.extensionPath);
      });
    });
  }

  /**
   * remove all init calls from incompatible extensions
   */
  public unloadIncompatible(furtherAPIs: Set<string>,
                            allExtensions: string[]): { [extId: string]: IExtensionLoadFailure[] } {
    const addAPIs: string[] =
        this.mApiAdditions.map((addition: IApiAddition) => addition.key);
    const fullAPI = new Set([...furtherAPIs, ...this.staticAPIs, ...addAPIs]);

    const incompatibleExtensions: { [extId: string]: IExtensionLoadFailure[] } = {};

    this.mInitCalls.filter(
      (call: IInitCall) => !call.optional && !fullAPI.has(call.key))
    .forEach((call: IInitCall) => {
      log('debug', 'unsupported api call', { extension: call.extension, api: call.key });
      setdefault(incompatibleExtensions, call.extension, [])
        .push({ id: 'unsupported-api' });
    });

    const testValid = (extId: string, requiredId?: string) => {
      if (allExtensions.indexOf(requiredId) === -1) {
        setdefault(incompatibleExtensions, extId, []).push(
          { id: 'dependency', args: { dependencyId: requiredId } });
      }
    };

    this.getCalls('requireExtension').forEach(call => {
      testValid(call.extension, ...call.arguments);
    });

    this.getCalls('requireVersion').forEach(call => {
      if ((process.env.NODE_ENV !== 'development')
          && !semver.satisfies(app.getVersion(), call.arguments[0])) {
        setdefault(incompatibleExtensions, call.extension, []).push(
          { id: 'unsupported-version' });
      }
    });

    if (Object.keys(incompatibleExtensions).length > 0) {
      log('info', 'extensions ignored for using unsupported api',
          { extensions: Object.keys(incompatibleExtensions).join(', ') });
      this.mInitCalls = this.mInitCalls.filter((call: IInitCall) =>
        incompatibleExtensions[call.extension] === undefined);
    } else {
      if (remote !== undefined) {
        log('debug', 'all extensions compatible');
      }
    }

    return incompatibleExtensions;
  }

  /**
   * change the extension name currently being loaded
   */
  public setExtension(extension: string, extensionPath: string) {
    this.mCurrentExtension = extension;
    this.mCurrentPath = extensionPath;
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
        if (!this.mMayRegister) {
          log('warn', 'extension tries to use register call outside init function', {
            extension: this.mCurrentExtension,
            call: key,
          });
          return;
        }

        this.mInitCalls.push({
          extension: this.mCurrentExtension,
          extensionPath: this.mCurrentPath,
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
      registerBanner: undefined,
      registerDeploymentMethod: undefined,
      registerInstaller: undefined,
      registerFooter: undefined,
      registerToDo: undefined,
      registerModSource: undefined,
      registerReducer: undefined,
      registerPersistor: undefined,
      registerSettingsHive: undefined,
      registerTableAttribute: undefined,
      registerTest: undefined,
      registerArchiveType: undefined,
      registerGame: undefined,
      registerGameStore: undefined,
      registerGameInfoProvider: undefined,
      registerAttributeExtractor: undefined,
      registerModType: undefined,
      registerActionCheck: undefined,
      registerMerge: undefined,
      registerInterpreter: undefined,
      registerStartHook: undefined,
      registerMigration: undefined,
      requireVersion: undefined,
      requireExtension: undefined,
      api: undefined,
      once: undefined,
      onceMain: undefined,
      optional: undefined,
    };

    return Object.keys(dummy);
  }
}

class EventProxy extends EventEmitter {
  private mTarget: WebContents;
  private mRemoteCallbacks: { [id: string]: (...args) => void } = {};
  private mRemotePromises: { [id: string]: { resolve: (res) => void, reject: (err) => void } } = {};

  constructor(target: WebContents) {
    super();
    this.mTarget = target;
    // any listener attached to this proxy will be attached to
    // the event handler in the target process as well so those events
    // get relayed to here
    this.on('newListener', (event, listener) => {
      // TODO: workaround: instead of two parameters I get one array with two elements.
      //   this differs from the documentation of newListener so I assume it'a a bug?
      if (Array.isArray(event)) {
        event = event[0];
      }
      this.mTarget.send('register-relay-listener', event);
    });
    // TODO: support removeListener
    ipcMain.on('relay-event', (event, eventName, ...args) => {
      if (event.sender === this.mTarget) {
        super.emit(eventName, ...args);
      }
    });
    ipcMain.on('relay-cb', (event, id, ...args) => {
      const cb = this.mRemoteCallbacks[id];
      if (cb !== undefined) {
        const newArgs = args.map(arg => {
          if (arg.__promise === undefined) {
            return arg;
          } else {
            return new Promise((resolve, reject) => {
              this.mRemotePromises[arg.__promise] = { resolve, reject };
            });
          }
        });
        cb(...newArgs);
        delete this.mRemoteCallbacks[id];
      }
    });
    ipcMain.on('relay-cb-resolve', (event, id, res) => {
      const prom = this.mRemotePromises[id];
      if (prom !== undefined) {
        prom.resolve(res);
        delete this.mRemotePromises[id];
      }
    });
    ipcMain.on('relay-cb-reject', (event, id, err) => {
      const prom = this.mRemotePromises[id];
      if (prom !== undefined) {
        prom.reject(err);
        delete this.mRemotePromises[id];
      }
    });
  }

  public emit(eventName: string, ...args) {
    if (!super.emit(eventName, args)
        && (this.mTarget !== undefined)
        && !this.mTarget.isDestroyed()) {
      // relay all events this process didn't handle itself to the connected
      // process
      if (typeof(args[args.length - 1]) === 'function') {
        const id = shortid();
        this.mRemoteCallbacks[id] = args[args.length - 1];
        const newArgs = [].concat(args.slice(0, args.length - 1), id);
        this.mTarget.send('relay-event-with-cb', eventName, ...newArgs);
      } else {
        this.mTarget.send('relay-event', eventName, ...args);
      }
      return true;
    }
    return false;
  }
}

const UNDEFINED = {};

interface IStartHook {
  priority: number;
  id: string;
  hook: (input: IRunParameters) => Promise<IRunParameters>;
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

  public static getExtensionPaths(): string[] {
    // only the first extension with a specific name is loaded, so
    // load the bundled ones last so a user can replace them
    return [
      path.join(getVortexPath('userData'), 'plugins'),
      getVortexPath('bundledPlugins'),
    ];
  }

  private static sUIAPIs: Set<string> = new Set<string>();

  private mExtensions: IRegisteredExtension[];
  private mApi: IExtensionApi;
  private mTranslator: i18n;
  private mEventEmitter: NodeJS.EventEmitter;
  private mStyleManager: StyleManager;
  private mReduxWatcher: any;
  private mWatches: IWatcherRegistry = {};
  private mProtocolHandlers: { [protocol: string]: (url: string, install: boolean) => void } = {};
  private mArchiveHandlers: { [extension: string]: ArchiveHandlerCreator };
  private mModDB: modmetaT.ModDB;
  private mModDBPromise: Promise<void>;
  private mModDBGame: string;
  private mModDBAPIKey: string;
  private mModDBCache: { [id: string]: ILookupResult[] } = {};
  private mContextProxyHandler: ContextProxyHandler;
  private mExtensionState: { [extId: string]: IExtensionState };
  private mLoadFailures: { [extId: string]: IExtensionLoadFailure[] } = {};
  private mInterpreters: { [ext: string]: (input: IRunParameters) => IRunParameters };
  private mStartHooks: IStartHook[];
  private mLoadingCallbacks: Array<(name: string, idx: number) => void> = [];
  private mProgrammaticMetaServers: { [id: string]: any } = {};
  private mForceDBReconnect: boolean = false;
  private mOnUIStarted: () => void;
  private mUIStartedPromise: Promise<void>;
  private mOutdated: string[] = [];

  constructor(initStore?: Redux.Store<any>, eventEmitter?: NodeJS.EventEmitter) {
    this.mEventEmitter = eventEmitter;
    if (this.mEventEmitter !== undefined) {
      this.mEventEmitter.setMaxListeners(100);
    }

    this.mUIStartedPromise = new Promise(resolve => {
      this.mOnUIStarted = resolve;
    });

    this.mInterpreters = {};
    this.mStartHooks = [];
    this.mApi = {
      showErrorNotification: this.showErrorBox,
      selectFile: this.selectFile,
      selectExecutable: this.selectExecutable,
      selectDir: this.selectDir,
      events: this.mEventEmitter,
      translate: (input, options?) => this.mTranslator !== undefined
          ? this.mTranslator.t(input, options)
          : (Array.isArray(input) ? input[0].toString() : input.toString()) as any,
      locale: () => this.mTranslator.language,
      getI18n: () => this.mTranslator,
      getPath: this.getPath,
      onStateChange: (statePath: string[], callback: StateChangeCallback) => undefined,
      registerProtocol: this.registerProtocol,
      deregisterProtocol: this.deregisterProtocol,
      lookupModReference: this.lookupModReference,
      lookupModMeta: this.lookupModMeta,
      saveModMeta: this.saveModMeta,
      openArchive: this.openArchive,
      clearStylesheet: () => this.mStyleManager.clearCache(),
      setStylesheet: (key, filePath) => this.mStyleManager.setSheet(key, filePath),
      runExecutable: this.runExecutable,
      emitAndAwait: this.emitAndAwait,
      isOutdated: () => isOutdated(),
      onAsync: this.onAsync,
      highlightControl: this.highlightControl,
      addMetaServer: this.addMetaServer,
      getLoadedExtensions: () => this.extensions,
      awaitUI: () => this.mUIStartedPromise,
      getState: () => undefined,
    };
    if (initStore !== undefined) {
      // apologies for the sync operation but this needs to happen before extensions are loaded
      // and everything in this phase of startup is synchronous anyway
      try {
        const disableExtensions =
            fs.readdirSync(getVortexPath('temp'))
                .filter(name => name.startsWith('__disable_'));
        disableExtensions.forEach(ext => {
          initStore.dispatch(setExtensionEnabled(ext.substr(10), false));
          fs.unlinkSync(path.join(getVortexPath('temp'), ext));
        });
      } catch (err) {
        // an ENOENT will happen on the first start where the dir doesn't
        // exist yet. No problem
        if (err.code !== 'ENOENT') {
          log('error', 'failed to read disabled extensions', err.message);
        }
      }

      this.mExtensionState = initStore.getState().app.extensions;
      const extensionsPath = path.join(getVortexPath('userData'), 'plugins');
      Object.keys(this.mExtensionState)
        .filter(extId => this.mExtensionState[extId].remove)
        .forEach(extId => {
          log('debug', 'removing', path.join(extensionsPath, extId));
          fs.removeSync(path.join(extensionsPath, extId));
          initStore.dispatch(forgetExtension(extId));
        });
      ipcMain.on('__get_extension_state', event => {
        event.returnValue = this.mExtensionState;
      });
      ipcMain.on('__ui_is_ready', () => {
        this.mOnUIStarted();
      });
    } else {
      this.mExtensionState = ipcRenderer.sendSync('__get_extension_state');
    }
    if (remote !== undefined) {
      this.mStyleManager = new StyleManager(this.mApi);
    }
    this.mExtensions = this.loadExtensions();

    if (this.mOutdated.length > 0) {
      this.mOutdated.forEach(ext => {
        log('info', 'extension older than bundled version, will be removed',
          { name: ext });
        initStore.dispatch(removeExtension(ext));
      });

      relaunch();
    }

    this.initExtensions();
  }

  public setTranslation(translator: i18n) {
    this.mTranslator = translator;
  }

  public get extensions(): IRegisteredExtension[] {
    return this.mExtensions;
  }

  /**
   * sets up the extension manager to work with the specified store
   *
   * @template S State interface
   * @param {Redux.Store<S>} store
   *
   * @memberOf ExtensionManager
   */
  public setStore<S extends IState>(store: ThunkStore<S>) {
    this.mReduxWatcher = new ReduxWatcher(store);

    this.mExtensionState = getSafe(store.getState(), ['app', 'extensions'], {});

    this.mApi.sendNotification = (notification: INotification): string => {
      const noti = { ...notification };
      if (noti.id === undefined) {
        noti.id = shortid();
      }
      if (notification.type === 'warning') {
        log('warn', 'warning notification',
            { message: notification.message, title: notification.title });
      } else if (notification.type === 'error') {
        log('warn', 'error notification',
            { message: notification.message, title: notification.title });
      }
      store.dispatch(addNotification(noti));
      return noti.id;
    };
    // tslint:disable-next-line:only-arrow-functions
    this.mApi.showErrorNotification = function(message: string,
                                               details: string | Error | any,
                                               options?: IErrorOptions) {
      if ((this.extension !== undefined)
          && (this.extension.info !== undefined)
          && (this.extension.info.author !== COMPANY_ID)) {
        if (options === undefined) {
          options = {};
        }
        if (options.allowReport !== false) {
          options['allowReport'] = false;
          options.extension = this.extension.info;
        }
      }
      showError(store.dispatch, message, details, options);
    };

    this.mApi.showDialog = (type: DialogType, title: string, content: IDialogContent,
                            actions: DialogActions, id?: string) =>
      store.dispatch(showDialog(type, title, content, actions, id));
    this.mApi.closeDialog = (id: string, actionKey: string, input: any) =>
      store.dispatch(closeDialog(id, actionKey, input));
    this.mApi.dismissNotification = (id: string) =>
      store.dispatch(dismissNotification(id));
    this.mApi.suppressNotification = (id: string, suppress: boolean) => {
      if (suppress !== false) {
        store.dispatch(dismissNotification(id));
      }
      store.dispatch(suppressNotification(id, suppress !== false));
    };
    this.mApi.store = store;
    this.mApi.getState = <T extends IState>() => this.mApi.store.getState() as T;
    this.mApi.onStateChange = this.stateChangeHandler;

    this.mApi.onStateChange(['settings', 'metaserver', 'servers'], () => {
      this.mForceDBReconnect = true;
    });

    if (ipcRenderer !== undefined) {
      ipcRenderer.on('send-notification',
        (event, notification) => this.mApi.sendNotification(notification));
      ipcRenderer.on('show-error-notification', (event, message, details, options, isError) =>  {
        let data = JSON.parse(details);
        if (isError) {
          data = Object.assign(new Error(), data);
        }
        this.mApi.showErrorNotification(message, data, options || undefined);
      });

      store.dispatch(setExtensionLoadFailures(this.mLoadFailures));
    } else {
      this.migrateExtensions();
    }
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
  public setupApiMain<S>(store: Redux.Store<S>, ipc: WebContents) {
    this.mApi.showErrorNotification =
        (message: string, details: string | Error, options: IErrorOptions) => {
          try {
            // make an attempt to serialise error objects in such a way that they can be
            // reconstructed.
            const data: any = (typeof(details) === 'object')
              ? { ...details }
              : details;
            if (details instanceof Error) {
              // details.stack, details.name AND details.message seem to be getters.
              data.stack = details.stack;
              data.name = details.name;
              data.message = details.message;
              // stack is also optional. If we don't have one, generate one to this function
              // which is better than nothing because otherwise the code reconstructing the error
              // will produce a stack that is completely useless
              if (data.stack === undefined) {
                data.stack = (new Error()).stack;
              }
            }
            ipc.send('show-error-notification',
                     message, JSON.stringify(data), options, details instanceof Error);
          } catch (err) {
            // this may happen if the ipc has already been destroyed
            this.showErrorBox(message, details);
          }
        };
    this.mApi.events = this.mEventEmitter = new EventProxy(ipc);
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
    this.apply('registerReducer', (statePath: string[], reducer: IReducerSpec) => {
      reducers.push({ path: statePath, reducer });
    });
    this.apply('registerActionCheck', (actionType: string, check: SanityCheck) => {
      registerSanityCheck(actionType, check);
    });
    this.apply('registerInterpreter', (extension: string,
                                       apply: (input: IRunParameters) => IRunParameters) => {
      this.mInterpreters[extension.toLowerCase()] = apply;
    });
    this.apply('registerStartHook', (priority: number, id: string,
                                     hook: (input: IRunParameters) => Promise<IRunParameters>) => {
      this.mStartHooks.push({ priority, id, hook });
    });

    this.mStartHooks.sort((lhs, rhs) => lhs.priority - rhs.priority);

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
    this.mContextProxyHandler.getCalls(funcName).forEach(call => {
      try {
        func(...call.arguments);
      } catch (err) {
        this.mApi.showErrorNotification(
          'Extension failed to initialize. If this isn\'t an official extension, ' +
          'please report the error to the respective author.',
          {
            extension: call.extension,
            err: err.message,
            stack: err.stack,
          });
      }
    });
  }

  /**
   * call the "once" function for all extensions. This should really only be called
   * once.
   */
  public doOnce(): Promise<void> {
    const calls = this.mContextProxyHandler.getCalls(remote !== undefined ? 'once' : 'onceMain');

    const reportError = (err: Error, call: IInitCall) => {
      log('warn', 'failed to call once',
        { err: err.message, stack: err.stack });
      this.mApi.showErrorNotification(
        'Extension failed to initialize. If this isn\'t an official extension, ' +
        'please report the error to the respective author.',
        {
          extension: call.extension,
          err: err.message,
          stack: err.stack,
        });
    };

    return Promise.each(calls, (call, idx) => {
      log('debug', 'once', { extension: call.extension });
      try {
        this.mLoadingCallbacks.forEach(cb => {
          cb(call.extension, idx);
        });
        const prom = call.arguments[0]() || Promise.resolve();

        return prom.catch(err => {
          reportError(err, call);
        });
      } catch (err) {
        reportError(err, call);
      }
    })
    .then(() => {
      this.mLoadingCallbacks.forEach(cb => {
        cb(undefined, calls.length);
      });
      log('debug', 'once done');
    });
  }

  public renderStyle() {
    this.mStyleManager.startAutoUpdate();
    return this.mStyleManager.renderNow();
  }

  public getProtocolHandler(protocol: string) {
    return this.mProtocolHandlers[protocol] || null;
  }

  public get numOnce() {
    const calls = this.mContextProxyHandler.getCalls(remote !== undefined ? 'once' : 'onceMain');
    return calls.length;
  }

  public onLoadingExtension(cb: (name: string, idx: number) => void) {
    this.mLoadingCallbacks.push(cb);
  }

  public setUIReady() {
    this.mOnUIStarted();
    ipcRenderer.send('__ui_is_ready');
  }

  private getModDB = (): Promise<modmetaT.ModDB> => {
    const gameMode = activeGameId(this.mApi.store.getState());
    const currentKey =
      getSafe(this.mApi.store.getState(),
        ['confidential', 'account', 'nexus', 'APIKey'], '');

    let init;

    let onDone: () => void;
    if (this.mModDBPromise === undefined) {
      this.mModDBPromise = new Promise<void>((resolve, reject) => {
        onDone = () => {
          this.mModDBPromise = undefined;
          resolve();
        };
      });
      init = Promise.resolve();
    } else {
      init = this.mModDBPromise;
    }

    return init.then(() => {
      // reset the moddb if necessary so new settings get used
      if ((this.mModDB === undefined)
          || this.mForceDBReconnect
          || (gameMode !== this.mModDBGame)
          || (currentKey !== this.mModDBAPIKey)) {
        this.mForceDBReconnect = false;
        if (this.mModDB !== undefined) {
          return this.mModDB.close()
            .then(() => this.mModDB = undefined);
        }
      }
      return Promise.resolve();
    })
      .then(() => (this.mModDB !== undefined)
        ? Promise.resolve()
        : this.connectMetaDB(gameMode, currentKey)
          .then(modDB => {
            this.mModDB = modDB;
            this.mModDBGame = gameMode;
            this.mModDBAPIKey = currentKey;
            log('debug', 'initialised');
          }))
      .then(() => this.mModDB)
      .finally(() => {
        if (onDone !== undefined) {
          onDone();
        }
      });
      // TODO: the fallback to nexus api should somehow be set up in nexus_integration, not here
  }

  private getMetaServerList() {
    const state = this.mApi.store.getState();
    const servers = getSafe(state, ['settings', 'metaserver', 'servers'], {});

    return [].concat(
      Object.keys(this.mProgrammaticMetaServers).map(id => this.mProgrammaticMetaServers[id]),
      Object.keys(servers).map(id => servers[id]),
    );
  }

  private connectMetaDB(gameId: string, apiKey: string) {
    const dbPath = path.join(getVortexPath('userData'), 'metadb');
    return modmeta.ModDB.create(
      dbPath,
      gameId, this.getMetaServerList(), log)
      .catch(err => {
        return this.mApi.showDialog('error', 'Failed to connect meta database', {
          text: 'Please check that there is no other instance of Vortex still running.',
          message: err.message,
        }, [
          { label: 'Quit' },
          { label: 'Retry' },
        ])
        .then(result => (result.action === 'Quit')
          ? app.quit()
          : this.connectMetaDB(gameId, apiKey));
      });
  }

  private stateChangeHandler = (watchPath: string[],
                                callback: StateChangeCallback) => {
    const stackErr = new Error();
    // have to initialize to a value that we _know_ is never set by the user.
    let lastValue = UNDEFINED;

    const key = watchPath.join('.');

    const changeHandler = ({cbStore, selector, prevState, currentState,
                            prevValue, currentValue}) => {
      // redux-watch may trigger even if no change occurred so we have to
      // do our own check, otherwise we could end up in an endless loop
      // if the callback causes redux-watch to trigger again without change
      if ((currentValue === lastValue) && (lastValue !== UNDEFINED)) {
        return;
      }
      lastValue = currentValue;
      this.mWatches[key].forEach(cb => {
        try {
          cb(prevValue, currentValue);
        } catch (err) {
          log('error', 'state change handler failed', {
            message: err.message,
            stack: stackErr.stack,
            key,
          });
        }
      });
    };

    if (this.mWatches[key] === undefined) {
      this.mWatches[key] = [];
      this.mReduxWatcher.watch(watchPath, changeHandler);
    }
    this.mWatches[key].push(callback);
  }

  private showErrorBox = (message: string, details: string | Error | any) => {
    if (typeof (details) === 'string') {
      dialog.showErrorBox(message, details);
    } else {
      dialog.showErrorBox(message, details.message);
    }
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
      this.mContextProxyHandler.setExtension(ext.name, ext.path);
      try {
        const apiProxy = new APIProxyCreator(ext);
        const extProxy = new Proxy(contextProxy, apiProxy);
        ext.initFunc(extProxy as IExtensionContext);
        apiProxy.enableAPI();
      } catch (err) {
        this.mLoadFailures[ext.name] = [ { id: 'exception', args: { message: err.message } } ];
        log('warn', 'couldn\'t initialize extension',
          {name: ext.name, err: err.message, stack: err.stack});
      }
    });
    this.mContextProxyHandler.endRegistration();
    // need to store them locally for now because the store isn't loaded at this time
    this.mLoadFailures = {
      ...this.mLoadFailures,
      ...this.mContextProxyHandler.unloadIncompatible(
        ExtensionManager.sUIAPIs, this.mExtensions.reduce((prev, ext) => {
          if (ext.info !== undefined) {
            if (ext.info.name !== undefined) {
              prev.push(ext.info.name);
            }

            if (ext.info.id !== undefined) {
              prev.push(ext.info.id);
            }
          }
          prev.push(ext.name);
          return prev;
        }, [])),
    };

    if (remote !== undefined) {
      // renderer process
      log('info', 'all extensions initialized');
    }
  }

  private migrateExtensions() {
    type MigrationFunc = (oldVersion: string) => Promise<void>;

    const migrations: { [ext: string]: MigrationFunc[] } = {};

    this.mContextProxyHandler.getCalls('registerMigration').forEach(call => {
      setdefault(migrations, call.extension, []).push(call.arguments[0]);
    });

    const state: IState = this.mApi.store.getState();
    this.mExtensions
      .filter(ext => ext.dynamic)
      .forEach(ext => {
        try {
          let oldVersion = getSafe(state.app, ['extensions', ext.name, 'version'], '0.0.0');
          if (!semver.valid(oldVersion)) {
            log('error', 'invalid version stored for extension',
                { extension: ext.name, oldVersion });
            oldVersion = '0.0.0';
          }
          if (oldVersion !== ext.info.version) {
            if (migrations[ext.name] === undefined) {
              this.mApi.store.dispatch(setExtensionVersion(ext.name, ext.info.version));
            } else {
              Promise.mapSeries(migrations[ext.name], mig => mig(oldVersion))
                .then(() => {
                  log('info', 'set extension version',
                      { name: ext.name, info: JSON.stringify(ext.info) });
                  this.mApi.store.dispatch(setExtensionVersion(ext.name, ext.info.version));
                })
                .catch(err => {
                  this.mApi.showErrorNotification('Extension failed to migrate', err, {
                    allowReport: ext.info.author === COMPANY_ID,
                  });
                });
            }
          }
        } catch (err) {
          this.mApi.showErrorNotification('Extension invalid', err, {
            allowReport: false,
            message: ext.name,
          });
        }
      });
  }

  private getPath(name: string) {
    return getVortexPath(name as any);
  }

  private selectFile(options: IOpenOptions): Promise<string> {
    const fullOptions: OpenDialogOptions = {
      ..._.omit(options, ['create']),
      properties: ['openFile'],
    };
    if (options.create === true) {
      fullOptions.properties.push('promptToCreate');
    }
    const win = remote !== undefined ? remote.getCurrentWindow() : null;
    return Promise.resolve(dialog.showOpenDialog(win, fullOptions))
      .then(result => (result.filePaths !== undefined) && (result.filePaths.length > 0)
        ? result.filePaths[0]
        : undefined);
  }

  private selectExecutable(options: IOpenOptions) {
    // TODO: make the filter list dynamic based on the list of registered interpreters?
    const fullOptions: OpenDialogOptions = {
      ..._.omit(options, ['create']),
      properties: ['openFile'],
      filters: [
        { name: 'All Executables', extensions: ['exe', 'cmd', 'bat', 'jar', 'py'] },
        { name: 'Native', extensions: ['exe', 'cmd', 'bat'] },
        { name: 'Java', extensions: ['jar'] },
        { name: 'Python', extensions: ['py'] },
      ],
    };
    const win = remote !== undefined ? remote.getCurrentWindow() : null;
    return Promise.resolve(dialog.showOpenDialog(win, fullOptions))
      .then(result => (result.filePaths !== undefined) && (result.filePaths.length > 0)
        ? result.filePaths[0]
        : undefined);
  }

  private selectDir(options: IOpenOptions) {
    const fullOptions: OpenDialogOptions = {
      ..._.omit(options, ['create']),
      properties: ['openDirectory'],
    };
    const win = remote !== undefined ? remote.getCurrentWindow() : null;
    return Promise.resolve(dialog.showOpenDialog(win, fullOptions))
      .then(result => (result.filePaths !== undefined) && (result.filePaths.length > 0)
        ? result.filePaths[0]
        : undefined);
  }

  private registerProtocol = (protocol: string, def: boolean,
                              callback: (url: string, install: boolean) => void): boolean => {
    log('info', 'register protocol', { protocol });
    // make it work when using the development version
    const args = process.execPath.endsWith('electron.exe')
      ? [getVortexPath('package'), '-d']
      : ['-d'];

    const haveToRegister = def && !app.isDefaultProtocolClient(protocol, process.execPath, args);
    if (def) {
      app.setAsDefaultProtocolClient(protocol, process.execPath, args);
    }
    this.mProtocolHandlers[protocol] = callback;
    return haveToRegister;
  }

  private registerArchiveHandler = (extension: string, handler: ArchiveHandlerCreator) => {
    this.mArchiveHandlers[extension] = handler;
  }

  private deregisterProtocol(protocol: string) {
    log('info', 'deregister protocol');
    if (process.execPath.endsWith('electron.exe')) {
      // make it work when using the development version
      app.removeAsDefaultProtocolClient(protocol, process.execPath,
                                        [ getVortexPath('package'), '-d' ]);
    } else {
      app.removeAsDefaultProtocolClient(protocol, process.execPath, ['-d']);
    }
  }

  private lookupModReference = (reference: IReference): Promise<ILookupResult[]> => {
    return this.getModDB()
      .then(modDB => modDB.getByKey(reference.fileMD5));
  }

  private modLookupId(detail: ILookupDetails): string {
    const fileName = detail.filePath !== undefined
      ? path.basename(detail.filePath, path.extname(detail.filePath))
      : undefined;
    return `${detail.fileMD5}_${fileName}`
         + `_${detail.fileSize}_${detail.gameId}`;
  }

  private lookupModMeta = (detail: ILookupDetails): Promise<ILookupResult[]> => {
    let lookupId = this.modLookupId(detail);
    if (this.mModDBCache[lookupId] !== undefined) {
      return Promise.resolve(this.mModDBCache[lookupId]);
    }
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
        lookupId = this.modLookupId({
          ...detail,
          fileMD5,
          fileSize,
        });
        this.getApi().events.emit('filehash-calculated', detail.filePath, fileMD5, fileSize);
      });
    } else {
      promise = Promise.resolve();
    }
    // lookup id may be updated now
    if (this.mModDBCache[lookupId] !== undefined) {
      return Promise.resolve(this.mModDBCache[lookupId]);
    }
    return promise
      .then(() => this.getModDB())
      .then(modDB => fileSize !== 0
        ? modDB.lookup(detail.filePath, fileMD5, fileSize, detail.gameId)
        : [])
      .then((result: ILookupResult[]) => {
        this.mModDBCache[lookupId] = result;
        return Promise.resolve(result);
      });
  }

  private saveModMeta = (modInfo: IModInfo): Promise<void> => {
    const lookupId = this.modLookupId({
      fileMD5: modInfo.fileMD5,
      filePath: modInfo.fileName,
      fileSize: modInfo.fileSizeBytes,
      gameId: modInfo.gameId,
    });
    delete this.mModDBCache[lookupId];
    return this.getModDB()
      .then(modDB => {
        return new Promise<void>((resolve, reject) => {
          modDB.insert([modInfo]);
          resolve();
        });
      });
  }

  private openArchive = (archivePath: string,
                         options?: IArchiveOptions,
                         ext?: string): Promise<Archive> => {
    if (this.mArchiveHandlers === undefined) {
      // lazy loading the archive handlers
      this.mArchiveHandlers = {};
      this.apply('registerArchiveType', this.registerArchiveHandler);
    }
    if (ext === undefined) {
      ext = path.extname(archivePath).substr(1);
    }
    const creator = this.mArchiveHandlers[ext];
    if (creator === undefined) {
      return Promise.reject(new NotSupportedError());
    }
    return creator(archivePath, options || {})
      .then((handler: IArchiveHandler) => Promise.resolve(new Archive(handler)));
  }

  private applyStartHooks(input: IRunParameters): Promise<IRunParameters> {
    let updated = input;
    return Promise.each(this.mStartHooks, hook => hook.hook(updated)
      .then((newParameters: IRunParameters) => {
        updated = newParameters;
      })
      .catch(UserCanceled, err => {
        log('debug', 'start canceled by user');
        return Promise.reject(err);
      })
      .catch(ProcessCanceled, err => {
        log('debug', 'hook canceled start', err.message);
        return Promise.reject(err);
      })
      .catch(err => {
        if (err instanceof UserCanceled) {
          log('debug', 'start canceled by user');
        } else if (err instanceof ProcessCanceled) {
          log('debug', 'hook canceled start', err.message);
        } else {
          log('error', 'hook failed', err);
        }
        return Promise.reject(err);
      }))
    .then(() => updated);
  }

  private runExecutable =
    (executable: string, args: string[], options: IRunOptions): Promise<void> => {
      if (!truthy(executable)) {
        return Promise.reject(new ProcessCanceled('Executable not set'));
      }
      const interpreter = this.mInterpreters[path.extname(executable).toLowerCase()];
      if (interpreter !== undefined) {
        try {
          ({ executable, args, options } = interpreter({ executable, args, options }));
        } catch (err) {
          return Promise.reject(err);
        }
      }

      const cwd = options.cwd || path.dirname(executable);
      // process.env is case insensitive (on windows at least?), but the spawn parameter isn't.
      // I think the key is called "Path" on windows but I'm not willing to bet this is consistent
      // across all language variants and versions
      const pathEnvName = Object.keys(process.env).find(key => key.toLowerCase() === 'path');
      const env = {
        ...process.env,
        [pathEnvName]: process.env['PATH_ORIG'] || process.env['PATH'],
        ...options.env,
      };

      return this.applyStartHooks({ executable, args, options })
      .then(updatedParameters => {
        ({ executable, args, options } = updatedParameters);
        return Promise.resolve();
      })
      .then(() => new Promise<void>((resolve, reject) => {
        try {
          const runExe = options.shell
            ? `"${executable}"`
            : executable;
          const spawnOptions: SpawnOptions = {
            cwd,
            env,
            detached: options.detach !== undefined ? options.detach : true,
            shell: options.shell,
          };
          const child = spawn(runExe, options.shell ? args : args.map(arg => arg.replace(/"/g, '')),
                              spawnOptions);
          if (truthy(child['exitCode'])) {
            // brilliant, apparently there is no way for me to get at the stdout/stderr when running
            // through a shell if starting the application fails immediately
            return reject(new Error(`Failed to start (exit code ${child['exitCode']})`));
          }
          if (options.onSpawned !== undefined) {
            options.onSpawned(child.pid);
          }

          if (options.detach) {
            child.unref();
          }

          let stdOut: string;
          let errOut: string;
          child
            .on('error', err => {
              reject(err);
            })
            .on('close', (code) => {
              const game = activeGameId(this.mApi.store.getState());
              if ((game === 'fallout3') && (code === 0xC0000135)) {
                // 0xC0000135 means that a dll couldn't be found.
                // In the context of FO3 it's commonly xlive or other redistribs are
                //  not installed.
                return reject(new MissingDependency());
              } else if (code === 0xE0434352) {
                // A .net error, unfortunately we can't now if/how the actual exception
                // text has been reported
                log('warn', '.Net error', { stdOut, errOut });
                if (game === 'stardewvalley') {
                  // In the case of SDV the interesting information seems to get printed to stdout
                  return reject(new Error(stdOut || errOut));
                } else if (errOut) {
                  return reject(new Error(errOut));
                } else {
                  return reject(new ProcessCanceled('.Net error'));
                }
              } else if (code !== 0) {
                // TODO: the child process returns an exit code of 53 for SSE and
                // FO4, and an exit code of 1 for Skyrim. We don't know why but it
                // doesn't seem to affect anything
                log('warn', 'child process exited with code: ' + code.toString(16), {});
                if (errOut !== undefined) {
                  log('warn', 'child output', errOut.trim());
                }
                if (options.expectSuccess) {
                  let lastLine = '<No output>';

                  if (errOut !== undefined) {
                    const lines = errOut.trim().split('\n');
                    lastLine = (lines.length > ERROR_OUTPUT_CUTOFF)
                      ? lines[lines.length - 1]
                      : lines.join('\n');
                  }
                  const err: any = new Error(
                    `Failed to run "${executable}": "${lastLine} (${code.toString(16)})"`);
                  err.exitCode = code;
                  return reject(err);
                }
              }
              resolve();
          });
          if (child.stderr !== undefined) {
            child.stderr.on('data', (chunk: Buffer) => {
              if (errOut === undefined) {
                errOut = '';
              }
              try {
                errOut += chunk.toString();
              } catch (err) {
                log('warn', 'error output from external process couldn\'t be processed',
                    { executable });
              }
            });
          }
          if (child.stdout !== undefined) {
            child.stdout.on('data', (chunk: Buffer) => {
              if (stdOut === undefined) {
                stdOut = '';
              }
              try {
                stdOut += chunk.toString();
              } catch (err) {
                log('warn', 'output from external process couldn\'t be processed',
                    { executable });
              }
            });
          }
        } catch (err) {
          return reject(err);
        }
      }))
        .catch(ProcessCanceled, () => null)
        .catch({ code: 'EACCES' }, () =>
          this.runElevated(executable, cwd, args, env, options.onSpawned))
        .catch({ errno: 1223 }, () => Promise.reject(new UserCanceled()))
        .catch((err) => {
          return Promise.reject(err);
        });
  }

  private runElevated(executable: string, cwd: string, args: string[],
                      env: { [key: string]: string }, onSpawned: (pid?: number) => void) {
    const ipcPath = shortid();
    let tmpFilePath: string;
    return new Promise((resolve, reject) => {
      this.startIPC(ipcPath, err => {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      });

      runElevated(ipcPath, runElevatedCustomTool, {
        toolPath: executable,
        toolCWD: cwd,
        parameters: args,
        environment: env,
      }).then(tmpPath => {
        tmpFilePath = tmpPath;
        if (onSpawned !== undefined) {
          onSpawned();
        }
      }).catch(err => {
        reject(err);
      });
    })
    .finally(() => {
      if (tmpFilePath !== undefined) {
        try {
          fs.unlinkSync(tmpFilePath);
        } catch (err) {
          // nop
        }
      }
    });
  }

  private emitAndAwait = (event: string, ...args: any[]): Promise<any> => {
    let queue = Promise.resolve();
    const results: any[] = [];
    const enqueue = (prom: Promise<any>) => {
      if (prom !== undefined) {
        queue = queue.then(() => prom
          .then(res => {
            if ((res !== undefined) && (res !== null)) {
              results.push(res);
            }
          })
          .catch(err => {
            this.mApi.showErrorNotification(`Unhandled error in event "${event}"`, err);
          }));
      }
    };

    this.mEventEmitter.emit(event, ...args, enqueue);

    return queue.then(() => results);
  }

  private onAsync = (event: string, listener: (...args) => PromiseLike<any>) => {
    this.mEventEmitter.on(event, (...args: any[]) => {
      const enqueue = args.pop();
      if ((enqueue === undefined) || (typeof(enqueue) !== 'function')) {
        // no arguments, this is not an emitAndAwait event!
        this.mApi.showErrorNotification('Invalid event handler', { event });
        if (enqueue !== undefined) {
          args.push(enqueue);
        }
        // call the listener anyway
        const prom = listener(...args);
        if (prom['catch'] !== undefined) {
          prom['catch'](err => {
            this.mApi.showErrorNotification(`Failed to call event ${event}`, err);
          });
        }
      } else {
        enqueue(listener(...args));
      }
    });
  }

  // tslint:disable-next-line:member-ordering
  private highlightCSS = (() => {
    let highlightCSS: CSSStyleRule;
    let highlightAfterCSS: CSSStyleRule;

    const initCSS = () => {
      if (highlightCSS !== undefined) {
        return;
      }

      highlightCSS = highlightAfterCSS = null;

      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < document.styleSheets.length; ++i) {
        if ((document.styleSheets[i].ownerNode as any).id === 'theme') {
          const rules = Array.from((document.styleSheets[i] as any).rules);
          rules.forEach((rule: CSSStyleRule) => {
            if (rule.selectorText === '#highlight-control-dummy') {
              highlightCSS = rule;
            } else if (rule.selectorText === '#highlight-control-dummy::after') {
              highlightAfterCSS = rule;
            }
          });
        }
      }
    };

    return (selector: string, text?: string) => {
      initCSS();
      let result = '';

      // adding a new css rule matching the selector when we could just as well add
      // the highlight class to the control.
      // The reason it's done this way is because it's less messy (easier to clean up one css
      // rule instead of every control matched by the selector) and it doesn't interfere with
      // react, which might re-generate every control.
      if (highlightCSS === null) {
        // fallback if template rules weren't found
        result += `${selector} { border: 1px solid red }`;
        if (text !== undefined) {
          result += `${selector}::after { color: red, content: "${text}" }`;
        }
      } else {
        result += highlightCSS.cssText.replace('#highlight-control-dummy', selector);
        if (text !== undefined) {
          result += highlightAfterCSS.cssText
            .replace('#highlight-control-dummy', selector)
            .replace('__contentPlaceholder', text);
        }
      }

      return result;
    };
  })();

  private highlightControl = (selector: string, duration: number, text?: string) => {
    const id = shortid();
    const style = document.createElement('style');
    style.id = `highlight_${id}`;
    style.type = 'text/css';
    style.innerHTML = this.highlightCSS(selector, text);

    const head = document.getElementsByTagName('head')[0];
    const highlightNode = head.appendChild(style);
    setTimeout(() => {
      head.removeChild(highlightNode);
    }, duration);
  }

  private addMetaServer = (id: string, server: any) => {
    this.mProgrammaticMetaServers[id] = server;
    this.mForceDBReconnect = true;
  }

  private startIPC(ipcPath: string, onFinished: (err: Error) => void) {
    let connected: boolean = false;

    const finish = (err: Error) => {
      server.close();
      onFinished(err);
    };

    const server = net.createServer(connRaw => {
      const conn = new JsonSocket(connRaw);

      log('debug', 'ipc client connected');
      connected = true;

      conn
        .on('message', data => {
          const { message, payload } = data;
          if (message === 'log') {
            // tslint:disable-next-line:no-shadowed-variable
            const { level, message, meta } = payload;
            log(level, message, meta);
          } else if (message === 'finished') {
            finish(null);
          }
        })
        .on('error', err => {
          log('error', 'elevated code reported error', err);
          finish(err);
        });
    })
    .listen(path.join('\\\\?\\pipe', ipcPath));
  }

  private loadDynamicExtension(extensionPath: string,
                               alreadyLoaded: IRegisteredExtension[])
                               : IRegisteredExtension {
    const indexPath = path.join(extensionPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      let info: IExtension = { name: '', author: '', description: '', version: '' };
      try {
        info = JSON.parse(fs.readFileSync(path.join(extensionPath, 'info.json'),
                                          { encoding: 'utf8' }));
      } catch (error) {
        const errMessage = (error.code === 'ENOENT')
          ? 'extension has no info.json file'
          : 'failed to parse info.json file';
        log('warn', errMessage, { extensionPath, error: error.message });
      }

      const name = info.id || path.basename(extensionPath);

      const existing = alreadyLoaded.find(reg => reg.name === name);

      if (existing) {
        if (semver.gt(info.version, existing.info.version)) {
          this.mOutdated.push(path.basename(existing.path));
        }

        return undefined;
      }

      return {
        name,
        initFunc: dynreq(indexPath).default,
        path: extensionPath,
        dynamic: true,
        info,
      };
    } else {
      // this is not necessarily a problem, translation extensions for example
      // have no index.js file
      log('debug', 'extension directory contains no index.js file', { extensionPath });
      return undefined;
    }
  }

  private loadDynamicExtensions(extensionsPath: string,
                                loadedExtensions: Set<string>,
                                alreadyLoaded: IRegisteredExtension[]): IRegisteredExtension[] {
    if (!fs.existsSync(extensionsPath)) {
      log('info', 'failed to load dynamic extensions, path doesn\'t exist', extensionsPath);
      try {
        fs.mkdirSync(extensionsPath);
      } catch (err) {
        log('warn', 'extension path missing and can\'t be created',
            { path: extensionsPath, error: err.message});
      }
      return [];
    }

    const res = fs.readdirSync(extensionsPath)
      .filter(name => fs.statSync(path.join(extensionsPath, name)).isDirectory())
      .map(name => {
        if (!getSafe(this.mExtensionState, [name, 'enabled'], true)) {
          log('debug', 'extension disabled', { name });
          return undefined;
        }
        try {
          // first, mark this extension as loaded. If this is a user extension and there is an
          // extension with the same name in the bundle we could otherwise end up loading the
          // bundled one if this one fails to load which could be convenient but also massively
          // confusing.
          const before = Date.now();
          const ext = this.loadDynamicExtension(path.join(extensionsPath, name), alreadyLoaded);
          if (ext !== undefined) {
            loadedExtensions.add(ext.name);
            const loadTime = Date.now() - before;
            log('debug', 'loaded extension', { name, loadTime, location: extensionsPath });
          }
          return ext;
        } catch (err) {
          log('warn', 'failed to load dynamic extension',
              { name, error: err.message, stack: err.stack });
          this.mLoadFailures[name] = [{ id: 'exception', args: { message: err.message } }];
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
   * @returns {ExtensionInit[]}
   */
  private loadExtensions(): IRegisteredExtension[] {
    const staticExtensions = [
      'settings_interface',
      'settings_application',
      'about_dialog',
      'diagnostics_files',
      'dashboard',
      'starter_dashlet',
      'firststeps_dashlet',
      'mod_load_order',
      'mod_management',
      'category_management',
      'profile_management',
      'nexus_integration',
      'download_management',
      'gamemode_management',
      'announcement_dashlet',
      'symlink_activator',
      'symlink_activator_elevate',
      'hardlink_activator',
      'move_activator',
      'updater',
      'installer_fomod',
      'installer_nested_fomod',
      'settings_metaserver',
      'test_runner',
      'extension_manager',
      'ini_prep',
      'news_dashlet',
      'sticky_mods',
      'browser',
      'recovery',
    ];

    require('./extensionRequire').default();

    const extensionPaths = ExtensionManager.getExtensionPaths();
    const loadedExtensions = new Set<string>();
    let dynamicallyLoaded = [];
    return staticExtensions
      .filter(ext => getSafe(this.mExtensionState, [ext, 'enabled'], true))
      .map((name: string) => ({
          name,
          path: path.join(extensionPaths[0], name),
          initFunc: require(`../extensions/${name}/index`).default,
          dynamic: false,
        }))
      .concat(...extensionPaths.map(ext => {
        const newExtensions = this.loadDynamicExtensions(ext, loadedExtensions, dynamicallyLoaded);
        dynamicallyLoaded = dynamicallyLoaded.concat(newExtensions);
        return newExtensions;
      }));
  }
}

export default ExtensionManager;
