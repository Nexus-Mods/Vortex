import { clearUIBlocker, setUIBlocker } from '../../actions';
import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { IState } from '../../types/IState';
import {ProcessCanceled, TemporaryError, UserCanceled} from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { Normalize } from '../../util/getNormalizeFunc';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { activeGameId, gameName } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import { getGame } from '../gamemode_management/util/getGame';
import LinkingDeployment from '../mod_management/LinkingDeployment';
import {
  IDeployedFile,
  IDeploymentMethod,
  IUnavailableReason,
} from '../mod_management/types/IDeploymentMethod';

import reducer from './reducers';
import { remoteCode } from './remoteCode';
import Settings from './Settings';
import walk from './walk';

import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import { TFunction } from 'i18next';
import JsonSocket from 'json-socket';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { generate as shortid } from 'shortid';
import { runElevated } from 'vortex-run';
import * as winapi from 'winapi-bindings';
import { enableUserSymlinks } from './actions';

const TASK_NAME = 'Vortex Symlink Deployment';
const SCRIPT_NAME = 'vortexSymlinkService.js';
const IPC_ID = 'vortex_elevate_symlink';

const app = appIn || remote.app;

function monitorConsent(onDisappeared: () => void): () => void {
  if (process.platform !== 'win32') {
    // on non-windows platforms we don't need to do any of this.
    return;
  }

  const doCheck = () => {
    const consentExe = winapi.GetProcessList().find(proc => proc.exeFile === 'consent.exe');
    if (consentExe === undefined) {
      // no consent.exe, assume it finished
      // still, wait a bit longer before doing anything so the "success" code has a chance to run
      nextCheck = setTimeout(onDisappeared, 5000);
    } else {
      // consent exe still running, bring its window to front and reschedule test
      const windows = winapi.GetProcessWindowList(consentExe.processID);
      windows.forEach(win => winapi.SetForegroundWindow(win));

      nextCheck = setTimeout(doCheck, 1000);
    }
  };

  // give the first check a lot of time, who knows what the system has to do
  let nextCheck = setTimeout(doCheck, 5000);

  return () => {
    clearTimeout(nextCheck);
  };
}

type OnMessageCB = (conn: JsonSocket, message: string, payload: any) => void;

function startIPCServer(ipcPath: string, onMessage: OnMessageCB): net.Server {
  return net.createServer(connRaw => {
    const conn = new JsonSocket(connRaw);

    conn
      .on('message', data => {
        const { message, payload } = data;
        onMessage(conn, message, payload);
      })
      .on('error', err => {
        log('error', 'elevated code reported error', err);
      });
  })
    .listen(path.join('\\\\?\\pipe', ipcPath))
    .on('error', err => {
      log('error', 'Failed to create ipc server', err);
    });
}

class DeploymentMethod extends LinkingDeployment {
  public id: string;
  public name: string;
  public description: string;

  public priority: number = 20;

  private mElevatedClient: any;
  private mQuitTimer: NodeJS.Timer;
  private mCounter: number = 0;
  private mOpenRequests: { [num: number]: { resolve: () => void, reject: (err: Error) => void } };
  private mIPCServer: net.Server;
  private mDone: () => void;
  private mWaitForUser: () => Promise<void>;
  private mOnReport: (report: string) => void;
  private mTmpFilePath: string;

  constructor(api: IExtensionApi) {
    super(
        'symlink_activator_elevated', 'Symlink Deployment (Run as Administrator)',
        'Deploys mods by setting symlinks in the destination directory. '
        + 'This is run as administrator and requires your permission every time we deploy.',
        true,
        api);
    this.mElevatedClient = null;

    this.mWaitForUser = () => new Promise<void>((resolve, reject) => api.sendNotification({
        type: 'info',
        message: 'Deployment requires elevation',
        noDismiss: true,
        actions: [{
          title: 'Elevate',
          action: dismiss => { dismiss(); resolve(); },
        }, {
          title: 'Cancel',
          action: dismiss => { dismiss(); reject(new UserCanceled()); },
        }],
      }));

    let lastReport: string;
    this.mOnReport = (report: string) => {
      if (report === lastReport) {
        return;
      }

      lastReport = report;

      if (report === 'not-supported') {
        api.showErrorNotification('Symlinks not support',
          'It appears symbolic links aren\'t supported between your mod staging folder and game '
          + 'folder. On Windows, symbolic links only work on NTFS drives.', { allowReport: false });
      } else {
        api.showErrorNotification('Unknown error', report);
      }
    };
  }

