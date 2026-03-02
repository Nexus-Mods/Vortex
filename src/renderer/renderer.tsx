// Preload types are declared in renderer/preload.d.ts

if (process.env.DEBUG_REACT_RENDERS === "true") {
  const whyDidYouRender = require("@welldone-software/why-did-you-render");
  whyDidYouRender?.(require("react"), {
    trackAllPureComponents: true,
    trackExtraHooks: [[require("react-redux"), "useSelector"]],
  });
}

// Set up requireRemap first, BEFORE any other requires
// IMPORTANT: Use require() not import, because imports are hoisted to the top
// tslint:disable-next-line:no-var-requires
const requireRemap = require("./util/requireRemap").default;
requireRemap();

const earlyErrHandler = (evt: ErrorEvent) => {
  const error = evt.error as Error | undefined;
  // Use preload API for dialog and app access
  void window.api.dialog.showErrorBox(
    "Unhandled error",
    error?.stack ?? String(evt.error),
  );
  void window.api.app.exit(1);
};

// turn all error logs into a single parameter. The reason is that (at least in production)
// these only get reported by the main process and due to a "bug" only one parameter gets
// relayed.
const oldErr = console.error;
console.error = (...args) => {
  oldErr(args.concat(" ") + "\n" + new Error().stack);
};

window.addEventListener("error", earlyErrHandler);
window.addEventListener("unhandledrejection", earlyErrHandler);

if (process.env.NODE_ENV === "development") {
  process.traceProcessWarnings = true;
  const sourceMapSupport = require("source-map-support");
  sourceMapSupport.install();
} else {
  // webpack will replace every occurrence of process.env.NODE_ENV in its endeavour to eliminate
  // dead code. It doesn't however set the environment variable itself for externals and the
  // replacement means I can't set the actual environment variable directly anymore because
  // "process.env.NODE_ENV = 'production'" would be converted to 'production' = 'production' at
  // build time. So FU very much webpack
  const key = "NODE_ENV";
  process.env[key] = "production";
}

// Produce english error messages (windows only atm), otherwise they don't get
// grouped correctly when reported through our feedback system
import { SetProcessPreferredUILanguages } from "winapi-bindings";
if (SetProcessPreferredUILanguages !== undefined) {
  SetProcessPreferredUILanguages(["en-US"]);
}

import type crashDumpT from "crash-dump";
import type * as I18next from "i18next";

import "./util/application.electron";
import {
  getErrorCode,
  getErrorMessageOrDefault,
  ApplicationData,
} from "@vortex/shared";
import Bluebird from "bluebird";
import { ipcRenderer, webFrame } from "electron";
import { EventEmitter } from "events";
import * as nativeErr from "native-errors";
import { readFile } from "node:fs/promises";
import * as path from "path";
import { DndProvider } from "react-dnd";

import "./util/monkeyPatching";
import { HTML5Backend } from "react-dnd-html5-backend";
import * as ReactDOM from "react-dom";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { applyMiddleware, compose, createStore } from "redux";
import thunkMiddleware from "redux-thunk";
import { generate as shortid } from "shortid";

import type { ThunkStore } from "./types/IExtensionContext";
import type { IState } from "./types/IState";

import { setLanguage, setNetworkConnected } from "./actions";
import {
  setApplicationVersion,
  setInstallType,
  setInstanceId,
  setWarnedAdmin,
} from "./actions/app";
import {
  addNotification,
  setupNotificationSuppression,
} from "./actions/notifications";
import {
  setMaximized,
  setWindowPosition,
  setWindowSize,
} from "./actions/window";
import ExtensionManager from "./ExtensionManager";
import { ExtensionContext } from "./ExtensionProvider";
import { log } from "./logging";
import { initApplicationMenu } from "./menu";
import reducer, { Decision } from "./reducers/index";
import { fetchHydrationState } from "./store/hydration";
import { persistDiffMiddleware } from "./store/persistDiffMiddleware";
import { reduxLogger } from "./store/reduxLogger";
import { reduxSanity, type StateError } from "./store/reduxSanity";
import StyleManager from "./StyleManager";
import { relaunch } from "./util/commandLine";
import { UserCanceled } from "./util/CustomErrors";
import { setOutdated, terminate, toError } from "./util/errorHandling";
import {} from "./util/extensionRequire";
import { setTFunction } from "./util/fs";
import getVortexPath, { setVortexPath } from "./util/getVortexPath";
import GlobalNotifications from "./util/GlobalNotifications";
import getI18n, {
  changeLanguage,
  fallbackTFunc,
  type TFunction,
} from "./util/i18n";
import { showError } from "./util/message";
import { getSafe } from "./util/storeHelper";
import { bytesToString, getAllPropertyNames } from "./util/util";
import { AppLayout } from "./views/AppLayout";
import LoadingScreen from "./views/LoadingScreen";

