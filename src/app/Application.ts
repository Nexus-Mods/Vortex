import {setApplicationVersion, setInstanceId, setWarnedAdmin} from '../actions/app';
import {} from '../reducers/index';
import { ThunkStore } from '../types/api';
import {IState} from '../types/IState';
import commandLine, {IParameters} from '../util/commandLine';
import { ProcessCanceled, UserCanceled } from '../util/CustomErrors';
import { } from '../util/delayed';
import * as develT from '../util/devel';
import { setOutdated, terminate, toError, setWindow } from '../util/errorHandling';
import ExtensionManagerT from '../util/ExtensionManager';
import * as fs from '../util/fs';
import lazyRequire from '../util/lazyRequire';
import LevelPersist, { DatabaseLocked } from '../util/LevelPersist';
import {log, setLogPath, setupLogging} from '../util/log';
import { showError } from '../util/message';
import migrate from '../util/migrate';
import { StateError } from '../util/reduxSanity';
import { allHives, createVortexStore, currentStatePath, extendStore,
         importState, insertPersistor, markImported, querySanitize } from '../util/store';
import {} from '../util/storeHelper';
import SubPersistor from '../util/SubPersistor';
import { spawnSelf, truthy } from '../util/util';

import { addNotification } from '../actions';

import MainWindowT from './MainWindow';
import SplashScreenT from './SplashScreen';
import TrayIconT from './TrayIcon';

import * as Promise from 'bluebird';
import crashDump from 'crash-dump';
import {app, dialog, ipcMain} from 'electron';
import * as isAdmin from 'is-admin';
import * as _ from 'lodash';
import * as path from 'path';
import { allow } from 'permissions';
import * as semver from 'semver';
import * as uuidT from 'uuid';

