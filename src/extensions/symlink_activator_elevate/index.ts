import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {ProcessCanceled, TemporaryError, UserCanceled} from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import { activeGameId, gameName, installPathForGame } from '../../util/selectors';

import LinkingDeployment from '../mod_management/LinkingDeployment';
import {
  IDeployedFile,
  IDeploymentMethod,
  IUnavailableReason,
} from '../mod_management/types/IDeploymentMethod';

import { remoteCode } from './remoteCode';
import walk from './walk';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import I18next from 'i18next';
import * as JsonSocket from 'json-socket';
import * as net from 'net';
import * as path from 'path';
import { generate as shortid } from 'shortid';
import { runElevated } from 'vortex-run';

const app = appIn || remote.app;

class DeploymentMethod extends LinkingDeployment {
  public id: string;
  public name: string;
  public description: string;

  public priority: number = 20;

  private mElevatedClient: any;
  private mQuitTimer: NodeJS.Timer;
  private mCounter: number;
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
          + 'folder. On Windows, symbolic links only work on NTFS drives', { allowReport: false });
      } else {
        api.showErrorNotification('Unknown error', report);
      }
    };
  }

  public detailedDescription(t: I18next.TFunction): string {
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
    return this.mWaitForUser();
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
    return this.startElevated()
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
    if (this.ensureAdmin()) {
      return {
        description: t =>
          t('No need to use the elevated variant, use the regular symlink deployment'),
      };
    }

    // unfortunately we can't test whether symlinks are supported on the filesystem if
    // creating a link requires elevation

    return undefined;
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const num = this.mCounter++;
      this.emit('link-file', {
        source: sourcePath, destination: linkPath, num,
      });
      this.mOpenRequests[num] = { resolve, reject };
    });
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const num = this.mCounter++;
      this.emit('remove-link', {
        destination: linkPath, num,
      });
      this.mOpenRequests[num] = { resolve, reject };
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
              .then((symlinkPath) => {
                if (!path.relative(installPath, symlinkPath).startsWith('..')) {
                  this.emit('remove-link', { destination: iterPath });
                }
              })
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
          return Promise.reject(new Error('Some files could not be purged, please check the log file'));
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

  private ensureAdmin(): boolean {
    const userData = app.getPath('userData');
    // any file we know exists
    const srcFile = path.join(userData, 'Cookies');
    const destFile = path.join(userData, '__link_test');
    try {
      try {
        // ensure the dummy file wasn't left over from a previous test
        fs.removeSync(destFile);
      } catch (err) {}
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

  private startElevated(): Promise<void> {
    this.mOpenRequests = {};
    this.mDone = null;
    const ipcPath: string = `vortex_elevate_symlink_${shortid()}`;
    let pongTimer: NodeJS.Timer;

    return new Promise<void>((resolve, reject) => {
      let connected: boolean = false;
      let ponged: boolean = true;
      if (this.mQuitTimer !== undefined) {
        // if there is already an elevated process, just keep it around a bit longer
        clearTimeout(this.mQuitTimer);
        return resolve();
      }

      this.mIPCServer = net.createServer(connRaw => {
        const conn = new JsonSocket(connRaw);

        conn
          .on('message', data => {
            const { message, payload } = data;
            if (message === 'initialised') {
              this.mElevatedClient = conn;
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
              const { level, message, meta } = payload;
              log(level, message, meta);
            } else if (message === 'report') {
              this.mOnReport(payload);
            } else if (message === 'pong') {
              ponged = true;
            } else {
              log('error', 'Got unexpected message', { message, payload });
            }
          })
          .on('error', err => {
            log('error', 'elevated code reported error', err);
          })
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
            return reject(new TemporaryError('deployment helper didn\'t respond, please check your log'));
          }
          ponged = false;
          this.emit('ping', {});
        }, 15000);
      })
      .listen(path.join('\\\\?\\pipe', ipcPath));

      return runElevated(ipcPath, remoteCode, {})
        .tap(tmpPath => {
          this.mTmpFilePath = tmpPath;
          console.log('started elevated process')
        })
        .tapCatch(() => {
          log('error', 'failed to run remote process');
          try { 
            this.mIPCServer.close();
            this.mIPCServer = undefined;
          } catch (err) {
            log('warn', 'Failed to close ipc server', err.message);
          }
        })
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
      } catch (err) { }
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
      ? ['nomanssky', 'stateofdecay', 'factorio']
      : ['nomanssky', 'stateofdecay'];

    return unsupportedGames.indexOf(gameId) !== -1;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerDeploymentMethod: (deployment: IDeploymentMethod) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerDeploymentMethod(new DeploymentMethod(context.api));

  return true;
}

export default init;