log("debug", "renderer process started", { pid: process["pid"] });

setVortexPath("temp", () => path.join(getVortexPath("userData"), "temp"));

let deinitCrashDump: () => void;

if (process.env.CRASH_REPORTING === "vortex") {
  void window.api.app.getPath("temp").then((tempPath: string) => {
    const crashDump: typeof crashDumpT = require("crash-dump").default;
    deinitCrashDump = crashDump(
      path.join(tempPath, "dumps", `crash-renderer-${Date.now()}.dmp`),
    );
  });
}

// on windows, inject the native error code into "unknown" errors to help track those down
if (process.platform === "win32") {
  nativeErr.InitHook();
  const oldPrep = Error.prepareStackTrace;
  Error.prepareStackTrace = (error, stack) => {
    if (error["code"] === "UNKNOWN" && error["nativeCode"] === undefined) {
      if (error["systemCode"] !== undefined) {
        error["nativeCode"] = error["systemCode"];
      } else {
        const native = nativeErr.GetLastError();
        error.message = `${native.message} (${native.code})`;
        error["nativeCode"] = native.code;
      }
    }
    return oldPrep !== undefined ? oldPrep(error, stack) : error.stack;
  };
}

// allow promises to be cancelled.
Bluebird.config({
  cancellation: true,
  // long stack traces would be sooo nice but the performance cost in some places is ridiculous
  longStackTraces: false,
});

// set up store. State is persisted via persistDiffMiddleware which
// sends diffs to the main process for storage

const middleware = [
  thunkMiddleware,
  reduxSanity(sanityCheckCB),
  persistDiffMiddleware,
  reduxLogger(),
];

function sanityCheckCB(err: StateError) {
  err["attachLogOnReport"] = true;
  showError(
    store.dispatch,
    "An invalid state change was prevented, this was probably caused by a bug",
    err,
  );
}

let store: ThunkStore<IState>;

const terminateFromError = (error: any, allowReport?: boolean) => {
  log("warn", "about to report an error", { stack: new Error().stack });
  terminate(
    toError(error),
    store !== undefined ? store.getState() : {},
    allowReport,
  );
};

