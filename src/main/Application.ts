import type * as msgpackT from "@msgpack/msgpack";
import type crashDumpT from "crash-dump";
import type {
  crashReporter as crashReporterT,
  OpenDialogOptions,
  IpcMainInvokeEvent,
  IpcMainEvent,
  JumpListCategory,
  SaveDialogOptions,
  Settings,
  TraceConfig,
  TraceCategoriesAndOptions,
} from "electron";
import type * as permissionsT from "permissions";
import type * as uuidT from "uuid";
import type * as winapiT from "winapi-bindings";

import PromiseBB from "bluebird";
import {
  app,
  BrowserView,
  BrowserWindow,
  contentTracing,
  clipboard,
  dialog,
  ipcMain,
  protocol,
  shell,
  Menu,
} from "electron";
import contextMenu from "electron-context-menu";
import isAdmin from "is-admin";
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";
import * as semver from "semver";

import type { StateError } from "../store/reduxSanity";
import type { ThunkStore } from "../types/IExtensionContext";
import type { IPresetStep, IPresetStepHydrateState } from "../types/IPreset";
import type { IState } from "../types/IState";
import type { IParameters, ISetItem } from "../util/commandLine";
import type * as develT from "../util/devel";
import type ExtensionManagerT from "../util/ExtensionManager";
import type MainWindowT from "./MainWindow";
import type SplashScreenT from "./SplashScreen";
import type TrayIconT from "./TrayIcon";

import { addNotification, setCommandLine, showDialog } from "../actions";
import {
  setApplicationVersion,
  setInstallType,
  setInstanceId,
  setWarnedAdmin,
} from "../actions/app";
import { NEXUS_DOMAIN } from "../extensions/nexus_integration/constants";
import { STATE_BACKUP_PATH } from "../reducers/index";
import {
  getErrorCode,
  getErrorMessageOrDefault,
  unknownToError,
} from "../shared/errors";
import LevelPersist, { DatabaseLocked } from "../store/LevelPersist";
import {
  allHives,
  createFullStateBackup,
  createVortexStore,
  currentStatePath,
  extendStore,
  finalizeStoreWrite,
  importState,
  insertPersistor,
  markImported,
  querySanitize,
} from "../store/store";
import SubPersistor from "../store/SubPersistor";
import { getApplication } from "../util/application";
import commandLine, { relaunch } from "../util/commandLine";
import {
  DataInvalid,
  DocumentsPathMissing,
  ProcessCanceled,
  UserCanceled,
} from "../util/CustomErrors";
import {
  didIgnoreError,
  disableErrorReport,
  getVisibleWindow,
  setOutdated,
  setWindow,
  terminate,
  toError,
} from "../util/errorHandling";
import { validateFiles } from "../util/fileValidation";
import * as fs from "../util/fs";
import type { AppPath } from "../util/getVortexPath";

import getVortexPath, { setVortexPath } from "../util/getVortexPath";
import lazyRequire from "../util/lazyRequire";
import { log, setLogPath, setupLogging } from "../util/log";
import { prettifyNodeErrorMessage, showError } from "../util/message";
import migrate from "../util/migrate";
import presetManager from "../util/PresetManager";
import startupSettings from "../util/startupSettings";
import {} from "../util/storeHelper";
import {
  isMajorDowngrade,
  replaceRecursive,
  spawnSelf,
  timeout,
} from "../util/util";
import { betterIpcMain } from "./ipc";

// Type-safe interface for global Redux state accessors
interface GlobalWithRedux {
  getReduxState?: () => unknown;
  getReduxStateMsgpack?: (idx: number) => string;
}

const uuid = lazyRequire<typeof uuidT>(() => require("uuid"));
const permissions = lazyRequire<typeof permissionsT>(() =>
  require("permissions"),
);
const winapi = lazyRequire<typeof winapiT>(() => require("winapi-bindings"));

const STATE_CHUNK_SIZE = 128 * 1024;

// TODO: remove this once extension manager separation is complete
function last<T>(array: T[]): T | undefined {
  if (array.length === 0) {
    return undefined;
  }
  return array[array.length - 1];
}

class Application {
  public static shouldIgnoreError(error: unknown, promise?: unknown): boolean {
    const err = unknownToError(error);
    if (err instanceof UserCanceled) {
      return true;
    }

    if (!err) {
      log("error", "empty error unhandled", {
        wasPromise: promise !== undefined,
      });
      return true;
    }

    if (err.message === "Object has been destroyed") {
      // This happens when Vortex crashed because of something else so there is no point
      // reporting this, it might otherwise obfuscate the actual problem
      return true;
    }

    // this error message appears to happen as the result of some other problem crashing the
    // renderer process, so all this may do is obfuscate what's actually going on.
    if (
      err.message.includes(
        "Error processing argument at index 0, conversion failure from",
      )
    ) {
      return true;
    }

    const code = getErrorCode(err);
    if (
      [
        "net::ERR_CONNECTION_RESET",
        "net::ERR_CONNECTION_ABORTED",
        "net::ERR_ABORTED",
        "net::ERR_CONTENT_LENGTH_MISMATCH",
        "net::ERR_SSL_PROTOCOL_ERROR",
        "net::ERR_HTTP2_PROTOCOL_ERROR",
        "net::ERR_INCOMPLETE_CHUNKED_ENCODING",
      ].includes(err.message) ||
      ["ETIMEDOUT", "ECONNRESET", "EPIPE"].includes(code)
    ) {
      log("warn", "network error unhandled", err.stack);
      return true;
    }

    // We used to handle err.errno here (incorrectly)
    //  e.g. ['EPERM', 'EACCES'].includes(err.errno)
    // but errno is a number, not a string.

    return false;
  }

  private mBasePath: string;
  private mStore: ThunkStore<IState>;
  private mLevelPersistors: LevelPersist[] = [];
  private mArgs: IParameters;
  private mMainWindow: MainWindowT;
  private mExtensions: ExtensionManagerT;
  private mTray: TrayIconT;
  private mFirstStart: boolean = false;
  private mStartupLogPath: string;
  private mDeinitCrashDump: () => void;

  constructor(args: IParameters) {
    this.mArgs = args;

    ipcMain.on("show-window", () => this.showMainWindow(args?.startMinimized));
    app.commandLine.appendSwitch(
      "js-flags",
      `--max-old-space-size=${args.maxMemory || 4096}`,
    );

    this.mBasePath = app.getPath("userData");
    fs.ensureDirSync(this.mBasePath);

    setVortexPath("temp", () => path.join(getVortexPath("userData"), "temp"));
    const tempPath = getVortexPath("temp");
    fs.ensureDirSync(path.join(tempPath, "dumps"));

    this.mStartupLogPath = path.join(tempPath, "startup.log");
    try {
      fs.statSync(this.mStartupLogPath);
      process.env.CRASH_REPORTING = Math.random() > 0.5 ? "vortex" : "electron";
    } catch (err) {
      // nop, this is the expected case
    }

    if (process.env.CRASH_REPORTING === "electron") {
      const crashReporter: typeof crashReporterT =
        require("electron").crashReporter;
      crashReporter.start({
        productName: "Vortex",
        uploadToServer: false,
        submitURL: "",
      });
      app.setPath("crashDumps", path.join(tempPath, "dumps"));
    } else if (process.env.CRASH_REPORTING === "vortex") {
      const crashDump: typeof crashDumpT = require("crash-dump").default;
      this.mDeinitCrashDump = crashDump(
        path.join(tempPath, "dumps", `crash-main-${Date.now()}.dmp`),
      );
    }

    setupLogging(
      app.getPath("userData"),
      process.env.NODE_ENV === "development",
    );
    this.setupAppEvents(args);
  }

