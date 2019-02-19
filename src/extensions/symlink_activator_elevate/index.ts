import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {ProcessCanceled, TemporaryError, UserCanceled} from '../../util/CustomErrors';
import { delayed } from '../../util/delayed';
import * as fs from '../../util/fs';
import { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import { activeGameId, gameName } from '../../util/selectors';

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
import * as I18next from 'i18next';
import * as ipc from 'node-ipc';
import * as path from 'path';
import { generate as shortid } from 'shortid';
import { runElevated } from 'vortex-run';

const app = appIn || remote.app;

ipc.config.logger = (message) => log('debug', 'ipc message', { message });

class DeploymentMethod extends LinkingDeployment {
  public id: string;
  public name: string;
  public description: string;

  private mElevatedClient: any;
  private mQuitTimer: NodeJS.Timer;
  private mCounter: number;
  private mOpenRequests: { [num: number]: { resolve: () => void, reject: (err: Error) => void } };
  private mDone: () => void;
  private mWaitForUser: () => Promise<void>;
  private mOnReport: (report: string) => void;

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

  public detailedDescription(t: I18next.TranslationFunction): string {
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
    return undefined;
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const num = this.mCounter++;
      ipc.server.emit(this.mElevatedClient, 'link-file',
        { source: sourcePath, destination: linkPath, num });
      this.mOpenRequests[num] = { resolve, reject };
    });
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const num = this.mCounter++;
      ipc.server.emit(this.mElevatedClient, 'remove-link',
        { destination: linkPath, num });
      this.mOpenRequests[num] = { resolve, reject };
    });
  }

  protected purgeLinks(installPath: string, dataPath: string): Promise<void> {
    // purge by removing all symbolic links that point to a file inside
    // the install directory
    return this.startElevated()
      .then(() => walk(dataPath, (iterPath: string, stats: fs.Stats) => {
            if (!stats.isSymbolicLink()) {
              return Promise.resolve();
            }
            return fs.readlinkAsync(iterPath).then((symlinkPath) => {
              if (!path.relative(installPath, symlinkPath).startsWith('..')) {
                ipc.server.emit(this.mElevatedClient, 'remove-link',
                                {destination: iterPath});
              }
            });
          }))
      .then(() => this.stopElevated());
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
      fs.linkSync(srcFile, destFile);
      fs.removeSync(destFile);
      return true;
    } catch (err) {
      return false;
    }
  }

  private startElevated(): Promise<void> {
    this.mOpenRequests = {};
    this.mDone = null;
    const ipcPath: string = `vortex_elevate_symlink_${shortid()}`;

    return new Promise<void>((resolve, reject) => {
      let connected: boolean = false;
      if (this.mQuitTimer !== undefined) {
        // if there is already an elevated process, just keep it around a bit longer
        clearTimeout(this.mQuitTimer);
        return resolve();
      }
      ipc.serve(ipcPath, () => undefined);
      ipc.server.start();
      ipc.server.on('initialised', (data, socket) => {
        this.mElevatedClient = socket;
        connected = true;
        resolve();
      });
      ipc.server.on('completed', (data, socket) => {
        const { err, num } = data;
        const task = this.mOpenRequests[num];
        if (task !== undefined) {
          if (err !== null) {
            task.reject(err);
          } else {
            task.resolve();
          }
          delete this.mOpenRequests[num];
        }
        if ((Object.keys(this.mOpenRequests).length === 0) && (this.mDone !== null)) {
          this.finish();
        }
      });
      ipc.server.on('socket.disconnected', () => {
        try {
          ipc.server.stop();
        } catch (err) {
          log('warn', 'Failed to close ipc server', err.message);
        }
      });
      ipc.server.on('log', (data: any) => {
        log(data.level, data.message, data.meta);
      });
      ipc.server.on('report', (data: string) => {
        this.mOnReport(data);
      });
      ipc.server.on('error', err => {
        log('error', 'Failed to start symlink activator', err);
      });
      return runElevated(ipcPath, remoteCode, {})
        .then(() => delayed(15000))
        .then(() => {
          if (!connected) {
            // still no connection, something must have gone wrong
            try {
              ipc.server.stop();
            } catch (err) {
              log('warn', 'Failed to close ipc server', err.message);
            }
            reject(new TemporaryError('failed to run deployment helper'));
          }
        })
        .tapCatch(() => {
          ipc.server.stop();
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
        ipc.server.emit(this.mElevatedClient, 'quit');
        ipc.server.stop();
      } catch (err) {
        // the most likely reason here is that it's already closed
        // and cleaned up
        log('warn', 'Failed to close ipc server', err.message);
      }
      this.mElevatedClient = null;
      this.mQuitTimer = undefined;
    }, 1000);

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
