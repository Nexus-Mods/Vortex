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
import presetManager from '../util/PresetManager';
import { StateError } from '../util/reduxSanity';
import startupSettings from '../util/startupSettings';
import { allHives, createFullStateBackup, createVortexStore, currentStatePath, extendStore,
         finalizeStoreWrite,
         importState, insertPersistor, markImported, querySanitize } from '../util/store';
import {} from '../util/storeHelper';
import SubPersistor from '../util/SubPersistor';
import { isMajorDowngrade, replaceRecursive, spawnSelf, timeout, truthy } from '../util/util';

import { addNotification, setCommandLine, showDialog } from '../actions';

import MainWindowT from './MainWindow';
import SplashScreenT from './SplashScreen';
import TrayIconT from './TrayIcon';

import * as msgpackT from '@msgpack/msgpack';
import Promise from 'bluebird';
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

import * as winapiT from 'winapi-bindings';

const uuid = lazyRequire<typeof uuidT>(() => require('uuid'));
const permissions = lazyRequire<typeof permissionsT>(() => require('permissions'));
const winapi = lazyRequire<typeof winapiT>(() => require('winapi-bindings'));

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
  private mFirstStart: boolean = false;
  private mStartupLogPath: string;
  private mDeinitCrashDump: () => void;

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
          if (process.platform !== 'darwin') {
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

    app.whenReady().then(() => {
      const vortexPath = process.env.NODE_ENV === 'development'
          ? 'vortex_devel'
          : 'vortex';

      // if userData specified, use it
      let userData = args.userData
          // (only on windows) use ProgramData from environment
          ?? ((args.shared && process.platform === 'win32')
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
        .tap(() => {
          log('info', '--------------------------');
          log('info', 'Vortex Version', getApplication().version);
          log('info', 'Parameters', process.argv.join(' '));
        })
        .then(() => this.testUserEnvironment())
        .then(() => this.validateFiles())
        .then(() => (args?.startMinimized === true)
          ? Promise.resolve(undefined)
          : this.startSplash())
        // start initialization
        .tap(splashIn => (splashIn !== undefined)
          ? log('debug', 'showing splash screen')
          : log('debug', 'starting without splash screen'))
        .then(splashIn => {
          splash = splashIn;
          return this.createStore(args.restore, args.merge)
            .catch(DataInvalid, err => {
              log('error', 'store data invalid', err.message);
              dialog.showMessageBox(getVisibleWindow(), {
                type: 'error',
                buttons: ['Continue'],
                title: 'Error',
                message: 'Data corrupted',
                detail: 'The application state which contains things like your Vortex '
                      + 'settings, meta data about mods and other important data is '
                      + 'corrupted and can\'t be read. This could be a result of '
                      + 'hard disk corruption, a power outage or something similar. '
                      + 'Vortex will now try to repair the database, usually this '
                      + 'should work fine but please check that settings, mod list and so '
                      + 'on are ok before you deploy anything. '
                      + 'If not, you can go to settings->workarounds and restore a backup '
                      + 'which shouldn\'t lose you more than an hour of progress.',
              })
              .then(() => this.createStore(args.restore, args.merge, true));
            });
        })
        .tap(() => log('debug', 'checking admin rights'))
        .then(() => this.warnAdmin())
        .tap(() => log('debug', 'checking how Vortex was installed'))
        .then(() => this.identifyInstallType())
        .tap(() => log('debug', 'checking if migration is required'))
        .then(() => this.checkUpgrade())
        .tap(() => log('debug', 'setting up error handlers'))
        .then(() => {
          // as soon as we have a store, install an extended error handler that has
          // access to application state
          const handleError = this.genHandleError();
          process.removeAllListeners('uncaughtException');
          process.removeAllListeners('unhandledRejection');
          process.on('uncaughtException', handleError);
          process.on('unhandledRejection', handleError);
        })
        .then(() => {
          this.mStore.dispatch(setCommandLine(args));
        })
        .then(() => this.initDevel())
        .tap(() => log('debug', 'starting user interface'))
        .then(() => {
          this.setupContextMenu();
          return Promise.resolve();
        })
        .then(() => this.startUi())
        .tap(() => log('debug', 'setting up tray icon'))
        .then(() => this.createTray())
        // end initialization
        .tap(() => {
          if (splash !== undefined) {
            log('debug', 'removing splash screen');
          }
        })
        .then(() => {
          this.connectTrayAndWindow();
          return (splash !== undefined)
            ? splash.fadeOut()
            : Promise.resolve();
        })
        .tapCatch((err) => log('debug', 'quitting with exception', err.message))
        .catch(UserCanceled, () => app.exit())
        .catch(ProcessCanceled, () => {
          app.quit();
        })
        .catch(DocumentsPathMissing, () =>
          dialog.showMessageBox(getVisibleWindow(), {
            type: 'error',
            buttons: ['Close', 'More info'],
            defaultId: 1,
            title: 'Error',
            message: 'Startup failed',
            detail: 'Your "My Documents" folder is missing or is '
              + 'misconfigured. Please ensure that the folder is properly '
              + 'configured and accessible, then try again.',
          }).then(response => {
            if (response.response === 1) {
              shell.openExternal(
                `https://wiki.${NEXUS_DOMAIN}/index.php/Misconfigured_Documents_Folder`);
            }
            app.quit();
          }))
        .catch(DatabaseLocked, () => {
          dialog.showErrorBox('Startup failed', 'Vortex seems to be running already. '
            + 'If you can\'t see it, please check the task manager.');
          app.quit();
        })
        .catch({ code: 'ENOSPC' }, () => {
          dialog.showErrorBox('Startup failed', 'Your system drive is full. '
            + 'You should always ensure your system drive has some space free (ideally '
            + 'at least 10% of the total capacity, especially on SSDs). '
            + 'Vortex can\'t start until you have freed up some space.');
          app.quit();
        })
        .catch((err) => {
          try {
            if (err instanceof Error) {
              const pretty = prettifyNodeErrorMessage(err);
              const details = pretty.message
                .replace(/{{ *([a-zA-Z]+) *}}/g, (m, key) => pretty.replace?.[key] || key);
              terminate({
                message: 'Startup failed',
                details,
                code: pretty.code,
                stack: err.stack,
              }, this.mStore !== undefined ? this.mStore.getState() : {},
                pretty.allowReport);
            } else {
              terminate({
                message: 'Startup failed',
                details: err.message,
                stack: err.stack,
              }, this.mStore !== undefined ? this.mStore.getState() : {});
            }
          } catch (err) {
            // nop
          }
        })
        .finally(() => fs.removeAsync(this.mStartupLogPath).catch(() => null));
  }

  private isUACEnabled(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return Promise.resolve(true);
    }

    const getSystemPolicyValue = (key: string) => {
      try {
        const res = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
          key);
        return Promise.resolve({ key, type: res.type, value: res.value});
      } catch (err) {
        // We couldn't retrieve the value, log this and resolve positively
        //  as the user might have a version of Windows that does not use
        //  the key we're looking for.
        log('debug', 'failed to check UAC settings', err);
        return Promise.resolve(undefined);
      }
    };

    return Promise.all([getSystemPolicyValue('ConsentPromptBehaviorAdmin'),
                        getSystemPolicyValue('ConsentPromptBehaviorUser')])
      .then(res => {
        res.forEach(value => {
          if (value !== undefined) {
            log('debug', 'UAC settings found', `${value.key}: ${value.value}`);
          }
        });
        const adminConsent = res[0];
        return ((adminConsent.type === 'REG_DWORD') && (adminConsent.value === 0))
          ? Promise.resolve(false)
          : Promise.resolve(true);
      })
      // Perfectly ok not to have the registry keys.
      .catch(err => Promise.resolve(true));
  }

  private identifyInstallType(): Promise<void> {

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

    return fs.statAsync(path.join(getVortexPath('application'), 'Uninstall Vortex.exe'))
      .then(() => {
        this.mStore.dispatch(setInstallType('regular'));
      })
      .catch(() => {
        this.mStore.dispatch(setInstallType('managed'));
      });
  }

  private warnAdmin(): Promise<void> {
    const state: IState = this.mStore.getState();
    return timeout(Promise.resolve(isAdmin()), 1000)
      .then(admin => {
        if ((admin === undefined) || !admin) {
          return Promise.resolve();
        }
        log('warn', 'running as administrator');
        if (state.app.warnedAdmin > 0) {
          return Promise.resolve();
        }
        return this.isUACEnabled().then(uacEnabled => dialog.showMessageBox(getVisibleWindow(), {
            title: 'Admin rights detected',
            message:
              `Vortex has detected that it is being run with administrator rights. It is strongly 
              advised to not run any application with admin rights as adverse effects may include 
              permission issues or even security risks. Continue at your own risk`
              + (!uacEnabled
                  ? `\n\nPlease note: User Account Control (UAC) notifications are disabled in your 
                  operating system.  We strongly recommend you re-enable these to avoid file permissions 
                  issues and potential security risks.`
                  : ''),
            buttons: [
              'Quit',
              'Ignore',
            ],
            noLink: true,
          }).then(result => {
            if (result.response === 0) {
              app.quit();
            } else {
              this.mStore.dispatch(setWarnedAdmin(1));
              return Promise.resolve();
            }
          }));
      });
  }

  private checkUpgrade(): Promise<void> {
    const currentVersion = getApplication().version;
    return this.migrateIfNecessary(currentVersion)
      .then(() => {
        this.mStore.dispatch(setApplicationVersion(currentVersion));
        return Promise.resolve();
      });
  }

  private migrateIfNecessary(currentVersion: string): Promise<void> {
    const state: IState = this.mStore.getState();
    const lastVersion = state.app.appVersion || '0.0.0';

    if (this.mFirstStart || (process.env.NODE_ENV === 'development')) {
      // don't check version change in development builds or on first start
      return Promise.resolve();
    } 

    if (isMajorDowngrade(lastVersion, currentVersion)) {
      if (dialog.showMessageBoxSync(getVisibleWindow(), {
        type: 'warning',
        title: 'Downgrade detected',
        message: `You're using a version of Vortex that is older than the version you ran previously. 
        Active version: (${currentVersion}) Previously run: (${lastVersion}). Continuing to run this 
        older version may cause irreversible damage to your application state and setup. Continue at your own risk. `,
        buttons: [
          'Quit',
          'Continue at your own risk',
        ],
        noLink: true,
      }) === 0) {
        app.quit();
        return Promise.reject(new UserCanceled());
      }
    } else if (semver.gt(currentVersion, lastVersion)) {
      log('info', 'Vortex was updated, checking for necessary migrations');
      return migrate(this.mStore, getVisibleWindow())
        .then(() => {
          return Promise.resolve();
        })
        .catch(err => !(err instanceof UserCanceled)
                   && !(err instanceof ProcessCanceled), (err: Error) => {
          dialog.showErrorBox(
            'Migration failed',
            'The migration from the previous Vortex release failed. '
            + 'Please resolve the errors you got, then try again.');
          app.exit(1);
          return Promise.reject(new ProcessCanceled('Migration failed'));
        });
    }
    return Promise.resolve();
  }

  private splitPath(statePath: string): string[] {
    return statePath.match(/(\\.|[^.])+/g).map(input => input.replace(/\\(.)/g, '$1'));
  }

  private handleGet(getPaths: string[] | boolean, dbpath: string): Promise<void> {
    if (typeof(getPaths) === 'boolean') {
      fs.writeSync(1, 'Usage: vortex --get <path>\n');
      return;
    }

    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then(persistIn => {
        persist = persistIn;
        return persist.getAllKeys();
      })
      .then(keys => {
        return Promise.all(getPaths.map(getPath => {
          const pathArray = this.splitPath(getPath);
          const matches = keys
            .filter(key => _.isEqual(key.slice(0, pathArray.length), pathArray));
          return Promise.all(matches.map(match => persist.getItem(match)
            .then(value => `${match.join('.')} = ${value}`)))
            .then(output => { process.stdout.write(output.join('\n') + '\n'); })
            .catch(err => { process.stderr.write(err.message + '\n'); });
        }))
          .then(() => null);
      })
      .catch(err => {
        process.stderr.write(err.message + '\n');
      })
      .finally(() => {
        persist.close();
      });
  }

  private handleSet(setParameters: ISetItem[], dbpath: string): Promise<void> {
    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then(persistIn => {
        persist = persistIn;

        return Promise.all(setParameters.map((setParameter: ISetItem) => {
          const pathArray = this.splitPath(setParameter.key);

          return persist.getItem(pathArray)
            .catch(() => undefined)
            .then(oldValue => {
              const newValue = setParameter.value.length === 0
                ? undefined
                : (oldValue === undefined) || (typeof (oldValue) === 'object')
                  ? JSON.parse(setParameter.value)
                  : oldValue.constructor(setParameter.value);
              return persist.setItem(pathArray, newValue);
            })
            .then(() => { process.stdout.write('changed\n'); })
            .catch(err => {
              process.stderr.write(err.message + '\n');
            })
        }))
          .then(() => null);
      })
      .catch(err => {
        process.stderr.write(err.message + '\n');
      })
      .finally(() => {
        persist.close();
      });
  }

  private handleDel(delPaths: string[], dbpath: string): Promise<void> {
    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then(persistIn => {
        persist = persistIn;
        return persist.getAllKeys();
      })
      .then(keys => {
        return Promise.all(delPaths.map(delPath => {
          const pathArray = this.splitPath(delPath);
          const matches = keys
            .filter(key => _.isEqual(key.slice(0, pathArray.length), pathArray));
          return Promise.all(matches.map(match => persist.removeItem(match)
            .then(() => process.stdout.write(`removed ${match.join('.')}\n`))
            .catch(err => { process.stderr.write(err.message + '\n'); })));
        }))
          .then(() => null);
      })
      .catch(err => {
        process.stderr.write(err.message + '\n')
      })
      .finally(() => {
        persist.close();
      });
  }

  private createTray(): Promise<void> {
    const TrayIcon = require('./TrayIcon').default;
    this.mTray = new TrayIcon(this.mExtensions.getApi());
    return Promise.resolve();
  }

  private connectTrayAndWindow() {
    if (this.mTray.initialized) {
      this.mMainWindow.connectToTray(this.mTray);
    }
  }

  private multiUserPath() {
    if (process.platform === 'win32') {
      const muPath = path.join(process.env.ProgramData, 'vortex');
      try {
        fs.ensureDirSync(muPath);
      } catch (err) {
        // not sure why this would happen, ensureDir isn't supposed to report a problem if
        // the directory exists, but there was a single report of EEXIST in this place.
        // Probably a bug related to the filesystem used in C:\ProgramData, we had similar
        // problems with OneDrive paths
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
      return muPath;
    } else {
      log('error', 'Multi-User mode not implemented outside windows');
      return app.getPath('userData');
    }
  }

  private createStore(restoreBackup?: string, mergeBackup?: string,
                      repair?: boolean): Promise<void> {
    const newStore = createVortexStore(this.sanityCheckCB);
    const backupPath = path.join(app.getPath('temp'), STATE_BACKUP_PATH);
    let backups: string[];

    const updateBackups = () => fs.ensureDirAsync(backupPath)
      .then(() => fs.readdirAsync(backupPath))
      .filter((fileName: string) =>
        fileName.startsWith('backup') && path.extname(fileName) === '.json')
      .then(backupsIn => { backups = backupsIn; })
      .catch(err => {
        log('error', 'failed to read backups', err.message);
        backups = [];
      });

    const deleteBackups = () => Promise.map(backups, backupName =>
          fs.removeAsync(path.join(backupPath, backupName))
            .catch(() => undefined))
          .then(() => null);

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
    return LevelPersist.create(path.join(this.mBasePath, currentStatePath),
                               undefined,
                               repair ?? false)
      .then(levelPersistor => {
        this.mLevelPersistors.push(levelPersistor);
        return insertPersistor(
          'user', new SubPersistor(levelPersistor, 'user'));
      })
      .catch(DataInvalid, err => {
        const failedPersistor = this.mLevelPersistors.pop();
        return failedPersistor.close()
          .then(() => Promise.reject(err));
      })
      .then(() => {
        let dataPath = app.getPath('userData');
        const { multiUser } = newStore.getState().user;
        if (this.mArgs.userData !== undefined) {
          dataPath = this.mArgs.userData;
        } else if (multiUser) {
          dataPath = this.multiUserPath();
        }
        setVortexPath('userData', dataPath);
        this.mBasePath = dataPath;
        let created = false;
        try {
          fs.statSync(dataPath);
        } catch (err) {
          fs.ensureDirSync(dataPath);
          created = true;
        }
        if (multiUser && created) {
          permissions.allow(dataPath, 'group', 'rwx');
        }
        fs.ensureDirSync(path.join(dataPath, 'temp'));

        log('info', `using ${dataPath} as the storage directory`);
        if (multiUser || (this.mArgs.userData !== undefined)) {
          log('info', 'all further logging will happen in', path.join(dataPath, 'vortex.log'));
          setLogPath(dataPath);
          log('info', '--------------------------');
          log('info', 'Vortex Version', getApplication().version);
          return LevelPersist.create(
            path.join(dataPath, currentStatePath),
            undefined,
            repair ?? false,
            )
            .then(levelPersistor => {
              this.mLevelPersistors.push(levelPersistor);
            });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        log('debug', 'reading app state');
        return insertPersistor('app', new SubPersistor(last(this.mLevelPersistors), 'app'));
      })
      .then(() => {
        if (newStore.getState().app.instanceId === undefined) {
          this.mFirstStart = true;
          const newId = uuid.v4();
          log('debug', 'first startup, generated instance id', { instanceId: newId });
          newStore.dispatch(setInstanceId(newId));
        } else {
          log('debug', 'startup instance', { instanceId: newStore.getState().app.instanceId });
        }
        const ExtensionManager = require('../util/ExtensionManager').default;
        this.mExtensions = new ExtensionManager(newStore);
        if (this.mExtensions.hasOutdatedExtensions) {
          log('debug', 'relaunching to remove outdated extensions');
          finalizeStoreWrite().then(() => relaunch());

          // relaunching the process happens asynchronously but we don't want to any further work
          // before that
          return new Promise(() => null);
        }
        const reducer = require('../reducers/index').default;
        newStore.replaceReducer(reducer(this.mExtensions.getReducers(), querySanitize));
        return Promise.mapSeries(allHives(this.mExtensions), hive =>
          insertPersistor(hive, new SubPersistor(last(this.mLevelPersistors), hive)));
      })
      .then(() => {
        log('debug', 'checking if state db needs to be upgraded');
        return importState(this.mBasePath);
      })
      .then(oldState => {
        // mark as imported first, otherwise we risk importing again, overwriting data.
        // this way we risk not importing but since the old state is still there, that
        // can be repaired
        return oldState !== undefined ?
                   markImported(this.mBasePath)
                       .then(() => {
                         newStore.dispatch({
                           type: '__hydrate',
                           payload: oldState,
                         });
                       }) :
                   Promise.resolve();
      })
      .then(() => {
        log('debug', 'updating state backups');
        return updateBackups();
      })
      .then(() => {
        if (restoreBackup !== undefined) {
          log('info', 'restoring state backup', restoreBackup);
          return fs.readFileAsync(restoreBackup, { encoding: 'utf-8' })
            .then(backupState => {
              newStore.dispatch({
                type: '__hydrate_replace',
                payload: JSON.parse(backupState),
              });
            })
            .then(() => deleteBackups())
            .then(() => updateBackups())
            .catch(err => {
              if (err instanceof UserCanceled) {
                return Promise.reject(err);
              }
              terminate({
                message: 'Failed to restore backup',
                details: (err.code !== 'ENOENT')
                  ? err.message
                  : 'Specified backup file doesn\'t exist',
                path: restoreBackup,
              }, {}, false);
            });
        } else if (mergeBackup !== undefined) {
          log('info', 'merging state backup', mergeBackup);
          return fs.readFileAsync(mergeBackup, { encoding: 'utf-8' })
            .then(backupState => {
              newStore.dispatch({
                type: '__hydrate',
                payload: JSON.parse(backupState),
              });
            })
            .catch(err => {
              if (err instanceof UserCanceled) {
                return Promise.reject(err);
              }
              terminate({
                message: 'Failed to merge backup',
                details: (err.code !== 'ENOENT')
                  ? err.message
                  : 'Specified backup file doesn\'t exist',
                path: mergeBackup,
              }, {}, false);
            });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        const hydrateHandler = (stepIn: IPresetStep): Promise<void> => {
          newStore.dispatch({
            type: '__hydrate',
            payload: (stepIn as IPresetStepHydrateState).state,
          });

          return Promise.resolve();
        }
        presetManager.on('hydrate', hydrateHandler);
        presetManager.now('hydrate', hydrateHandler);
      })
      .then(() => {
        this.mStore = newStore;

        let sendState: Buffer;

        (global as any).getReduxStateMsgpack = (idx: number) => {
          const msgpack: typeof msgpackT = require('@msgpack/msgpack');
          if ((sendState === undefined) || (idx === 0)) {
            sendState = Buffer.from(msgpack.encode(
              replaceRecursive(this.mStore.getState(), undefined, '__UNDEFINED__')));
          }
          const res = sendState.slice(idx * STATE_CHUNK_SIZE, (idx + 1) * STATE_CHUNK_SIZE);
          return res.toString('base64');
        };

        this.mExtensions.setStore(newStore);
        log('debug', 'setting up extended store');
        return extendStore(newStore, this.mExtensions);
      })
      .then(() => {
        if (backups.length > 0) {
          const sorted = backups.sort((lhs, rhs) => rhs.localeCompare(lhs));
          const mostRecent = sorted[0];
          const timestamp = path.basename(mostRecent, '.json').replace('backup_', '');
          const date = new Date(+timestamp);
          const dateString = `${date.toDateString()} `
            + `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
          const replace = { date: dateString };
          this.mStore.dispatch(addNotification({
            type: 'info',
            message: 'Found an application state backup. Created on: {{date}}',
            actions: [
              { title: 'Restore', action: () => {
                this.mStore.dispatch(showDialog('question', 'Restoring Application State', {
                  bbcode: 'You are attempting to restore an application state backup which will revert any '
                        + 'state changes you have made since the backup was created.[br][/br][br][/br]'
                        + 'Please note that this operation will NOT uninstall/remove any mods you '
                        + 'may have downloaded/installed since the backup was created, however Vortex '
                        + 'may "forget" some changes:[list]'
                        + '[*] Which download archive belongs to which mod installation, exhibiting '
                        + 'itself as "duplicate" entries of the same mod (archive entry and installed mod entry).'
                        + '[*] The state of an installed mod - reverting it to a disabled state.'
                        + '[*] Any conflict rules you had defined after the state backup.'
                        + '[*] Any other configuration changes you may have made.'
                        + '[/list][br][/br]'
                        + 'Are you sure you wish to restore the backed up state ?',
                }, [
                  { label: 'Cancel' },
                  { label: 'Restore', action: () => {
                    log('info', 'sorted backups', sorted);
                    spawnSelf(['--restore', path.join(backupPath, mostRecent)]);
                    app.exit();
                  } },
                ]));
              } },
              { title: 'Delete', action: dismiss => {
                deleteBackups();
                dismiss();
              } },
            ],
            replace,
          }));
        } else if (!repair) {
          // we started without any problems, save this application state
          return createFullStateBackup('startup', this.mStore)
            .then(() => Promise.resolve())
            .catch(err => log('error', 'Failed to create startup state backup', err.message));
        }
        return Promise.resolve();
      })
      .then(() => this.mExtensions.doOnce());
  }

  private sanityCheckCB = (err: StateError) => {
    err['attachLogOnReport'] = true;
    showError(this.mStore.dispatch,
      'An invalid state change was prevented, this was probably caused by a bug', err);
  }

  private initDevel(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      const {installDevelExtensions} = require('../util/devel') as typeof develT;
      return installDevelExtensions();
    } else {
      return Promise.resolve();
    }
  }

  private showMainWindow(startMinimized: boolean) {
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
        log('error', 'failed to show main window', err);
        app.exit();
        return;
      } else {
        throw err;
      }
    }
    setWindow(this.mMainWindow.getHandle());
  }

  private testUserEnvironment(): Promise<void> {
    // Should be used to test the user's environment for known
    //  issues before starting up Vortex.
    // On Windows:
    //  - Ensure we're able to retrieve the user's documents folder.
    if (process.platform === 'win32') {
      try {
        const documentsFolder = app.getPath('documents');
        return (documentsFolder !== '')
          ? Promise.resolve()
          : Promise.reject(new DocumentsPathMissing());
      } catch (err) {
        return Promise.reject(new DocumentsPathMissing());
      }
    } else {
      // No tests needed.
      return Promise.resolve();
    }
  }

  private validateFiles(): Promise<void> {
    return Promise.resolve(validateFiles(getVortexPath('assets_unpacked')))
      .then(validation => {
        if ((validation.changed.length > 0)
            || (validation.missing.length > 0)) {
          log('info', 'Files were manipulated', validation);
          return dialog.showMessageBox(null, {
            type: 'error',
            title: 'Installation corrupted',
            message: 'Your Vortex installation has been corrupted. '
              + 'This could be the result of a virus or manual manipulation. '
              + 'Vortex might still appear to work (partially) but we suggest '
              + 'you reinstall it. For more information please refer to Vortex\'s log files.',
            noLink: true,
            buttons: ['Quit', 'Ignore'],
          })
          .then(dialogReturn => {
            const { response } = dialogReturn;
            if (response === 0) {
              app.quit();
            } else {
              disableErrorReport();
              return Promise.resolve();
            }
          });
        } else {
          return Promise.resolve();
        }
      });
  }

  private applyArguments(args: IParameters) {
    if (args.download || args.install) {
      const prom: Promise<void> = (this.mMainWindow === undefined)
        // give the main instance a moment to fully start up
        ? Promise.delay(2000)
        : Promise.resolve(undefined);

      prom.then(() => {
        if (this.mMainWindow !== undefined) {
          this.mMainWindow.sendExternalURL(args.download || args.install,
            args.install !== undefined);
        } else {
          // TODO: this instructions aren't very correct because we know Vortex doesn't have
          // a UI and needs to be shut down from the task manager
          dialog.showErrorBox('Vortex unresponsive',
            'Vortex appears to be frozen, please close Vortex and try again');
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

export default Application;
