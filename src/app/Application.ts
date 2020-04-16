import {setApplicationVersion, setInstanceId, setWarnedAdmin} from '../actions/app';
import { STATE_BACKUP_PATH } from '../reducers/index';
import { ThunkStore } from '../types/api';
import {IState} from '../types/IState';
import commandLine, {IParameters} from '../util/commandLine';
import { DataInvalid, DocumentsPathMissing, ProcessCanceled,
         UserCanceled } from '../util/CustomErrors';
import * as develT from '../util/devel';
import { didIgnoreError, disableErrorReport, getVisibleWindow, setOutdated, setWindow,
         terminate, toError } from '../util/errorHandling';
import ExtensionManagerT from '../util/ExtensionManager';
import { validateFiles } from '../util/fileValidation';
import * as fs from '../util/fs';
import getVortexPath from '../util/getVortexPath';
import lazyRequire from '../util/lazyRequire';
import LevelPersist, { DatabaseLocked } from '../util/LevelPersist';
import {log, setLogPath, setupLogging} from '../util/log';
import { prettifyNodeErrorMessage, showError } from '../util/message';
import migrate from '../util/migrate';
import { StateError } from '../util/reduxSanity';
import { allHives, createFullStateBackup, createVortexStore, currentStatePath, extendStore,
         importState, insertPersistor, markImported, querySanitize } from '../util/store';
import {} from '../util/storeHelper';
import SubPersistor from '../util/SubPersistor';
import { isMajorDowngrade, spawnSelf, timeout, truthy } from '../util/util';

import { addNotification, setCommandLine } from '../actions';

import MainWindowT from './MainWindow';
import SplashScreenT from './SplashScreen';
import TrayIconT from './TrayIcon';

import Promise from 'bluebird';
import crashDumpX from 'crash-dump';
import {app, dialog, ipcMain, shell} from 'electron';
import isAdmin = require('is-admin');
import * as _ from 'lodash';
import * as msgpackT from 'msgpack';
import * as path from 'path';
import { allow } from 'permissions';
import * as semver from 'semver';
import * as uuidT from 'uuid';

import { RegGetValue } from 'winapi-bindings';

// export is currently a bit messed up
const crashDump = (crashDumpX as any).default;

const uuid = lazyRequire<typeof uuidT>(() => require('uuid'));

const STATE_CHUNK_SIZE = 128 * 1024;

function last(array: any[]): any {
  if (array.length === 0) {
    return undefined;
  }
  return array[array.length - 1];
}

class Application {
  private mBasePath: string;
  private mStore: ThunkStore<IState>;
  private mLevelPersistors: LevelPersist[] = [];
  private mArgs: IParameters;
  private mMainWindow: MainWindowT;
  private mExtensions: ExtensionManagerT;
  private mTray: TrayIconT;
  private mFirstStart: boolean = false;
  private mDeinitCrashDump: () => void = undefined;

