import {setInstanceId} from '../actions/app';
import {} from '../reducers/index';
import {IState} from '../types/IState';
import commandLine, {IParameters} from '../util/commandLine';
import {} from '../util/delayed';
import * as develT from '../util/devel';
import {} from '../util/errorHandling';
import ExtensionManagerT from '../util/ExtensionManager';
import lazyRequire from '../util/lazyRequire';
import LevelPersist from '../util/LevelPersist';
import {log, setLogPath, setupLogging} from '../util/log';
import { showError } from '../util/message';
import ReduxPersistor from '../util/ReduxPersistor';
import { StateError } from '../util/reduxSanity';
import { allHives, createVortexStore, currentStatePath, extendStore,
         importState, insertPersistor, markImported } from '../util/store';
import {} from '../util/storeHelper';
import SubPersistor from '../util/SubPersistor';

import MainWindowT from './MainWindow';
import SplashScreenT from './SplashScreen';
import TrayIconT from './TrayIcon';

import * as Promise from 'bluebird';
import {app, BrowserWindow, ipcMain} from 'electron';
import * as origFS from 'fs';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as Redux from 'redux';
import * as uuidT from 'uuid';

const uuid = lazyRequire<typeof uuidT>('uuid');

class Application {
  private mBasePath: string;
  private mStore: Redux.Store<IState>;
  private mLevelPersistor: LevelPersist;
  private mArgs: IParameters;
  private mMainWindow: MainWindowT;
  private mExtensions: ExtensionManagerT;
  private mTray: TrayIconT;

  constructor(args: IParameters) {
    this.mArgs = args;

    ipcMain.on('show-window', () => this.showMainWindow());

    this.mBasePath = app.getPath('userData');
    fs.ensureDirSync(this.mBasePath);

    app.setPath('temp', path.join(app.getPath('userData'), 'temp'));

    this.setupAppEvents(args);
  }

  private startUi(): Promise<void> {
    const MainWindow = require('./MainWindow').default;
    this.mMainWindow = new MainWindow(this.mStore);
    return this.mMainWindow.create(this.mStore).then(webContents => {
      this.mExtensions.setupApiMain(this.mStore, webContents);
      this.applyArguments(this.mArgs);
    });
  }

  private startSplash(): Promise<SplashScreenT> {
    const SplashScreen = require('./SplashScreen').default;
    const splash = new SplashScreen();
    return splash.create()
      .then(() => splash);
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

    app.on('ready', () => {
      if (args.get) {
        this.handleGet(args.get);
      } else if (args.set) {
        this.handleSet(args.set);
      } else {
        this.regularStart(args);
      }
    });
  }

  private regularStart(args: IParameters): Promise<void> {
    let splash: SplashScreenT;

    return this.testShouldQuit(args.wait ? 10 : -1)
        .then(() => {
          setupLogging(app.getPath('userData'), process.env.NODE_ENV === 'development');
          log('info', '--------------------------');
          log('info', 'Vortex Version', app.getVersion());
          return this.startSplash();
        })
        // start initialization
        .then(splashIn => {
          splash = splashIn;
          return this.createStore();
        })
        .then(() => this.createTray())
        .then(() => this.initDevel())
        .then(() => this.startUi())
        // end initialization
        .then(() => splash.fadeOut())
        .catch((err) => {
          require('../util/errorHandling').terminate({
            message: 'Startup failed',
            details: err.message,
            stack: err.stack,
          });
        });
  }

  private handleGet(getPath: string | boolean): Promise<void> {
    if (typeof(getPath) === 'boolean') {
      origFS.writeSync(1, 'Usage: vortex --get <path>\n');
      app.quit();
      return;
    }
    const levelup = require('levelup');
    const vortexPath = process.env.NODE_ENV === 'development' ? 'vortex_devel' : 'vortex';
    const dbpath = path.join(process.env['APPDATA'], vortexPath, 'state');
    const db = levelup(dbpath);
    const pathArray = getPath.split('.');

    db.get('global_' + pathArray[0], (err, value) => {
      if (err) {
        process.stderr.write(err + '\n');
      } else {
        const { inspect } = require('util');
        const { getSafe } = require('../util/storeHelper');
        process.stdout.write(
          inspect(getSafe(JSON.parse(value), pathArray.slice(1), '<invalid>')) + '\n');
      }
      app.quit();
    });
  }