  public initEvents(api: IExtensionApi) {
    if (api.events !== undefined) {
      api.events.on('force-unblock-elevating', () => {
        try {
          if (this.mIPCServer !== undefined) {
            this.mIPCServer.close();
            this.mIPCServer = undefined;
          }
        } catch (err) {
          log('warn', 'Failed to close ipc server', err.message);
        }
      });
    }
  }

  public detailedDescription(t: TFunction): string {
    return t(
      'Symbolic links are special files containing a reference to another file. '
      + 'They are supported directly by the low-level API of the operating system '
      + 'so any application trying to open a symbolic link will actually open '
      + 'the referenced file unless the application asks specifically to not be '
      + 'redirected.\n'
      + 'Advantages:\n'
      + ' - good compatibility and availability\n'
      + ' - can link across partitions (unlike hard links)\n'
      + ' - an application that absolutely needs to know can recognize a symlink '
      + '(unlike hard links)\n'
      + 'Disadvantages:\n'
      + ' - some games and applications refuse to work with symbolic links for no '
      + 'good reason.\n'
      + ' - On windows you need admin rights to create a symbolic link, even when '
      + 'your regular account has write access to source and destination.');
  }

  public userGate(): Promise<void> {
    const state: IState = this.api.store.getState();

    return state.settings.workarounds.userSymlinks
      ? Promise.resolve()
      : this.mWaitForUser();
  }

  public prepare(dataPath: string, clean: boolean, lastActivation: IDeployedFile[],
                 normalize: Normalize): Promise<void> {
    this.mCounter = 0;
    this.mOpenRequests = {};
    return super.prepare(dataPath, clean, lastActivation, normalize);
  }

  public finalize(gameId: string, dataPath: string,
                  installationPath: string): Promise<IDeployedFile[]> {
    Object.keys(this.mOpenRequests).forEach(num => {
      this.mOpenRequests[num].reject(new ProcessCanceled('unfinished'));
    });
    this.mOpenRequests = {};
    return this.closeServer()
        .then(() => this.startElevated())
        .tapCatch(() => this.context.onComplete())
        .then(() => super.finalize(gameId, dataPath, installationPath))
        .then(result => this.stopElevated().then(() => result));
  }

  public isSupported(state: any, gameId?: string): IUnavailableReason {
    if (process.platform !== 'win32') {
      return { description: t => t('Elevation not required on non-windows systems') };
    }
    if (gameId === undefined) {
      gameId = activeGameId(state);
    }

    const game: IGame = getGame(gameId);
    if ((game.details !== undefined) && (game.details.supportsSymlinks === false)) {
      return { description: t => t('Game doesn\'t support symlinks') };
    }

    if (this.isGamebryoGame(gameId) || this.isUnsupportedGame(gameId)) {
      // Mods for this games use some file types that have issues working with symbolic links
      return {
        description: t => t('Incompatible with "{{name}}".', {
          replace: {
            name: gameName(state, gameId),
          },
        }),
      };
    }
    if (this.ensureAdmin() && (process.env['FORCE_ALLOW_ELEVATED_SYMLINKING'] !== 'yes')) {
      return {
        description: t =>
          t('No need to use the elevated variant, use the regular symlink deployment'),
      };
    }

    // unfortunately we can't test whether symlinks are supported on the filesystem if
    // creating a link requires elevation

    return undefined;
  }

  protected linkFile(linkPath: string, sourcePath: string, dirTags?: boolean): Promise<void> {
    const dirName = path.dirname(linkPath);
    return fs.ensureDirAsync(dirName)
      .then(created => {
        if ((dirTags !== false) && (created !== null)) {
          log('debug', 'created directory', dirName);
          return fs.writeFileAsync(
            path.join(dirName, LinkingDeployment.NEW_TAG_NAME),
            'This directory was created by Vortex deployment and will be removed ' +
            'during purging if it\'s empty');
        } else {
          // if the directory did exist there is a chance the destination file already
          // exists
          return fs.removeAsync(linkPath)
            .catch(err => (err.code === 'ENOENT')
              ? Promise.resolve()
              : Promise.reject(err));
        }
      })
      .then(() => this.emitOperation('link-file', {
        source: sourcePath, destination: linkPath,
      }));
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return this.emitOperation('remove-link', {
      destination: linkPath,
    });
  }

