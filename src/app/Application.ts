import {setApplicationVersion, setInstallType, setInstanceId, setWarnedAdmin} from '../actions/app';
import { NEXUS_DOMAIN } from '../extensions/nexus_integration/constants';
import { STATE_BACKUP_PATH } from '../reducers/index';
import { ThunkStore } from '../types/IExtensionContext';
import type { IPresetStep, IPresetStepHydrateState } from '../types/IPreset';
import {IState} from '../types/IState';
import { getApplication } from '../util/application';
import commandLine, {IParameters, ISetItem, relaunch} from '../util/commandLine';
import { DataInvalid, DocumentsPathMissing, ProcessCanceled,
         UserCanceled } from '../util/CustomErrors';
import * as develT from '../util/devel';
import { didIgnoreError, disableErrorReport, getVisibleWindow, setOutdated, setWindow,
         terminate, toError } from '../util/errorHandling';
import ExtensionManagerT from '../util/ExtensionManager';
import { validateFiles } from '../util/fileValidation';
import * as fs from '../util/fs';
import getVortexPath, { setVortexPath } from '../util/getVortexPath';
import lazyRequire from '../util/lazyRequire';
import LevelPersist, { DatabaseLocked } from '../util/LevelPersist';
import {log, setLogPath, setupLogging} from '../util/log';
import { prettifyNodeErrorMessage, showError } from '../util/message';
import migrate from '../util/migrate';
import { isWindows, isMacOS } from '../util/platform';
import { initializeMacOSPermissions } from '../util/macosPermissions';
import { applyMacOSPerformanceOptimizations } from '../util/macosPerformance';
import presetManager from '../util/PresetManager';
import { StateError } from '../util/reduxSanity';
import startupSettings from '../util/startupSettings';
import { allHives, createFullStateBackup, createVortexStore, currentStatePath, extendStore,
         finalizeStoreWrite,
         importState, insertPersistor, markImported, querySanitize } from '../util/store';
import {} from '../util/storeHelper';
import SubPersistor from '../util/SubPersistor';
import { isMajorDowngrade, replaceRecursive, spawnSelf, timeout, truthy } from '../util/util';
import { initializeNativeThemeManager } from '../util/nativeThemeManager';

import { addNotification, setCommandLine, showDialog } from '../actions';

import MainWindowT from './MainWindow';
import SplashScreenT from './SplashScreen';
import TrayIconT from './TrayIcon';
import { MacOSDockManager } from '../util/macOSDockManager';
import { MacOSWindowManager } from '../util/macOSWindowManager';
import { MacOSNotificationManager } from '../util/macOSNotificationManager';
import { MacOSQuickLookManager } from '../util/macOSQuickLookManager';
import { MacOSServicesManager } from '../util/macOSServicesManager';
import { MacOSHandoffManager } from '../util/macOSHandoffManager';
import { MacOSShortcutsManager } from '../util/macOSShortcutsManager';

import * as msgpackT from '@msgpack/msgpack';
// TODO: Remove Bluebird import - using native Promise;
import { promiseMapSeries } from '../util/bluebird-migration-helpers.local';
import crashDumpT from 'crash-dump';
import {app, crashReporter as crashReporterT, dialog, ipcMain, protocol, shell} from 'electron';
import contextMenu from 'electron-context-menu';
import isAdmin = require('is-admin');
import * as _ from 'lodash';
import * as os from 'os';
import * as path from 'path';
import * as permissionsT from 'permissions';
import * as semver from 'semver';
import * as uuidT from 'uuid';

const uuid = lazyRequire<typeof uuidT>(() => require('uuid'));
const permissions = lazyRequire<typeof permissionsT>(() => require('permissions'));
const winapi = isWindows() ? lazyRequire(() => (isWindows() ? require('winapi-bindings') : undefined)) : undefined;

const STATE_CHUNK_SIZE = 128 * 1024;

function last(array: any[]): any {
  if (array.length === 0) {
    return undefined;
  }
  return array[array.length - 1];
}