  private setupContextMenu() {
    contextMenu({
      showCopyImage: false,
      showLookUpSelection: false,
      showSaveImageAs: false,
      showInspectElement: false,
      showSearchWithGoogle: false,
      shouldShowMenu: (
        event: Electron.Event,
        params: Electron.ContextMenuParams,
      ) => {
        // currently only offer menu on selected text
        return params.selectionText.length > 0;
      },
    });
  }

  private startUi(): PromiseBB<void> {
    const MainWindow = require("./MainWindow").default;
    this.mMainWindow = new MainWindow(this.mStore, this.mArgs.inspector);
    log("debug", "creating main window");
    return this.mMainWindow.create(this.mStore).then((webContents) => {
      if (!webContents) {
        return PromiseBB.reject(new Error("no web contents from main window"));
      }
      log("debug", "window created");
      this.mExtensions.setupApiMain(this.mStore, webContents);
      setOutdated(this.mExtensions.getApi());
      // in the past we would process some command line arguments the same as we do when
      // they get passed in from a second instance but that was inconsistent
      // because we don't use most arguments from secondary instances and the
      // rest get handled by the extension they are intended for.
      // so now "applyArguments()" is only intended for forwarding messages from
      // secondary instances

      if (didIgnoreError()) {
        webContents.send("did-ignore-error", true);
      }
      return PromiseBB.resolve();
    });
  }

  private startSplash(): PromiseBB<SplashScreenT> {
    const SplashScreen = require("./SplashScreen").default;
    const splash: SplashScreenT = new SplashScreen();
    return splash.create(this.mArgs.disableGPU).then(() => {
      setWindow(splash.getHandle());
      return splash;
    });
  }

  private setupAppEvents(args: IParameters) {
    app.on("window-all-closed", () => {
      log("info", "Vortex closing");
      finalizeStoreWrite().then(() => {
        log("info", "clean application end");
        if (this.mTray !== undefined) {
          this.mTray.close();
        }
        if (this.mDeinitCrashDump !== undefined) {
          this.mDeinitCrashDump();
        }
        if (process.platform !== "darwin") {
          app.quit();
        }
      });
    });

    app.on("activate", () => {
      if (this.mMainWindow !== undefined) {
        this.mMainWindow.create(this.mStore);
      }
    });

    app.on("second-instance", (event: Event, secondaryArgv: string[]) => {
      log("debug", "getting arguments from second instance", secondaryArgv);
      this.applyArguments(commandLine(secondaryArgv, true));
    });

    app.whenReady().then(() => {
      const vortexPath =
        process.env.NODE_ENV === "development" ? "vortex_devel" : "vortex";

      // if userData specified, use it
      let userData =
        args.userData ??
        // (only on windows) use ProgramData from environment
        (args.shared &&
        process.platform === "win32" &&
        process.env.ProgramData !== undefined
          ? path.join(process.env.ProgramData, "vortex")
          : // this allows the development build to access data from the
            // production version and vice versa
            path.resolve(app.getPath("userData"), "..", vortexPath));
      userData = path.join(userData, currentStatePath);

      // handle nxm:// internally
      protocol.registerHttpProtocol("nxm", (request, callback) => {
        const cfgFile: IParameters = { download: request.url };
        this.applyArguments(cfgFile);
      });

      let startupMode: PromiseBB<void> | undefined = undefined;
      if (args.get) {
        startupMode = this.handleGet(args.get, userData);
      } else if (args.set) {
        startupMode = this.handleSet(args.set, userData);
      } else if (args.del) {
        startupMode = this.handleDel(args.del, userData);
      }
      if (startupMode !== undefined) {
        startupMode.then(() => {
          app.quit();
        });
      } else {
        this.regularStart(args);
      }
    });

    app.on(
      "web-contents-created",
      (event: Electron.Event, contents: Electron.WebContents) => {
        contents.on("will-attach-webview", this.attachWebView);
      },
    );

    // Default open or close DevTools by F12 in development
    if (process.env.NODE_ENV === "development") {
      app.on("browser-window-created", (_, window) => {
        const { webContents } = window;
        webContents.on("before-input-event", (_, input) => {
          if (input.type !== "keyDown") return;
          if (input.code !== "F12") return;
          webContents.toggleDevTools();
        });
      });
    }
  }

  private attachWebView = (
    event: Electron.Event,
    webPreferences: Electron.WebPreferences & { preloadURL?: string },
    params,
  ) => {
    // disallow creation of insecure webviews

    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    webPreferences.nodeIntegration = false;
  };

  private genHandleError() {
    return (error: unknown, promise?: unknown) => {
      if (Application.shouldIgnoreError(error, promise)) {
        return;
      }

      terminate(toError(error), this.mStore.getState());
    };
  }

