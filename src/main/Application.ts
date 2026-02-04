import type crashDumpT from "crash-dump";
import type { crashReporter as crashReporterT } from "electron";
import type * as permissionsT from "permissions";
import type * as uuidT from "uuid";
import type * as winapiT from "winapi-bindings";

import type { AppInitMetadata } from "../shared/types/ipc";
import type { IWindow } from "../types/IState";
import type { IParameters, ISetItem } from "../util/commandLine";

import type MainWindowT from "./MainWindow";
import type SplashScreenT from "./SplashScreen";
import type TrayIconT from "./TrayIcon";

import PromiseBB from "bluebird";
import { app, dialog, ipcMain, protocol, shell } from "electron";
import contextMenu from "electron-context-menu";
import isAdmin from "is-admin";
import * as _ from "lodash";
import * as path from "path";
import * as semver from "semver";

import { NEXUS_DOMAIN } from "../extensions/nexus_integration/constants";
import {
  getErrorCode,
  getErrorMessageOrDefault,
  unknownToError,
} from "../shared/errors";
import { currentStatePath } from "../store/store";
import { getApplication } from "../util/application";
import commandLine from "../util/commandLine";
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
  setWindow,
  terminate,
  toError,
} from "../util/errorHandling";
import { validateFiles } from "../util/fileValidation";
import * as fs from "../util/fs";
import getVortexPath, { setVortexPath } from "../util/getVortexPath";
import lazyRequire from "../util/lazyRequire";
import { prettifyNodeErrorMessage } from "../util/message";
import startupSettings from "../util/startupSettings";
import { isMajorDowngrade, timeout } from "../util/util";
import { setupMainExtensions } from "./extensions";
import { betterIpcMain } from "./ipc";
import { log, setupLogging, changeLogPath } from "./logging";
import LevelPersist, { DatabaseLocked } from "./store/LevelPersist";
import {
  initMainPersistence,
  readPersistedValue,
  registerHive,
  finalizeMainWrite,
} from "./store/mainPersistence";
import SubPersistor from "./store/SubPersistor";

const uuid = lazyRequire<typeof uuidT>(() => require("uuid"));
const permissions = lazyRequire<typeof permissionsT>(() =>
  require("permissions"),
);
const winapi = lazyRequire<typeof winapiT>(() => require("winapi-bindings"));

class Application {
  public static shouldIgnoreError(error: any, promise?: any): boolean {
    if (error instanceof UserCanceled) {
      return true;
    }

    if (!error) {
      log("error", "empty error unhandled", {
        wasPromise: promise !== undefined,
      });
      return true;
    }

    if (error.message === "Object has been destroyed") {
      // This happens when Vortex crashed because of something else so there is no point
      // reporting this, it might otherwise obfuscate the actual problem
      return true;
    }

    // this error message appears to happen as the result of some other problem crashing the
    // renderer process, so all this may do is obfuscate what's actually going on.
    if (
      error.message.includes(
        "Error processing argument at index 0, conversion failure from",
      )
    ) {
      return true;
    }

    if (
      [
        "net::ERR_CONNECTION_RESET",
        "net::ERR_CONNECTION_ABORTED",
        "net::ERR_ABORTED",
        "net::ERR_CONTENT_LENGTH_MISMATCH",
        "net::ERR_SSL_PROTOCOL_ERROR",
        "net::ERR_HTTP2_PROTOCOL_ERROR",
        "net::ERR_INCOMPLETE_CHUNKED_ENCODING",
      ].includes(error.message) ||
      ["ETIMEDOUT", "ECONNRESET", "EPIPE"].includes(error.code)
    ) {
      log("warn", "network error unhandled", error.stack);
      return true;
    }

    if (
      ["EACCES", "EPERM"].includes(error.errno) &&
      error.path !== undefined &&
      error.path.indexOf("vortex-setup") !== -1
    ) {
      // It's wonderous how electron-builder finds new ways to be more shit without even being
      // updated. Probably caused by node update
      log("warn", "suppressing error message", {
        message: error.message,
        stack: error.stack,
      });
      return true;
    }

    return false;
  }

  private mBasePath: string;
  private mLevelPersistors: LevelPersist[] = [];
  private mArgs: IParameters;
  private mMainWindow: MainWindowT;
  private mTray: TrayIconT;
  private mAppMetadata: AppInitMetadata;
  private mFirstStart: boolean = false;
  private mStartupLogPath: string;
  private mDeinitCrashDump: () => void;