class Application {
  public static shouldIgnoreError(error: any, promise?: any): boolean {
    if (error instanceof UserCanceled) {
      return true;
    }

    if (!truthy(error)) {
      log('error', 'empty error unhandled', { wasPromise: promise !== undefined });
      return true;
    }

    if (error.message === 'Object has been destroyed') {
      // This happens when Vortex crashed because of something else so there is no point
      // reporting this, it might otherwise obfuscate the actual problem
      return true;
    }

    // this error message appears to happen as the result of some other problem crashing the
    // renderer process, so all this may do is obfuscate what's actually going on.
    if (error.message.includes('Error processing argument at index 0, conversion failure from')) {
      return true;
    }

    if (['net::ERR_CONNECTION_RESET',
      'net::ERR_CONNECTION_ABORTED',
      'net::ERR_ABORTED',
      'net::ERR_CONTENT_LENGTH_MISMATCH',
      'net::ERR_SSL_PROTOCOL_ERROR',
      'net::ERR_HTTP2_PROTOCOL_ERROR',
      'net::ERR_INCOMPLETE_CHUNKED_ENCODING'].includes(error.message)
        || ['ETIMEDOUT', 'ECONNRESET', 'EPIPE'].includes(error.code)) {
      log('warn', 'network error unhandled', error.stack);
      return true;
    }

    if (['EACCES', 'EPERM'].includes(error.errno)
      && (error.path !== undefined)
      && (error.path.indexOf('vortex-setup') !== -1)) {
      // It's wonderous how electron-builder finds new ways to be more shit without even being
      // updated. Probably caused by node update
      log('warn', 'suppressing error message', { message: error.message, stack: error.stack });
      return true;
    }

    return false;
  }

  private mBasePath: string;
  private mStore: ThunkStore<IState>;
  private mLevelPersistors: LevelPersist[] = [];
  private mArgs: IParameters;
  private mMainWindow: MainWindowT;
  private mExtensions: ExtensionManagerT;
  private mTray: TrayIconT;
  private mDockManager: MacOSDockManager;
  private mWindowManager: MacOSWindowManager;
  private mNotificationManager: MacOSNotificationManager;
  private mQuickLookManager: MacOSQuickLookManager;
  private mServicesManager: MacOSServicesManager;
  private mHandoffManager: MacOSHandoffManager;
  private mShortcutsManager: MacOSShortcutsManager;
  private mFirstStart: boolean = false;
  private mStartupLogPath: string;
  private mDeinitCrashDump: () => void;

  // Add methods for touch bar support
  public refresh(): void {
    if (this.mMainWindow) {
      try {
        this.mMainWindow.getHandle().webContents.send('refresh-main-window');
      } catch (err) {
        log('warn', 'Failed to send refresh command to main window', err.message);
      }
    }
  }

  public openSettings(): void {
    if (this.mMainWindow) {
      try {
        this.mMainWindow.getHandle().webContents.send('show-settings');
      } catch (err) {
        log('warn', 'Failed to send settings command to main window', err.message);
      }
    }
  }

  // Add method to get the main window for accessibility features
  public getMainWindow(): MainWindowT {
    return this.mMainWindow;
  }

  // Add method to check for updates
  public checkForUpdates(): void {
    // This will be handled by the auto-update system in main.ts
    // We can emit an event to show a checking notification in the UI
    if (this.mExtensions) {
      try {
        this.mExtensions.getApi().sendNotification({
          id: 'checking-for-updates',
          type: 'info',
          message: 'Checking for updates...',
          noDismiss: true,
          displayMS: 2000
        });
      } catch (err) {
        log('warn', 'Failed to send checking updates notification', err.message);
      }
    }
  }