function errorHandler(evt: any) {
  const error =
    evt.reason ||
    evt.error ||
    (evt.detail !== undefined ? evt.detail.reason : undefined) ||
    evt.message;

  if (error instanceof UserCanceled) {
    return;
  }

  if (error === undefined || getAllPropertyNames(error).length === 0) {
    log("error", "empty error object ignored", {
      wasPromise: evt.promise !== undefined,
    });
    return;
  }

  if (typeof error === "string") {
    if (error === "Script error.") {
      // this is bad. It happens within electron/chrome when an exception is thrown in javascript.
      // unfortunately it's impossible based on this error to figure out what the cause was, though
      // it's almost certainly some callback invoked from a native library
      log("error", "script error");
      return;
    } else if (error === "ResizeObserver loop limit exceeded") {
      // this error was called "benign" by one of the spec authors. I'll take their word for it.
      return;
    }
  }

  if (error.name === "EvalError") {
    // seems to happen only when using the chrome inspector when using certain debug tools
    return;
  }

  if (
    error.name === "TypeError" &&
    error.message === "Cannot read property 'forEach' of undefined"
  ) {
    // seems to be a completely electron-internal error where the webview receives an event
    // that it's not equipped to handle.
    return;
  }

  if (error.name === "Invariant Violation") {
    // these may not get caught, even when we have an ErrorBoundary, if the exception happens
    // in some callback. Unfortunately this also makes these errors almost impossible to find,
    // the code-stack is pointless (it's only react interna) and the component-stack gets
    // stripped in production builds.
    log("error", "react invariant violation", {
      error: error.message,
      stack: error.stack,
    });
    return;
  }

  if (error.message === "Array buffer allocation failed") {
    terminateFromError(
      {
        message:
          "Your system has run out of memory. " +
          "This only happens if both your physical and virtual memory have run out",
        stack: error.stack,
      },
      false,
    );
    return;
  }

  if (error.message === "Cannot read property '0' of null") {
    // This is caused by cytoscape in their mouse-move/dragging handler if the user manages
    // to get a mouse-down event in before the cytoscape graph is shown because then the initial
    // location is unset.
    // I don't see how we could do anything about that but it also shouldn't be a biggy if we
    // ignore this
    return;
  }

  if (
    error.message === "Cannot read property 'focus' of null" ||
    error.message === "Cannot read properties of null (reading 'focus')"
  ) {
    // Caused by the react-overlays Modal.restoreLastFocus function but it's unclear how this can
    // happen because the function contains a check specifically to prevent this error.
    return;
  }

  if (error.stack.includes("packery")) {
    // seems to be caused by an event triggered inside packery after cleanup so I don't see
    // a way to catch this cleanly
    return;
  }

  if (error.stack.includes("react-sortable-tree")) {
    // bug in external library. I know where the bug is but fixing that causes a new problem and
    // i just don't want to pull that thread.
    // To elaborate: there is no logic in react-sortable-tree to stop users
    //   from moving a node into one of its own decendents and completely destroying its data
    //   structure but there is an unhandled exception happening _before_ the data gets corrupted
    //   so if we _did_ handle it, things get worse.
    //   Solid...
    return;
  }

  const dynPaths = ExtensionManager.getExtensionPaths().filter(
    (extPath) => !extPath.bundled,
  );

  if (dynPaths.length > 0) {
    if (error.stack.includes(`at ${dynPaths[0].path}`)) {
      const extPath = (dynPaths[0].path + path.sep).replace(/[\\]/g, "\\\\");
      const re = new RegExp(
        `at ${extPath}(Vortex Extension Update - )?([^/\\\\]*)`,
      );
      const reMatch = error.stack.match(re);
      const extName = reMatch?.[2] ?? "unknown";

      error["extension"] = extName;

      log("error", "extension caused an unhandled exception", {
        name: extName,
        error: error.stack,
      });
      extensions
        ?.getApi()
        ?.showErrorNotification?.("Unhandled exception in extension", error, {
          message: extName,
          allowReport: false,
        });
      return;
    }
  }

  if (
    error.message === "Cannot read property 'parentNode' of undefined" ||
    error.message ===
      "Cannot read properties of undefined (reading 'parentNode')"
  ) {
    // thrown by packery - seemingly at random
    return;
  }

  if (error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    log("error", "invalid leaf signature", error.message);
    return;
  } else if (
    error.code === "ERR_SSL_WRONG_VERSION_NUMBER" ||
    error.function === "OPENSSL_internal"
  ) {
    log("warn", "internal ssl error", error.message);
    return;
  }

  if (
    error.stack !== undefined &&
    error.stack.includes("finishClassComponent")
  ) {
    // don't report errors from react components because they will be handled (usually),
    // for some reason the "unhandled" callback is invoked before reacts componentDidCatch
    // handler.
    return;
  }

  if (
    error.stack !== undefined &&
    // some exceptions from foreign libraries can't be caught so we have to ignore them
    // the main offender here is electron-builder. Unfortunately newer versions that may
    // have fixed this have even more significant bugs.
    (error.message === "socket hang up" ||
      (error.message !== undefined &&
        error.message.includes("Error invoking remote method")) ||
      error.stack.indexOf("net::ERR_CONNECTION_RESET") !== -1 ||
      error.stack.indexOf("net::ERR_ABORTED") !== -1 ||
      error.stack.indexOf("PackeryItem.proto.positionDropPlaceholder") !== -1 ||
      (error.syscall === "getaddrinfo" && error.code === "ENOTFOUND") ||
      [
        "ETIMEDOUT",
        "ECONNRESET",
        "EPIPE",
        "ECONNABORTED",
        "ECONNREFUSED",
        "EHOSTUNREACH",
      ].includes(error.code))
  ) {
    log("warn", "suppressing error message", {
      message: error.message,
      stack: error.stack,
    });
    // bit of a hack: The main process checks the console log during startup and if an error
    // is reported and the main window not presented within a certain time, it will relay the
    // error and quit.
    // By logging this error here we ensure that even a suppressed error will be reported to
    // user _if_ it managed to prevent the application start. Of course it would be nicer
    // if there was a proper api for that but it's quite the fringe case I think
    console.error(error.stack);
    return true;
  } else {
    terminateFromError(error);
  }
}