const uuid = lazyRequire<typeof uuidT>(() => require('uuid'));

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

  constructor(args: IParameters) {
    this.mArgs = args;

    ipcMain.on('show-window', () => this.showMainWindow());

    app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

    this.mBasePath = app.getPath('userData');
    fs.ensureDirSync(this.mBasePath);

    const tempPath = path.join(app.getPath('userData'), 'temp');
    app.setPath('temp', tempPath);
    fs.ensureDirSync(path.join(tempPath, 'dumps'));

    crashDump(path.join(tempPath, 'dumps', `crash-main-${Date.now()}.dmp`));

    this.setupAppEvents(args);
  }

  private startUi(): Promise<void> {
    const MainWindow = require('./MainWindow').default;
    this.mMainWindow = new MainWindow(this.mStore);
    return this.mMainWindow.create(this.mStore).then(webContents => {
      this.mExtensions.setupApiMain(this.mStore, webContents);
      setOutdated(this.mExtensions.getApi());
      return this.applyArguments(this.mArgs);
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
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (this.mMainWindow !== undefined) {
        this.mMainWindow.create(this.mStore);
      }
    });

    /* electron 3
    app.on('second-instance', (event: Event, secondaryArgv: string[]) => {
      this.applyArguments(commandLine(secondaryArgv));
    });
    */

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

      if (['net::ERR_CONNECTION_RESET', 'net::ERR_ABORTED'].indexOf(error.message) !== -1) {
        log('warn', 'network error unhandled', error.stack);
        return;
      }

      terminate(toError(error), this.mStore.getState());
    };
  }

  private regularStart(args: IParameters): Promise<void> {
    let splash: SplashScreenT;

    return this.testShouldQuit()
        .then(() => {
          setupLogging(app.getPath('userData'), process.env.NODE_ENV === 'development');
          log('info', '--------------------------');
          log('info', 'Vortex Version', app.getVersion());
          return this.startSplash();
        })
        // start initialization
        .then(splashIn => {
          splash = splashIn;
          return this.createStore(args.restore);
        })
        .then(() => this.warnAdmin())
        .then(() => this.checkUpgrade())
        .then(() => {
          // as soon as we have a store, install an extended error handler that has
          // access to application state
          const handleError = this.genHandleError();
          process.removeAllListeners('uncaughtException');
          process.removeAllListeners('unhandledRejection');
          process.on('uncaughtException', handleError);
          process.on('unhandledRejection', handleError);
        })
        .then(() => this.initDevel())
        .then(() => this.startUi())
        .then(() => this.createTray())
        // end initialization
        .then(() => splash.fadeOut())
        .then(() => {
          this.connectTrayAndWindow();
          return splash.fadeOut();
        })
        .catch(UserCanceled, () => app.exit())
        .catch(ProcessCanceled, () => {
          app.quit();
        })
        .catch(DatabaseLocked, () => {
          dialog.showErrorBox('Startup failed', 'Vortex seems to be running already. '
            + 'If you can\'t see it, please check the task manager.');
          app.quit();
        })
        .catch((err) => {
          try {
            terminate({
              message: 'Startup failed',
              details: err.message,
              stack: err.stack,
            }, this.mStore !== undefined ? this.mStore.getState() : {});
          } catch (err) {
            // nop
          }
        });
  }

  private warnAdmin(): Promise<void> {
    const state: IState = this.mStore.getState();
    return isAdmin()
      .then(admin => {
        if (!admin) {
          return Promise.resolve();
        }
        log('warn', 'running as administrator');
        if (state.app.warnedAdmin > 0) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
          dialog.showMessageBox(null, {
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
              + 'of your own making.',
            buttons: [
              'Quit',
              'Ignore',
            ],
            noLink: true,
          }, (response: number) => {
            if (response === 0) {
              app.quit();
            } else {
              this.mStore.dispatch(setWarnedAdmin(1));
              resolve();
            }
          });
        });
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
    if ((semver.major(currentVersion) < semver.major(lastVersion))
        || (semver.minor(currentVersion) < semver.minor(lastVersion))) {
      if (dialog.showMessageBox(null, {
        type: 'warning',
        title: 'Downgrade detected',
        message: 'The version of Vortex you\'re running is older than the one you previously ran. '
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
      return migrate(this.mStore)
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

  private createStore(restoreBackup?: string): Promise<void> {
    const newStore = createVortexStore(this.sanityCheckCB);
    const backupPath = path.join(app.getPath('temp'), 'state_backups');
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
    return LevelPersist.create(path.join(this.mBasePath, currentStatePath))
      .then(levelPersistor => {
        this.mLevelPersistors.push(levelPersistor);
        return insertPersistor(
          'user', new SubPersistor(levelPersistor, 'user'));
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
                details: err.code !== 'ENOENT' ? err.message : 'Specified backup file doesn\'t exist',
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
        }
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

  private testShouldQuit(): Promise<void> {
    /* electron 3
    const primaryInstance: boolean = app.requestSingleInstanceLock();

    if (primaryInstance) {
      return Promise.resolve();
    } else {
      app.exit();
      return Promise.reject(new ProcessCanceled('should quit'));
    }
    */

    const remoteCallback = (secondaryArgv, workingDirectory) => {
      // this is called inside the primary process
      // with the parameters of
      // the secondary one whenever an additional
      // instance is started
      this.applyArguments(commandLine(secondaryArgv));
    };

    const shouldQuit: boolean = app.makeSingleInstance(remoteCallback);

    if (shouldQuit) {
      // exit instead of quit so events don't get triggered. Otherwise an exception may be caused
      // by failures to require modules
      app.exit();
      return Promise.reject(new ProcessCanceled('should quit'));
    }

    return Promise.resolve();
  }

  private applyArguments(args: IParameters) {
    if (args.download) {
      const prom: Promise<void> = (this.mMainWindow === undefined)
        // give the main instance a moment to fully start up
        ? Promise.delay(2000)
        : Promise.resolve(undefined);

      prom.then(() => {
        if (this.mMainWindow !== undefined) {
          this.mMainWindow.sendExternalURL(args.download);
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
