import type { IParameters, ISetItem } from "@vortex/shared/cli";
import type { AppInitMetadata } from "@vortex/shared/ipc";
import type { IWindow } from "@vortex/shared/state";

import { ApplicationData } from "@vortex/shared";
import {
  getErrorCode,
  getErrorMessageOrDefault,
  unknownToError,
} from "@vortex/shared";
import {
  DataInvalid,
  DocumentsPathMissing,
  ProcessCanceled,
  UserCanceled,
} from "@vortex/shared/errors";
import { currentStatePath } from "@vortex/shared/state";
import crashDump from "crash-dump";
import { app, dialog, ipcMain, protocol, shell } from "electron";
import contextMenu from "electron-context-menu";
import isAdmin from "is-admin";
import * as _ from "lodash";
import { mkdirSync, statSync } from "node:fs";
import { writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import permissions from "permissions";
import * as semver from "semver";
import { v4 as uuidv4 } from "uuid";
import winapi from "winapi-bindings";

import { parseCommandline, updateStartupSettings } from "./cli";
import { terminate } from "./errorHandling";
import { disableErrorReporting } from "./errorReporting";
import { setupMainExtensions } from "./extensions";
import { validateFiles } from "./fileValidation";
import getVortexPath, { setVortexPath } from "./getVortexPath";
import { log, setupLogging, changeLogPath } from "./logging";
import MainWindow from "./MainWindow";
import SplashScreen from "./SplashScreen";
import LevelPersist, { DatabaseLocked } from "./store/LevelPersist";
import {
  initMainPersistence,
  readPersistedValue,
  registerHive,
  finalizeMainWrite,
} from "./store/mainPersistence";
import SubPersistor from "./store/SubPersistor";
import TrayIcon from "./TrayIcon";

/** test if the running version is a major downgrade (downgrading by a major or minor version,
/ everything except a patch) compared to what was running last */
export function isMajorDowngrade(previous: string, current: string): boolean {
  const majorL = semver.major(previous);
  const majorR = semver.major(current);

  if (majorL !== majorR) {
    return majorL > majorR;
  } else {
    return semver.minor(previous) > semver.minor(current);
  }
}

class Application {
  public static shouldIgnoreError(error: unknown, promise?: unknown): boolean {
    const err = unknownToError(error);
    if (err instanceof UserCanceled || err instanceof ProcessCanceled) {
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
  private mLevelPersistors: LevelPersist[] = [];
  private mArgs: IParameters;
  private mMainWindow: MainWindow;
  private mTray: TrayIcon;
  private mAppMetadata: AppInitMetadata;
  private mFirstStart: boolean = false;
  private mStartupLogPath: string;
  private mDeinitCrashDump: () => void;

  constructor(args: IParameters) {
    this.mArgs = args;

    // Initialize ApplicationData cache for IPC handlers
    // This must happen before any IPC handlers are called by the renderer
    ApplicationData.set({
      appName: app.getName(),
      appVersion: app.getVersion(),
      vortexPaths: {
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
      },
    });

    // Set up main process extensions IPC handlers
    setupMainExtensions();

    ipcMain.on("show-window", () => this.showMainWindow(args?.startMinimized));
    app.commandLine.appendSwitch(
      "js-flags",
      `--max-old-space-size=${args.maxMemory || 4096}`,
    );

    this.mBasePath = app.getPath("userData");
    mkdirSync(this.mBasePath, { recursive: true });

    setVortexPath("temp", () => path.join(getVortexPath("userData"), "temp"));
    const tempPath = getVortexPath("temp");
    mkdirSync(path.join(tempPath, "dumps"), { recursive: true });

    this.mStartupLogPath = path.join(tempPath, "startup.log");
    try {
      statSync(this.mStartupLogPath);
      process.env.CRASH_REPORTING = Math.random() > 0.5 ? "vortex" : "electron";
    } catch {
      // nop, this is the expected case
    }

    // NOTE(erri120): crash-dump is mistyped
    this.mDeinitCrashDump = (crashDump as any).default(
      path.join(tempPath, "dumps", `crash-main-${Date.now()}.dmp`),
    );

    const enableLogging =
      process.env.NODE_ENV === "development" ||
      process.env.VORTEX_ENABLE_LOGGING === "1";
    setupLogging(app.getPath("userData"), enableLogging);
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
        _event: Electron.Event,
        params: Electron.ContextMenuParams,
      ) => {
        // currently only offer menu on selected text
        return params.selectionText.length > 0;
      },
    });
  }

  private async startUi(): Promise<void> {
    // Read window settings from persistence before creating window
    const windowSettings = await readPersistedValue<IWindow>("settings", [
      "window",
    ]);

    this.mMainWindow = new MainWindow(this.mArgs.inspector, windowSettings);
    log("debug", "creating main window");

    const webContents = await this.mMainWindow.create();
    if (!webContents) {
      throw new Error("no web contents from main window");
    }

    log("debug", "window created");

    // Send app initialization metadata to renderer
    // Renderer will dispatch Redux actions based on this
    webContents.send("app:init", this.mAppMetadata);
  }

  private async startSplash(): Promise<SplashScreen> {
    const splash = new SplashScreen();
    await splash.create(this.mArgs.disableGPU);
    return splash;
  }

  private setupAppEvents(args: IParameters): void {
    app.on("window-all-closed", () => {
      log("info", "Vortex closing");
      finalizeMainWrite()
        .then(() => {
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
        })
        .catch((err: unknown) => log("error", "error finalizing write", err));
    });

    app.on("activate", () => {
      if (this.mMainWindow !== undefined) {
        this.mMainWindow.create();
      }
    });

    app.on("second-instance", (_event: Event, secondaryArgv: string[]) => {
      log("debug", "getting arguments from second instance", secondaryArgv);
      this.applyArguments(parseCommandline(secondaryArgv, true)).catch(
        (err: unknown) => log("error", "error applying arguments", err),
      );
    });

    const onReady = () => {
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
      protocol.registerHttpProtocol("nxm", (request) => {
        const cfgFile: IParameters = { download: request.url };
        this.applyArguments(cfgFile).catch((err: unknown) =>
          log("error", "error applying arguments", err),
        );
      });

      let startupMode: Promise<void> | undefined = undefined;
      if (args.get) {
        startupMode = this.handleGet(args.get, userData);
      } else if (args.set) {
        startupMode = this.handleSet(args.set, userData);
      } else if (args.del) {
        startupMode = this.handleDel(args.del, userData);
      }

      if (startupMode !== undefined) {
        startupMode
          .then(() => app.quit())
          .catch((err: unknown) => console.error(err));
      } else {
        this.regularStart(args).catch((err: unknown) => console.error(err));
      }
    };

    app
      .whenReady()
      .then(onReady)
      .catch((err: unknown) => log("error", "error starting application", err));

    app.on(
      "web-contents-created",
      (_event: Electron.Event, contents: Electron.WebContents) => {
        contents.on("will-attach-webview", this.attachWebView);
      },
    );

    // Enable F12 to toggle DevTools in all builds
    app.on("browser-window-created", (_, window) => {
      const { webContents } = window;
      webContents.on("before-input-event", (_, input) => {
        if (input.type !== "keyDown") return;
        if (input.code !== "F12") return;
        webContents.toggleDevTools();
      });
    });
  }

  private attachWebView = (
    _event: Electron.Event,
    webPreferences: Electron.WebPreferences & { preloadURL?: string },
    _params,
  ) => {
    // disallow creation of insecure webviews

    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    webPreferences.nodeIntegration = false;
  };

  private genHandleError() {
    return (error: Error, promise?: unknown) => {
      if (Application.shouldIgnoreError(error, promise)) {
        return;
      }

      terminate(error);
    };
  }

  private async regularStart(args: IParameters): Promise<void> {
    try {
      await writeFile(this.mStartupLogPath, new Date().toUTCString());
    } catch {
      // ignore
    }

    try {
      await this.regularStartInner(args);
    } catch (err) {
      log("error", "quitting with exception", getErrorMessageOrDefault(err));

      if (err instanceof UserCanceled) {
        app.exit();
      } else if (err instanceof ProcessCanceled) {
        app.quit();
      } else if (err instanceof DocumentsPathMissing) {
        const response = await dialog.showMessageBox(
          this.mMainWindow.getHandle(),
          {
            type: "error",
            buttons: ["Close", "More info"],
            defaultId: 1,
            title: "Error",
            message: "Startup failed",
            detail:
              'Your "My Documents" folder is missing or is ' +
              "misconfigured. Please ensure that the folder is properly " +
              "configured and accessible, then try again.",
          },
        );

        if (response.response === 1) {
          await shell.openExternal(
            `https://wiki.nexusmods.com/index.php/Misconfigured_Documents_Folder`,
          );
        }

        app.quit();
      } else if (err instanceof DatabaseLocked) {
        dialog.showErrorBox(
          "Startup failed",
          "Vortex seems to be running already. " +
            "If you can't see it, please check the task manager.",
        );

        app.quit();
      } else {
        const code = getErrorCode(err);
        if (code === "ENOSPC") {
          dialog.showErrorBox(
            "Startup failed",
            "Your system drive is full. " +
              "You should always ensure your system drive has some space free (ideally " +
              "at least 10% of the total capacity, especially on SSDs). " +
              "Vortex can't start until you have freed up some space.",
          );
          app.quit();
          return;
        }

        const error = unknownToError(err);
        terminate(error);
      }
    } finally {
      try {
        await rm(this.mStartupLogPath);
      } catch {
        // ignore
      }
    }
  }

  private async regularStartInner(args: IParameters): Promise<void> {
    log("info", "--------------------------");
    log("info", "Vortex Version", app.getVersion());
    log("info", "Parameters", process.argv.join(" "));

    this.testUserEnvironment();
    await this.validateFiles();

    let splash: SplashScreen | undefined = undefined;

    if (!args.startMinimized) {
      log("debug", "showing splash screen");
      splash = await this.startSplash();
    } else {
      log("debug", "starting without splash screen");
    }

    try {
      await this.setupPersistence();
    } catch (err) {
      if (err instanceof DataInvalid) {
        log("error", "persistence data invalid", getErrorMessageOrDefault(err));

        await dialog.showMessageBox(this.mMainWindow.getHandle(), {
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
        });

        await this.setupPersistence(true);
      } else {
        throw err;
      }
    }

    log("debug", "checking admin rights");
    await this.warnAdmin();

    log("debug", "checking how Vortex was installed");
    await this.identifyInstallType();

    log("debug", "checking if migration is required");
    await this.checkUpgrade();

    log("debug", "setting up error handlers");
    // Install error handler (no longer has access to store state)
    const handleError = this.genHandleError();
    process.removeAllListeners("uncaughtException");
    process.removeAllListeners("unhandledRejection");
    process.on("uncaughtException", handleError);
    process.on("unhandledRejection", handleError);

    await this.initDevel();

    this.setupContextMenu();

    log("debug", "starting user interface");
    await this.startUi();

    log("debug", "setting up tray icon");
    this.createTray();

    if (splash) {
      log("debug", "removing splash screen");
      await splash.fadeOut();
    }

    this.connectTrayAndWindow();
  }

  private isUACEnabled(): boolean {
    if (process.platform !== "win32") {
      return true;
    }

    const getSystemPolicyValue = (key: string) => {
      try {
        const res = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
          key,
        );
        log("debug", "UAC settings found", `${key}: ${res.value}`);
        return { key, type: res.type, value: res.value };
      } catch (err) {
        // We couldn't retrieve the value, log this and resolve positively
        //  as the user might have a version of Windows that does not use
        //  the key we're looking for.
        log("debug", "failed to check UAC settings", err);
        return undefined;
      }
    };

    const promptBehaviorAdmin = getSystemPolicyValue(
      "ConsentPromptBehaviorAdmin",
    );
    const promptBehaviorUser = getSystemPolicyValue(
      "ConsentPromptBehaviorUser",
    );

    if (!promptBehaviorAdmin) return true;
    return (
      promptBehaviorAdmin.type === "REG_DWORD" &&
      promptBehaviorAdmin.value === 1
    );
  }

  private async identifyInstallType(): Promise<void> {
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

    try {
      await stat(
        path.join(getVortexPath("application"), "Uninstall Vortex.exe"),
      );
      // Collect metadata - renderer will dispatch the action
      this.mAppMetadata.installType = "regular";
    } catch {
      this.mAppMetadata.installType = "managed";
    }
  }

  private async warnAdmin(): Promise<void> {
    // Read warnedAdmin from persistence since we don't have the store yet
    const warnedAdmin = await readPersistedValue<number>("app", [
      "warnedAdmin",
    ]);

    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });

    const isAdminResult = await Promise.race([timeout, isAdmin()]);
    if (typeof isAdminResult !== "boolean" || !isAdminResult) return;

    log("warn", "running as administrator");
    if ((warnedAdmin ?? 0) > 0) {
      return;
    }

    const uacEnabled = this.isUACEnabled();
    const result = await dialog.showMessageBox(this.mMainWindow.getHandle(), {
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
    });

    if (result.response === 0) {
      app.quit();
    } else {
      // Collect metadata - renderer will dispatch the action
      this.mAppMetadata.warnedAdmin = 1;
    }
  }

  private async checkUpgrade(): Promise<void> {
    const currentVersion = app.getVersion();
    await this.migrateIfNecessary(currentVersion);
    // Collect metadata - renderer will dispatch the action
    this.mAppMetadata.version = currentVersion;
  }

  private async migrateIfNecessary(currentVersion: string): Promise<void> {
    // Read appVersion from persistence since we don't have the store
    const lastVersionPersisted = await readPersistedValue<string>("app", [
      "appVersion",
    ]);
    const lastVersion = lastVersionPersisted || "0.0.0";

    if (this.mFirstStart || process.env.NODE_ENV === "development") {
      // don't check version change in development builds or on first start
      return;
    }

    if (isMajorDowngrade(lastVersion, currentVersion)) {
      const res = dialog.showMessageBoxSync(this.mMainWindow.getHandle(), {
        type: "warning",
        title: "Downgrade detected",
        message: `You're using a version of Vortex that is older than the version you ran previously.
      Active version: (${currentVersion}) Previously run: (${lastVersion}). Continuing to run this
      older version may cause irreversible damage to your application state and setup. Continue at your own risk. `,
        buttons: ["Quit", "Continue at your own risk"],
        noLink: true,
      });

      if (res === 0) {
        app.quit();
        throw new UserCanceled();
      }
    } else if (semver.gt(currentVersion, lastVersion)) {
      log("info", "Vortex was updated, checking for necessary migrations");
      // Note: migrate() still uses store for now - this may need refactoring
      // if migrations need to be run before the renderer loads
    }
  }

  private splitPath(statePath: string): string[] {
    return (
      statePath
        .match(/(\\.|[^.])+/g)
        ?.map((input) => input.replace(/\\(.)/g, "$1")) ?? []
    );
  }

  private async handleGet(getPaths: string[], dbPath: string): Promise<void> {
    const persist = await Promise.resolve(LevelPersist.create(dbPath));
    const keys = await Promise.resolve(persist.getAllKeys());

    try {
      const promises = getPaths.map(async (getPath) => {
        const pathArray = this.splitPath(getPath);
        const matches = keys.filter((key) =>
          _.isEqual(key.slice(0, pathArray.length), pathArray),
        );

        try {
          const output = await Promise.all(
            matches.map(async (match) => {
              const value = await Promise.resolve(persist.getItem(match));
              return `${match.join(".")} = ${value}`;
            }),
          );

          process.stdout.write(output.join("\n") + "\n");
        } catch (err) {
          process.stderr.write(getErrorMessageOrDefault(err) + "\n");
        }
      });

      await Promise.allSettled(promises);
    } catch (err) {
      process.stderr.write(getErrorMessageOrDefault(err) + "\n");
    } finally {
      await Promise.resolve(persist.close());
    }
  }

  private async handleSet(
    setParameters: ISetItem[],
    dbPath: string,
  ): Promise<void> {
    const persist = await Promise.resolve(LevelPersist.create(dbPath));

    try {
      const promises = setParameters.map(async (setParameter) => {
        const pathArray = this.splitPath(setParameter.key);
        const newValue: string | undefined =
          setParameter.value.length === 0 ? undefined : setParameter.value;
        await persist.setItem(pathArray, newValue);
      });

      await Promise.all(promises);
      process.stdout.write("changed\n");
    } catch (err) {
      process.stderr.write(getErrorMessageOrDefault(err) + "\n");
    } finally {
      await Promise.resolve(persist.close());
    }
  }

  private async handleDel(delPaths: string[], dbPath: string): Promise<void> {
    const persist = await Promise.resolve(LevelPersist.create(dbPath));
    const keys = await Promise.resolve(persist.getAllKeys());

    try {
      const promises = delPaths.map(async (getPath) => {
        const pathArray = this.splitPath(getPath);
        const matches = keys.filter((key) =>
          _.isEqual(key.slice(0, pathArray.length), pathArray),
        );

        try {
          await Promise.all(
            matches.map(async (match) => {
              await Promise.resolve(persist.removeItem(match));
              process.stdout.write(`removed ${match.join(".")}\n`);
            }),
          );
        } catch (err) {
          process.stderr.write(getErrorMessageOrDefault(err) + "\n");
        }
      });

      await Promise.allSettled(promises);
    } catch (err) {
      process.stderr.write(getErrorMessageOrDefault(err) + "\n");
    } finally {
      await Promise.resolve(persist.close());
    }
  }

  private createTray(): void {
    // Pass null api since ExtensionManager is now renderer-only
    //  and TrayIcon used to receive the api from there.
    this.mTray = new TrayIcon();
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
        mkdirSync(muPath, { recursive: true });
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
  private async setupPersistence(repair?: boolean): Promise<void> {
    // storing the last version that ran in the startup.json settings file.
    updateStartupSettings((startupSettings) => {
      startupSettings.storeVersion = app.getVersion();
      return startupSettings;
    });

    // Initialize app metadata that will be sent to renderer
    this.mAppMetadata = {
      commandLine: this.mArgs as unknown as Record<string, unknown>,
    };

    // 1. Create LevelPersist for the base path
    const levelPersistor = await LevelPersist.create(
      path.join(this.mBasePath, currentStatePath),
      undefined,
      repair ?? false,
    );

    try {
      this.mLevelPersistors.push(levelPersistor);

      // 2. Read user settings to check multi-user mode
      const subPersistor = new SubPersistor(levelPersistor, "user");
      let multiUser = false;
      try {
        const multiUserStr = await subPersistor.getItem(["multiUser"]);
        multiUser = multiUserStr ? Boolean(JSON.parse(multiUserStr)) : false;
      } catch {
        multiUser = false;
      }

      // 3. Determine data path
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
        statSync(dataPath);
      } catch {
        mkdirSync(dataPath, { recursive: true });
        created = true;
      }
      if (multiUser && created) {
        permissions.allow(dataPath, "group", "rwx");
      }
      mkdirSync(path.join(dataPath, "temp"), { recursive: true });

      log("info", `using ${dataPath} as the storage directory`);

      // 4. If multi-user or custom userData, create new LevelPersist for actual data path
      let finalPersistor = levelPersistor;
      if (multiUser || this.mArgs.userData !== undefined) {
        log(
          "info",
          "all further logging will happen in",
          path.join(dataPath, "vortex.log"),
        );
        changeLogPath(dataPath);
        log("info", "--------------------------");
        log("info", "Vortex Version", app.getVersion());

        const newLevelPersistor = await LevelPersist.create(
          path.join(dataPath, currentStatePath),
          undefined,
          repair ?? false,
        );
        this.mLevelPersistors.push(newLevelPersistor);
        finalPersistor = newLevelPersistor;
      }

      // 5. Initialize the IPC-based persistence system
      log("debug", "initializing main persistence system");
      initMainPersistence(finalPersistor);

      // 6. Register core hives - these will be loaded for hydration
      await Promise.all([
        registerHive("app"),
        registerHive("user"),
        registerHive("settings"),
        registerHive("persistent"),
        registerHive("confidential"),
      ]);

      // 7. Read instanceId from persistence for metadata
      const instanceId = await readPersistedValue<string>("app", [
        "instanceId",
      ]);
      if (instanceId === undefined) {
        this.mFirstStart = true;
        const newId = uuidv4();
        log("debug", "first startup, generated instance id", {
          instanceId: newId,
        });
        this.mAppMetadata.instanceId = newId;
      } else {
        log("debug", "startup instance", { instanceId });
        this.mAppMetadata.instanceId = instanceId;
      }

      log("debug", "persistence setup complete");
    } catch (err) {
      if (err instanceof DataInvalid) {
        const failedPersistor = this.mLevelPersistors.pop();
        if (failedPersistor) {
          await failedPersistor.close();
        }
      }
      throw err;
    }
  }

  private async initDevel(): Promise<void> {
    if (process.env.NODE_ENV === "development") {
      const { installDevelExtensions } = await import("./devel.js");
      await installDevelExtensions();
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
      })
      .catch((err) => {
        log(
          "error",
          "failed to read window settings",
          getErrorMessageOrDefault(err),
        );
        // Fall back to non-maximized
        this.mMainWindow?.show(false, startMinimized);
      });
  }

  private testUserEnvironment(): void {
    // Should be used to test the user's environment for known
    //  issues before starting up Vortex.
    // On Windows:
    //  - Ensure we're able to retrieve the user's documents folder.
    if (process.platform !== "win32") return;

    try {
      app.getPath("documents");
    } catch {
      throw new DocumentsPathMissing();
    }
  }

  private async validateFiles(): Promise<void> {
    const validation = await validateFiles(getVortexPath("assets_unpacked"));
    if (validation.changed.length === 0 && validation.missing.length === 0)
      return;

    const { response } = await dialog.showMessageBox(null, {
      type: "error",
      title: "Installation corrupted",
      message:
        "Your Vortex installation has been corrupted. " +
        "This could be the result of a virus or manual manipulation. " +
        "Vortex might still appear to work (partially) but we suggest " +
        "you reinstall it. For more information please refer to Vortex's log files.",
      noLink: true,
      buttons: ["Quit", "Ignore"],
    });

    if (response === 0) {
      app.quit();
    } else {
      disableErrorReporting();
    }
  }

  private async applyArguments(args: IParameters): Promise<void> {
    if (!args.download && !args.install && !args.installArchive) {
      if (this.mMainWindow) {
        // Vortex's executable has been run without download/install arguments;
        //  this is potentially down to the user not realizing that Vortex is minimized
        //  leading him to try to start up Vortex again - we just display the main
        //  window in this case.
        this.showMainWindow(args.startMinimized);
      }

      return;
    }

    const delay = this.mMainWindow
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 2000);
        });

    await delay;
    if (!this.mMainWindow) {
      // TODO: this instructions aren't very correct because we know Vortex doesn't have
      // a UI and needs to be shut down from the task manager
      dialog.showErrorBox(
        "Vortex unresponsive",
        "Vortex appears to be frozen, please close Vortex and try again",
      );

      return;
    }

    if (args.download || args.install) {
      this.mMainWindow.sendExternalURL(
        args.download || args.install,
        args.install !== undefined,
      );
    }

    if (args.installArchive) {
      this.mMainWindow.installModFromArchive(args.installArchive);
    }
  }
}

export default Application;