  protected purgeLinks(installPath: string, dataPath: string): Promise<void> {
    let hadErrors = false;
    // purge by removing all symbolic links that point to a file inside
    // the install directory
    return this.startElevated()
      .then(() => walk(dataPath, (iterPath: string, stats: fs.Stats) => {
            if (!stats.isSymbolicLink()) {
              return Promise.resolve();
            }
            return fs.readlinkAsync(iterPath)
              .then((symlinkPath) => path.relative(installPath, symlinkPath).startsWith('..')
                ? Promise.resolve()
                : this.emitOperation('remove-link', { destination: iterPath }))
              .catch(err => {
                if (err.code === 'ENOENT') {
                  log('debug', 'link already gone', { iterPath, error: err.message });
                } else {
                  hadErrors = true;
                  log('error', 'failed to remove link', { iterPath, error: err.message });
                }
              });
          }))
      .then(() => this.stopElevated())
      .then(() => {
        if (hadErrors) {
          return Promise.reject(
            new Error('Some files could not be purged, please check the log file'));
        } else {
          return Promise.resolve();
        }
      });
  }

  protected isLink(linkPath: string, sourcePath: string): Promise<boolean> {
    return fs.readlinkAsync(linkPath)
    .then(symlinkPath => symlinkPath === sourcePath)
    // readlink throws an "unknown" error if the file is no link at all. Super helpful
    .catch(() => false);
  }

  protected canRestore(): boolean {
    return false;
  }

  private closeServer(): Promise<void> {
    if ((this.mIPCServer === undefined)
        || (this.mQuitTimer !== undefined)) {
      return Promise.resolve();
    }
    return new Promise((resolve,  reject) => {
      this.mIPCServer.close((err: Error) => {
        if ((err !== null) && !err.message.includes('ERR_SERVER_NOT_RUNNING')) {
          return reject(err);
        } else {
          this.mIPCServer = undefined;
          return resolve();
        }
      });
    });
  }

  private ensureAdmin(): boolean {
    const userData = getVortexPath('userData');
    // any file we know exists
    const srcFile = path.join(userData, 'Cookies');
    const destFile = path.join(userData, '__link_test');
    try {
      try {
        // ensure the dummy file wasn't left over from a previous test
        fs.removeSync(destFile);
      } catch (err) {
        // nop
      }
      fs.symlinkSync(srcFile, destFile);
      fs.removeSync(destFile);
      return true;
    } catch (err) {
      return false;
    }
  }

  private emit(message, payload) {
    if (this.mElevatedClient) {
      this.mElevatedClient.sendMessage({message, payload});
    }
  }
  private emitOperation(command: string, args: any): Promise<void> {
    const requestNum = this.mCounter++;
    return new Promise<void>((resolve, reject) => {
      this.emit(command, { ...args, num: requestNum });
      this.mOpenRequests[requestNum] = { resolve, reject };
    })
    .timeout(5000)
    .tapCatch(Promise.TimeoutError, () => {
      delete this.mOpenRequests[requestNum];
    });
  }