  private regularStart(args: IParameters): PromiseBB<void> {
    let splash: SplashScreenT | undefined;
    return (
      fs
        .writeFileAsync(this.mStartupLogPath, new Date().toUTCString())
        .catch(() => null)
        .tap(() => {
          log("info", "--------------------------");
          log("info", "Vortex Version", getApplication().version);
          log("info", "Parameters", process.argv.join(" "));
        })
        .then(() => this.testUserEnvironment())
        .then(() => this.validateFiles())
        .then(() =>
          args?.startMinimized === true
            ? PromiseBB.resolve(undefined)
            : this.startSplash(),
        )
        // start initialization
        .tap((splashIn) =>
          splashIn !== undefined
            ? log("debug", "showing splash screen")
            : log("debug", "starting without splash screen"),
        )
        .then((splashIn) => {
          splash = splashIn;
          return this.createStore(args.restore, args.merge).catch(
            DataInvalid,
            (err) => {
              log("error", "store data invalid", getErrorMessageOrDefault(err));
              dialog
                .showMessageBox(getVisibleWindow(), {
                  type: "error",
                  buttons: ["Continue"],
                  title: "Error",
                  message: "Data corrupted",
                  detail:
                    "The application state which contains things like your Vortex " +
                    "settings, meta data about mods and other important data is " +
                    "corrupted and can't be read. This could be a result of " +
                    "hard disk corruption, a power outage or something similar. " +
                    "Vortex will now try to repair the database, usually this " +
                    "should work fine but please check that settings, mod list and so " +
                    "on are ok before you deploy anything. " +
                    "If not, you can go to settings->workarounds and restore a backup " +
                    "which shouldn't lose you more than an hour of progress.",
                })
                .then(() => this.createStore(args.restore, args.merge, true));
            },
          );
        })
        .tap(() => log("debug", "checking admin rights"))
        .then(() => this.warnAdmin())
        .tap(() => log("debug", "checking how Vortex was installed"))
        .then(() => this.identifyInstallType())
        .tap(() => log("debug", "checking if migration is required"))
        .then(() => this.checkUpgrade())
        .tap(() => log("debug", "setting up error handlers"))
        .then(() => {
          // as soon as we have a store, install an extended error handler that has
          // access to application state
          const handleError = this.genHandleError();
          process.removeAllListeners("uncaughtException");
          process.removeAllListeners("unhandledRejection");
          process.on("uncaughtException", handleError);
          process.on("unhandledRejection", handleError);
        })
        .then(() => {
          this.mStore.dispatch(setCommandLine(args));
        })
        .then(() => this.initDevel())
        .tap(() => log("debug", "starting user interface"))
        .then(() => {
          this.setupContextMenu();
          return PromiseBB.resolve();
        })
        .then(() => this.startUi())
        .tap(() => log("debug", "setting up tray icon"))
        .then(() => this.createTray())
        // end initialization
        .tap(() => {
          if (splash !== undefined) {
            log("debug", "removing splash screen");
          }
        })
        .then(() => {
          this.connectTrayAndWindow();
          return splash !== undefined ? splash.fadeOut() : PromiseBB.resolve();
        })
        .tapCatch((err) =>
          log(
            "debug",
            "quitting with exception",
            getErrorMessageOrDefault(err),
          ),
        )
        .catch(UserCanceled, () => app.exit())
        .catch(ProcessCanceled, () => {
          app.quit();
        })
        .catch(DocumentsPathMissing, () =>
          dialog
            .showMessageBox(getVisibleWindow(), {
              type: "error",
              buttons: ["Close", "More info"],
              defaultId: 1,
              title: "Error",
              message: "Startup failed",
              detail:
                'Your "My Documents" folder is missing or is ' +
                "misconfigured. Please ensure that the folder is properly " +
                "configured and accessible, then try again.",
            })
            .then((response) => {
              if (response.response === 1) {
                shell.openExternal(
                  `https://wiki.${NEXUS_DOMAIN}/index.php/Misconfigured_Documents_Folder`,
                );
              }
              app.quit();
            }),
        )
        .catch(DatabaseLocked, () => {
          dialog.showErrorBox(
            "Startup failed",
            "Vortex seems to be running already. " +
              "If you can't see it, please check the task manager.",
          );
          app.quit();
        })
        .catch({ code: "ENOSPC" }, () => {
          dialog.showErrorBox(
            "Startup failed",
            "Your system drive is full. " +
              "You should always ensure your system drive has some space free (ideally " +
              "at least 10% of the total capacity, especially on SSDs). " +
              "Vortex can't start until you have freed up some space.",
          );
          app.quit();
        })
        .catch((unknownError) => {
          try {
            if (unknownError instanceof Error) {
              const pretty = prettifyNodeErrorMessage(unknownError);
              const details = pretty.message.replace(
                /{{ *([a-zA-Z]+) *}}/g,
                (m, key) => pretty.replace?.[key] || key,
              );
              terminate(
                {
                  message: "Startup failed",
                  details,
                  code: pretty.code,
                  stack: unknownError.stack,
                },
                this.mStore !== undefined ? this.mStore.getState() : {},
                pretty.allowReport,
              );
            } else {
              const err = unknownToError(unknownError);
              terminate(
                {
                  message: "Startup failed",
                  details: err.message,
                  stack: err.stack,
                },
                this.mStore !== undefined ? this.mStore.getState() : {},
              );
            }
          } catch (err) {
            // nop
          }
        })
        .finally(() => fs.removeAsync(this.mStartupLogPath).catch(() => null))
    );
  }

  private isUACEnabled(): PromiseBB<boolean> {
    if (process.platform !== "win32") {
      return PromiseBB.resolve(true);
    }

    const getSystemPolicyValue = (key: string) => {
      try {
        const res = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
          key,
        );
        return PromiseBB.resolve({ key, type: res.type, value: res.value });
      } catch (err) {
        // We couldn't retrieve the value, log this and resolve positively
        //  as the user might have a version of Windows that does not use
        //  the key we're looking for.
        log("debug", "failed to check UAC settings", err);
        return PromiseBB.resolve(undefined);
      }
    };