window.addEventListener("error", errorHandler);
window.addEventListener("unhandledrejection", errorHandler);
window.removeEventListener("error", earlyErrHandler);
window.removeEventListener("unhandledrejection", earlyErrHandler);
window.addEventListener("close", () => {
  if (deinitCrashDump !== undefined) {
    deinitCrashDump();
  }
});

const eventEmitter: NodeJS.EventEmitter = new EventEmitter();

let enhancer = null;

if (process.env.NODE_ENV === "development") {
  const freeze = require("redux-freeze");
  const devtool = window["__REDUX_DEVTOOLS_EXTENSION__"]?.({
    shouldRecordChanges: false,
    autoPause: true,
    shouldHotReload: false,
  });
  enhancer = compose(
    applyMiddleware(...middleware, freeze),
    devtool || ((id) => id),
  );
} else {
  enhancer = compose(applyMiddleware(...middleware));
}

const tFunc: TFunction = fallbackTFunc;
let startupFinished: () => void;
let extensions: ExtensionManager;

async function initGlobals(): Promise<void> {
  // Initialize application data asynchronously from main process cache
  // This replaces synchronous IPC calls that were in the preload script
  await ApplicationData.init();
}

async function init(): Promise<ExtensionManager | null> {
  await StyleManager.renderDefault();

  // Fetch hydration data from main process (persisted state)
  log("debug", "fetching hydration data from main process");
  const hydratedState: Partial<IState> = await fetchHydrationState();
  log("debug", "hydration data received", {
    hives: Object.keys(hydratedState),
  });

  // Get extension state from hydrated app state for ExtensionManager
  const extensionState = hydratedState?.app?.extensions ?? {};

  // Extension manager initialized with extension state from hydration
  extensions = new ExtensionManager(extensionState, eventEmitter);
  if (extensions.hasOutdatedExtensions) {
    // we should *not* get here, the main process should never have started the renderer
    // if there are outdated extensions
    log("warn", "outdated extensions discovered in renderer");
    relaunch();
    return null;
  }

  const extReducers = extensions.getReducers();

  const reportReducerError = (err) =>
    extensions
      .getApi()
      .showErrorNotification("Failed to update application state", err);

  // Create store WITHOUT preloaded state - reducers will initialize with defaults
  // Then we dispatch __hydrate to merge persisted data with defaults
  store = createStore(
    reducer(extReducers, () => Decision.QUIT, reportReducerError),
    enhancer,
  );

  // Hydrate each hive by dispatching __hydrate action
  // This merges persisted data with reducer defaults (like the old architecture)
  for (const hive of Object.keys(hydratedState)) {
    store.dispatch({
      type: "__hydrate",
      payload: { [hive]: hydratedState[hive] },
    });
  }

  // Set up window event handlers from main process
  if (window.api?.window) {
    window.api.window.onResized((width, height) => {
      store.dispatch(setWindowSize({ width, height }));
    });
    window.api.window.onMoved((x, y) => {
      store.dispatch(setWindowPosition({ x, y }));
    });
    window.api.window.onMaximized((maximized) => {
      store.dispatch(setMaximized(maximized));
    });
  }

  // Set up app initialization handler from main process
  if (window.api?.app) {
    window.api.app.onInit((metadata) => {
      log("debug", "received app:init metadata from main", metadata);
      if (metadata.version) {
        store.dispatch(setApplicationVersion(metadata.version));
      }
      if (metadata.installType) {
        store.dispatch(setInstallType(metadata.installType));
      }
      if (metadata.instanceId) {
        store.dispatch(setInstanceId(metadata.instanceId));
      }
      if (metadata.warnedAdmin !== undefined) {
        store.dispatch(setWarnedAdmin(metadata.warnedAdmin));
      }
    });
  }

  extensions.setStore(store);
  setOutdated(extensions.getApi());
  extensions.applyExtensionsOfExtensions();
  log("debug", "renderer connected to store");

  // Initialize main process extensions
  const installType = store.getState().app?.installType ?? "official";
  window.api.extensions.initializeAllMain(installType);
  log("debug", "main process extensions initialization triggered", {
    installType,
  });

  setupNotificationSuppression((id) => {
    const state = store.getState();
    return getSafe(state.settings.notifications, ["suppress", id], false);
  });

  let lastHeapSize = 0;
  const REPORT_HEAP_INCREASE = 100 * 1024;
  let highUsageReport = false;
  setInterval(() => {
    const stat = process.getHeapStatistics();
    const heapPerc = stat.totalHeapSize / stat.heapSizeLimit;
    if (heapPerc > 0.75 && !highUsageReport) {
      extensions.getApi().sendNotification({
        id: "high-memory-usage",
        type: "warning",
        title: "Vortex is using a lot of memory and may crash",
        message: bytesToString(stat.totalHeapSize * 1024),
      });
      log("warn", "High memory usage", {
        usage: stat.totalHeapSize,
        max: stat.heapSizeLimit,
      });
    }
    highUsageReport = heapPerc > 0.75;
    if (
      lastHeapSize > 0 &&
      stat.totalHeapSize - lastHeapSize > REPORT_HEAP_INCREASE
    ) {
      log("info", "memory usage growing fast", {
        usage: bytesToString(stat.totalHeapSize * 1024),
        previous: bytesToString(lastHeapSize * 1024),
        max: bytesToString(stat.heapSizeLimit * 1024),
      });
    }
    lastHeapSize = stat.totalHeapSize;
  }, 5000);

  const startupPromise = new Promise<void>(
    (resolve) => (startupFinished = resolve),
  );

  const api = extensions.getApi();

  // NOTE(erri120): has side-effects
  const _globalNotifications = new GlobalNotifications(api);

  async function startinstallFromArchive(filePath: string): Promise<void> {
    await startupPromise;
    if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
      return;
    }

    api.events.emit("import-downloads", [filePath], (dlIds: string[]) => {
      dlIds.forEach((dlId) => {
        api.events.emit("start-install-download", dlId);
      });
    });
  }

  async function startDownloadFromURL(
    url: string,
    _fileName?: string,
    install?: boolean,
  ): Promise<void> {
    await startupPromise;
    if (typeof url !== "string") {
      return;
    }

    const protocol = url.split(":")[0];

    const handler = extensions.getProtocolHandler(protocol);
    if (handler !== null) {
      log("info", "handling url", { url });
      handler(url, install);
    } else {
      store.dispatch(
        addNotification({
          type: "info",
          message: tFunc(
            "Vortex isn't set up to handle this protocol: {{url}}",
            {
              replace: { url },
            },
          ),
        }),
      );
    }
  }

  eventEmitter.on(
    "start-download-url",
    (url: string, fileName?: string, install?: boolean) => {
      startDownloadFromURL(url, fileName, install);
    },
  );

  eventEmitter.on("relaunch-application", (gameId: string) => {
    relaunch(["--game", gameId]);
  });

  ipcRenderer.on(
    "external-url",
    (event, url: string, fileName?: string, install?: boolean) => {
      startDownloadFromURL(url, fileName, install);
    },
  );

  ipcRenderer.on("install-archive", (event, filePath: string) => {
    startinstallFromArchive(filePath);
  });

  ipcRenderer.on("relay-event", (sender, event, ...args) => {
    eventEmitter.emit(event, ...args);
  });

  ipcRenderer.on("relay-event-with-cb", (sender, event, ...args) => {
    const id = args[args.length - 1];
    const cb = (...cbArgs) => {
      const newCBArgs = cbArgs.map((arg) => {
        if (!(arg instanceof Bluebird)) {
          return arg;
        }
        const promId = shortid();
        arg
          .then((res) => {
            ipcRenderer.send("relay-cb-resolve", promId, res);
          })
          .catch((err) => {
            ipcRenderer.send("relay-cb-reject", promId, err);
          });
        return { __promise: promId };
      });
      ipcRenderer.send("relay-cb", id, ...newCBArgs);
    };
    const newArgs = [].concat(args.slice(0, args.length - 1), cb);
    eventEmitter.emit(event, ...newArgs);
  });

  ipcRenderer.on("register-relay-listener", (sender, event, ...noArgs) => {
    eventEmitter.on(event, (...args) =>
      ipcRenderer.send("relay-event", event, ...args),
    );
  });

  let currentLanguage: string = store.getState().settings.interface.language;
  store.subscribe(() => {
    const newLanguage: string = store.getState().settings.interface.language;
    if (newLanguage !== currentLanguage) {
      try {
        new Date().toLocaleString(newLanguage);
      } catch (err) {
        store.dispatch(setLanguage(currentLanguage));
        log("warn", "Attempt to set invalid language", newLanguage);
        return;
      }
      currentLanguage = newLanguage;

      changeLanguage(newLanguage, (err: Error) => {
        if (err !== undefined) {
          if (Array.isArray(err)) {
            // don't show ENOENT errors because it shouldn't really matter
            const filtErr = err.filter((iter) => iter.code !== "ENOENT");
            if (filtErr.length > 0) {
              showError(store.dispatch, "failed to activate language", err, {
                allowReport: false,
              });
            }
          } else {
            showError(store.dispatch, "failed to activate language", err, {
              allowReport: false,
            });
          }
        }
      });
    }
  });

  return extensions;
}