  constructor(args: IParameters) {
    this.mArgs = args;

    ipcMain.on('show-window', () => this.showMainWindow(args?.startMinimized));
    process.env['UV_THREADPOOL_SIZE'] = (os.cpus().length * 1.5).toString();
    app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${args.maxMemory || 4096}`);

    this.mBasePath = app.getPath('userData');
    fs.ensureDirSync(this.mBasePath);

    setVortexPath('temp', () => path.join(getVortexPath('userData'), 'temp'));
    const tempPath = getVortexPath('temp');
    fs.ensureDirSync(path.join(tempPath, 'dumps'));

    this.mStartupLogPath = path.join(tempPath, 'startup.log');
    try {
      fs.statSync(this.mStartupLogPath);
      process.env.CRASH_REPORTING = Math.random() > 0.5 ? 'vortex' : 'electron';
    } catch (err) {
      // nop, this is the expected case
    }

    if (process.env.CRASH_REPORTING === 'electron') {
      const crashReporter: typeof crashReporterT = require('electron').crashReporter;
      crashReporter.start({
        productName: 'Vortex',
        uploadToServer: false,
        submitURL: '',
      });
      app.setPath('crashDumps', path.join(tempPath, 'dumps'));
    } else if (process.env.CRASH_REPORTING === 'vortex') {
      const crashDump: typeof crashDumpT = require('crash-dump').default;
      this.mDeinitCrashDump =
        crashDump(path.join(tempPath, 'dumps', `crash-main-${Date.now()}.dmp`));
    }

    setupLogging(app.getPath('userData'), process.env.NODE_ENV === 'development');
    this.setupAppEvents(args);
  }

  private setupContextMenu() {
    contextMenu({
      showCopyImage: false,
      showLookUpSelection: false,
      showSaveImageAs: false,
      showInspectElement: false,
      showSearchWithGoogle: false,
      shouldShowMenu: (event: Electron.Event, params: Electron.ContextMenuParams) => {
        // currently only offer menu on selected text
        return params.selectionText.length > 0;
      },
    });
  }

  private startUi(): Promise<void> {
    const MainWindow = require('./MainWindow').default;
    this.mMainWindow = new MainWindow(this.mStore, this.mArgs.inspector);
    log('debug', 'creating main window');
    return this.mMainWindow.create(this.mStore).then(webContents => {
      log('debug', 'window created');
      this.mExtensions.setupApiMain(this.mStore, webContents);
      setOutdated(this.mExtensions.getApi());

      // Initialize native theme manager after store and extensions are ready
      try {
        initializeNativeThemeManager(this.mExtensions.getApi());
        log('debug', 'native theme manager initialized');
      } catch (error) {
        log('warn', 'failed to initialize native theme manager', error.message);
      }

      // Show the main window after everything is ready
      this.showMainWindow(this.mArgs?.startMinimized);

      // Initialize macOS-specific permissions
      if (isMacOS() && this.mMainWindow) {
        try {
          initializeMacOSPermissions(this.mMainWindow.getHandle());
          // Apply macOS performance optimizations
          applyMacOSPerformanceOptimizations(this.mMainWindow.getHandle());
        } catch (err) {
          log('warn', 'Failed to initialize macOS permissions', err.message);
        }
      }

      // in the past we would process some command line arguments the same as we do when
      // they get passed in from a second instance but that was inconsistent
      // because we don't use most arguments from secondary instances and the
      // rest get handled by the extension they are intended for.
      // so now "applyArguments()" is only intended for forwarding messages from
      // secondary instances

      if (didIgnoreError()) {
        webContents.send('did-ignore-error', true);
      }
      return Promise.resolve();
    });
  }

  private startSplash(): Promise<SplashScreenT> {
    const SplashScreen = require('./SplashScreen').default;
    const splash: SplashScreenT = new SplashScreen();
    return splash.create(this.mArgs.disableGPU)
      .then(() => {
        setWindow(splash.getHandle());
        return splash;
      });
  }

  private setupAppEvents(args: IParameters) {
    app.on('window-all-closed', () => {
      log('info', 'Vortex closing');
      finalizeStoreWrite()
        .then(() => {
          log('info', 'clean application end');
          if (this.mTray !== undefined) {
            this.mTray.close();
          }
          if (this.mDeinitCrashDump !== undefined) {
            this.mDeinitCrashDump();
          }
          if (!isMacOS()) {
            app.quit();
          }
        });
    });

    app.on('activate', () => {
      if (this.mMainWindow !== undefined) {
        this.mMainWindow.create(this.mStore);
      }
    });

    app.on('second-instance', (event: Event, secondaryArgv: string[]) => {
      log('debug', 'getting arguments from second instance', secondaryArgv);
      this.applyArguments(commandLine(secondaryArgv, true));
    });

    if (isMacOS()) {
      app.on('open-url', (event: Electron.Event, url: string) => {
        event.preventDefault();
        log('debug', 'received open-url', url);
        this.applyArguments({ download: url });
      });
    }

    app.whenReady().then(() => {
      // Set the dock icon on macOS
      if (isMacOS()) {
        const iconPath = path.join(getVortexPath('assets'), 'images', 'vortex.png');
        app.dock.setIcon(iconPath);

        // Enable macOS-specific drag and drop enhancements
        // This allows files to be dropped onto the Vortex dock icon
        app.dock.setBadge('');
      }

      const vortexPath = process.env.NODE_ENV === 'development'
        ? 'vortex_devel'
        : 'vortex';

      // if userData specified, use it
      let userData = args.userData
          // (only on windows) use ProgramData from environment
          ?? ((args.shared && isWindows())
            ? path.join(process.env.ProgramData, 'vortex')
            // this allows the development build to access data from the
            // production version and vice versa
            : path.resolve(app.getPath('userData'), '..', vortexPath));
      userData = path.join(userData, currentStatePath);

      // handle nxm:// internally
      protocol.registerHttpProtocol('nxm', (request, callback) => {
        const cfgFile: IParameters = {download: request.url};
        this.applyArguments(cfgFile);
      });

      let startupMode: Promise<void>;
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

    // Add macOS-specific event handlers for drag and drop
    if (isMacOS()) {
      app.on('open-file', (event: Electron.Event, path: string) => {
        event.preventDefault();
        log('info', 'File dropped on macOS dock', { path });
        // Handle file dropped on dock icon
        if (this.mExtensions) {
          this.mExtensions.getApi().events.emit('open-file', path);
        }
      });
    }

    app.on('web-contents-created', (event: Electron.Event, contents: Electron.WebContents) => {
      // tslint:disable-next-line:no-submodule-imports
      require('@electron/remote/main').enable(contents);
      contents.on('will-attach-webview', this.attachWebView);
    });
  }

  private attachWebView = (event: Electron.Event,
                           webPreferences: Electron.WebPreferences & { preloadURL: string },
                           params) => {
    // disallow creation of insecure webviews

    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    webPreferences.nodeIntegration = false;
  }

  private genHandleError() {
    return (error: any, promise?: any) => {
      if (Application.shouldIgnoreError(error, promise)) {
        return;
      }

      terminate(toError(error), this.mStore.getState());
    };
  }

  private regularStart(args: IParameters): Promise<void> {
    let splash: SplashScreenT;
    return fs.writeFileAsync(this.mStartupLogPath, (new Date()).toUTCString())
      .catch(() => null)
      .then(() => {
        log('info', '--------------------------');
        log('info', 'Vortex Version', getApplication().version);
        log('info', 'Parameters', process.argv.join(' '));
        return Promise.resolve();
      })
      .then(() => this.testUserEnvironment())
      .then(() => this.validateFiles())
      .then(() => (args?.startMinimized === true)
        ? Promise.resolve(undefined)
        : this.startSplash())
        // start initialization
      .then(() => {
        log('info', 'Initializing...');
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions = new ExtensionManagerT(this.mStore, this.mBasePath);
        return this.mExtensions.loadExtensions();
      })
      .then(() => {
        this.mStore = createVortexStore(this.mExtensions.getReducers(), this.mExtensions.getMiddleware());
        this.mExtensions.setStore(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupApiMain(this.mStore, undefined);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupApiRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensions(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsMain(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
      .then(() => {
        this.mExtensions.setupExtensionsRenderer(this.mStore);
        return Promise.resolve();
      })