  constructor(args: IParameters) {
    this.mArgs = args;

    // Set up main process extensions IPC handlers
    setupMainExtensions();

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

  private async startUi(): Promise<void> {
    const MainWindow = require("./MainWindow").default;

    // Read window settings from persistence before creating window
    const windowSettings = await readPersistedValue<IWindow>("settings", [
      "window",
    ]);

    // Create window with null store (renderer owns the store now) and initial window settings
    this.mMainWindow = new MainWindow(
      null,
      this.mArgs.inspector,
      windowSettings,
    );
    log("debug", "creating main window");
    return this.mMainWindow.create(null).then((webContents) => {
      if (!webContents) {
        return PromiseBB.reject(new Error("no web contents from main window"));
      }
      log("debug", "window created");

      // Send app initialization metadata to renderer
      // Renderer will dispatch Redux actions based on this
      webContents.send("app:init", this.mAppMetadata);

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
      finalizeMainWrite().then(() => {
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
        this.mMainWindow.create(null);
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
        // tslint:disable-next-line:no-submodule-imports
        require("@electron/remote/main").enable(contents);
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
    return (error: any, promise?: any) => {
      if (Application.shouldIgnoreError(error, promise)) {
        return;
      }

      // Store is now in renderer, so we can't access state from main process
      terminate(toError(error), {});
    };
  }

  private regularStart(args: IParameters): PromiseBB<void> {
    let splash: SplashScreenT | undefined;
    return (
      fs
        .writeFileAsync(this.mStartupLogPath, new Date().toUTCString())
        .catch(() => null)
        .then(() => {
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
        .then((splashIn: SplashScreenT | undefined) => {
          if (splashIn !== undefined) {
            log("debug", "showing splash screen");
          } else {
            log("debug", "starting without splash screen");
          }
          splash = splashIn;
          return this.setupPersistence().catch(DataInvalid, (err) => {
            log(
              "error",
              "persistence data invalid",
              getErrorMessageOrDefault(err),
            );
            return dialog
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
              .then(() => this.setupPersistence(true));
          });
        })
        .then(() => {
          log("debug", "checking admin rights");
          return this.warnAdmin();
        })
        .then(() => {
          log("debug", "checking how Vortex was installed");
          return this.identifyInstallType();
        })
        .then(() => {
          log("debug", "checking if migration is required");
          return this.checkUpgrade();
        })
        .then(() => {
          log("debug", "setting up error handlers");
          // Install error handler (no longer has access to store state)
          const handleError = this.genHandleError();
          process.removeAllListeners("uncaughtException");
          process.removeAllListeners("unhandledRejection");
          process.on("uncaughtException", handleError);
          process.on("unhandledRejection", handleError);
        })
        .then(() => this.initDevel())
        .then(() => {
          this.setupContextMenu();
          return PromiseBB.resolve();
        })
        .then(() => {
          log("debug", "starting user interface");
          return this.startUi();
        })
        .then(() => {
          log("debug", "setting up tray icon");
          return this.createTray();
        })
        // end initialization
        .then(() => {
          if (splash !== undefined) {
            log("debug", "removing splash screen");
          }
          this.connectTrayAndWindow();
          return splash !== undefined ? splash.fadeOut() : PromiseBB.resolve();
        })
        .catch((err) => {
          log(
            "debug",
            "quitting with exception",
            getErrorMessageOrDefault(err),
          );
          return PromiseBB.reject(err);
        })
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
                {},
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
                {},
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
        // Collect metadata - renderer will dispatch the action
        this.mAppMetadata.installType = "regular";
      })
      .catch(() => {
        this.mAppMetadata.installType = "managed";
      });
  }

  private warnAdmin(): PromiseBB<void> {
    // Read warnedAdmin from persistence since we don't have the store yet
    return PromiseBB.resolve(
      readPersistedValue<number>("app", ["warnedAdmin"]),
    ).then((warnedAdmin) => {
      return timeout(PromiseBB.resolve(isAdmin()), 1000).then((admin) => {
        if (admin === undefined || !admin) {
          return PromiseBB.resolve();
        }
        log("warn", "running as administrator");
        if ((warnedAdmin ?? 0) > 0) {
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
                // Collect metadata - renderer will dispatch the action
                this.mAppMetadata.warnedAdmin = 1;
                return PromiseBB.resolve();
              }
            }),
        );
      });
    });
  }

  private checkUpgrade(): PromiseBB<void> {
    const currentVersion = getApplication().version;
    return this.migrateIfNecessary(currentVersion).then(() => {
      // Collect metadata - renderer will dispatch the action
      this.mAppMetadata.version = currentVersion;
      return PromiseBB.resolve();
    });
  }

  private migrateIfNecessary(currentVersion: string): PromiseBB<void> {
    // Read appVersion from persistence since we don't have the store
    return PromiseBB.resolve(
      readPersistedValue<string>("app", ["appVersion"]),
    ).then((lastVersionPersisted) => {
      const lastVersion = lastVersionPersisted || "0.0.0";

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
        // Note: migrate() still uses store for now - this may need refactoring
        // if migrations need to be run before the renderer loads
        return PromiseBB.resolve();
      }
      return PromiseBB.resolve();
    });
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
    // Pass null api since ExtensionManager is now renderer-only
    //  and TrayIcon used to receive the api from there.
    this.mTray = new TrayIcon(null);
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

  /**
   * Set up persistence system for the main process.
   * In the new architecture, main process only handles persistence - renderer owns the Redux store.
   */
  private setupPersistence(repair?: boolean): PromiseBB<void> {
    // storing the last version that ran in the startup.json settings file.
    startupSettings.storeVersion = getApplication().version;

    // Initialize app metadata that will be sent to renderer
    this.mAppMetadata = {
      commandLine: this.mArgs as unknown as Record<string, unknown>,
    };

    // 1. Create LevelPersist for the base path
    // 2. Check multi-user mode from persisted user settings
    // 3. Initialize main persistence system
    // 4. Register core hives for hydration
    return LevelPersist.create(
      path.join(this.mBasePath, currentStatePath),
      undefined,
      repair ?? false,
    )
      .then((levelPersistor) => {
        this.mLevelPersistors.push(levelPersistor);
        // Read user settings to check multi-user mode
        const subPersistor = new SubPersistor(levelPersistor, "user");
        return Promise.resolve(subPersistor.getItem(["multiUser"]))
          .then((multiUserStr: string) => {
            const multiUser: boolean = multiUserStr
              ? Boolean(JSON.parse(multiUserStr))
              : false;
            return { levelPersistor, multiUser };
          })
          .catch(() => ({ levelPersistor, multiUser: false }));
      })
      .then(
        ({
          levelPersistor,
          multiUser,
        }: {
          levelPersistor: LevelPersist;
          multiUser: boolean;
        }) => {
          let dataPath = app.getPath("userData");
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
          } catch {
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
            changeLogPath(dataPath);
            log("info", "--------------------------");
            log("info", "Vortex Version", getApplication().version);
            // Create a new LevelPersist for the actual data path if different
            return LevelPersist.create(
              path.join(dataPath, currentStatePath),
              undefined,
              repair ?? false,
            ).then((newLevelPersistor) => {
              this.mLevelPersistors.push(newLevelPersistor);
              return newLevelPersistor;
            });
          } else {
            return levelPersistor;
          }
        },
      )
      .catch(DataInvalid, (err) => {
        const failedPersistor = this.mLevelPersistors.pop();
        if (!failedPersistor) {
          return PromiseBB.reject(err);
        }
        return failedPersistor.close().then(() => PromiseBB.reject(err));
      })
      .then((levelPersistor: LevelPersist) => {
        log("debug", "initializing main persistence system");
        // Initialize the IPC-based persistence system
        initMainPersistence(levelPersistor);

        // Register core hives - these will be loaded for hydration
        return PromiseBB.all([
          registerHive("app"),
          registerHive("user"),
          registerHive("settings"),
          registerHive("persistent"),
          registerHive("confidential"),
        ]);
      })
      .then(() => {
        // Read instanceId from persistence for metadata
        return readPersistedValue<string>("app", ["instanceId"]).then(
          (instanceId) => {
            if (instanceId === undefined) {
              this.mFirstStart = true;
              const newId = uuid.v4();
              log("debug", "first startup, generated instance id", {
                instanceId: newId,
              });
              this.mAppMetadata.instanceId = newId;
            } else {
              log("debug", "startup instance", { instanceId });
              this.mAppMetadata.instanceId = instanceId;
            }
          },
        );
      })
      .then(() => {
        log("debug", "persistence setup complete");
      });
  }

  private initDevel(): PromiseBB<void> {
    if (process.env.NODE_ENV === "development") {
      const { installDevelExtensions } = require("../util/devel") as any;
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
    // Read maximized setting from persistence since store is in renderer
    readPersistedValue<boolean>("settings", ["window", "maximized"])
      .then((maximized) => {
        try {
          this.mMainWindow?.show(maximized ?? false, startMinimized);
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
        setWindow(this.mMainWindow?.getHandle() ?? null);
      })
      .catch((err) => {
        log(
          "error",
          "failed to read window settings",
          getErrorMessageOrDefault(err),
        );
        // Fall back to non-maximized
        this.mMainWindow?.show(false, startMinimized);
        setWindow(this.mMainWindow?.getHandle() ?? null);
      });
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

export default Application;