  constructor(args: IParameters) {
    this.mArgs = args;

    ipcMain.on('show-window', () => this.showMainWindow());

    app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${args.maxMemory || 4096}`);

    this.mBasePath = app.getPath('userData');
    fs.ensureDirSync(this.mBasePath);

    const tempPath = path.join(app.getPath('userData'), 'temp');
    app.setPath('temp', tempPath);
    fs.ensureDirSync(path.join(tempPath, 'dumps'));

    this.mDeinitCrashDump = crashDump(path.join(tempPath, 'dumps', `crash-main-${Date.now()}.dmp`));

    setupLogging(app.getPath('userData'), process.env.NODE_ENV === 'development');
    this.setupAppEvents(args);
  }

  private startUi(): Promise<void> {
    const MainWindow = require('./MainWindow').default;
    this.mMainWindow = new MainWindow(this.mStore);
    log('debug', 'creating main window');
    return this.mMainWindow.create(this.mStore).then(webContents => {
      log('debug', 'window created');
      this.mExtensions.setupApiMain(this.mStore, webContents);
      setOutdated(this.mExtensions.getApi());
      this.applyArguments(this.mArgs);
      if (didIgnoreError()) {
        webContents.send('did-ignore-error', true);
      }
      return Promise.resolve();
    });
  }

  private startSplash(): Promise<SplashScreenT> {
    const SplashScreen = require('./SplashScreen').default;
    const splash: SplashScreenT = new SplashScreen();
    return splash.create()
      .then(() => {
        setWindow(splash.getHandle());
        return splash;
      });
  }

  private setupAppEvents(args: IParameters) {
    app.on('window-all-closed', () => {
      log('info', 'clean application end');
      if (this.mTray !== undefined) {
        this.mTray.close();
      }
      this.mDeinitCrashDump();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    if (!app.requestSingleInstanceLock()) {
      app.disableHardwareAcceleration();
      app.commandLine.appendSwitch('--in-process-gpu');
      app.commandLine.appendSwitch('--disable-software-rasterizer');
      app.quit();
      return;
    }

    app.on('activate', () => {
      if (this.mMainWindow !== undefined) {
        this.mMainWindow.create(this.mStore);
      }
    });

    app.on('second-instance', (event: Event, secondaryArgv: string[]) => {
      log('debug', 'getting arguments from second instance', secondaryArgv);
      this.applyArguments(commandLine(secondaryArgv, true));
    });

    app.on('ready', () => {
      if (args.get) {
        this.handleGet(args.get, args.shared);
      } else if (args.set) {
        this.handleSet(args.set, args.shared);
      } else if (args.del) {
        this.handleDel(args.del, args.shared);
      } else {
        this.regularStart(args);
      }
    });

    app.on('web-contents-created', (event: Electron.Event, contents: Electron.WebContents) => {
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
    webPreferences.enableRemoteModule = false;
  }

  private genHandleError() {
    return (error: any, promise?: any) => {
      if (error instanceof UserCanceled) {
        return;
      }

      if (!truthy(error)) {
        log('error', 'empty error unhandled', { wasPromise: promise !== undefined });
        return;
      }

      if (['net::ERR_CONNECTION_RESET',
           'net::ERR_ABORTED',
           'net::ERR_CONTENT_LENGTH_MISMATCH',
           'net::ERR_INCOMPLETE_CHUNKED_ENCODING'].indexOf(error.message) !== -1) {
        log('warn', 'network error unhandled', error.stack);
        return;
      }

      if (['EACCES', 'EPERM'].includes(error.errno)
          && (error.path !== undefined)
          && (error.path.indexOf('vortex-setup') !== -1)) {
        // It's wonderous how electron-builder finds new ways to be more shit without even being
        // updated. Probably caused by node update
        log('warn', 'suppressing error message', { message: error.message, stack: error.stack });
        return;
      }

      terminate(toError(error), this.mStore.getState());
    };
  }

  private regularStart(args: IParameters): Promise<void> {
    let splash: SplashScreenT;

    return this.testUserEnvironment()
        .then(() => this.validateFiles())
        .then(() => {
          log('info', '--------------------------');
          log('info', 'Vortex Version', app.getVersion());
          log('info', 'Parameters', process.argv.join(' '));
          return this.startSplash();
        })
        // start initialization
        .tap(() => log('debug', 'showing splash screen'))
        .then(splashIn => {
          splash = splashIn;
          return this.createStore(args.restore)
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
              .then(() => this.createStore(args.restore, true));
            });
        })
        .tap(() => log('debug', 'checking admin rights'))
        .then(() => this.warnAdmin())
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
        // .then(() => this.initDevel())
        .tap(() => log('debug', 'starting user interface'))
        .then(() => this.startUi())
        .tap(() => log('debug', 'setting up tray icon'))
        .then(() => this.createTray())
        // end initialization
        .tap(() => log('debug', 'removing splash screen'))
        .then(() => {
          this.connectTrayAndWindow();
          return splash.fadeOut();
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
                'https://wiki.nexusmods.com/index.php/Misconfigured_Documents_Folder');
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
              terminate({
                message: 'Startup failed',
                details: pretty.message,
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
        });
  }

  private isUACEnabled(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      try {
        const res = RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
          'ConsentPromptBehaviorAdmin');
        log('debug', 'UAC settings found', JSON.stringify(res, undefined, 2));
        return ((res.type === 'REG_DWORD') && (res.value === 0))
          ? resolve(false)
          : resolve(true);
      } catch (err) {
        // We couldn't retrieve the value, log this and resolve positively
        //  as the user might have a version of Windows that does not use
        //  the key we're looking for.
        log('warn', 'failed to check UAC settings', err);
        return resolve(true);
      }
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
              'Vortex is not intended to be run as administrator!\n'
              + 'If you\'re doing this because you have permission problems, please '
              + 'stop, you\'re just making it worse.\n'
              + 'File permissions can be changed, so that the tools can be run with a '
              + 'regular account. '
              + 'Vortex will try its best to help you with that.\n'
              + 'If you choose to continue I won\'t bother you again but please '
              + 'don\'t report any permission problems to us because they are '
              + 'of your own making.'
              + (!uacEnabled
                  ? '\n\nPlease note: User Account Control(UAC) notifications are disabled '
                    + 'on your device; we strongly recommend you re-enable these to avoid '
                    + 'file permissions issues.'
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
    const currentVersion = app.getVersion();
    return this.migrateIfNecessary(currentVersion)
      .then(() => {
        this.mStore.dispatch(setApplicationVersion(currentVersion));
        return Promise.resolve();
      });
  }

  private migrateIfNecessary(currentVersion: string): Promise<void> {
    const state: IState = this.mStore.getState();
    const lastVersion = state.app.appVersion || '0.0.0';
    if (this.mFirstStart || (currentVersion === '0.0.1')) {
      // don't check version change in development builds or on first start
      return Promise.resolve();
    }
    if (isMajorDowngrade(lastVersion, currentVersion)) {
      if (dialog.showMessageBoxSync(getVisibleWindow(), {
        type: 'warning',
        title: 'Downgrade detected',
        message: `The version of Vortex you\'re running (${currentVersion}) `
               + `is older than the one you previously ran (${lastVersion}). `
               + 'While Vortex versions are backward compatible they are not forward compatible, '
               + 'it\'s possible this version of Vortex may not run and may even '
               + 'do irrevsible damage to your application state.\n'
               + 'Only continue if you\'re happy to reinstall and cleanup everything manually.',
        buttons: [
          'Quit',
          'Yes, I\'m mad',
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

  private handleGet(getPath: string | boolean, shared: boolean): Promise<void> {
    if (typeof(getPath) === 'boolean') {
      fs.writeSync(1, 'Usage: vortex --get <path>\n');
      app.quit();
      return;
    }

    const vortexPath = process.env.NODE_ENV === 'development'
        ? 'vortex_devel'
        : 'vortex';

    const dbpath = shared
      ? path.join(process.env.ProgramData, 'vortex', currentStatePath)
      : path.join(process.env['APPDATA'], vortexPath, currentStatePath);
    const pathArray = this.splitPath(getPath);

    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then(persistIn => {
        persist = persistIn;
        return persist.getAllKeys();
      })
      .then(keys => {
        const matches = keys
          .filter(key => _.isEqual(key.slice(0, pathArray.length), pathArray));
        return Promise.map(matches, match => persist.getItem(match)
          .then(value => `${match.join('.')} = ${value}`));
      }).then(output => { process.stdout.write(output.join('\n') + '\n'); })
      .catch(err => { process.stderr.write(err.message + '\n'); })
      .finally(() => {
        app.quit();
      });
  }

  private handleSet(setParameters: string[], shared: boolean): Promise<void> {
    if (setParameters.length !== 2) {
      process.stdout.write('Usage: vortex --set <path>=<value>\n');
      app.quit();
      return;
    }

    const vortexPath = process.env.NODE_ENV === 'development'
        ? 'vortex_devel'
        : 'vortex';

    const dbpath = shared
      ? path.join(process.env.ProgramData, 'vortex', currentStatePath)
      : path.join(process.env['APPDATA'], vortexPath, currentStatePath);
    const pathArray = this.splitPath(setParameters[0]);

    let persist: LevelPersist;

    return LevelPersist.create(dbpath)
      .then(persistIn => {
        persist = persistIn;
        return persist.getItem(pathArray)
          .catch(() => undefined);
      })
      .then(oldValue => {
        const newValue = setParameters[1].length === 0
          ? undefined
          : (oldValue === undefined) || (typeof(oldValue) === 'object')
            ? JSON.parse(setParameters[1])
            : oldValue.constructor(setParameters[1]);
        return persist.setItem(pathArray, newValue);
      })
      .then(() => { process.stdout.write('changed\n'); })
      .catch(err => {
        process.stderr.write(err.message + '\n');
      })
      .finally(() => {
        app.quit();
      });
  }

  private handleDel(delPath: string, shared: boolean): Promise<void> {
    const vortexPath = process.env.NODE_ENV === 'development'
        ? 'vortex_devel'
        : 'vortex';

    const dbpath = shared
      ? path.join(process.env.ProgramData, 'vortex', currentStatePath)
      : path.join(process.env['APPDATA'], vortexPath, currentStatePath);
    const pathArray = this.splitPath(delPath);

    let persist: LevelPersist;

    let found = false;

    return LevelPersist.create(dbpath)
      .then(persistIn => {
        persist = persistIn;
        return persist.getAllKeys();
      })
      .filter((key: string[]) => _.isEqual(key.slice(0, pathArray.length), pathArray))
      .map((key: string[]) => {
        // tslint:disable-next-line:no-console
        console.log('removing', key.join('.'));
        found = true;
        return persist.removeItem(key);
      })
      .then(() => {
        if (!found) {
          process.stdout.write('not found\n');
        }
      })
      .catch(err => { process.stderr.write(err.message + '\n'); })
      .finally(() => {
        app.quit();
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

  private createStore(restoreBackup?: string, repair?: boolean): Promise<void> {
    const newStore = createVortexStore(this.sanityCheckCB);
    const backupPath = path.join(app.getPath('temp'), STATE_BACKUP_PATH);
    let backups: string[];

    const updateBackups = () => fs.ensureDirAsync(backupPath)
      .then(() => fs.readdirAsync(backupPath))
      .filter((fileName: string) =>
        fileName.startsWith('backup') && path.extname(fileName) === '.json')
      .then(backupsIn => { backups = backupsIn; });

    const deleteBackups = () => Promise.map(backups, backupName =>
          fs.removeAsync(path.join(backupPath, backupName))
            .catch(() => undefined))
          .then(() => null);

    // 1. load only user settings to determine if we're in multi-user mode
    // 2. load app settings to determine which extensions to load
    // 3. load extensions, then load all settings, including extensions
    return LevelPersist.create(path.join(this.mBasePath, currentStatePath),
                               undefined,
                               repair || false)
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
        const multiUser = newStore.getState().user.multiUser;
        const dataPath = multiUser
          ? this.multiUserPath()
          : app.getPath('userData');
        app.setPath('userData', dataPath);
        this.mBasePath = dataPath;
        let created = false;
        try {
          fs.statSync(dataPath);
        } catch (err) {
          fs.ensureDirSync(dataPath);
          created = true;
        }
        if (multiUser && created) {
          allow(dataPath, 'group', 'rwx');
        }

        log('info', `using ${dataPath} as the storage directory`);
        if (multiUser) {
          setLogPath(dataPath);
          log('info', '--------------------------');
          log('info', 'Vortex Version', app.getVersion());
          return LevelPersist.create(path.join(dataPath, currentStatePath))
            .then(levelPersistor => {
              this.mLevelPersistors.push(levelPersistor);
            });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => insertPersistor('app', new SubPersistor(last(this.mLevelPersistors), 'app')))
      .then(() => {
        if (newStore.getState().app.instanceId === undefined) {
          this.mFirstStart = true;
          const newId = uuid.v4();
          newStore.dispatch(setInstanceId(newId));
        }
        const ExtensionManager = require('../util/ExtensionManager').default;
        this.mExtensions = new ExtensionManager(newStore);
        const reducer = require('../reducers/index').default;
        newStore.replaceReducer(reducer(this.mExtensions.getReducers(), querySanitize));
        return Promise.mapSeries(allHives(this.mExtensions), hive =>
          insertPersistor(hive, new SubPersistor(last(this.mLevelPersistors), hive)));
      })
      .then(() => importState(this.mBasePath))
      .then(oldState => {
        // mark as imported first, otherwise we risk importing again overwriting data.
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
      .then(() => updateBackups())
      .then(() => {
        if (restoreBackup !== undefined) {
          log('info', 'restoring state backup', restoreBackup);
          return fs.readFileAsync(restoreBackup, { encoding: 'utf-8' })
            .then(backupState => {
              newStore.dispatch({
                type: '__hydrate',
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
                stack: err.stack,
                path: restoreBackup,
              }, {}, err.code !== 'ENOENT');
            });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        this.mStore = newStore;

        let sendState: Buffer;

        (global as any).getReduxStateMsgpack = (idx: number) => {
          const msgpack: typeof msgpackT = require('msgpack');
          if ((sendState === undefined) || (idx === 0)) {
            sendState = msgpack.pack(this.mStore.getState());
          }
          const res = sendState.slice(idx * STATE_CHUNK_SIZE, (idx + 1) * STATE_CHUNK_SIZE);
          return res.toString('base64');
        };

        this.mExtensions.setStore(newStore);
        return extendStore(newStore, this.mExtensions);
      })
      .then(() => {
        if (backups.length > 0) {
          this.mStore.dispatch(addNotification({
            type: 'info',
            message: 'A backup of application state was created recently.',
            actions: [
              { title: 'Restore', action: () => {
                const sorted = backups.sort((lhs, rhs) => rhs.localeCompare(lhs));
                log('info', 'sorted backups', sorted);
                spawnSelf(['--restore', path.join(backupPath, sorted[0])]);
                app.exit();
              } },
              { title: 'Delete', action: dismiss => {
                deleteBackups();
                dismiss();
              } },
            ],
          }));
        } else if (!repair) {
          // we started without any problems, save this application state
          return createFullStateBackup('startup', this.mStore);
        }
        return Promise.resolve();
      })
      .then(() => this.mExtensions.doOnce());
  }

  private sanityCheckCB = (err: StateError) => {
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

  private showMainWindow() {
    if (this.mMainWindow === null) {
      // ??? renderer has signaled it's done loading before we even started it?
      // that can't be right...
      app.exit();
      return;
    }
    const windowMetrics = this.mStore.getState().settings.window;
    const maximized: boolean = windowMetrics.maximized || false;
    this.mMainWindow.show(maximized);
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
    disableErrorReport();
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
              + 'you reinstall it.',
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
    }
  }
}

export default Application;
