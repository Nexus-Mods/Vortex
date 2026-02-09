import type { SpawnOptions } from "child_process";
import type { OpenDialogOptions, SaveDialogOptions } from "electron";
import type { IHashResult, ILookupResult, IModInfo } from "modmeta-db";
import type * as modmetaT from "modmeta-db";
import type { ToastOptions } from "react-hot-toast";
import type * as winapiT from "vortex-run";

import type {
  DialogActions,
  DialogType,
  IDialogContent,
} from "../actions/notifications";
import type {
  IModReference,
  IModRepoId,
} from "../extensions/mod_management/types/IMod";
import type { SanityCheck } from "../store/reduxSanity";
import type {
  IAvailableExtension,
  IExtension,
  IRegisteredExtension,
} from "../types/extensions";
import type {
  ArchiveHandlerCreator,
  IArchiveHandler,
  IArchiveOptions,
  IErrorOptions,
  IExtensionApi,
  IExtensionContext,
  ILookupDetails,
  IOpenOptions,
  IPersistor,
  IReducerSpec,
  IRunOptions,
  IRunParameters,
  ISaveOptions,
  StateChangeCallback,
  ThunkStore,
  ToolParameterCB,
} from "../types/IExtensionContext";
import type {
  ILookupOptions,
  IModLookupResult,
} from "../types/IModLookupResult";
import type { INotification } from "../types/INotification";
import type {
  IExtensionLoadFailure,
  IExtensionOptional,
  IExtensionState,
  IState,
} from "../types/IState";
import type { i18n } from "../util/i18n";

import PromiseBB from "bluebird";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs-extra";
import * as fuzz from "fuzzball";
import JsonSocket from "json-socket";
import * as _ from "lodash";
import * as net from "net";
import * as path from "path";
import { toast } from "react-hot-toast";
import * as semver from "semver";
import { generate as shortid } from "shortid";
import stringFormat from "string-template";
import { fileMD5 } from "vortexmt";

import {
  forgetExtension,
  setExtensionEnabled,
  setExtensionVersion,
} from "../actions/app";
import {
  addNotification,
  closeDialog,
  dismissAllNotifications,
  dismissNotification,
  showDialog,
} from "../actions/notifications";
import { suppressNotification } from "../actions/notificationSettings";
import { setExtensionLoadFailures } from "../actions/session";
import { setOptionalExtensions } from "../extensions/extension_manager/actions";
import { VCREDIST_URL } from "../shared/constants";
import {
  getErrorCode,
  getErrorMessageOrDefault,
  unknownToError,
} from "../shared/errors";
import { registerSanityCheck } from "../store/reduxSanity";
import { Archive } from "../util/archives";
import { getApplication } from "../util/application";
import { COMPANY_ID } from "../util/constants";
import {
  MissingDependency,
  NotSupportedError,
  ProcessCanceled,
  ThirdPartyError,
  TimeoutError,
  UserCanceled,
} from "../util/CustomErrors";
import { disableErrorReport, isOutdated } from "../util/errorHandling";
import * as fsVortex from "../util/fs";
import getVortexPath from "../util/getVortexPath";
import { TString } from "../util/i18n";
import lazyRequire from "../util/lazyRequire";
import { log } from "../util/log";
import { showError } from "../util/message";
import runElevatedCustomTool from "../util/runElevatedCustomTool";
import { activeGameId } from "../util/selectors";
import { getSafe } from "../util/storeHelper";
import {
  filteredEnvironment,
  isFunction,
  setdefault,
  timeout,
  toPromise,
  truthy,
  wrapExtCBAsync,
  wrapExtCBSync,
} from "../util/util";
import ReduxWatcher from "./store/ReduxWatcher";
import { getPreloadApi } from "../util/preloadAccess";
import { computeStateDiff } from "./store/stateDiff";
import type { PreloadWindow } from "../shared/types/preload";

const modmeta = lazyRequire<typeof modmetaT>(() => require("modmeta-db"));

export function isExtSame(
  installed: IExtension,
  remote: IAvailableExtension,
): boolean {
  if (installed.modId !== undefined) {
    return installed.modId === remote.modId;
  }

  return installed.name === remote.name;
}

const winapi = lazyRequire<typeof winapiT>(() => require("vortex-run"));

const ERROR_OUTPUT_CUTOFF = 3;

// TODO: remove this when separation is complete
// Protocol client functions - now use window.api preload bridge
const setSelfAsProtocolClient = (
  protocol: string,
  udPath: string,
): Promise<void> => {
  return getPreloadApi().app.setProtocolClient(protocol, udPath);
};

const isSelfProtocolClient = (
  protocol: string,
  udPath: string,
): Promise<boolean> => {
  return getPreloadApi().app.isProtocolClient(protocol, udPath);
};

const removeSelfAsProtocolClient = (
  protocol: string,
  udPath: string,
): Promise<void> => {
  return getPreloadApi().app.removeProtocolClient(protocol, udPath);
};

// Dialog functions - now use window.api preload bridge
const showOpenDialog = (
  options: Electron.OpenDialogOptions,
): Promise<Electron.OpenDialogReturnValue> => {
  return getPreloadApi().dialog.showOpen(options);
};

const showSaveDialog = (
  options: Electron.SaveDialogOptions,
): Promise<Electron.SaveDialogReturnValue> => {
  return getPreloadApi().dialog.showSave(options);
};

const appExit = (exitCode?: number): Promise<void> => {
  return getPreloadApi().app.exit(exitCode);
};

const showErrorBox = (title: string, content: string): Promise<void> => {
  return getPreloadApi().dialog.showErrorBox(title, content);
};