  private startElevated(): Promise<void> {
    this.mOpenRequests = {};
    this.mDone = null;

    const state: IState = this.api.store.getState();
    const useTask = state.settings.workarounds.userSymlinks;

    // can't use dynamic id for the task
    const ipcPath: string = useTask
      ? IPC_ID
      : `${IPC_ID}vortex_elevate_symlink_${shortid()}`;
    let pongTimer: NodeJS.Timer;

    return new Promise<void>((resolve, reject) => {
      let connected: boolean = false;
      let ponged: boolean = true;
      if (this.mQuitTimer !== undefined) {
        // if there is already an elevated process, just keep it around a bit longer
        clearTimeout(this.mQuitTimer);
        return resolve();
      }

      this.mIPCServer = startIPCServer(ipcPath,
                                       (conn: JsonSocket, message: string, payload: any) => {
        if (message === 'initialised') {
          log('debug', 'ipc connected');
          this.mElevatedClient = conn;
          this.api.store.dispatch(clearUIBlocker('elevating'));
          if (cancelConsentMonitor !== undefined) {
            cancelConsentMonitor();
          }
          connected = true;
          resolve();
        } else if (message === 'completed') {
          const { err, num } = payload;
          const task = this.mOpenRequests[num];
          if (task !== undefined) {
            if (err !== null) {
              task.reject(err);
            } else {
              task.resolve();
            }
            delete this.mOpenRequests[num];
          }
          if ((Object.keys(this.mOpenRequests).length === 0)
            && (this.mDone !== null)) {
            this.finish();
          }
        } else if (message === 'log') {
          // tslint:disable-next-line:no-shadowed-variable
          const { level, message, meta } = payload;
          log(level, message, meta);
        } else if (message === 'report') {
          this.mOnReport(payload);
        } else if (message === 'pong') {
          ponged = true;
        } else {
          log('error', 'Got unexpected message', { message, payload });
        }
      });

      pongTimer = setInterval(() => {
        if (!ponged || !connected) {
          try {
            if (this.mIPCServer !== undefined) {
              this.mIPCServer.close();
              this.mIPCServer = undefined;
            }
          } catch (err) {
            log('warn', 'Failed to close ipc server', err.message);
          }
          return reject(
            new TemporaryError('deployment helper didn\'t respond, please check your log'));
        }
        ponged = false;
        this.emit('ping', {});
      }, 15000);

      if (!useTask) {
        this.api.store.dispatch(setUIBlocker(
          'elevating', 'open-ext', 'Please confirm the "User Access Control" dialog', true));
      }

      const cancelConsentMonitor = useTask ? undefined : monitorConsent(() => {
        // this is called if consent.exe disappeared but none of our "regular" code paths ran
        // which would have cancelled this timeout
        this.api.store.dispatch(clearUIBlocker('elevating'));
        try {
          this.mIPCServer.close();
          this.mIPCServer = undefined;
        } catch (err) {
          log('warn', 'Failed to close ipc server', err.message);
        }
        if (pongTimer !== undefined) {
          clearInterval(pongTimer);
        }
        /*
        this.api.showErrorNotification('Failed to run elevated process',
          'Symlinks on your system can only be created by an elevated process and your system '
          + 'just refused/failed to run the process elevated with no error message. '
          + 'Please check your system settings regarding User Access Control or use a '
          + 'different deployment method.', { allowReport: false });
          */
        reject(new ProcessCanceled(
          'Symlinks on your system can only be created by an elevated process and your system '
          + 'just refused/failed to run the process elevated with no error message. '
          + 'Please check your system settings regarding User Access Control or use a '
          + 'different deployment method.'));
      });

      const remoteProm = useTask
        ? Promise.resolve()
        : Promise.delay(0).then(() => runElevated(ipcPath, remoteCode, {}))
        .tap(tmpPath => {
          this.mTmpFilePath = tmpPath;
          log('debug', 'started elevated process');
        })
        .tapCatch(() => {
          this.api.store.dispatch(clearUIBlocker('elevating'));
          if (cancelConsentMonitor !== undefined) {
            cancelConsentMonitor();
          }
          log('error', 'failed to run remote process');
          try {
            this.mIPCServer.close();
            this.mIPCServer = undefined;
          } catch (err) {
            log('warn', 'Failed to close ipc server', err.message);
          }
        });

      if (useTask) {
        winapi.RunTask(TASK_NAME);
      }

      return remoteProm
        // Error 1223 is the current standard Windows system error code
        //  for ERROR_CANCELLED, which in this case is raised if the user
        //  selects to deny elevation when prompted.
        //  https://docs.microsoft.com/en-us/windows/desktop/debug/system-error-codes--1000-1299-
        .catch(err => (err.code === 5)
          || ((process.platform === 'win32') && (err.errno === 1223))
            ? reject(new UserCanceled())
            : reject(err))
        .catch(reject);
    })
    .finally(() => {
      if (pongTimer !== undefined) {
        clearInterval(pongTimer);
      }
    });
  }

  private stopElevated() {
    return new Promise<void>((resolve, reject) => {
      this.mDone = () => {
        resolve();
      };
      if (Object.keys(this.mOpenRequests).length === 0) {
        this.finish();
      }
    });
  }