  private handleSet(setParameters: string[]): Promise<void> {
    if (setParameters.length !== 2) {
      process.stdout.write('Usage: vortex --set <path>=<value>\n');
      app.quit();
      return;
    }

    const levelup = require('levelup');
    const vortexPath = process.env.NODE_ENV === 'development' ? 'vortex_devel' : 'vortex';
    const dbpath = path.join(process.env['APPDATA'], vortexPath, 'state');
    const db = levelup(dbpath);
    const pathArray = setParameters[0].split('.');

    db.get('global_' + pathArray[0], (err, value) => {
      if (err) {
        process.stderr.write(err);
        app.quit();
      } else {
        const { getSafe, setSafe } = require('../util/storeHelper');
        const data = JSON.parse(value);
        const oldValue = getSafe(data, pathArray.slice(1), undefined);
        const newValue = setParameters[1].length === 0
          ? undefined
          : (oldValue === undefined) || (typeof(oldValue) === 'object')
            ? JSON.parse(setParameters[1])
            : oldValue.constructor(setParameters[1]);
        if (oldValue !== undefined) {
          const newData = setSafe(data, pathArray.slice(1), newValue);
          db.put('global_' + pathArray[0], JSON.stringify(newData), (setErr) => {
            if (setErr) {
              process.stderr.write(setErr);
            }
            app.quit();
          });
        } else {
          app.quit();
        }
      }
    });
  }

  private createTray(): Promise<void> {
    const TrayIcon = require('./TrayIcon').default;
    this.mTray = new TrayIcon();
    return Promise.resolve();
  }

  private multiUserPath() {
    if (process.platform === 'win32') {
      const muPath = path.join(process.env.ProgramData, 'vortex');
      fs.ensureDirSync(muPath);
      return muPath;
    } else {
      log('error', 'Multi-User mode not implemented outside windows');
      return app.getPath('userData');
    }
  }

  private createStore(): Promise<void> {
    const newStore = createVortexStore(this.sanityCheckCB);

    // 1. load only user settings to determine if we're in multi-user mode
    // 2. load app settings to determine which extensions to load
    // 3. load extensions, then load all settings, including extensions
    return LevelPersist.create(path.join(this.mBasePath, currentStatePath))
      .then(levelPersistor => {
        this.mLevelPersistor = levelPersistor;
        return insertPersistor(
          'user', new SubPersistor(this.mLevelPersistor, 'user'));
      })
      .then(() => {
        const multiUser = newStore.getState().user.multiUser;
        const dataPath = multiUser
          ? this.multiUserPath()
          : app.getPath('userData');
        app.setPath('userData', dataPath);
        this.mBasePath = dataPath;
        fs.ensureDirSync(dataPath);

        log('info', `using ${dataPath} as the storage directory`);
        if (multiUser) {
          setLogPath(dataPath);
          return this.mLevelPersistor.changeDatabase(path.join(dataPath, currentStatePath));
        } else {
          return Promise.resolve();
        }
      })
      .then(() => insertPersistor('app', new SubPersistor(this.mLevelPersistor, 'app')))
      .then(() => {
        if (newStore.getState().app.instanceId === undefined) {
          const newId = uuid.v4();
          newStore.dispatch(setInstanceId(newId));
        }
        const ExtensionManager = require('../util/ExtensionManager').default;
        this.mExtensions = new ExtensionManager(newStore);
        const reducer = require('../reducers/index').default;
        newStore.replaceReducer(reducer(this.mExtensions.getReducers()));
        return Promise.mapSeries(allHives(this.mExtensions), hive =>
          insertPersistor(hive, new SubPersistor(this.mLevelPersistor, hive)));
      })
      .then(() => importState(this.mBasePath))
      .then(oldState => {
        // mark as imported first, otherwise we risk importing again overwriting data.
        // this way we risk not importing but since the old state is still there, that
        // can be repaired
        return markImported(this.mBasePath)
          .then(() => {
            newStore.dispatch({
              type: '__hydrate',
              payload: oldState,
            });
          });
      })
      .then(() => {
        this.mStore = newStore;
        return extendStore(newStore, this.mExtensions);
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
    const windowMetrics = this.mStore.getState().settings.window;
    const maximized: boolean = windowMetrics.maximized || false;
    this.mMainWindow.show(maximized);
  }

  private testShouldQuit(retries: number): Promise<void> {
    // different modes: if retries were set, the caller wants to start a
    // "primary" instance and is willing to wait. In that case we don't act as
    // a secondary instance that sends off it's arguments to the first
    const remoteCallback = (retries === -1) ?
                               (secondaryArgv, workingDirectory) => {
                                 // this is called inside the primary process
                                 // with the parameters of
                                 // the secondary one whenever an additional
                                 // instance is started
                                 this.applyArguments(commandLine(secondaryArgv));
                               } :
                               () => undefined;

    const shouldQuit: boolean = app.makeSingleInstance(remoteCallback);

    if (shouldQuit) {
      if (retries > 0) {
        return require('../util/delayed').delayed(100).then(() => this.testShouldQuit(retries - 1));
      }
      app.quit();
    }

    return Promise.resolve();
  }

  private applyArguments(args: IParameters) {
    if (args.download) {
      this.mMainWindow.sendExternalURL(args.download);
    }
  }
}

export default Application;