    return (
      PromiseBB.all([
        getSystemPolicyValue("ConsentPromptBehaviorAdmin"),
        getSystemPolicyValue("ConsentPromptBehaviorUser"),
      ])
        .then((res) => {
          res.forEach((value) => {
            if (value !== undefined) {
              log(
                "debug",
                "UAC settings found",
                `${value.key}: ${value.value}`,
              );
            }
          });
          const adminConsent = res[0];
          return adminConsent?.type === "REG_DWORD" && adminConsent?.value === 0
            ? PromiseBB.resolve(false)
            : PromiseBB.resolve(true);
        })
        // Perfectly ok not to have the registry keys.
        .catch((err) => PromiseBB.resolve(true))
    );
  }

  private identifyInstallType(): PromiseBB<void> {
    /**
     * we are checking to see if an uninstaller exists as if it does, it means it was installed via our installer.
     * if it doesn't, then something else installed it. Maybe GOG, or EPIC, or something.
     *
     * TODO: we want to further check managed types to distiguish between anything that isn't us.
     * Quick research says we need to file pattern match the install directory to see what files gog or epic adds etc.
     * This should determine where it's from
     *
     * GOG
     *
     * Maybe the existance of: (the number being the gog product id)
     * 'goggame-galaxyFileList.ini'
     * 'goggame-2053394557.info'
     * 'goggame-2053394557.hashdb'
     *
     * EPIC
     *
     *
     */

    return fs
      .statAsync(
        path.join(getVortexPath("application"), "Uninstall Vortex.exe"),
      )
      .then(() => {
        this.mStore.dispatch(setInstallType("regular"));
      })
      .catch(() => {
        this.mStore.dispatch(setInstallType("managed"));
      });
  }

  private warnAdmin(): PromiseBB<void> {
    const state: IState = this.mStore.getState();
    return timeout(PromiseBB.resolve(isAdmin()), 1000).then((admin) => {
      if (admin === undefined || !admin) {
        return PromiseBB.resolve();
      }
      log("warn", "running as administrator");
      if (state.app.warnedAdmin > 0) {
        return PromiseBB.resolve();
      }
      return this.isUACEnabled().then((uacEnabled) =>
        dialog
          .showMessageBox(getVisibleWindow(), {
            title: "Admin rights detected",
            message:
              `Vortex has detected that it is being run with administrator rights. It is strongly 
              advised to not run any application with admin rights as adverse effects may include 
              permission issues or even security risks. Continue at your own risk` +
              (!uacEnabled
                ? `\n\nPlease note: User Account Control (UAC) notifications are disabled in your 
                  operating system.  We strongly recommend you re-enable these to avoid file permissions 
                  issues and potential security risks.`
                : ""),
            buttons: ["Quit", "Ignore"],
            noLink: true,
          })
          .then((result) => {
            if (result.response === 0) {
              app.quit();
            } else {
              this.mStore.dispatch(setWarnedAdmin(1));
              return PromiseBB.resolve();
            }
          }),
      );
    });
  }

  private checkUpgrade(): PromiseBB<void> {
    const currentVersion = getApplication().version;
    return this.migrateIfNecessary(currentVersion).then(() => {
      this.mStore.dispatch(setApplicationVersion(currentVersion));
      return PromiseBB.resolve();
    });
  }

  private migrateIfNecessary(currentVersion: string): PromiseBB<void> {
    const state: IState = this.mStore.getState();
    const lastVersion = state.app.appVersion || "0.0.0";

    if (this.mFirstStart || process.env.NODE_ENV === "development") {
      // don't check version change in development builds or on first start
      return PromiseBB.resolve();
    }

    if (isMajorDowngrade(lastVersion, currentVersion)) {
      if (
        dialog.showMessageBoxSync(getVisibleWindow(), {
          type: "warning",
          title: "Downgrade detected",
          message: `You're using a version of Vortex that is older than the version you ran previously. 
        Active version: (${currentVersion}) Previously run: (${lastVersion}). Continuing to run this 
        older version may cause irreversible damage to your application state and setup. Continue at your own risk. `,
          buttons: ["Quit", "Continue at your own risk"],
          noLink: true,
        }) === 0
      ) {
        app.quit();
        return PromiseBB.reject(new UserCanceled());
      }
    } else if (semver.gt(currentVersion, lastVersion)) {
      log("info", "Vortex was updated, checking for necessary migrations");
      return migrate(this.mStore, getVisibleWindow())
        .then(() => {
          return PromiseBB.resolve();
        })
        .catch(
          (err) =>
            !(err instanceof UserCanceled) && !(err instanceof ProcessCanceled),
          (err: Error) => {
            dialog.showErrorBox(
              "Migration failed",
              "The migration from the previous Vortex release failed. " +
                "Please resolve the errors you got, then try again.",
            );
            app.exit(1);
            return PromiseBB.reject(new ProcessCanceled("Migration failed"));
          },
        );
    }
    return PromiseBB.resolve();
  }

  private splitPath(statePath: string): string[] {
    return (
      statePath
        .match(/(\\.|[^.])+/g)
        ?.map((input) => input.replace(/\\(.)/g, "$1")) ?? []
    );
  }

  private handleGet(
    getPaths: string[] | boolean,
    dbpath: string,
  ): PromiseBB<void> {
    if (typeof getPaths === "boolean") {
      fs.writeSync(1, "Usage: vortex --get <path>\n");
      return PromiseBB.resolve();
    }

    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then((persistIn) => {
        persist = persistIn;
        return persist.getAllKeys();
      })
      .then((keys) => {
        return PromiseBB.all(
          getPaths.map((getPath) => {
            const pathArray = this.splitPath(getPath);
            const matches = keys.filter((key) =>
              _.isEqual(key.slice(0, pathArray.length), pathArray),
            );
            return PromiseBB.all(
              matches.map((match) =>
                persist
                  .getItem(match)
                  .then((value) => `${match.join(".")} = ${value}`),
              ),
            )
              .then((output) => {
                process.stdout.write(output.join("\n") + "\n");
              })
              .catch((err) => {
                process.stderr.write(getErrorMessageOrDefault(err) + "\n");
              });
          }),
        ).then(() => {});
      })
      .catch((err) => {
        process.stderr.write(getErrorMessageOrDefault(err) + "\n");
      })
      .finally(() => {
        persist.close();
      });
  }

  private handleSet(
    setParameters: ISetItem[],
    dbpath: string,
  ): PromiseBB<void> {
    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then((persistIn) => {
        persist = persistIn;

        return PromiseBB.all(
          setParameters.map((setParameter: ISetItem) => {
            const pathArray = this.splitPath(setParameter.key);

            return persist
              .getItem(pathArray)
              .catch(() => undefined)
              .then((oldValue) => {
                const newValue =
                  setParameter.value.length === 0
                    ? undefined
                    : oldValue === undefined || typeof oldValue === "object"
                      ? JSON.parse(setParameter.value)
                      : oldValue.constructor(setParameter.value);
                return persist.setItem(pathArray, newValue);
              })
              .then(() => {
                process.stdout.write("changed\n");
              })
              .catch((err) => {
                process.stderr.write(getErrorMessageOrDefault(err) + "\n");
              });
          }),
        ).then(() => {});
      })
      .catch((err) => {
        process.stderr.write(getErrorMessageOrDefault(err) + "\n");
      })
      .finally(() => {
        persist.close();
      });
  }

  private handleDel(delPaths: string[], dbpath: string): PromiseBB<void> {
    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then((persistIn) => {
        persist = persistIn;
        return persist.getAllKeys();
      })
      .then((keys) => {
        return PromiseBB.all(
          delPaths.map((delPath) => {
            const pathArray = this.splitPath(delPath);
            const matches = keys.filter((key) =>
              _.isEqual(key.slice(0, pathArray.length), pathArray),
            );
            return PromiseBB.all(
              matches.map((match) =>
                persist
                  .removeItem(match)
                  .then(() =>
                    process.stdout.write(`removed ${match.join(".")}\n`),
                  )
                  .catch((err) => {
                    process.stderr.write(getErrorMessageOrDefault(err) + "\n");
                  }),
              ),
            );
          }),
        ).then(() => {});
      })
      .catch((err) => {
        process.stderr.write(getErrorMessageOrDefault(err) + "\n");
      })
      .finally(() => {
        persist.close();
      });
  }

  private createTray(): PromiseBB<void> {
    const TrayIcon = require("./TrayIcon").default;
    this.mTray = new TrayIcon(this.mExtensions.getApi());
    return PromiseBB.resolve();
  }

  private connectTrayAndWindow() {
    if (this.mTray.initialized) {
      this.mMainWindow.connectToTray(this.mTray);
    }
  }

  private multiUserPath() {
    if (process.platform === "win32" && process.env.ProgramData !== undefined) {
      const muPath = path.join(process.env.ProgramData, "vortex");
      try {
        fs.ensureDirSync(muPath);
      } catch (err) {
        const code = getErrorCode(err);
        // not sure why this would happen, ensureDir isn't supposed to report a problem if
        // the directory exists, but there was a single report of EEXIST in this place.
        // Probably a bug related to the filesystem used in C:\ProgramData, we had similar
        // problems with OneDrive paths
        if (code !== "EEXIST") {
          throw err;
        }
      }

      return muPath;
    } else {
      log("error", "Multi-User mode not implemented outside windows");
      return app.getPath("userData");
    }
  }

  private createStore(
    restoreBackup?: string,
    mergeBackup?: string,
    repair?: boolean,
  ): PromiseBB<void> {
    const newStore = createVortexStore(this.sanityCheckCB);
    const backupPath = path.join(app.getPath("temp"), STATE_BACKUP_PATH);
    let backups: string[];

    const updateBackups = () =>
      fs
        .ensureDirAsync(backupPath)
        .then(() => fs.readdirAsync(backupPath))
        .filter(
          (fileName: string) =>
            fileName.startsWith("backup") && path.extname(fileName) === ".json",
        )
        .then((backupsIn) => {
          backups = backupsIn;
        })
        .catch((err) => {
          log("error", "failed to read backups", getErrorMessageOrDefault(err));
          backups = [];
        });

    const deleteBackups = () =>
      PromiseBB.map(backups, (backupName) =>
        fs
          .removeAsync(path.join(backupPath, backupName))
          .catch(() => undefined),
      ).then(() => null);

    // storing the last version that ran in the startup.json settings file.
    // We have that same information in the leveldb store but what if we need
    // to react to an upgrade before the state is loaded?
    // In development of 1.4 I assumed we had a case where this was necessary.
    // Turned out it wasn't, still feel it's sensible to have this
    // information available asap
    startupSettings.storeVersion = getApplication().version;

    // 1. load only user settings to determine if we're in multi-user mode
    // 2. load app settings to determine which extensions to load
    // 3. load extensions, then load all settings, including extensions
    return LevelPersist.create(
      path.join(this.mBasePath, currentStatePath),
      undefined,
      repair ?? false,
    )
      .then((levelPersistor) => {
        this.mLevelPersistors.push(levelPersistor);
        return insertPersistor(
          "user",
          new SubPersistor(levelPersistor, "user"),
        );
      })
      .catch(DataInvalid, (err) => {
        const failedPersistor = this.mLevelPersistors.pop();
        if (!failedPersistor) {
          return PromiseBB.reject(err);
        }
        return failedPersistor.close().then(() => PromiseBB.reject(err));
      })
      .then(() => {
        let dataPath = app.getPath("userData");
        const { multiUser } = newStore.getState().user;
        if (this.mArgs.userData !== undefined) {
          dataPath = this.mArgs.userData;
        } else if (multiUser) {
          dataPath = this.multiUserPath();
        }
        setVortexPath("userData", dataPath);
        this.mBasePath = dataPath;
        let created = false;
        try {
          fs.statSync(dataPath);
        } catch (err) {
          fs.ensureDirSync(dataPath);
          created = true;
        }
        if (multiUser && created) {
          permissions.allow(dataPath, "group", "rwx");
        }
        fs.ensureDirSync(path.join(dataPath, "temp"));

        log("info", `using ${dataPath} as the storage directory`);
        if (multiUser || this.mArgs.userData !== undefined) {
          log(
            "info",
            "all further logging will happen in",
            path.join(dataPath, "vortex.log"),
          );
          setLogPath(dataPath);
          log("info", "--------------------------");
          log("info", "Vortex Version", getApplication().version);
          return LevelPersist.create(
            path.join(dataPath, currentStatePath),
            undefined,
            repair ?? false,
          ).then((levelPersistor) => {
            this.mLevelPersistors.push(levelPersistor);
          });
        } else {
          return PromiseBB.resolve();
        }
      })
      .then(() => {
        log("debug", "reading app state");
        return insertPersistor(
          "app",
          new SubPersistor(last(this.mLevelPersistors), "app"),
        );
      })
      .then(() => {
        if (newStore.getState().app.instanceId === undefined) {
          this.mFirstStart = true;
          const newId = uuid.v4();
          log("debug", "first startup, generated instance id", {
            instanceId: newId,
          });
          newStore.dispatch(setInstanceId(newId));
        } else {
          log("debug", "startup instance", {
            instanceId: newStore.getState().app.instanceId,
          });
        }
        const ExtensionManager = require("../util/ExtensionManager").default;
        this.mExtensions = new ExtensionManager(newStore);
        if (this.mExtensions.hasOutdatedExtensions) {
          log("debug", "relaunching to remove outdated extensions");
          finalizeStoreWrite().then(() => relaunch());

          // relaunching the process happens asynchronously but we don't want to any further work
          // before that
          return new PromiseBB(() => null);
        }
        const reducer = require("../reducers/index").default;
        newStore.replaceReducer(
          reducer(this.mExtensions.getReducers(), querySanitize),
        );

        return PromiseBB.mapSeries(allHives(this.mExtensions), (hive) =>
          insertPersistor(
            hive,
            new SubPersistor(last(this.mLevelPersistors), hive),
          ),
        );
      })
      .then(() => {
        log("debug", "checking if state db needs to be upgraded");
        return importState(this.mBasePath);
      })
      .then((oldState) => {
        // mark as imported first, otherwise we risk importing again, overwriting data.
        // this way we risk not importing but since the old state is still there, that
        // can be repaired
        return oldState !== undefined
          ? markImported(this.mBasePath).then(() => {
              newStore.dispatch({
                type: "__hydrate",
                payload: oldState,
              });
            })
          : PromiseBB.resolve();
      })
      .then(() => {
        log("debug", "updating state backups");
        return updateBackups();
      })
      .then(() => {
        if (restoreBackup !== undefined) {
          log("info", "restoring state backup", restoreBackup);
          return fs
            .readFileAsync(restoreBackup, { encoding: "utf-8" })
            .then((backupState) => {
              newStore.dispatch({
                type: "__hydrate_replace",
                payload: JSON.parse(backupState),
              });
            })
            .then(() => deleteBackups())
            .then(() => updateBackups())
            .catch((err) => {
              if (err instanceof UserCanceled) {
                return PromiseBB.reject(err);
              }
              terminate(
                {
                  message: "Failed to restore backup",
                  details:
                    getErrorCode(err) !== "ENOENT"
                      ? getErrorMessageOrDefault(err)
                      : "Specified backup file doesn't exist",
                  path: restoreBackup,
                },
                {},
                false,
              );
            });
        } else if (mergeBackup !== undefined) {
          log("info", "merging state backup", mergeBackup);
          return fs
            .readFileAsync(mergeBackup, { encoding: "utf-8" })
            .then((backupState) => {
              newStore.dispatch({
                type: "__hydrate",
                payload: JSON.parse(backupState),
              });
            })
            .catch((err) => {
              if (err instanceof UserCanceled) {
                return PromiseBB.reject(err);
              }
              terminate(
                {
                  message: "Failed to merge backup",
                  details:
                    getErrorCode(err) !== "ENOENT"
                      ? getErrorMessageOrDefault(err)
                      : "Specified backup file doesn't exist",
                  path: mergeBackup,
                },
                {},
                false,
              );
            });
        } else {
          return PromiseBB.resolve();
        }
      })
      .then(() => {
        const hydrateHandler = (stepIn: IPresetStep): PromiseBB<void> => {
          newStore.dispatch({
            type: "__hydrate",
            payload: (stepIn as IPresetStepHydrateState).state,
          });

          return PromiseBB.resolve();
        };
        presetManager.on("hydrate", hydrateHandler);
        presetManager.now("hydrate", hydrateHandler);
      })
      .then(() => {
        this.mStore = newStore;

        let sendState: Buffer;

        (global as GlobalWithRedux).getReduxStateMsgpack = (idx: number) => {
          const msgpack: typeof msgpackT = require("@msgpack/msgpack");
          if (sendState === undefined || idx === 0) {
            sendState = Buffer.from(
              msgpack.encode(
                replaceRecursive(
                  this.mStore.getState(),
                  undefined,
                  "__UNDEFINED__",
                ),
              ),
            );
          }
          const res = sendState.slice(
            idx * STATE_CHUNK_SIZE,
            (idx + 1) * STATE_CHUNK_SIZE,
          );
          return res.toString("base64");
        };

        this.mExtensions.setStore(newStore);
        log("debug", "setting up extended store");
        return extendStore(newStore, this.mExtensions);
      })
      .then(() => {
        if (backups.length > 0) {
          const sorted = backups.sort((lhs, rhs) => rhs.localeCompare(lhs));
          const mostRecent = sorted[0];
          const timestamp = path
            .basename(mostRecent, ".json")
            .replace("backup_", "");
          const date = new Date(+timestamp);
          const dateString =
            `${date.toDateString()} ` +
            `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
          const replace = { date: dateString };
          this.mStore.dispatch(
            addNotification({
              type: "info",
              message:
                "Found an application state backup. Created on: {{date}}",
              actions: [
                {
                  title: "Restore",
                  action: () => {
                    this.mStore.dispatch(
                      showDialog(
                        "question",
                        "Restoring Application State",
                        {
                          bbcode:
                            "You are attempting to restore an application state backup which will revert any " +
                            "state changes you have made since the backup was created.[br][/br][br][/br]" +
                            "Please note that this operation will NOT uninstall/remove any mods you " +
                            "may have downloaded/installed since the backup was created, however Vortex " +
                            'may "forget" some changes:[list]' +
                            "[*] Which download archive belongs to which mod installation, exhibiting " +
                            'itself as "duplicate" entries of the same mod (archive entry and installed mod entry).' +
                            "[*] The state of an installed mod - reverting it to a disabled state." +
                            "[*] Any conflict rules you had defined after the state backup." +
                            "[*] Any other configuration changes you may have made." +
                            "[/list][br][/br]" +
                            "Are you sure you wish to restore the backed up state ?",
                        },
                        [
                          { label: "Cancel" },
                          {
                            label: "Restore",
                            action: () => {
                              log("info", "sorted backups", sorted);
                              spawnSelf([
                                "--restore",
                                path.join(backupPath, mostRecent),
                              ]);
                              app.exit();
                            },
                          },
                        ],
                      ),
                    );
                  },
                },
                {
                  title: "Delete",
                  action: (dismiss) => {
                    deleteBackups();
                    dismiss();
                  },
                },
              ],
              replace,
            }),
          );
        } else if (!repair) {
          // we started without any problems, save this application state
          return createFullStateBackup("startup", this.mStore)
            .then(() => PromiseBB.resolve())
            .catch((err) =>
              log(
                "error",
                "Failed to create startup state backup",
                getErrorMessageOrDefault(err),
              ),
            );
        }
        return PromiseBB.resolve();
      })
      .then(() => this.mExtensions.doOnce());
  }

  private sanityCheckCB = (err: StateError) => {
    err["attachLogOnReport"] = true;
    showError(
      this.mStore.dispatch,
      "An invalid state change was prevented, this was probably caused by a bug",
      err,
    );
  };

  private initDevel(): PromiseBB<void> {
    if (process.env.NODE_ENV === "development") {
      const { installDevelExtensions } =
        require("../util/devel") as typeof develT;
      return installDevelExtensions();
    } else {
      return PromiseBB.resolve();
    }
  }

  private showMainWindow(startMinimized?: boolean) {
    if (this.mMainWindow === null) {
      // ??? renderer has signaled it's done loading before we even started it?
      // that can't be right...
      app.exit();
      return;
    }
    const windowMetrics = this.mStore.getState().settings.window;
    const maximized: boolean = windowMetrics.maximized || false;
    try {
      this.mMainWindow.show(maximized, startMinimized);
    } catch (err) {
      if (this.mMainWindow === null) {
        // It's possible for the user to forcefully close Vortex just
        //  as it attempts to show the main window and obviously cause
        //  the app to crash if we don't handle the exception.
        log("error", "failed to show main window", err);
        app.exit();
        return;
      } else {
        throw err;
      }
    }
    setWindow(this.mMainWindow.getHandle());
  }

  private testUserEnvironment(): PromiseBB<void> {
    // Should be used to test the user's environment for known
    //  issues before starting up Vortex.
    // On Windows:
    //  - Ensure we're able to retrieve the user's documents folder.
    if (process.platform === "win32") {
      try {
        const documentsFolder = app.getPath("documents");
        return documentsFolder !== ""
          ? PromiseBB.resolve()
          : PromiseBB.reject(new DocumentsPathMissing());
      } catch (err) {
        return PromiseBB.reject(new DocumentsPathMissing());
      }
    } else {
      // No tests needed.
      return PromiseBB.resolve();
    }
  }

  private validateFiles(): PromiseBB<void> {
    return PromiseBB.resolve(
      validateFiles(getVortexPath("assets_unpacked")),
    ).then((validation) => {
      if (validation.changed.length > 0 || validation.missing.length > 0) {
        log("info", "Files were manipulated", validation);
        return dialog
          .showMessageBox(null, {
            type: "error",
            title: "Installation corrupted",
            message:
              "Your Vortex installation has been corrupted. " +
              "This could be the result of a virus or manual manipulation. " +
              "Vortex might still appear to work (partially) but we suggest " +
              "you reinstall it. For more information please refer to Vortex's log files.",
            noLink: true,
            buttons: ["Quit", "Ignore"],
          })
          .then((dialogReturn) => {
            const { response } = dialogReturn;
            if (response === 0) {
              app.quit();
            } else {
              disableErrorReport();
              return PromiseBB.resolve();
            }
          });
      } else {
        return PromiseBB.resolve();
      }
    });
  }

  private applyArguments(args: IParameters) {
    if (args.download || args.install || args.installArchive) {
      const prom: PromiseBB<void> =
        this.mMainWindow === undefined
          ? // give the main instance a moment to fully start up
            PromiseBB.delay(2000)
          : PromiseBB.resolve(undefined);

      prom.then(() => {
        if (this.mMainWindow !== undefined) {
          if (args.download || args.install) {
            this.mMainWindow.sendExternalURL(
              args.download || args.install,
              args.install !== undefined,
            );
          }
          if (args.installArchive) {
            this.mMainWindow.installModFromArchive(args.installArchive);
          }
        } else {
          // TODO: this instructions aren't very correct because we know Vortex doesn't have
          // a UI and needs to be shut down from the task manager
          dialog.showErrorBox(
            "Vortex unresponsive",
            "Vortex appears to be frozen, please close Vortex and try again",
          );
        }
      });
    } else {
      if (this.mMainWindow !== undefined) {
        // Vortex's executable has been run without download/install arguments;
        //  this is potentially down to the user not realizing that Vortex is minimized
        //  leading him to try to start up Vortex again - we just display the main
        //  window in this case.
        this.showMainWindow(args?.startMinimized);
      }
    }
  }
}

betterIpcMain.handle("example:ping", () => "pong", { includeArgs: true });

// Helper for protocol client registration
function selfCL(udPath: string | undefined): [string, string[]] {
  // The "-d" flag is required so that when Windows appends the NXM URL to the command line,
  // it becomes "-d nxm://..." which commander parses as "--download nxm://..."
  if (process.env.NODE_ENV === "development") {
    // Use absolute path for the app entry point - process.argv[1] may be relative (e.g. ".")
    // and would fail when launched from a different working directory (e.g. C:\WINDOWS\system32)
    const appPath = path.resolve(process.argv[1]);
    return [
      process.execPath,
      [appPath, ...(udPath !== undefined ? ["--userData", udPath] : []), "-d"],
    ];
  } else {
    return [
      process.execPath,
      [...(udPath !== undefined ? ["--userData", udPath] : []), "-d"],
    ];
  }
}

// Dialog handlers
betterIpcMain.handle(
  "dialog:showOpen",
  async (event: IpcMainInvokeEvent, options: OpenDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return await dialog.showOpenDialog(window, options);
  },
);

betterIpcMain.handle(
  "dialog:showSave",
  async (event: IpcMainInvokeEvent, options: SaveDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return await dialog.showSaveDialog(window, options);
  },
);

betterIpcMain.handle(
  "dialog:showMessageBox",
  async (event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return await dialog.showMessageBox(window, options);
  },
);

betterIpcMain.handle(
  "dialog:showErrorBox",
  async (_event: IpcMainInvokeEvent, title: string, content: string) => {
    console.error("[Error Box]", title, content);
    dialog.showErrorBox(title, content);
  },
);

// App protocol client handlers
betterIpcMain.handle(
  "app:setProtocolClient",
  async (
    _event: IpcMainInvokeEvent,
    protocol: string,
    udPath: string | undefined,
  ) => {
    const [execPath, args] = selfCL(udPath);
    app.setAsDefaultProtocolClient(protocol, execPath, args);
  },
);

betterIpcMain.handle(
  "app:isProtocolClient",
  async (
    _event: IpcMainInvokeEvent,
    protocol: string,
    udPath: string | undefined,
  ) => {
    const [execPath, args] = selfCL(udPath);
    return app.isDefaultProtocolClient(protocol, execPath, args);
  },
);

betterIpcMain.handle(
  "app:removeProtocolClient",
  async (
    _event: IpcMainInvokeEvent,
    protocol: string,
    udPath: string | undefined,
  ) => {
    const [execPath, args] = selfCL(udPath);
    app.removeAsDefaultProtocolClient(protocol, execPath, args);
  },
);

betterIpcMain.handle(
  "app:exit",
  async (_event: IpcMainInvokeEvent, exitCode: number) => {
    app.exit(exitCode);
  },
);

betterIpcMain.handle("app:getName", async () => {
  return app.getName();
});

// App path handlers
betterIpcMain.handle(
  "app:getPath",
  async (_event: IpcMainInvokeEvent, name: string) => {
    // Use Vortex's custom path logic instead of Electron's native paths
    return getVortexPath(name as AppPath);
  },
);

betterIpcMain.handle(
  "app:setPath",
  async (_event: IpcMainInvokeEvent, name: string, value: string) => {
    // Use Vortex's custom path setter
    setVortexPath(name as AppPath, value);
  },
);

// File icon extraction
betterIpcMain.handle(
  "app:extractFileIcon",
  async (_event: IpcMainInvokeEvent, exePath: string, iconPath: string) => {
    const icon = await app.getFileIcon(exePath, { size: "normal" });
    await fs.writeFileAsync(iconPath, icon.toPNG());
  },
);

// BrowserView handlers
import { extraWebViews } from "./webview";

betterIpcMain.handle(
  "browserView:create",
  async (
    event: IpcMainInvokeEvent,
    src: string,
    partition: string,
    _isNexus: boolean,
  ) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const contentsId = event.sender.id;

    if (extraWebViews[contentsId] === undefined) {
      extraWebViews[contentsId] = {};
    }

    const view = new BrowserView({
      webPreferences: {
        // External sites are sandboxed with minimal Buffer polyfill for bundled JS
        preload: path.join(__dirname, "../preload/browserView.js"),
        nodeIntegration: false,
        contextIsolation: true,
        partition: partition,
        sandbox: true,

        /**
         * Not happy about this, but disabling webSecurity is necessary to avoid
         * CORS and certificate issues with some external sites when downloading through BrowserViews.
         * (moddb being one of them)
         *
         * These views are temporary (created only for downloads)
         * We can't control external sites' SSL/certificate configuration
         * The partition isolation already provides some security boundary
         * In the future we could consider enabling webSecurity and
         * adding specific exceptions for known sites if necessary.
         */
        webSecurity: false,
      },
    });

    const viewId = `${contentsId}_${Object.keys(extraWebViews[contentsId]).length}`;
    extraWebViews[contentsId][viewId] = view;

    await view.webContents.loadURL(src);
    window.addBrowserView(view);

    return viewId;
  },
);

betterIpcMain.handle(
  "browserView:createWithEvents",
  async (
    event: IpcMainInvokeEvent,
    src: string,
    forwardEvents: string[],
    options: Electron.BrowserViewConstructorOptions | undefined,
  ) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const contentsId = event.sender.id;

    if (extraWebViews[contentsId] === undefined) {
      extraWebViews[contentsId] = {};
    }

    const typedOptions = options ?? {};
    // External sites are sandboxed with minimal Buffer polyfill
    const viewOptions: Electron.BrowserViewConstructorOptions = {
      ...typedOptions,
      webPreferences: {
        preload: path.join(__dirname, "../preload/browserView.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        /**
         * Not happy about this, but disabling webSecurity is necessary to avoid
         * CORS and certificate issues with some external sites when downloading through BrowserViews.
         * (moddb being one of them)
         *
         * These views are temporary (created only for downloads)
         * We can't control external sites' SSL/certificate configuration
         * The partition isolation already provides some security boundary
         * In the future we could consider enabling webSecurity and
         * adding specific exceptions for known sites if necessary.
         */
        webSecurity: false,
        ...typedOptions?.webPreferences,
      },
    };

    const view = new BrowserView(viewOptions);
    const viewId = `${contentsId}_${Object.keys(extraWebViews[contentsId]).length}`;
    extraWebViews[contentsId][viewId] = view;

    view.setAutoResize({
      horizontal: true,
      vertical: true,
    });

    window.addBrowserView(view);
    await view.webContents.loadURL(src);

    // Forward events from BrowserView to renderer
    forwardEvents.forEach((eventId) => {
      // Type assertion needed because eventId is a dynamic string from the caller
      // WebContents.on is overloaded for each specific event type
      view.webContents.on(
        eventId as Parameters<typeof view.webContents.on>[0],
        (evt, ...args) => {
          event.sender.send(`view-${viewId}-${eventId}`, JSON.stringify(args));
          evt.preventDefault();
        },
      );
    });

    return viewId;
  },
);

betterIpcMain.handle(
  "browserView:close",
  async (event: IpcMainInvokeEvent, viewId) => {
    const contentsId = event.sender.id;
    if (extraWebViews[contentsId]?.[viewId] !== undefined) {
      const window = BrowserWindow.fromWebContents(event.sender);
      window?.removeBrowserView(extraWebViews[contentsId][viewId]);
      delete extraWebViews[contentsId][viewId];
    }
  },
);

betterIpcMain.handle(
  "browserView:position",
  async (event: IpcMainInvokeEvent, viewId, rect) => {
    const contentsId = event.sender.id;
    extraWebViews[contentsId]?.[viewId]?.setBounds?.(rect);
  },
);

betterIpcMain.handle(
  "browserView:updateURL",
  async (event: IpcMainInvokeEvent, viewId, newURL) => {
    const contentsId = event.sender.id;
    void extraWebViews[contentsId]?.[viewId]?.webContents.loadURL(newURL);
  },
);

// Jump list (Windows)
betterIpcMain.handle(
  "app:setJumpList",
  async (_event: IpcMainInvokeEvent, categories: JumpListCategory[]) => {
    try {
      app.setJumpList(categories);
    } catch (_err) {
      // Ignore jump list errors (not available on all platforms)
    }
  },
);

// Session cookies
betterIpcMain.handle(
  "session:getCookies",
  async (event: IpcMainInvokeEvent, filter: Electron.CookiesGetFilter) => {
    // Only return cookies from the main window's session
    // BrowserView cookies (e.g., tracking cookies from external sites) should NOT
    // be sent to CDN downloads that use signed URLs for authentication
    return event.sender.session.cookies.get(filter);
  },
);

// Window operations

// Sync handler for getting windowId during preload initialization
betterIpcMain.handleSync("window:getIdSync", (event: IpcMainEvent) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window?.id ?? -1;
});

// Sync handlers for app name and version (used by application.electron.ts)
betterIpcMain.handleSync("app:getNameSync", () => {
  return app.name;
});

betterIpcMain.handleSync("app:getVersionSync", () => {
  return app.getVersion();
});

// Sync handler for all Vortex paths (used by preload for renderer)
betterIpcMain.handleSync("vortex:getPathsSync", () => {
  return {
    base: getVortexPath("base"),
    assets: getVortexPath("assets"),
    assets_unpacked: getVortexPath("assets_unpacked"),
    modules: getVortexPath("modules"),
    modules_unpacked: getVortexPath("modules_unpacked"),
    bundledPlugins: getVortexPath("bundledPlugins"),
    locales: getVortexPath("locales"),
    package: getVortexPath("package"),
    package_unpacked: getVortexPath("package_unpacked"),
    application: getVortexPath("application"),
    userData: getVortexPath("userData"),
    appData: getVortexPath("appData"),
    localAppData: getVortexPath("localAppData"),
    temp: getVortexPath("temp"),
    home: getVortexPath("home"),
    documents: getVortexPath("documents"),
    exe: getVortexPath("exe"),
    desktop: getVortexPath("desktop"),
  };
});

betterIpcMain.handle("window:getId", async (event: IpcMainInvokeEvent) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window?.id ?? -1;
});

betterIpcMain.handle(
  "window:minimize",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.minimize();
  },
);

betterIpcMain.handle(
  "window:maximize",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.maximize();
  },
);

betterIpcMain.handle(
  "window:unmaximize",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.unmaximize();
  },
);

betterIpcMain.handle(
  "window:restore",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.restore();
  },
);

betterIpcMain.handle(
  "window:close",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.close();
  },
);

betterIpcMain.handle(
  "window:focus",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.focus();
  },
);

betterIpcMain.handle(
  "window:show",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.show();
  },
);

betterIpcMain.handle(
  "window:hide",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.hide();
  },
);

betterIpcMain.handle(
  "window:isMaximized",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    return window?.isMaximized() ?? false;
  },
);

betterIpcMain.handle(
  "window:isMinimized",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    return window?.isMinimized() ?? false;
  },
);

betterIpcMain.handle(
  "window:isFocused",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    return window?.isFocused() ?? false;
  },
);

betterIpcMain.handle(
  "window:setAlwaysOnTop",
  async (_event: IpcMainInvokeEvent, windowId: number, flag: boolean) => {
    const window = BrowserWindow.fromId(windowId);
    window?.setAlwaysOnTop(flag);
  },
);

betterIpcMain.handle(
  "window:moveTop",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const window = BrowserWindow.fromId(windowId);
    window?.moveTop();
  },
);

// Menu operations
betterIpcMain.handle(
  "menu:setApplicationMenu",
  (
    event: IpcMainInvokeEvent,
    template: Electron.MenuItemConstructorOptions[],
  ) => {
    const sender = event.sender;

    // Recursively add click handlers that send IPC events to renderer
    type MenuItemWithId = Electron.MenuItemConstructorOptions & { id?: string };
    const processTemplate = (items: MenuItemWithId[]): MenuItemWithId[] => {
      return items.map((item: MenuItemWithId) => {
        const processed = { ...item };
        if (item.id) {
          processed.click = () => {
            if (!sender.isDestroyed()) {
              sender.send("menu:click", item.id);
            }
          };
        }
        if (item.submenu && Array.isArray(item.submenu)) {
          processed.submenu = processTemplate(item.submenu);
        }
        return processed;
      });
    };

    const processedTemplate = processTemplate(template);
    const menu = Menu.buildFromTemplate(processedTemplate);
    Menu.setApplicationMenu(menu);
  },
);

// Content tracing operations
betterIpcMain.handle(
  "contentTracing:startRecording",
  async (
    _event: IpcMainInvokeEvent,
    options: TraceConfig | TraceCategoriesAndOptions,
  ) => {
    return await contentTracing.startRecording(options);
  },
);

betterIpcMain.handle(
  "contentTracing:stopRecording",
  async (_event: IpcMainInvokeEvent, resultPath: string) => {
    return await contentTracing.stopRecording(resultPath);
  },
);

// Redux state transfer
betterIpcMain.handle("redux:getState", async () => {
  const getReduxState = (global as GlobalWithRedux).getReduxState;
  if (typeof getReduxState === "function") {
    return getReduxState();
  }
  return undefined;
});

betterIpcMain.handle(
  "redux:getStateMsgpack",
  async (_event: IpcMainInvokeEvent, idx: number) => {
    const getReduxStateMsgpack = (global as GlobalWithRedux)
      .getReduxStateMsgpack;
    if (typeof getReduxStateMsgpack === "function") {
      return getReduxStateMsgpack(idx ?? 0);
    }
    return undefined;
  },
);

// Login item settings
betterIpcMain.handle(
  "app:setLoginItemSettings",
  async (_event: IpcMainInvokeEvent, settings: Settings) => {
    app.setLoginItemSettings(settings);
  },
);

betterIpcMain.handle("app:getLoginItemSettings", async () => {
  return app.getLoginItemSettings();
});

// Clipboard operations
betterIpcMain.handle(
  "clipboard:writeText",
  async (_event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  },
);

betterIpcMain.handle("clipboard:readText", async () => {
  return clipboard.readText();
});

// Power save blocker operations
import { powerSaveBlocker } from "electron";

betterIpcMain.handle(
  "powerSaveBlocker:start",
  async (
    _event: IpcMainInvokeEvent,
    type: "prevent-app-suspension" | "prevent-display-sleep",
  ) => {
    return powerSaveBlocker.start(type);
  },
);

betterIpcMain.handle(
  "powerSaveBlocker:stop",
  async (_event: IpcMainInvokeEvent, id: number) => {
    powerSaveBlocker.stop(id);
  },
);

betterIpcMain.handle(
  "powerSaveBlocker:isStarted",
  async (_event: IpcMainInvokeEvent, id: number) => {
    return powerSaveBlocker.isStarted(id);
  },
);

// App path operations
betterIpcMain.handle("app:getAppPath", async (_event: IpcMainInvokeEvent) => {
  return app.getAppPath();
});

// Additional window operations
betterIpcMain.handle(
  "window:getPosition",
  async (_event: IpcMainInvokeEvent, windowId): Promise<[number, number]> => {
    const win = BrowserWindow.fromId(windowId);
    return (win?.getPosition() ?? [0, 0]) as [number, number];
  },
);

betterIpcMain.handle(
  "window:setPosition",
  async (
    _event: IpcMainInvokeEvent,
    windowId: number,
    x: number,
    y: number,
  ) => {
    const win = BrowserWindow.fromId(windowId);
    win?.setPosition(x, y);
  },
);

betterIpcMain.handle(
  "window:getSize",
  async (_event: IpcMainInvokeEvent, windowId): Promise<[number, number]> => {
    const win = BrowserWindow.fromId(windowId);
    return (win?.getSize() ?? [0, 0]) as [number, number];
  },
);

betterIpcMain.handle(
  "window:setSize",
  async (
    _event: IpcMainInvokeEvent,
    windowId: number,
    width: number,
    height: number,
  ) => {
    const win = BrowserWindow.fromId(windowId);
    win?.setSize(width, height);
  },
);

betterIpcMain.handle(
  "window:isVisible",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const win = BrowserWindow.fromId(windowId);
    return win?.isVisible() ?? false;
  },
);

betterIpcMain.handle(
  "window:toggleDevTools",
  async (_event: IpcMainInvokeEvent, windowId: number) => {
    const win = BrowserWindow.fromId(windowId);
    win?.webContents.toggleDevTools();
  },
);

export default Application;