  private finish() {
    if (this.mQuitTimer !== undefined) {
      clearTimeout(this.mQuitTimer);
    }
    this.mQuitTimer = setTimeout(() => {
      try {
        this.emit('quit', {});
        this.mIPCServer.close();
        this.mIPCServer = undefined;
      } catch (err) {
        // the most likely reason here is that it's already closed
        // and cleaned up
        log('warn', 'Failed to close ipc server', err.message);
      }
      this.mElevatedClient = null;
      this.mQuitTimer = undefined;
    }, 1000);

    if (this.mTmpFilePath !== undefined) {
      try {
        fs.removeSync(this.mTmpFilePath);
        this.mTmpFilePath = undefined;
      } catch (err) {
        // nop
      }
    }

    this.mDone();
  }

  private isGamebryoGame(gameId: string): boolean {
    return [
      'morrowind', 'oblivion', 'skyrim', 'enderal', 'skyrimse', 'skyrimvr',
      'fallout4', 'fallout4vr', 'fallout3', 'falloutnv',
    ].indexOf(gameId) !== -1;
  }

  private isUnsupportedGame(gameId: string): boolean {
    const unsupportedGames = (process.platform === 'win32')
      ? ['nomanssky', 'stateofdecay', 'factorio', 'witcher3']
      : ['nomanssky', 'stateofdecay'];

    return unsupportedGames.indexOf(gameId) !== -1;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerDeploymentMethod: (deployment: IDeploymentMethod) => void;
}

// tslint:disable-next-line:variable-name
const __req = undefined; // dummy

// copy&pasted from elevatedMain
function baseFunc(moduleRoot: string, ipcPath: string,
                  main: (ipc, req: NodeRequireFunction) => void | Promise<void>) {
  const handleError = (error: any) => {
    // tslint:disable-next-line:no-console
    console.error('Elevated code failed', error.stack);
  };
  process.on('uncaughtException', handleError);
  process.on('unhandledRejection', handleError);
  // tslint:disable-next-line:no-shadowed-variable
  (module as any).paths.push(moduleRoot);
  const imp = {
    net: __req('net'),
    JsonSocket: __req('json-socket'),
    path: __req('path'),
  };

  const client = new imp.JsonSocket(new imp.net.Socket());
  client.connect(imp.path.join('\\\\?\\pipe', ipcPath));

  client.on('connect', () => {
    const res = main(client, __req);
    // bit of a hack but the type "bluebird" isn't known in this context
    if (res?.['catch'] !== undefined) {
      (res as any)
        .catch(error => {
          client.emit('error', error.message);
        })
        .finally(() => {
          client.end();
          process.exit(0);
        });
    }
  })
    .on('close', () => {
      process.exit(0);
    })
    .on('error', err => {
      if (err.code !== 'EPIPE') {
        // will anyone ever see this?
        // tslint:disable-next-line:no-console
        console.error('Connection failed', err.message);
      }
    });
}

function makeScript(args: any): string {
  const projectRoot = getVortexPath('modules_unpacked').split('\\').join('/');

  let funcBody = baseFunc.toString();
  funcBody = 'const __req = require;'
    + funcBody.slice(funcBody.indexOf('{') + 1, funcBody.lastIndexOf('}'));
  let prog: string = `
        let moduleRoot = '${projectRoot}';\n
        let ipcPath = '${IPC_ID}';\n
      `;

  if (args !== undefined) {
    for (const argKey of Object.keys(args)) {
      if (args.hasOwnProperty(argKey)) {
        prog += `let ${argKey} = ${JSON.stringify(args[argKey])};\n`;
      }
    }
  }

  prog += `
        let main = ${remoteCode.toString()};\n
        ${funcBody}\n
      `;
  return prog;
}

function ensureTaskEnabled() {
  const scriptPath = path.join(getVortexPath('userData'), SCRIPT_NAME);

  return fs.writeFileAsync(scriptPath, makeScript({ }))
    .then(() => {
      if (findTask() !== undefined) {
        // not checking if the task is actually set up correctly
        // (proper path and arguments for the action) so if we change any of those we
        // need migration code. If the user changes the task, screw them.
        return Promise.resolve();
      }

      const taskName = TASK_NAME;

      const ipcPath = `ipc_${shortid()}`;

      const ipcServer: net.Server = startIPCServer(ipcPath, (conn, message: string, payload) => {
        if (message === 'log') {
          log(payload.level, payload.message, payload.meta);
        } else if (message === 'quit') {
          ipcServer.close();
        }
      });

      const exePath = process.execPath;
      const exeArgs = exePath.endsWith('electron.exe')
        ? getVortexPath('package')
        : '';

      return runElevated(ipcPath, (ipc, req) => {
        const winapiRemote: typeof winapi = req('winapi-bindings');
        const osRemote: typeof os = req('os');
        try {
          winapiRemote.CreateTask(taskName, {
            registrationInfo: {
              Author: 'Vortex',
              Description: 'This task is required for Vortex to create symlinks without elevation.'
                + 'Do not change anything unless you really know what you\'re doing.',
            },
            user: `${osRemote.hostname()}\\${osRemote.userInfo().username}`,
            taskSettings: { AllowDemandStart: true },
            principal: { RunLevel: 'highest' } as any,
            actions: [
              {
                Path: exePath,
                Arguments: `${exeArgs} --run ${scriptPath}`,
              },
            ],
          });
        } catch (err) {
          ipc.sendMessage({ message: 'log', payload: {
            level: 'error', message: 'Failed to create task', meta: err } });
        }
        ipc.sendMessage({ message: 'quit' });
      }, { scriptPath, taskName, exePath, exeArgs });
    });
}

function tasksSupported() {
  try {
    winapi.GetTasks();
    return null;
  } catch (err) {
    log('info', 'windows tasks api failed', err.message);
    return err.message;
  }
}

function findTask() {
  if (process.platform !== 'win32') {
    return undefined;
  }
  try {
    return winapi.GetTasks().find(task => task.Name === TASK_NAME);
  } catch (err) {
    log('warn', 'failed to list windows tasks', err.message);
    return undefined;
  }
}

function ensureTaskDeleted(): Promise<void> {
  if (findTask() === undefined) {
    return Promise.resolve();
  }

  const ipcPath = `ipc_${shortid()}`;
  const ipcServer: net.Server = startIPCServer(ipcPath, (conn, message: string, payload) => {
    if (message === 'log') {
      log(payload.level, payload.message, payload.meta);
    } else if (message === 'quit') {
      ipcServer.close();
    }
  });

  const taskName = TASK_NAME;

  return runElevated(ipcPath, (ipc, req) => {
    const winapiRemote: typeof winapi = req('winapi-bindings');
    winapiRemote.DeleteTask(taskName);
    ipc.sendMessage({ message: 'quit' });
  }, { taskName });
}

function ensureTask(api: IExtensionApi, enabled: boolean): void {
  if (enabled) {
    ensureTaskEnabled()
      .catch(err => {
        api.showErrorNotification('Failed to create task', err);
        api.store.dispatch(enableUserSymlinks(false));
      })
      .then(() => null);
  } else {
    ensureTaskDeleted()
      .catch(err => {
        api.showErrorNotification('Failed to remove task', err);
      })
      .then(() => null);
  }
}

function migrate(api: IExtensionApi, oldVersion: string) {
  if (process.platform === 'win32'
      && semver.satisfies(oldVersion, '>=1.2.0  <1.2.10')
      && (findTask() !== undefined)) {
    api.sendNotification({
      type: 'warning',
      title: 'Due to a bug you have to disable and re-enable the Workaround "Allow Symlinks without elevation"',
      message: 'I am sorry for the inconvenience',
      displayMS: null,
    });
  }
  return Promise.resolve();
}

function init(context: IExtensionContextEx): boolean {
  const method = new DeploymentMethod(context.api);
  context.registerDeploymentMethod(method);

  context.registerReducer(['settings', 'workarounds'], reducer);

  if (process.platform === 'win32') {
    context.registerSettings('Workarounds', Settings, () => ({
      supported: tasksSupported(),
    }));
  }

  context.registerMigration(oldVersion => migrate(context.api, oldVersion));

  context.once(() => {
    method.initEvents(context.api);

    if (process.platform === 'win32') {
      const userSymlinksPath = ['settings', 'workarounds', 'userSymlinks'];
      context.api.onStateChange(userSymlinksPath, (prev, current) => {
        ensureTask(context.api, current);
      });
      const state = context.api.store.getState();
      const userSymlinks = getSafe(state, userSymlinksPath, false);
      ensureTask(context.api, userSymlinks);
    }
  });

  return true;
}

export default init;