async function load(extensions: ExtensionManager): Promise<void> {
  const { i18n, tFunc, error } = await Promise.resolve(
    getI18n("en", () => {
      const state = store.getState();
      return Object.values(state.session.extensions.installed).filter(
        (ext) => ext.type === "translation",
      );
    }),
  );

  if (error) {
    showError(store.dispatch, "failed to initialize localization", error, {
      allowReport: false,
    });
  }

  setTFunction(tFunc);

  const dynamicExts = extensions.extensions
    .filter((ext) => ext.dynamic)
    .map((ext) => ({
      name: ext.namespace,
      path: ext.path,
    }));

  await Promise.all(
    dynamicExts.map(async (ext) => {
      const filePath = path.join(ext.path, "language.json");

      try {
        const fileData = await readFile(filePath, "utf-8");
        i18n.addResources("en", ext.name, JSON.parse(fileData));
      } catch (err) {
        const code = getErrorCode(err);

        // an extension not providing a locale file is ok
        if (code === "ENOENT") return;

        log("error", "Failed to load translation", {
          filePath,
          error: getErrorMessageOrDefault(err),
        });
      }
    }),
  );

  extensions.setTranslation(i18n);
  await Promise.resolve(extensions.doOnce());

  log("info", "activating language", {
    lang: store.getState().settings.interface.language,
  });
  await changeLanguage(store.getState().settings.interface.language);

  extensions.setUIReady();
  log("debug", "render with language", { language: i18n.language });
  const refresh = initApplicationMenu(extensions);
  extensions.getApi().events.on("gamemode-activated", () => refresh());
  startupFinished();
  eventEmitter.emit("startup");
  // render the page content
  ReactDOM.render(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <I18nextProvider i18n={i18n}>
          <ExtensionContext.Provider value={extensions}>
            <AppLayout className="full-height" />
          </ExtensionContext.Provider>
        </I18nextProvider>
      </DndProvider>
    </Provider>,
    document.getElementById("content"),
  );
}

function renderer(extensions: ExtensionManager | null) {
  if (!extensions) {
    return;
  }

  webFrame.setZoomFactor(
    getSafe(store.getState(), ["settings", "window", "zoomFactor"], 1),
  );

  ReactDOM.render(
    <LoadingScreen extensions={extensions} />,
    document.getElementById("content"),
  );
  ipcRenderer.send("show-window");

  store.dispatch(setNetworkConnected(navigator.onLine));
  window.addEventListener("online", () => {
    store.dispatch(setNetworkConnected(true));
  });
  window.addEventListener("offline", () => {
    store.dispatch(setNetworkConnected(false));
  });

  // prevent the page from being changed through drag&drop
  document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault();
  };

  load(extensions).catch((err) =>
    log("error", "error setting up renderer", err),
  );
}

initGlobals()
  .then(() => init())
  .then((extensions) => renderer(extensions))
  .catch((err) => log("error", "error setting up renderer", err));