const showMessageBox = (
  options: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> => {
  return getPreloadApi().dialog.showMessageBox(options);
};

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

function applyVariables(arg: string, variables: { [key: string]: string }) {
  return stringFormat(arg, variables);
}

class ExtEventHandler extends EventEmitter {
  private mWrappee: EventEmitter;
  private mExtension: IRegisteredExtension;
  private mFuncMap: Map<
    string | symbol,
    Array<{ orig: CBFunc; wrapped: CBFunc }>
  > = new Map();

  constructor(wrappee: EventEmitter, extension: IRegisteredExtension) {
    super();
    this.mWrappee = wrappee;
    this.mExtension = extension;
  }

  public addListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this {
    this.mWrappee.addListener(event, this.makeWrapped(event, listener));
    return this;
  }

  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    const stack = new Error().stack;
    return this.addListener(event, listener);
  }

  public once(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this {
    this.mWrappee.once(event, this.makeOnceWrapped(event, listener));
    return this;
  }

  public prependListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this {
    this.mWrappee.prependListener(event, this.makeWrapped(event, listener));
    return this;
  }

  public prependOnceListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this {
    this.mWrappee.prependOnceListener(
      event,
      this.makeOnceWrapped(event, listener),
    );
    return this;
  }

  public removeListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this {
    if (this.mFuncMap.has(event)) {
      const listeners = this.mFuncMap.get(event);
      const idx = listeners.findIndex((iter) => iter.orig === listener);
      if (idx !== -1) {
        this.mWrappee.removeListener(event, listeners[idx].wrapped);
        listeners.splice(idx, 1);
      }
    }
    return this;
  }

  public off(event: string | symbol, listener: (...args: any[]) => void): this {
    return this.removeListener(event, listener);
  }

  public removeAllListeners(event?: string | symbol): this {
    this.mWrappee.removeAllListeners(event);
    return this;
  }

  public setMaxListeners(n: number): this {
    this.mWrappee.setMaxListeners(n);
    return this;
  }

  public getMaxListeners(): number {
    return this.mWrappee.getMaxListeners();
  }

  // tslint:disable-next-line:ban-types
  public listeners(event: string | symbol): Function[] {
    return this.mWrappee.listeners(event);
  }

  // tslint:disable-next-line:ban-types
  public rawListeners(event: string | symbol): Function[] {
    return this.mWrappee.rawListeners(event);
  }

  public emit(event: string | symbol, ...args: any[]): boolean {
    return this.mWrappee.emit(event, ...args);
  }

  public eventNames(): Array<string | symbol> {
    return this.mWrappee.eventNames();
  }

  public listenerCount(type: string | symbol): number {
    return this.mWrappee.listenerCount(type);
  }

  private funcMap(event: string | symbol) {
    if (!this.mFuncMap.has(event)) {
      this.mFuncMap.set(event, []);
    }
    return this.mFuncMap.get(event);
  }

  private makeWrapped(event: string | symbol, listener: CBFunc) {
    const wrapped = wrapExtCBSync(listener, convertExtInfo(this.mExtension));
    this.funcMap(event).push({ orig: listener, wrapped });
    return wrapped;
  }

  private makeOnceWrapped(event: string | symbol, listener: CBFunc) {
    const wrapped = wrapExtCBSync((...args: any[]): void => {
      listener(...args);
      this.removeListener(event, listener);
    }, convertExtInfo(this.mExtension));
    this.funcMap(event).push({ orig: listener, wrapped });
    return wrapped;
  }
}

function convertExtInfo(ext: IRegisteredExtension) {
  if (ext === undefined) {
    return undefined;
  }
  return {
    name: ext.info?.name ?? ext.name,
    namespace: ext.namespace,
    path: ext.path,
    dynamic: ext.dynamic,
    official: ext.info?.bundled ?? true,
  };
}

class APIProxyHandler implements ProxyHandler<any> {
  private mExtension: IRegisteredExtension;
  private mEnabled: boolean;
  private mEvents: EventEmitter;

  constructor(
    extension: IRegisteredExtension,
    enable: boolean,
    events: EventEmitter,
  ) {
    this.mExtension = extension;
    this.mEnabled = enable;
    this.mEvents = new ExtEventHandler(events, this.mExtension);
  }

  public enable() {
    this.mEnabled = true;
  }

  public get(target: IExtensionApi, key: PropertyKey): any {
    if (key === "extension") {
      return this.mExtension;
    } else if (key === "translate") {
      return target[key];
    } else if (key === "onAsync") {
      return (
        eventName: string,
        listener: (...args: any[]) => PromiseLike<any>,
      ) =>
        (target["onAsync"] as any)(
          eventName,
          listener,
          convertExtInfo(this.mExtension),
        );
    } else if (key === "onStateChange") {
      return (statePath: string[], callback: StateChangeCallback) =>
        (target[key] as any)(statePath, callback, this.mExtension);
    } else if (key === "events") {
      return this.mEvents;
    } else if (key === "laterT") {
      return (input, options?) =>
        new TString(input, options, this.mExtension.namespace);
    } else if (key === "NAMESPACE") {
      return this.mExtension.namespace;
    }
    if (!this.mEnabled) {
      throw new Error("extension uses api in init function");
    }
    return target[key];
  }
}

class APIProxyCreator implements ProxyHandler<any> {
  private mExtension: IRegisteredExtension;
  private mProxyHandler: APIProxyHandler;
  private mProxy: IExtensionApi;
  private mEvents: EventEmitter;
  private mAPIEnabled: boolean = false;

  constructor(extension: IRegisteredExtension, events: EventEmitter) {
    this.mExtension = extension;
    this.mEvents = events;
  }

  public enableAPI() {
    this.mAPIEnabled = true;
    if (this.mProxyHandler !== undefined) {
      this.mProxyHandler.enable();
    }
  }

  public get(target, key: PropertyKey): any {
    if (key === "api") {
      if (this.mProxy === undefined) {
        this.mProxyHandler = new APIProxyHandler(
          this.mExtension,
          this.mAPIEnabled,
          this.mEvents,
        );
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
    this.mOptional = new Proxy(
      {},
      {
        get(target, key: PropertyKey): any {
          return (...args) => {
            if (!that.mMayRegister) {
              log(
                "warn",
                "extension tries to use register call outside init function",
                {
                  extension: that.mCurrentExtension,
                  call: key,
                },
              );
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
      },
    );
  }

  public endRegistration() {
    this.mMayRegister = false;
  }

  /**
   * returns the parameters of calls to the specified function
   */
  public getCalls(name: string): IInitCall[] {
    return this.mInitCalls.filter((call: IInitCall) => call.key === name);
  }

  public dropCalls(extNames: string) {
    this.mInitCalls = this.mInitCalls.filter(
      (iter) => iter.extension !== extNames,
    );
  }

  public invokeAdditions(extensions: IRegisteredExtension[]) {
    this.mApiAdditions.forEach((addition: IApiAddition) => {
      this.getCalls(addition.key).forEach((call) => {
        const ext = extensions.find((iter) => iter.name === call.extension);
        const extInfo = convertExtInfo(ext);
        addition.callback(...call.arguments, call.extensionPath, extInfo);
      });
    });
  }

  /**
   * Retrieve the map of optional extensions
   *  Each optional requireExtension call is added against the id of the extension that requires it.
   */
  public getOptionalExtensions(allExtensions: IRegisteredExtension[]) {
    const optionalRequireCalls = this.getCalls("requireExtension").filter(
      (iter) => iter.arguments.length > 2 && iter.arguments[2] === true,
    );
    const missingOptionals = optionalRequireCalls.reduce((acc, iter) => {
      const callingExtensionKey = iter.extension;
      const requiredKey = iter.arguments[0];
      const ext = this.findExt(requiredKey, allExtensions);
      if (ext === undefined) {
        const optional: IExtensionOptional = {
          id: requiredKey,
          args: iter.arguments,
          extensionPath: iter.extensionPath,
        };
        acc = {
          ...acc,
          [callingExtensionKey]: [].concat(
            acc[callingExtensionKey] || [],
            optional,
          ) as IExtensionOptional[],
        };
      }
      return acc;
    }, {});
    return missingOptionals;
  }

  /**
   * remove all init calls from incompatible extensions
   */
  public unloadIncompatible(
    furtherAPIs: Set<string>,
    allExtensions: IRegisteredExtension[],
  ): { [extId: string]: IExtensionLoadFailure[] } {
    const addAPIs: string[] = this.mApiAdditions.map(
      (addition: IApiAddition) => addition.key,
    );
    const fullAPI = new Set([...furtherAPIs, ...this.staticAPIs, ...addAPIs]);

    const incompatibleExtensions: { [extId: string]: IExtensionLoadFailure[] } =
      {};

    this.mInitCalls
      .filter((call: IInitCall) => !call.optional && !fullAPI.has(call.key))
      .forEach((call: IInitCall) => {
        log("debug", "unsupported api call", {
          extension: call.extension,
          api: call.key,
        });
        setdefault(incompatibleExtensions, call.extension, []).push({
          id: "unsupported-api",
        });
      });

    const testValid = (
      extId: string,
      requiredId?: string,
      version?: string,
      optional?: boolean,
    ) => {
      if (!optional) {
        const req = this.findExt(requiredId, allExtensions);
        if (req === undefined) {
          setdefault(incompatibleExtensions, extId, []).push({
            id: "dependency",
            args: { dependencyId: requiredId },
          });
        } else if (
          version !== undefined &&
          !semver.satisfies(req.info?.version, version)
        ) {
          setdefault(incompatibleExtensions, extId, []).push({
            id: "dependency",
            args: { dependencyId: requiredId, version },
          });
        }
      }
    };

    this.getCalls("requireExtension").forEach((call) => {
      testValid(call.extension, ...call.arguments);
    });

    this.getCalls("requireVersion").forEach((call) => {
      if (
        process.env.NODE_ENV !== "development" &&
        !semver.satisfies(getApplication().version, call.arguments[0], {
          includePrerelease: true,
        })
      ) {
        setdefault(incompatibleExtensions, call.extension, []).push({
          id: "unsupported-version",
        });
      }
    });

    if (Object.keys(incompatibleExtensions).length > 0) {
      log("info", "extensions ignored for using unsupported api", {
        extensions: Object.keys(incompatibleExtensions).join(", "),
      });
      this.mInitCalls = this.mInitCalls.filter(
        (call: IInitCall) =>
          incompatibleExtensions[call.extension] === undefined,
      );
    } else {
      log("debug", "all extensions compatible");
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
    } else if (key === "optional") {
      return this.mOptional;
    }

    return key in this.mContext
      ? this.mContext[key]
      : (...args) => {
          if (!this.mMayRegister) {
            log(
              "warn",
              "extension tries to use register call outside init function",
              {
                extension: this.mCurrentExtension,
                call: key,
              },
            );
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
      registerOverlay: undefined,
      registerSettings: undefined,
      registerAction: undefined,
      registerControlWrapper: undefined,
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
      registerGameStub: undefined,
      registerGameStore: undefined,
      registerGameInfoProvider: undefined,
      registerAttributeExtractor: undefined,
      registerModType: undefined,
      registerActionCheck: undefined,
      registerMerge: undefined,
      registerInterpreter: undefined,
      registerStartHook: undefined,
      registerMigration: undefined,
      registerToolVariables: undefined,
      registerLoadOrderPage: undefined,
      registerLoadOrder: undefined,
      registerGameSpecificCollectionsData: undefined,
      registerHistoryStack: undefined,
      registerAPI: undefined,
      requireVersion: undefined,
      requireExtension: undefined,
      api: undefined,
      once: undefined,
      onceMain: undefined,
      optional: undefined,
    };

    return Object.keys(dummy);
  }

  public findExt = (id: string, allExtensions?: IRegisteredExtension[]) => {
    return allExtensions.find(
      (ext) => ext.info?.name === id || ext.info?.id === id || ext.name === id,
    );
  };
}

const UNDEFINED = {};

type CBFunc = (...args: any[]) => void;
interface IStartHook {
  priority: number;
  id: string;
  hook: (input: IRunParameters) => PromiseBB<IRunParameters>;
}

function convertMD5Result(input: ILookupResult): IModLookupResult {
  return input;
}

interface IRepositoryLookup {
  preferOverMD5: boolean;
  func: (id: IModRepoId) => PromiseBB<IModLookupResult[]>;
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

  public static getExtensionPaths(): Array<{ path: string; bundled: boolean }> {
    // only the first extension with a specific name is loaded, so
    // load the bundled ones last so a user can replace them
    return [
      { path: path.join(getVortexPath("userData"), "plugins"), bundled: false },
      { path: getVortexPath("bundledPlugins"), bundled: true },
    ];
  }

  private static sUIAPIs: Set<string> = new Set<string>();

  private mExtensions: IRegisteredExtension[];
  private mApi: IExtensionApi;
  private mTranslator: i18n;
  private mEventEmitter: NodeJS.EventEmitter;
  private mStyleManager: any;
  private mReduxWatcher: ReduxWatcher<IState>;
  private mWatches: IWatcherRegistry = {};
  private mProtocolHandlers: {
    [protocol: string]: (url: string, install: boolean) => void;
  } = {};
  private mRepositoryLookup: { [repository: string]: IRepositoryLookup } = {};
  private mArchiveHandlers: { [extension: string]: ArchiveHandlerCreator };
  private mModDB: modmetaT.ModDB;
  private mModDBPromise: PromiseBB<void>;
  private mModDBGame: string;
  private mModDBAPIKey: string;
  private mModDBCache: { [id: string]: ILookupResult[] } = {};
  private mContextProxyHandler: ContextProxyHandler;
  private mExtensionState: { [extId: string]: IExtensionState };
  private mLoadFailures: { [extId: string]: IExtensionLoadFailure[] } = {};
  private mOptionalExtensions: { [extId: string]: IExtensionOptional[] } = {};
  private mInterpreters: {
    [ext: string]: (input: IRunParameters) => IRunParameters;
  };
  private mStartHooks: IStartHook[];
  private mToolParameterCBs: ToolParameterCB[];
  private mLoadingCallbacks: Array<(name: string, idx: number) => void> = [];
  private mProgrammaticMetaServers: { [id: string]: modmetaT.IServer } = {};
  private mForceDBReconnect: boolean = false;
  private mOnUIStarted: () => void;
  private mUIStartedPromise: PromiseBB<void>;
  private mOutdated: string[] = [];
  private mFailedWatchers: Set<string> = new Set();
  // the idea behind this was that we might want to support things like typescript
  // or coffescript directly but that would require us shipping the corresponding compilers
  private mExtensionFormats: string[] = ["index.js"];
  // Pending actions to dispatch when setStore() is called (renderer-only architecture)
  private mPendingDisables: string[] = [];
  private mPendingRemoves: string[] = [];
  // Extension-registered persistors for custom hives (e.g., loadOrder -> plugins.txt)
  private mExtensionPersistors: {
    [hive: string]: { persistor: IPersistor; debounce: number };
  } = {};
  // Previous state for extension persistor diff computation
  private mPersistorPrevState: { [hive: string]: unknown } = {};
  // Debounce timers for extension persistors
  private mPersistorTimers: { [hive: string]: ReturnType<typeof setTimeout> } =
    {};

  /**
   * Create ExtensionManager.
   *
   * In the new renderer-only architecture:
   * - Pass extensionState directly (from hydrated app.extensions)
   * - Store will be set later via setStore() after reducer is initialized
   *
   * @param extensionState - Pre-loaded extension state from hydration (renderer-only)
   * @param eventEmitter - Event emitter for extension communication
   */
  constructor(
    extensionState?: { [extId: string]: IExtensionState },
    eventEmitter?: NodeJS.EventEmitter,
  ) {
    this.mEventEmitter = eventEmitter;
    if (eventEmitter !== undefined) {
      this.mEventEmitter.setMaxListeners(100);
    }

    this.mUIStartedPromise = new PromiseBB((resolve) => {
      this.mOnUIStarted = resolve;
    });

    this.mInterpreters = {};
    this.mStartHooks = [];
    this.mToolParameterCBs = [];
    this.mApi = {
      showErrorNotification: this.showErrorBox,
      selectFile: this.selectFile,
      saveFile: this.saveFile,
      selectExecutable: this.selectExecutable,
      selectDir: this.selectDir,
      events: this.mEventEmitter,
      translate: (input, options?) => {
        if (this.mTranslator == null) {
          return Array.isArray(input) ? input[0].toString() : input.toString();
        }
        if (options == null) {
          options = {};
        }
        // This is a namespace key, use new separators.
        if (options?.isNamespaceKey) {
          return this.mTranslator.t(input, {
            ...options,
            keySeparator: ".",
            nsSeparator: ":",
          });
        }
        // Not a namespace key, use old separators.
        return this.mTranslator.t(input, options);
      },
      laterT: (input, options?) => new TString(input, options, "common"),
      locale: () => this.mTranslator.language,
      getI18n: () => this.mTranslator,
      getPath: this.getPath,
      onStateChange: (statePath: string[], callback: StateChangeCallback) =>
        undefined,
      registerProtocol: this.registerProtocol,
      registerRepositoryLookup: this.registerRepositoryLookup,
      deregisterProtocol: this.deregisterProtocol,
      lookupModReference: this.lookupModReference,
      lookupModMeta: this.lookupModMeta,
      saveModMeta: this.saveModMeta,
      openArchive: this.openArchive,
      genMd5Hash: this.genMd5Hash,
      clearStylesheet: () => {
        /** NOTE(erri120): no-op */
      },
      setStylesheet: (key, filePath) =>
        this.mStyleManager.addStylesheet(key, filePath),
      runExecutable: this.runExecutable,
      emitAndAwait: this.emitAndAwait,
      withPrePost: this.withPrePost,
      isOutdated: () => isOutdated(),
      onAsync: this.onAsync,
      highlightControl: this.highlightControl,
      addMetaServer: this.addMetaServer,
      getLoadedExtensions: () => this.extensions,
      awaitUI: () => this.mUIStartedPromise,
      getState: () => undefined,
      ext: {},
      NAMESPACE: "common",
    };

    // Use provided extension state directly (renderer-only architecture)
    // Extensions that need to be removed will be handled when setStore() is called
    this.mExtensionState = extensionState ?? {};

    // Handle extensions that caused crashes - mark for disabling
    // The actual dispatch will happen when setStore() is called
    this.mPendingDisables = [];
    try {
      const disableExtensions = fs
        .readdirSync(getVortexPath("temp"))
        .filter((name) => name.startsWith("__disable_"));
      disableExtensions.forEach((ext) => {
        const extId = ext.substr(10);
        log("info", "disabling extension that caused a crash before", {
          extId,
        });
        this.mPendingDisables.push(extId);
        fs.unlinkSync(path.join(getVortexPath("temp"), ext));
      });
    } catch (err) {
      const code = getErrorCode(err);
      // an ENOENT will happen on the first start where the dir doesn't
      // exist yet. No problem
      if (code !== "ENOENT") {
        log("error", "failed to read disabled extensions", err);
      }
    }

    // Check for extensions marked for removal
    const extensionsPath = path.join(getVortexPath("userData"), "plugins");
    this.mPendingRemoves = [];
    Object.keys(this.mExtensionState)
      .filter((extId) => this.mExtensionState[extId].remove)
      .forEach((extId) => {
        log("info", "removing", path.join(extensionsPath, extId));
        fs.removeSync(path.join(extensionsPath, extId));
        this.mPendingRemoves.push(extId);
      });

    // Dynamic require to prevent TypeScript from analyzing StyleManager during api build
    const StyleManagerClass = require("./StyleManager").default;
    this.mStyleManager = new StyleManagerClass();
    this.mExtensions = this.prepareExtensions();

    log("info", "outdated extensions", { numOutdated: this.mOutdated.length });
    if (this.mOutdated.length > 0) {
      this.mOutdated.forEach((ext) => {
        log("info", "extension older than bundled version, will be removed", {
          name: ext,
        });
        // Store pending removal - will be dispatched when setStore() is called
        this.mPendingRemoves.push(ext);
      });
      return;
    }

    this.initExtensions();
  }

  public get hasOutdatedExtensions() {
    return this.mOutdated.length > 0;
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
    this.mReduxWatcher = new ReduxWatcher(store, this.watcherError);

    // Process any pending actions that were deferred during construction
    // (renderer-only architecture - dispatches happen after store is ready)
    this.mPendingDisables.forEach((extId) => {
      store.dispatch(setExtensionEnabled(extId, false));
    });
    this.mPendingDisables = [];

    this.mPendingRemoves.forEach((extId) => {
      store.dispatch(forgetExtension(extId));
    });
    this.mPendingRemoves = [];

    this.mExtensionState = getSafe(store.getState(), ["app", "extensions"], {});

    // Initialize extension-registered persistors (e.g., loadOrder -> plugins.txt)
    this.initExtensionPersistors(store);

    this.mApi.sendNotification = (notification: INotification): string => {
      const noti = { ...notification };
      if (noti.id === undefined) {
        noti.id = shortid();
      }
      if (this.canBeToast(noti)) {
        try {
          const toastFunc = noti.type === "error" ? toast.error : toast.success;
          const toastOptions: ToastOptions = {
            id: noti.id,
            duration: noti.displayMS,
          };
          const message =
            noti.title !== undefined
              ? `${noti.title}:\n${noti.message ?? ""}`
              : (noti.message ?? "");
          if (message.length > 0) {
            toastFunc(message, toastOptions);
            return noti.id;
          }
        } catch (err) {
          // Toast rendering failed (e.g., goober styling error during race condition)
          // Fall through to standard notification
          log("warn", "Failed to show toast notification", err);
        }
      }
      if (notification.type === "warning") {
        log("warn", "warning notification", {
          message: notification.message,
          title: notification.title,
        });
      } else if (notification.type === "error") {
        log("warn", "error notification", {
          message: notification.message,
          title: notification.title,
        });
      }
      store.dispatch(addNotification(noti));
      return noti.id;
    };

    // tslint:disable-next-line:only-arrow-functions
    this.mApi.showErrorNotification = function (
      message: string,
      details: string | Error | any,
      options?: IErrorOptions,
    ) {
      let extension: IRegisteredExtension = this.extension;

      if (extension === undefined && details?.["extension"] !== undefined) {
        extension = (this.getLoadedExtensions() as IRegisteredExtension[]).find(
          (iter) => iter.name === details["extension"],
        );
      }

      if (
        extension !== undefined &&
        extension.info !== undefined &&
        extension.info.author !== COMPANY_ID
      ) {
        if (options === undefined) {
          options = {};
        }
        if (options.allowReport !== false) {
          options.extensionName = extension.info.name;

          const remoteExtensions = (this.getState() as IState).session
            .extensions.available;
          options.extensionRemote = remoteExtensions.find((ext) =>
            isExtSame(extension.info, ext),
          );
        }
        options.extension = extension;
      }
      showError(store.dispatch, message, details, options);
    };

    this.mApi.showDialog = (
      type: DialogType,
      title: string,
      content: IDialogContent,
      actions: DialogActions,
      id?: string,
    ) => store.dispatch(showDialog(type, title, content, actions, id));
    this.mApi.closeDialog = (id: string, actionKey: string, input: any) =>
      store.dispatch(closeDialog(id, actionKey, input));
    this.mApi.dismissNotification = (id: string) =>
      store.dispatch(dismissNotification(id));
    this.mApi.dismissAllNotifications = () =>
      store.dispatch(dismissAllNotifications());
    this.mApi.suppressNotification = (id: string, suppress: boolean) => {
      if (suppress !== false) {
        store.dispatch(dismissNotification(id));
      }
      store.dispatch(suppressNotification(id, suppress !== false));
    };
    this.mApi.store = store;
    this.mApi.getState = <T extends IState>() =>
      this.mApi.store.getState() as T;
    this.mApi.onStateChange = this.stateChangeHandler;

    this.mApi.onStateChange(["settings", "metaserver", "servers"], () => {
      this.mForceDBReconnect = true;
    });

    store.dispatch(setOptionalExtensions(this.mOptionalExtensions));
    store.dispatch(setExtensionLoadFailures(this.mLoadFailures));
    this.migrateExtensions();
    this.reportExtLoadErrors();
  }

  private reportExtLoadErrors() {
    const nodeLoadErr = Object.values(this.mLoadFailures)
      .flat(1)
      .find((_) => {
        const msg = _.args?.message ?? "";
        return (
          msg.includes("The specified module could not be found.") &&
          msg.includes(".node")
        );
      });
    if (nodeLoadErr !== undefined) {
      this.mApi.store?.dispatch?.(
        showDialog(
          "error",
          "Extension failed to load",
          {
            bbcode:
              "An unexpected error occurred while Vortex was loading extension:<br/><br/>{{message}}<br/><br/>" +
              "This is often caused by a bad installation of the app, " +
              "a security app interfering with Vortex " +
              "or a problem with the Microsoft Visual C++ Redistributable installed on your PC. " +
              "To solve this issue please try the following:<br/><br/>" +
              "- Wait a moment and try starting Vortex again<br/>" +
              "- Reinstall Vortex from the Nexus Mods website<br/>" +
              "- Install the latest Microsoft Visual C++ Redistributable ([url]{{url}}[/url])<br/>" +
              "- Disable anti-virus or other security apps that might interfere and install Vortex again<br/><br/>" +
              "If the issue persists, please create a thread in our support forum for further assistance.",
            parameters: {
              message: nodeLoadErr.args.message,
              url: VCREDIST_URL,
            },
          },
          [
            {
              label: "Ignore",
              action: () => disableErrorReport(),
            },
            {
              label: "Close Vortex",
              action: () => appExit(),
            },
          ],
          "ext-load-native-failed",
        ),
      );
    }
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
    this.apply(
      "registerReducer",
      (statePath: string[], reducer: IReducerSpec) => {
        reducers.push({ path: statePath, reducer });
      },
    );
    this.apply(
      "registerActionCheck",
      (actionType: string, check: SanityCheck) => {
        registerSanityCheck(actionType, check);
      },
    );
    this.apply(
      "registerInterpreter",
      (extension: string, apply: (input: IRunParameters) => IRunParameters) => {
        this.mInterpreters[extension.toLowerCase()] = apply;
      },
    );
    this.apply(
      "registerStartHook",
      (
        priority: number,
        id: string,
        hook: (input: IRunParameters) => PromiseBB<IRunParameters>,
      ) => {
        this.mStartHooks.push({ priority, id, hook });
      },
    );
    this.apply("registerToolVariables", (func: ToolParameterCB) => {
      this.mToolParameterCBs.push(func);
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
    this.mContextProxyHandler.invokeAdditions(this.mExtensions);
  }

  /**
   * Initialize extension-registered persistors.
   * Should be called after the store is set up.
   * This enables extensions to persist custom state hives to external files
   * (e.g., loadOrder -> plugins.txt, userlist -> userlist.yaml)
   */
  public initExtensionPersistors<S extends IState>(store: ThunkStore<S>) {
    // Collect all persistor registrations from extensions
    this.apply(
      "registerPersistor",
      (hive: string, persistor: IPersistor, debounce?: number) => {
        log("info", "Registering extension persistor", { hive });
        this.mExtensionPersistors[hive] = {
          persistor,
          debounce: debounce ?? 200,
        };
        // Initialize previous state for this hive
        this.mPersistorPrevState[hive] = (store.getState() as IState)[
          hive as keyof IState
        ];

        // Set up the reset callback - called when persistor loads data from file
        // This hydrates the Redux state from the persistor's data
        persistor.setResetCallback(() => {
          return this.hydrateFromPersistor(hive, persistor, store);
        });
      },
    );

    // Subscribe to store changes to notify extension persistors
    if (Object.keys(this.mExtensionPersistors).length > 0) {
      log("info", "Setting up extension persistor subscriptions", {
        hives: Object.keys(this.mExtensionPersistors),
      });

      store.subscribe(() => {
        const newState = store.getState() as IState;
        this.notifyExtensionPersistors(newState);
      });
    }
  }

  /**
   * Hydrate Redux state from a persistor's data.
   * Called when a persistor loads data from its backing store (e.g., plugins.txt).
   */
  private async hydrateFromPersistor<S extends IState>(
    hive: string,
    persistor: IPersistor,
    store: ThunkStore<S>,
  ): Promise<void> {
    try {
      log("debug", "Hydrating from extension persistor", { hive });

      // Build the hydration data from the persistor
      const hydrationData: Record<string, unknown> = {};

      if (persistor.getAllKVs !== undefined) {
        // Fast path: get all key-value pairs at once
        const kvPairs = await persistor.getAllKVs();
        for (const { key, value } of kvPairs) {
          this.insertAtPath(hydrationData, key, this.deserialize(value));
        }
      } else {
        // Slow path: get keys first, then values
        const keys = await persistor.getAllKeys();
        for (const key of keys) {
          try {
            const value = await persistor.getItem(key);
            this.insertAtPath(hydrationData, key, this.deserialize(value));
          } catch (err) {
            log("warn", "Failed to get persistor item", {
              hive,
              key: key.join("."),
              error: getErrorMessageOrDefault(err),
            });
          }
        }
      }

      // Dispatch hydration action to update Redux state
      store.dispatch({
        type: "__hydrate",
        payload: { [hive]: hydrationData },
      } as any);

      // Update our tracked previous state to match what we just hydrated
      this.mPersistorPrevState[hive] = hydrationData;

      log("debug", "Extension persistor hydration complete", {
        hive,
        keyCount: Object.keys(hydrationData).length,
      });
    } catch (err) {
      log("error", "Failed to hydrate from extension persistor", {
        hive,
        error: getErrorMessageOrDefault(err),
      });
    }
  }

  /**
   * Insert a value at a nested path in an object.
   */
  private insertAtPath(
    target: Record<string, unknown>,
    path: string[],
    value: unknown,
  ): void {
    let current: Record<string, unknown> = target;
    for (let i = 0; i < path.length - 1; i++) {
      if (current[path[i]] === undefined) {
        current[path[i]] = {};
      }
      current = current[path[i]] as Record<string, unknown>;
    }
    if (path.length > 0) {
      current[path[path.length - 1]] = value;
    }
  }

  /**
   * Deserialize a value from the persistor.
   */
  private deserialize(value: string): unknown {
    if (value === undefined || value.length === 0) {
      return "";
    }
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  /**
   * Notify extension persistors of state changes.
   * Computes diffs and calls setItem/removeItem on each persistor.
   */
  private notifyExtensionPersistors(newState: IState) {
    for (const [hive, { persistor, debounce }] of Object.entries(
      this.mExtensionPersistors,
    )) {
      const newHive = newState[hive as keyof IState];

      // Skip if hive hasn't changed from the last PERSISTED state
      if (this.mPersistorPrevState[hive] === newHive) {
        continue;
      }

      // Clear any pending timer for this hive
      if (this.mPersistorTimers[hive] !== undefined) {
        clearTimeout(this.mPersistorTimers[hive]);
      }

      // Schedule debounced persist - capture newHive but use stored prevState when running
      // This ensures multiple rapid changes are accumulated into one diff
      const capturedNewHive = newHive;
      this.mPersistorTimers[hive] = setTimeout(() => {
        const oldHive = this.mPersistorPrevState[hive];
        this.persistHiveChanges(hive, persistor, oldHive, capturedNewHive);
        // Update previous state AFTER successful persist
        this.mPersistorPrevState[hive] = capturedNewHive;
        delete this.mPersistorTimers[hive];
      }, debounce);
    }
  }

  /**
   * Persist changes for a specific hive by computing diff and calling persistor methods.
   */
  private persistHiveChanges(
    hive: string,
    persistor: IPersistor,
    oldHive: unknown,
    newHive: unknown,
  ) {
    try {
      const operations = computeStateDiff(oldHive, newHive);

      for (const op of operations) {
        if (op.type === "set") {
          Promise.resolve(
            persistor.setItem(op.path, JSON.stringify(op.value)),
          ).catch((err: unknown) => {
            log("error", "Extension persistor setItem failed", {
              hive,
              path: op.path.join("."),
              error: getErrorMessageOrDefault(err),
            });
          });
        } else {
          Promise.resolve(persistor.removeItem(op.path)).catch(
            (err: unknown) => {
              log("error", "Extension persistor removeItem failed", {
                hive,
                path: op.path.join("."),
                error: getErrorMessageOrDefault(err),
              });
            },
          );
        }
      }
    } catch (err) {
      log("error", "Failed to compute extension persistor diff", {
        hive,
        error: getErrorMessageOrDefault(err),
      });
    }
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
  public apply(
    funcName: keyof IExtensionContext,
    func: (...args: any[]) => void,
    addExtInfo?: boolean,
  ) {
    this.mContextProxyHandler.getCalls(funcName).forEach((call) => {
      try {
        if (addExtInfo === true) {
          const ext = this.mExtensions.find(
            (iter) => iter.name === call.extension,
          );
          const extInfo = _.pick(ext, ["name", "namespace", "path"]);
          func(extInfo, ...call.arguments);
        } else {
          func(...call.arguments);
        }
      } catch (unknownError) {
        const err = unknownToError(unknownError);

        this.mApi.showErrorNotification(
          "Extension failed to initialize. If this isn't an official extension, " +
            "please report the error to the respective author.",
          {
            extension: call.extension,
            err: err.message,
            stack: err.stack,
          },
        );
      }
    });
  }

  /**
   * call the "once" function for all extensions. This should really only be called
   * once.
   */
  public doOnce(): PromiseBB<void> {
    // Since ExtensionManager is renderer-only, we need to handle both once and onceMain
    const onceCalls = this.mContextProxyHandler.getCalls("once");
    const onceMainCalls = this.mContextProxyHandler.getCalls("onceMain");
    const allCalls = [...onceCalls, ...onceMainCalls];

    const reportError = (
      err: unknown,
      call: IInitCall,
      allowReport: boolean = true,
    ) => {
      if (err instanceof Error) {
        log("warn", "failed to call once", {
          err: err.message,
          stack: err.stack,
        });
      } else {
        log("warn", "failed to call once", err);
      }

      err["extension"] = call.extension;
      this.mApi.showErrorNotification(
        "Extension failed to initialize. If this isn't an official extension, " +
          "please report the error to the respective author.",
        err,
        { allowReport },
      );
    };

    return PromiseBB.mapSeries(allCalls, (call, idx) => {
      const isMainCall = onceMainCalls.includes(call);
      log("debug", isMainCall ? "onceMain" : "once", {
        extension: call.extension,
      });
      const ext = this.mExtensions.find((iter) => iter.name === call.extension);
      this.mContextProxyHandler.setExtension(ext.name, ext.path);
      try {
        this.mLoadingCallbacks.forEach((cb) => {
          cb(call.extension, idx);
        });

        let prom: PromiseBB<void>;
        if (isMainCall) {
          // For onceMain, request main process initialization via IPC
          log("debug", "Requesting main process initialization", {
            extension: call.extension,
          });
          prom = PromiseBB.resolve(
            (window as unknown as PreloadWindow).api.extensions.requestMainInit(
              call.extension,
            ),
          ).then((result) => {
            if (!result.success) {
              throw new Error(
                result.error || "Main process initialization failed",
              );
            }
          });
        } else {
          // For once, execute the callback directly in renderer
          prom = call.arguments[0]() || PromiseBB.resolve();
        }

        const start = Date.now();
        return timeout(prom, 60000, {
          throw: true,
          queryContinue: () => this.queryLoadTimeout(call.extension),
        })
          .then(() => {
            const elapsed = Date.now() - start;
            if (elapsed > 1000) {
              log("debug", "slow initialization", {
                extension: call.extension,
                elapsed,
              });
            }
          })
          .catch(TimeoutError, () => {
            reportError(
              new Error("Initialization didn't finish in time."),
              call,
              false,
            );
          })
          .catch((err) => {
            reportError(err, call);
          });
      } catch (err) {
        reportError(err, call);
      }
    }).then(() => {
      this.mLoadingCallbacks.forEach((cb) => {
        cb(undefined, allCalls.length);
      });
      log("debug", "once done");
    });
  }

  public getProtocolHandler(protocol: string) {
    return this.mProtocolHandlers[protocol] || null;
  }

  public get numOnce() {
    // Count both once and onceMain calls since we handle both in renderer
    const onceCalls = this.mContextProxyHandler.getCalls("once");
    const onceMainCalls = this.mContextProxyHandler.getCalls("onceMain");
    return onceCalls.length + onceMainCalls.length;
  }

  public onLoadingExtension(cb: (name: string, idx: number) => void) {
    this.mLoadingCallbacks.push(cb);
  }

  public setUIReady() {
    this.mOnUIStarted();
  }

  private watcherError = (err: Error, selector: string[]) => {
    const id = selector.join(".");
    if (!this.mFailedWatchers.has(id)) {
      log("warn", "Failed to trigger state listener", {
        error: err.message,
        selector: JSON.stringify(selector),
      });
      this.mFailedWatchers.add(id);
    }
  };

  private queryLoadTimeout(extension: string): PromiseBB<boolean> {
    return PromiseBB.resolve(
      showMessageBox({
        type: "warning",
        title: "Extension slow",
        message:
          `An extension (${extension}) is taking unusually long to load. ` +
          "This is very likely a bug. Do you want to continue to wait for it?",
        noLink: true,
        buttons: ["Cancel", "Wait"],
      }),
    ).then((result) => result.response === 1);
  }

  private getModDB = (): PromiseBB<modmetaT.ModDB> => {
    const gameMode = activeGameId(this.mApi.store.getState());
    const currentKey = getSafe(
      this.mApi.store.getState(),
      ["confidential", "account", "nexus", "APIKey"],
      "",
    );

    let init;

    let onDone: () => void;
    if (this.mModDBPromise === undefined) {
      this.mModDBPromise = new PromiseBB<void>((resolve, reject) => {
        onDone = () => {
          this.mModDBPromise = undefined;
          resolve();
        };
      });
      init = PromiseBB.resolve();
    } else {
      init = this.mModDBPromise;
    }

    return init
      .then(() => {
        // reset the moddb if necessary so new settings get used
        if (
          this.mModDB === undefined ||
          this.mForceDBReconnect ||
          gameMode !== this.mModDBGame ||
          currentKey !== this.mModDBAPIKey
        ) {
          this.mForceDBReconnect = false;
          if (this.mModDB !== undefined) {
            return this.mModDB.close().then(() => (this.mModDB = undefined));
          }
        }
        return PromiseBB.resolve();
      })
      .then(() =>
        this.mModDB !== undefined
          ? PromiseBB.resolve()
          : this.connectMetaDB(gameMode, currentKey).then((modDB) => {
              this.mModDB = modDB;
              this.mModDBGame = gameMode;
              this.mModDBAPIKey = currentKey;
              log("debug", "initialised");
            }),
      )
      .then(() => this.mModDB)
      .finally(() => {
        if (onDone !== undefined) {
          onDone();
        }
      });
    // TODO: the fallback to nexus api should somehow be set up in nexus_integration, not here
  };

  private canBeToast = (notif: INotification) => {
    const invalidToastTypes = ["activity", "warning"];
    if (
      notif.displayMS != null &&
      notif.displayMS <= 5000 &&
      notif.noToast !== true &&
      (notif.actions == null || notif.actions.length === 0) &&
      !invalidToastTypes.includes(notif.type)
    ) {
      return true;
    }
    return false;
  };

  private getMetaServerList(): modmetaT.IServer[] {
    const state = this.mApi.store.getState();
    const servers: { [key: string]: modmetaT.IServer } = getSafe(
      state,
      ["settings", "metaserver", "servers"],
      {},
    );

    return Object.keys(servers)
      .map((id) => servers[id])
      .slice()
      .concat(Object.values(this.mProgrammaticMetaServers))
      .sort((lhs, rhs) => (lhs.priority ?? 100) - (rhs.priority ?? 100));
  }

  private connectMetaDB(
    gameId: string,
    apiKey: string,
  ): PromiseBB<modmetaT.ModDB> {
    const dbPath = path.join(getVortexPath("userData"), "metadb");
    return modmeta.ModDB.create(
      dbPath,
      gameId,
      this.getMetaServerList(),
      log,
    ).catch((err) => {
      return this.mApi
        .showDialog(
          "error",
          "Failed to connect meta database",
          {
            text: "Please check that there is no other instance of Vortex still running.",
            message: getErrorMessageOrDefault(err),
          },
          [{ label: "Quit" }, { label: "Retry" }],
        )
        .then((result) => {
          if (result.action === "Quit") {
            getApplication().quit();
            return PromiseBB.reject(new ProcessCanceled("meta db locked"));
          }
          return this.connectMetaDB(gameId, apiKey);
        });
    });
  }

  private stateChangeHandler = (
    watchPath: string[],
    callback: StateChangeCallback,
    ext?: IRegisteredExtension,
  ) => {
    if (!isFunction(callback)) {
      // TODO we should be throwing an exception here but this didn't fail in the past and I don't
      //   want to break previously ok extensions in a minor update
      // throw new Error('attempt to register invalid change handler');
      log("error", "attempt to register invalid change handler", {
        stack: new Error().stack,
      });
      return;
    }

    const stackErr = new Error();
    // have to initialize to a value that we _know_ is never set by the user.
    let lastValue = UNDEFINED;

    const key = watchPath.join(".");

    // TODO: this code makes using the ReduxWatcher pointless and looking at the
    //   code I would now disagree with the assessment that it may retrigger
    //   without an actual change. otoh I didn't add this for no reason...
    const changeHandler = ({ prevValue, currentValue }) => {
      // redux-watch may trigger even if no change occurred so we have to
      // do our own check, otherwise we could end up in an endless loop
      // if the callback causes redux-watch to trigger again without change
      if (currentValue === lastValue && lastValue !== UNDEFINED) {
        return;
      }
      lastValue = currentValue;
      this.mWatches[key].forEach((cb) => {
        try {
          cb(prevValue, currentValue);
        } catch (unknownError) {
          const err = unknownToError(unknownError);

          log("error", "state change handler failed", {
            message: err.message,
            stack1: err.stack,
            stack2: stackErr.stack,
            key,
          });
        }
      });
    };

    if (this.mWatches[key] === undefined) {
      this.mWatches[key] = [];
      this.mReduxWatcher.on<any>(watchPath, changeHandler);
    }
    this.mWatches[key].push(wrapExtCBSync(callback, convertExtInfo(ext)));
  };

  private showErrorBox = (message: string, details: string | Error | any) => {
    const errMessage = getErrorMessageOrDefault(details);
    void showErrorBox(message, errMessage);
  };

  /**
   * initialize all extensions
   */
  private initExtensions() {
    const context = {
      api: this.mApi,
    };

    this.mContextProxyHandler = new ContextProxyHandler(context);
    const contextProxy = new Proxy(context, this.mContextProxyHandler);
    this.mExtensions.forEach((ext) => {
      log("info", "init extension", { name: ext.name, path: ext.path });
      this.mContextProxyHandler.setExtension(ext.name, ext.path);
      try {
        const apiProxy = new APIProxyCreator(ext, this.mEventEmitter);
        const extProxy = new Proxy(contextProxy, apiProxy);
        ext.initFunc()(extProxy as IExtensionContext);
        apiProxy.enableAPI();
      } catch (unknownError) {
        if (!ext.dynamic) {
          // if one of the static extension fails to initialize we should be
          // crashing, otherwise we risk data loss if the user restores a backup
          // and the important reducers aren't loaded
          throw unknownError;
        }
        const err = unknownToError(unknownError);

        // make sure we're not calling any of the register calls if the extension
        // isn't fully initialized
        this.mContextProxyHandler.dropCalls(ext.name);
        this.mLoadFailures[ext.name] = [
          { id: "exception", args: { message: err.message } },
        ];
        log("warn", "couldn't initialize extension", {
          name: ext.name,
          err: err.message,
          stack: err.stack,
        });
      }
    });
    this.mContextProxyHandler.endRegistration();
    // need to store them locally for now because the store isn't loaded at this time
    this.mLoadFailures = {
      ...this.mLoadFailures,
      ...this.mContextProxyHandler.unloadIncompatible(
        ExtensionManager.sUIAPIs,
        this.mExtensions,
      ),
    };

    this.mOptionalExtensions = this.mContextProxyHandler.getOptionalExtensions(
      this.mExtensions,
    );

    // apply api extensions immediately after all extensions are loaded so they
    // become available asap
    this.apply(
      "registerAPI",
      (key: string, func: (...args: any[]) => any, options: IApiAddition) => {
        this.mApi.ext[key] = func;
      },
    );

    log("info", "all extensions initialized");
  }

  private migrateExtensions() {
    type MigrationFunc = (oldVersion: string) => PromiseBB<void>;

    const migrations: { [ext: string]: MigrationFunc[] } = {};

    this.mContextProxyHandler.getCalls("registerMigration").forEach((call) => {
      setdefault(migrations, call.extension, []).push(call.arguments[0]);
    });

    const state: IState = this.mApi.store.getState();
    this.mExtensions
      .filter((ext) => ext.dynamic)
      .forEach((ext) => {
        try {
          let oldVersion = getSafe(
            state.app,
            ["extensions", ext.name, "version"],
            "0.0.0",
          );
          if (!semver.valid(oldVersion)) {
            log("error", "invalid version stored for extension", {
              extension: ext.name,
              oldVersion,
            });
            oldVersion = "0.0.0";
          }
          if (oldVersion !== ext.info.version) {
            if (migrations[ext.name] === undefined) {
              this.mApi.store.dispatch(
                setExtensionVersion(ext.name, ext.info.version),
              );
            } else {
              PromiseBB.mapSeries(migrations[ext.name], (mig) =>
                mig(oldVersion),
              )
                .then(() => {
                  log("info", "set extension version", {
                    name: ext.name,
                    info: JSON.stringify(ext.info),
                  });
                  this.mApi.store.dispatch(
                    setExtensionVersion(ext.name, ext.info.version),
                  );
                })
                .catch((err) => {
                  this.mApi.showErrorNotification(
                    "Extension failed to migrate",
                    err,
                    {
                      allowReport: ext.info.author === COMPANY_ID,
                    },
                  );
                })
                .then(() => null);
            }
          }
        } catch (err) {
          this.mApi.showErrorNotification("Extension invalid", err, {
            allowReport: false,
            message: ext.name,
          });
        }
      });
  }

  private getPath(name: string) {
    return getVortexPath(name as any);
  }

  private selectFile(options: IOpenOptions): PromiseBB<string> {
    const fullOptions: OpenDialogOptions = {
      ..._.omit(options, ["create"]),
      properties: ["openFile"],
    };
    if (options.create === true) {
      fullOptions.properties.push("promptToCreate");
    }
    return PromiseBB.resolve(showOpenDialog(fullOptions)).then((result) =>
      result.filePaths !== undefined && result.filePaths.length > 0
        ? result.filePaths[0]
        : undefined,
    );
  }

  private saveFile(options: ISaveOptions): PromiseBB<string> {
    const fullOptions: SaveDialogOptions = {
      //..._.omit(options, ['create']),
      //properties: ['showOverwriteConfirmation'],
      ...options,
    };
    //if (options === true) {
    //fullOptions.properties.push('showOverwriteConfirmation');
    //}
    return PromiseBB.resolve(showSaveDialog(fullOptions)).then((result) =>
      result.filePath !== undefined ? result.filePath : undefined,
    );
  }

  private selectExecutable(options: IOpenOptions) {
    // TODO: make the filter list dynamic based on the list of registered interpreters?
    const fullOptions: OpenDialogOptions = {
      ..._.omit(options, ["create"]),
      properties: ["openFile"],
      filters: [
        {
          name: "All Executables",
          extensions: ["exe", "cmd", "bat", "jar", "py"],
        },
        { name: "Native", extensions: ["exe", "cmd", "bat"] },
        { name: "Java", extensions: ["jar"] },
        { name: "Python", extensions: ["py"] },
      ],
    };
    return PromiseBB.resolve(showOpenDialog(fullOptions)).then((result) =>
      result.filePaths !== undefined && result.filePaths.length > 0
        ? result.filePaths[0]
        : undefined,
    );
  }

  private selectDir(options: IOpenOptions) {
    const fullOptions: OpenDialogOptions = {
      ..._.omit(options, ["create"]),
      properties: ["openDirectory"],
    };
    return PromiseBB.resolve(showOpenDialog(fullOptions)).then((result) =>
      result.filePaths !== undefined && result.filePaths.length > 0
        ? result.filePaths[0]
        : undefined,
    );
  }

  private commandLineUserData = () =>
    this.mApi.getState().session.base.commandLine?.userData;

  private registerProtocol = async (
    protocol: string,
    def: boolean,
    callback: (url: string, install: boolean) => void,
  ): Promise<boolean> => {
    log("info", "register protocol", { protocol });
    const isAlreadyClient = await isSelfProtocolClient(
      protocol,
      this.commandLineUserData(),
    );
    const haveToRegister = def && !isAlreadyClient;
    if (def) {
      await setSelfAsProtocolClient(protocol, this.commandLineUserData());
    }
    this.mProtocolHandlers[protocol] = callback;
    return haveToRegister;
  };

  private registerRepositoryLookup = (
    repository: string,
    preferOverMD5: boolean,
    func: (id: IModRepoId) => PromiseBB<IModLookupResult[]>,
  ) => {
    this.mRepositoryLookup[repository] = { preferOverMD5, func };
  };

  private registerArchiveHandler = (
    extension: string,
    handler: ArchiveHandlerCreator,
  ) => {
    this.mArchiveHandlers[extension] = handler;
  };

  private deregisterProtocol = async (protocol: string): Promise<void> => {
    log("info", "deregister protocol");
    await removeSelfAsProtocolClient(protocol, this.commandLineUserData());
  };

  private lookupModReference = (
    reference: IModReference,
    options?: ILookupOptions,
  ): PromiseBB<IModLookupResult[]> => {
    if (options === undefined) {
      options = {};
    }

    // Spammy debug log
    // log('debug', 'lookup mod reference', { reference });

    let lookup: {
      preferOverMD5: boolean;
      func: (id: IModRepoId) => PromiseBB<IModLookupResult[]>;
    };
    let preMD5: PromiseBB<IModLookupResult[]> = PromiseBB.resolve([]);
    if (reference.repo !== undefined) {
      lookup = this.mRepositoryLookup[reference.repo.repository];
    }
    if (lookup !== undefined && lookup.preferOverMD5) {
      preMD5 = lookup.func(reference.repo);
    }

    return preMD5
      .then((results: IModLookupResult[]) => {
        if (options.requireURL === true) {
          results = results.filter((res) => truthy(res.value.sourceURI));
        }
        if (results.length !== 0) {
          return results;
        } else {
          return this.getModDB()
            .then((modDB) => modDB.getByReference(reference))
            .filter((mod: ILookupResult) => {
              if (options.requireURL === true) {
                return truthy(mod.value.sourceURI);
              } else {
                return true;
              }
            })
            .map((mod: ILookupResult) => convertMD5Result(mod));
        }
      })
      .then((results: IModLookupResult[]) => {
        if (results.length !== 0) {
          if (reference.logicalFileName !== undefined) {
            const exactMatch = results.filter(
              (iter) =>
                iter.value.logicalFileName !== undefined &&
                iter.value.logicalFileName === reference.logicalFileName,
            );
            if (exactMatch.length > 0) {
              return exactMatch;
            } else {
              return results.sort(
                (lhs, rhs) =>
                  fuzz.ratio(
                    rhs.value.logicalFileName,
                    reference.logicalFileName,
                  ) -
                  fuzz.ratio(
                    lhs.value.logicalFileName,
                    reference.logicalFileName,
                  ),
              );
            }
          } else {
            return results;
          }
        } else {
          if (lookup !== undefined && !lookup.preferOverMD5) {
            return lookup.func(reference.repo);
          } else {
            return [];
          }
        }
      });
  };

  private modLookupId(detail: ILookupDetails): string {
    const san = (input: string) => path.basename(input, path.extname(input));
    const fileName =
      detail.filePath !== undefined
        ? san(detail.filePath)
        : detail.fileName !== undefined
          ? san(detail.fileName)
          : undefined;
    return (
      `${detail.fileMD5}_${fileName}` + `_${detail.fileSize}_${detail.gameId}`
    );
  }

  private lookupModMeta = (
    detail: ILookupDetails,
    ignoreCache?: boolean,
  ): PromiseBB<ILookupResult[]> => {
    if (detail.fileName !== undefined && detail.fileSize === 0) {
      log("error", "trying to calculate hash for an empty file", {
        name: detail.fileName,
        trace: new Error().stack,
      });
      const err = new ProcessCanceled(
        "trying to calculate hash for an empty file",
      );
      err["fileName"] = detail.fileName;
      return PromiseBB.reject(err);
    }
    if (detail.fileMD5 === undefined && detail.filePath === undefined) {
      return PromiseBB.resolve([]);
    }
    let lookupId = this.modLookupId(detail);
    if (this.mModDBCache[lookupId] !== undefined && ignoreCache !== true) {
      return PromiseBB.resolve(this.mModDBCache[lookupId]);
    }
    let fileMD5 = detail.fileMD5;
    let fileSize = detail.fileSize;

    if (fileMD5 === undefined && detail.filePath === undefined) {
      return PromiseBB.resolve([]);
    }

    let promise: PromiseBB<void>;

    if (fileMD5 === undefined) {
      promise = this.genMd5Hash(detail.filePath)
        .then((res: IHashResult) => {
          fileMD5 = res.md5sum;
          fileSize = res.numBytes;
          lookupId = this.modLookupId({
            ...detail,
            fileMD5,
            fileSize,
          });
          this.getApi().events.emit(
            "filehash-calculated",
            detail.filePath,
            fileMD5,
            fileSize,
            detail.gameId,
          );
        })
        .catch((err) => {
          log("info", "failed to calculate hash", {
            path: detail.filePath,
            error: getErrorMessageOrDefault(err),
          });
          return PromiseBB.resolve();
        });
    } else {
      promise = PromiseBB.resolve();
    }
    // lookup id may be updated now
    if (this.mModDBCache[lookupId] !== undefined && ignoreCache !== true) {
      return PromiseBB.resolve(this.mModDBCache[lookupId]);
    }
    return promise
      .then(() => this.getModDB())
      .then((modDB) =>
        fileSize !== 0 && fileMD5 !== undefined
          ? modDB.lookup(undefined, fileMD5, fileSize, detail.gameId)
          : [],
      )
      .then((result: ILookupResult[]) => {
        const resultSorter = this.makeSorter(detail);
        this.mModDBCache[lookupId] = result.sort(resultSorter);
        return PromiseBB.resolve(this.mModDBCache[lookupId]);
      });
  };

  private makeSorter(
    detail: ILookupDetails,
  ): (lhs: ILookupResult, rhs: ILookupResult) => number {
    const fileName =
      detail.filePath !== undefined
        ? path.basename(detail.filePath)
        : undefined;

    const hasAttribute = (
      attribute: string,
      lhs: IModInfo,
      rhs: IModInfo,
      preferredValue?: any,
    ) => {
      if (lhs[attribute] === rhs[attribute]) {
        return 0;
      }

      if (preferredValue === undefined) {
        // if no preferred value was set, ensure it can never match
        preferredValue = Symbol();
      }

      if (!truthy(lhs[attribute]) || rhs[attribute] === preferredValue) {
        return 1;
      } else if (!truthy(rhs[attribute]) || lhs[attribute] === preferredValue) {
        return -1;
      } else {
        return 0;
      }
    };

    const numDetails = (result: IModInfo) => {
      return Object.keys(result.details || {}).length;
    };

    return (lhs: ILookupResult, rhs: ILookupResult) => {
      const lhsV = lhs.value;
      const rhsV = rhs.value;
      // prefer results where the file name matches, otherwise use the one with
      // more details
      return (
        hasAttribute("fileName", lhsV, rhsV, fileName) ||
        hasAttribute("source", lhsV, rhsV, "nexus") ||
        hasAttribute("sourceURI", lhsV, rhsV) ||
        hasAttribute("gameId", lhsV, rhsV) ||
        hasAttribute("fileVersion", lhsV, rhsV) ||
        hasAttribute("logicalFileName", lhsV, rhsV) ||
        numDetails(lhsV) - numDetails(rhsV)
      );
    };
  }

  private saveModMeta = (modInfo: IModInfo): PromiseBB<void> => {
    const lookupId = this.modLookupId({
      fileMD5: modInfo.fileMD5,
      filePath: modInfo.fileName,
      fileSize: modInfo.fileSizeBytes,
      gameId: modInfo.gameId,
    });
    delete this.mModDBCache[lookupId];
    return this.getModDB().then((modDB) => {
      return new PromiseBB<void>((resolve, reject) => {
        modDB.insert([modInfo]);
        resolve();
      });
    });
  };

  private genMd5Hash = (
    data: string | Buffer,
    progressFunc?: (progress: number, total: number) => void,
  ): PromiseBB<IHashResult> => {
    let lastProgress: number = 0;
    const progressHash = (progress: number, total: number) => {
      progressFunc?.(progress, total);
      if (lastProgress !== total) {
        lastProgress = total;
      }
    };
    return toPromise<string>((cb) => fileMD5(data, cb, progressHash)).then(
      (result) => {
        if (lastProgress === 0) {
          // Need to get the size from the file or buffer
          const sizePromise = Buffer.isBuffer(data)
            ? PromiseBB.resolve(data.length)
            : fsVortex
                .statAsync(data)
                .then((stats) => stats.size)
                .catch(() => 0);

          return sizePromise.then((numBytes) => ({
            md5sum: result,
            numBytes,
          }));
        } else {
          return PromiseBB.resolve({
            md5sum: result,
            numBytes: lastProgress,
          });
        }
      },
    );
  };

  private openArchive = (
    archivePath: string,
    options?: IArchiveOptions,
    ext?: string,
  ): PromiseBB<Archive> => {
    if (this.mArchiveHandlers === undefined) {
      // lazy loading the archive handlers
      this.mArchiveHandlers = {};
      this.apply("registerArchiveType", this.registerArchiveHandler);
    }
    if (ext === undefined) {
      ext = path.extname(archivePath).substr(1);
    }
    const creator = this.mArchiveHandlers[ext];
    if (creator === undefined) {
      return PromiseBB.reject(new NotSupportedError());
    }
    return creator(archivePath, options || {}).then(
      (handler: IArchiveHandler) => PromiseBB.resolve(new Archive(handler)),
    );
  };

  private applyStartHooks(input: IRunParameters): PromiseBB<IRunParameters> {
    let updated = input;
    return PromiseBB.each(this.mStartHooks, (hook) =>
      hook
        .hook(updated)
        .then((newParameters: IRunParameters) => {
          updated = newParameters;
        })
        .catch(UserCanceled, (err) => {
          log("debug", "start canceled by user");
          return PromiseBB.reject(err);
        })
        .catch(ProcessCanceled, (err) => {
          log("debug", "hook canceled start", getErrorMessageOrDefault(err));
          return PromiseBB.reject(err);
        })
        .catch((err) => {
          if (err instanceof UserCanceled) {
            log("debug", "start canceled by user");
          } else if (err instanceof ProcessCanceled) {
            log("debug", "hook canceled start", getErrorMessageOrDefault(err));
          } else {
            log("error", "hook failed", err);
          }
          return PromiseBB.reject(err);
        }),
    ).then(() => updated);
  }

  private runExecutable = (
    executable: string,
    args: string[],
    options: IRunOptions,
  ): PromiseBB<void> => {
    if (!truthy(executable)) {
      return PromiseBB.reject(new ProcessCanceled("Executable not set"));
    }
    const interpreter =
      this.mInterpreters[path.extname(executable).toLowerCase()];
    if (interpreter !== undefined) {
      try {
        ({ executable, args, options } = interpreter({
          executable,
          args,
          options,
        }));
      } catch (err) {
        return PromiseBB.reject(err);
      }
    }

    const cwd = options.cwd || path.dirname(executable);

    // Detect if executable is a script file that requires shell: true
    // Common script extensions that need shell interpretation
    const scriptExtensions = [".ps1", ".bat", ".cmd", ".sh", ".bash"];
    const ext = path.extname(executable).toLowerCase();
    const isScript = scriptExtensions.includes(ext);

    // If it's a script and shell isn't explicitly set, enable shell mode
    if (isScript && options.shell === undefined) {
      options.shell = true;
    }

    // process.env is case insensitive (on windows at least?), but the spawn parameter isn't.
    // I think the key is called "Path" on windows but I'm not willing to bet this is consistent
    // across all language variants and versions
    const pathEnvName = Object.keys(process.env).find(
      (key) => key.toLowerCase() === "path",
    );
    const env = {
      ...filteredEnvironment(),
      [pathEnvName]: process.env["PATH_ORIG"] || process.env["PATH"],
      ...options.env,
    };

    // TODO: we might want to be much more restrictive in what keys we allow in environment variables,
    //   based on a quick google I could only find rules for Linux which appears to not allow the equal
    //   sign in keys either (which makes sense).
    //   On windows the empty string is the only thing I found that causes a problem though
    delete env[""];

    return (
      this.applyStartHooks({ executable, args, options })
        .then((updatedParameters) => {
          ({ executable, args, options } = updatedParameters);
          return PromiseBB.resolve();
        })
        .then(
          () =>
            new PromiseBB<void>((resolve, reject) => {
              const runExe = options.shell ? `"${executable}"` : executable;
              const spawnOptions: SpawnOptions = {
                cwd,
                env,
                detached: options.detach !== undefined ? options.detach : true,
                shell: options.shell ?? false,
              };

              try {
                const runParams = {
                  executable,
                  args,
                  options: { ...options, env },
                };
                const vars = this.mToolParameterCBs.reduce((prev, cb) => {
                  return { ...prev, ...cb(runParams) };
                }, {});

                args = args.map((arg) => applyVariables(arg, vars));

                const child = spawn(
                  runExe,
                  options.shell
                    ? args
                    : args.map((arg) => arg.replace(/"/g, "")),
                  spawnOptions,
                );
                if (truthy(child["exitCode"])) {
                  // brilliant, apparently there is no way for me to get at the stdout/stderr when running
                  // through a shell if starting the application fails immediately
                  return reject(
                    new Error(
                      `Failed to start (exit code ${child["exitCode"]})`,
                    ),
                  );
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
                  .on("error", (err) => {
                    reject(err);
                  })
                  .on("close", (code, signal) => {
                    const game = activeGameId(this.mApi.store.getState());
                    if (code === null) {
                      log("warn", "child process terminated by signal", {
                        signal,
                      });
                      if (options.expectSuccess) {
                        const err = new ProcessCanceled(
                          `Process terminated by signal ${signal ?? "unknown"}`,
                        );
                        err["signal"] = signal;
                        reject(err);
                        return;
                      }
                      resolve();
                      return;
                    }
                    if (game === "fallout3" && code === 0xc0000135) {
                      // 0xC0000135 means that a dll couldn't be found.
                      // In the context of FO3 it's commonly xlive or other redistribs are
                      //  not installed.
                      return reject(new MissingDependency());
                    } else if (code === 0xe0434352) {
                      // A .net error, unfortunately we can't now if/how the actual exception
                      // text has been reported
                      log("warn", ".NET error", { stdOut, errOut });
                      if (game === "stardewvalley") {
                        // In the case of SDV the interesting information seems to get printed to stdout
                        return reject(new ThirdPartyError(stdOut || errOut));
                      } else if (errOut) {
                        return reject(new ThirdPartyError(errOut));
                      } else {
                        return reject(new ProcessCanceled(".NET error"));
                      }
                    } else if (code === 0xc000026b) {
                      return reject(
                        new ProcessCanceled("Windows shutting down"),
                      );
                    } else if (code !== 0) {
                      // TODO: the child process returns an exit code of 53 for SSE and
                      // FO4, and an exit code of 1 for Skyrim. We don't know why but it
                      // doesn't seem to affect anything
                      log(
                        "warn",
                        "child process exited with code: " + code.toString(16),
                        {},
                      );
                      if (errOut !== undefined) {
                        log("warn", "child output", errOut.trim());
                      }
                      if (options.expectSuccess) {
                        let lastLine = "<No output>";

                        if (errOut !== undefined) {
                          const lines = errOut.trim().split("\n");
                          lastLine =
                            lines.length > ERROR_OUTPUT_CUTOFF
                              ? lines[lines.length - 1]
                              : lines.join("\n");
                        }

                        // Sanitize the error message to prevent crashpad issues
                        const sanitizedExecutable = executable.replace(
                          /[^\x20-\x7E]/g,
                          "?",
                        );
                        const sanitizedLastLine = lastLine
                          .replace(/[^\x20-\x7E]/g, "?")
                          .substring(0, 500);
                        const exitCodeHex = code.toString(16);

                        const errorMessage = `Failed to run "${sanitizedExecutable}": "${sanitizedLastLine} (${exitCodeHex})"`;
                        const err = new Error(errorMessage);
                        err["exitCode"] = code;
                        reject(err);
                        return;
                      }
                    }
                    resolve();
                  });
                if (child.stderr !== undefined) {
                  child.stderr.on("data", (chunk: Buffer) => {
                    if (errOut === undefined) {
                      errOut = "";
                    }
                    try {
                      errOut += chunk.toString();
                    } catch (err) {
                      log(
                        "warn",
                        "error output from external process couldn't be processed",
                        { executable },
                      );
                    }
                  });
                }
                if (child.stdout !== undefined) {
                  child.stdout.on("data", (chunk: Buffer) => {
                    if (stdOut === undefined) {
                      stdOut = "";
                    }
                    try {
                      stdOut += chunk.toString();
                    } catch (err) {
                      log(
                        "warn",
                        "output from external process couldn't be processed",
                        { executable },
                      );
                    }
                  });
                }
              } catch (err) {
                const code = getErrorCode(err);
                if (code === "EINVAL") {
                  err["attachLogOnReport"] = true;
                  log("error", "Invalid spawn parameters", {
                    runExe,
                    args,
                    options: JSON.stringify(options),
                  });
                }

                return reject(err);
              }
            }),
        )
        .catch(ProcessCanceled, () => null)
        .catch({ code: "EACCES" }, (err) => {
          // Elevated execution is only supported on Windows
          if (process.platform !== "win32") {
            return PromiseBB.reject(err);
          }
          return this.runElevated(
            executable,
            cwd,
            args,
            env,
            options.onSpawned,
          );
        })
        .catch({ code: "ECANCELED" }, () =>
          PromiseBB.reject(new UserCanceled()),
        )
        .catch({ systemCode: 1223 }, () => PromiseBB.reject(new UserCanceled()))
        // Is errno still used ? looks like shellEx call returns systemCode instead
        .catch({ errno: 1223 }, () => PromiseBB.reject(new UserCanceled()))
        .catch((unknownErr) => {
          const err = unknownToError(unknownErr);
          if (
            err.message
              .toLowerCase()
              .indexOf("the operation was canceled by the user") !== -1
          ) {
            // This is more of a sanity check than anything else as one user report
            //  contained none of the properties we rely on to detect when a user
            //  cancels the UAC dialog.
            //  https://github.com/Nexus-Mods/Vortex/issues/8524
            return PromiseBB.reject(new UserCanceled());
          }
          return PromiseBB.reject(err);
        })
    );
  };

  private runElevated(
    executable: string,
    cwd: string,
    args: string[],
    env: { [key: string]: string },
    onSpawned: (pid?: number) => void,
  ) {
    const ipcPath = shortid();
    let tmpFilePath: string;
    return new PromiseBB((resolve, reject) => {
      this.startIPC(ipcPath, (err) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      });

      log("debug", "running elevated", { executable, cwd, args });
      winapi
        .runElevated(ipcPath, runElevatedCustomTool, {
          toolPath: executable,
          toolCWD: cwd,
          parameters: args,
          environment: env,
        })
        .then((tmpPath) => {
          tmpFilePath = tmpPath;
          if (onSpawned !== undefined) {
            onSpawned();
          }
        })
        .catch((err) => reject(err));
    }).finally(() => {
      if (tmpFilePath !== undefined) {
        try {
          fs.unlinkSync(tmpFilePath);
        } catch (err) {
          // nop
        }
      }
    });
  }

  private emitAndAwait = (event: string, ...args: any[]): PromiseBB<any> => {
    let queue = PromiseBB.resolve();
    const results: any[] = [];
    const enqueue = (prom: PromiseBB<any>) => {
      if (prom !== undefined) {
        queue = queue.then(() =>
          prom
            .then((res) => {
              if (res !== undefined && res !== null) {
                results.push(res);
              }
            })
            .catch((err) => {
              this.mApi.showErrorNotification(
                `Unhandled error in event "${event}"`,
                err,
              );
            }),
        );
      }
    };

    this.mEventEmitter.emit(event, ...args, enqueue);

    return queue.then(() => results);
  };

  private onAsync = (
    event: string,
    listener: (...args) => PromiseLike<any>,
    extInfo?: { name: string; official: boolean },
  ) => {
    const effectiveListener = wrapExtCBAsync(listener, extInfo);
    this.mEventEmitter.on(event, (...args: any[]) => {
      const enqueue = args.pop();
      if (enqueue === undefined || typeof enqueue !== "function") {
        // no arguments, this is not an emitAndAwait event!
        this.mApi.showErrorNotification("Invalid event handler", { event });
        if (enqueue !== undefined) {
          args.push(enqueue);
        }
        // call the listener anyway
        const prom = effectiveListener(...args);
        if (prom["catch"] !== undefined) {
          prom["catch"]((err) => {
            this.mApi.showErrorNotification(
              `Failed to call event ${event}`,
              err,
            );
          });
        }
      } else {
        enqueue(effectiveListener(...args));
      }
    });
  };

  private withPrePost = <T>(
    eventName: string,
    cb: (...args: any[]) => PromiseBB<T>,
  ) => {
    return (...args: any[]) => {
      return this.emitAndAwait(`will-${eventName}`, ...args)
        .then(() => cb(...args))
        .then((res: T) =>
          this.emitAndAwait(`did-${eventName}`, res, ...args).then(() => res),
        );
    };
  };

  // tslint:disable-next-line:member-ordering
  private highlightCSS = (() => {
    let highlightCSS: CSSStyleRule;
    let highlightCSSAlt: CSSStyleRule;
    let highlightAfterCSS: CSSStyleRule;
    let highlightBeforeCSSAlt: CSSStyleRule;

    const initCSS = () => {
      if (highlightCSS !== undefined) {
        return;
      }

      highlightCSS = highlightAfterCSS = null;

      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < document.styleSheets.length; ++i) {
        if ((document.styleSheets[i].ownerNode as any).id === "theme") {
          const rules = Array.from((document.styleSheets[i] as any).rules);
          rules.forEach((rule: CSSStyleRule) => {
            if (rule.selectorText === "#highlight-control-dummy") {
              highlightCSS = rule;
            } else if (rule.selectorText === "#highlight-control-dummy-alt") {
              highlightCSSAlt = rule;
            } else if (
              rule.selectorText === "#highlight-control-dummy::after"
            ) {
              highlightAfterCSS = rule;
            } else if (
              rule.selectorText === "#highlight-control-dummy-alt::before"
            ) {
              highlightBeforeCSSAlt = rule;
            }
          });
        }
      }
    };

    return (selector: string, text?: string, altStyle?: boolean) => {
      initCSS();
      let result = "";

      const css = altStyle ? highlightCSSAlt : highlightCSS;
      const afterCSS = highlightAfterCSS;
      const dummySelector = altStyle
        ? "#highlight-control-dummy-alt"
        : "#highlight-control-dummy";

      // adding a new css rule matching the selector when we could just as well add
      // the highlight class to the control.
      // The reason it's done this way is because it's less messy (easier to clean up one css
      // rule instead of every control matched by the selector) and it doesn't interfere with
      // react, which might re-generate every control.
      if (highlightCSS === null) {
        // fallback if template rules weren't found
        result += `${selector} { border: 1px solid var(--brand-danger) !important }\n`;
        if (text !== undefined) {
          result += `${selector}::after { color: var(--brand-danger); content: "${text}" }\n`;
        }
      } else {
        result += css.cssText.replace(dummySelector, selector);
        if (altStyle) {
          result += highlightBeforeCSSAlt.cssText.replace(
            dummySelector,
            selector,
          );
        }
        if (text !== undefined) {
          result += afterCSS.cssText
            .replace("#highlight-control-dummy", selector)
            .replace("__contentPlaceholder", text);
        }
      }

      return result;
    };
  })();

  private highlightControl = (
    selector: string,
    duration: number,
    text?: string,
    altStyle?: boolean,
  ) => {
    const id = shortid();
    const style = document.createElement("style");
    style.id = `highlight_${id}`;
    style.type = "text/css";
    style.innerHTML = this.highlightCSS(selector, text, altStyle);

    const head = document.getElementsByTagName("head")[0];
    const highlightNode = head.appendChild(style);
    setTimeout(() => {
      head.removeChild(highlightNode);
    }, duration);
  };

  private addMetaServer = (id: string, server: modmetaT.IServer) => {
    if (server !== undefined) {
      this.mProgrammaticMetaServers[id] = server;
    } else {
      delete this.mProgrammaticMetaServers[id];
    }
    this.mForceDBReconnect = true;
  };

  private startIPC(ipcPath: string, onFinished: (err: Error) => void) {
    let connected: boolean = false;

    const finish = (err: Error) => {
      server.close();
      onFinished(err);
    };

    const server = net
      .createServer((connRaw) => {
        const conn = new JsonSocket(connRaw);

        log("debug", "ipc client connected");
        connected = true;

        conn
          .on("message", (data) => {
            const { message, payload } = data;
            if (message === "log") {
              // tslint:disable-next-line:no-shadowed-variable
              const { level, message, meta } = payload;
              log(level, message, meta);
            } else if (message === "finished") {
              finish(null);
            }
          })
          .on("error", (err) => {
            log("error", "elevated code reported error", err);
            finish(err);
          });
      })
      .listen(path.join("\\\\?\\pipe", ipcPath));
  }

  private idify(name: string, pathName: string) {
    const transform = (input: string) =>
      input.toLowerCase().replace(/[:']/g, "").replace(/[ _]/g, "-").trim();
    if (name !== undefined) {
      return transform(name);
    } else {
      // assuming the path is based on a nexus archive name, there should be a
      // -<modid>- tag after the actual mod name
      return pathName.split(/-\w+-/)[0];
    }
  }

  private loadDynamicExtension(
    extensionPath: string,
    alreadyLoaded: IRegisteredExtension[],
    bundled: boolean,
  ): IRegisteredExtension {
    const indexPath = this.mExtensionFormats
      .map((format) => path.join(extensionPath, format))
      .find((iter) => fs.existsSync(iter));
    if (indexPath !== undefined) {
      let info: IExtension = {
        name: "",
        author: "",
        description: "",
        version: "",
      };
      try {
        info = JSON.parse(
          fs.readFileSync(path.join(extensionPath, "info.json"), {
            encoding: "utf8",
          }),
        );
      } catch (err) {
        const errorCode = getErrorCode(err);
        const errMessage =
          errorCode === "ENOENT"
            ? "extension has no info.json file"
            : "failed to parse info.json file";

        log("warn", errMessage, {
          extensionPath,
          error: getErrorMessageOrDefault(err),
        });
      }

      const pathName = path.basename(extensionPath);
      const name = info.id || pathName;
      const namespace =
        info.namespace ??
        info.id ??
        (bundled ? pathName : this.idify(info.name, pathName));

      const existing = alreadyLoaded.find((reg) => reg.name === name);

      if (existing) {
        if (semver.gte(info.version, existing.info.version)) {
          this.mOutdated.push(path.basename(existing.path));
        }

        return undefined;
      }

      return {
        name,
        namespace,
        initFunc: () => winapi.dynreq(indexPath).default,
        path: extensionPath,
        dynamic: true,
        info: {
          ...info,
          bundled,
        },
      };
    } else {
      // this is not necessarily a problem, translation extensions for example
      // have no index.js file
      log("debug", "extension directory contains no index.js file", {
        extensionPath,
      });
      return undefined;
    }
  }

  private loadDynamicExtensions(
    extension: { path: string; bundled: boolean },
    loadedExtensions: Set<string>,
    alreadyLoaded: IRegisteredExtension[],
  ): IRegisteredExtension[] {
    if (!fs.existsSync(extension.path)) {
      log(
        "info",
        "failed to load dynamic extensions, path doesn't exist",
        extension.path,
      );
      try {
        fs.mkdirSync(extension.path);
      } catch (err) {
        log("warn", "extension path missing and can't be created", {
          path: extension.path,
          error: getErrorMessageOrDefault(err),
        });
      }
      return [];
    }

    const res = fs
      .readdirSync(extension.path)
      .filter((name) =>
        fs.statSync(path.join(extension.path, name)).isDirectory(),
      )
      .reduce((prev: { [id: string]: IRegisteredExtension }, name: string) => {
        if (!getSafe(this.mExtensionState, [name, "enabled"], true)) {
          log("debug", "extension disabled", { name });
          return prev;
        }
        try {
          // first, mark this extension as loaded. If this is a user extension and there is an
          // extension with the same name in the bundle we could otherwise end up loading the
          // bundled one if this one fails to load which could be convenient but also massively
          // confusing.
          const before = Date.now();
          const ext = this.loadDynamicExtension(
            path.join(extension.path, name),
            alreadyLoaded,
            extension.bundled,
          );
          if (ext !== undefined) {
            if (this.mExtensionState?.[ext.name]?.enabled === false) {
              log("debug", "extension disabled", { name: ext.name });
              return prev;
            }
            loadedExtensions.add(ext.name);
            const loadTime = Date.now() - before;
            log("debug", "loaded extension", {
              name,
              loadTime,
              location: extension.path,
            });
            if (prev[ext.name] !== undefined) {
              // loadDynamicExtension already handles the case where the same extension was found
              // in a different directory, but if the same directory contains multiple copies
              // of the same extension, we have to deal with that slightly differently
              log("warn", "multiple copies of the same extension installed", {
                first: ext.path,
                second: prev[ext.name].path,
              });

              if (
                ext.info === undefined ||
                semver.gt(prev[ext.name].info?.version, ext.info?.version)
              ) {
                // the copy we loaded previously is newer so mark this one for removal and not
                // load it
                this.mOutdated.push(path.basename(ext.path));
              } else {
                // this copy is actually the newer one so replace the one previously found and
                // mark that for deletion
                this.mOutdated.push(path.basename(prev[ext.name].path));
                prev[ext.name] = ext;
              }
            } else {
              prev[ext.name] = ext;
            }
          }
        } catch (unknownError) {
          const err = unknownToError(unknownError);
          log("warn", "failed to load dynamic extension", {
            name,
            error: err.message,
            stack: err.stack,
          });
          this.mLoadFailures[name] = [
            { id: "exception", args: { message: err.message } },
          ];
        }
        return prev;
      }, {});
    return Object.values(res);
  }

  /**
   * retrieves all extensions to the base functionality, both the static
   * and external ones.
   * This loads external extensions from disc synchronously
   *
   * @returns {ExtensionInit[]}
   */
  private prepareExtensions(): IRegisteredExtension[] {
    const staticExtensions = [
      "settings_interface",
      "settings_application",
      "about_dialog",
      "diagnostics_files",
      "dashboard",
      "starter_dashlet",
      "firststeps_dashlet",
      "mod_load_order",
      "file_based_loadorder",
      "mod_management",
      "category_management",
      "collections_integration",
      "profile_management",
      "nexus_integration",
      "download_management",
      "gameversion_management",
      "gamemode_management",
      "announcement_dashlet",
      "symlink_activator",
      "symlink_activator_elevate",
      "hardlink_activator",
      "move_activator",
      "null_activator",
      "updater",
      "instructions_overlay",
      "settings_metaserver",
      "test_runner",
      "extension_manager",
      "ini_prep",
      "news_dashlet",
      "sticky_mods",
      "browser",
      "recovery",
      "file_preview",
      "tool_variables_base",
      "history_management",
      "analytics",
      "onboarding_dashlet",
      "mod_spotlights_dashlet",
      "tailwind_dev",
      "browse_nexus",
      "installer_dotnet",
      "installer_nested_fomod",
      "installer_fomod_shared",
      "installer_fomod_ipc",
      "installer_fomod_native",
    ];

    require("../util/extensionRequire").default(() => this.extensions);

    const extensionPaths = ExtensionManager.getExtensionPaths();
    const loadedExtensions = new Set<string>();
    let dynamicallyLoaded = [];
    return staticExtensions
      .map((name: string) => ({
        name,
        namespace: name,
        path: path.resolve(__dirname, "..", "extensions", name),
        initFunc: () => require(`../extensions/${name}/index`).default,
        dynamic: false,
      }))
      .concat(
        ...extensionPaths.map((extSpec) => {
          const newExtensions = this.loadDynamicExtensions(
            extSpec,
            loadedExtensions,
            dynamicallyLoaded,
          );
          dynamicallyLoaded = dynamicallyLoaded.concat(newExtensions);
          return newExtensions;
        }),
      );
  }
}

export default ExtensionManager;
