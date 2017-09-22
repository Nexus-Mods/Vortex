import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {UserCanceled} from '../../util/CustomErrors';
import * as elevatedT from '../../util/elevated';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';
import { activeGameId, gameName } from '../../util/selectors';

import LinkingDeployment from '../mod_management/LinkingDeployment';
import {
  IDeployedFile,
  IDeploymentMethod,
} from '../mod_management/types/IDeploymentMethod';

import walk from './walk';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import ipc = require('node-ipc');
import * as path from 'path';

import { remoteCode } from './remoteCode';

const elevated =
    lazyRequire<typeof elevatedT>('../../util/elevated', __dirname);

class DeploymentMethod extends LinkingDeployment {
  public id: string;
  public name: string;
  public description: string;

  private mElevatedClient: any;
  private mOutstanding: string[];
  private mQuitTimer: NodeJS.Timer;
  private mDone: () => void;
  private mWaitForUser: () => Promise<void>;

  constructor(api: IExtensionApi) {
    super(
        'symlink_activator_elevated', 'Symlink deployment (Run as Administrator)',
        'Deploys mods by setting symlinks in the destination directory. '
        + 'This is run as administrator and requires your permission every time we deploy.', api);
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

  public prepare(dataPath: string, clean: boolean, lastActivation: IDeployedFile[]): Promise<void> {
    return super.prepare(dataPath, clean, lastActivation);
  }

  public finalize(dataPath: string): Promise<IDeployedFile[]> {
    return this.startElevated()
        .then(() => super.finalize(dataPath))
        .then(result => this.stopElevated()
            .then(() => result));
  }

  public isSupported(state: any, gameId?: string): string {
    if (process.platform !== 'win32') {
      return 'Not required on non-windows systems';
    }
    if (gameId === undefined) {
      gameId = activeGameId(state);
    }
    if (this.isGamebryoGame(gameId)) {
      return 'Doesn\'t work with games based on the gamebryo engine '
        + '(including Skyrim SE and Fallout 4)';
    }
    if (this.isUnsupportedGame(gameId)) {
      // Mods for this games use some file types that have issues working with symbolic links
      return 'Doesn\'t work with ' + gameName(state, gameId);
    }
    return undefined;
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mOutstanding.push(sourcePath);

      ipc.server.emit(this.mElevatedClient, 'link-file',
        { source: sourcePath, destination: linkPath });
      resolve();
    });
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mOutstanding.push(linkPath);

      ipc.server.emit(this.mElevatedClient, 'remove-link',
        { destination: linkPath });
      resolve();
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

  private startElevated(): Promise<void> {
    this.mOutstanding = [];
    this.mDone = null;
    const ipcPath: string = 'nmm_elevate_symlink';

    return new Promise<void>((resolve, reject) => {
          if (this.mQuitTimer !== undefined) {
            // if there is already an elevated process, just keep it around a bit longer
            clearTimeout(this.mQuitTimer);
            return resolve();
          }
          ipc.serve(ipcPath, () => undefined);
          ipc.server.start();
          ipc.server.on('initialised', (data, socket) => {
            this.mElevatedClient = socket;
            resolve();
          });
          ipc.server.on('finished', (modPath: string) => {
            this.mOutstanding.splice(this.mOutstanding.indexOf(modPath), 1);
            if ((this.mOutstanding.length === 0) && (this.mDone !== null)) {
              this.finish();
            }
          });
          ipc.server.on('socket.disconnected', () => {
            ipc.server.stop();
          });
          ipc.server.on('log', (data: any) => {
            log(data.level, data.message, data.meta);
          });
          return elevated.default(ipcPath, remoteCode, {}, __dirname);
        });
  }

  private stopElevated() {
    return new Promise<void>((resolve, reject) => {
      this.mDone = () => {
        resolve();
      };
      if (this.mOutstanding.length === 0) {
        this.finish();
      }
    });
  }

  private finish() {
    if (this.mQuitTimer !== undefined) {
      clearTimeout(this.mQuitTimer);
    }
    this.mQuitTimer = setTimeout(() => {
      ipc.server.emit(this.mElevatedClient, 'quit');
      ipc.server.stop();
      this.mElevatedClient = null;
      this.mQuitTimer = undefined;
    }, 1000);

    this.mDone();
  }

  private isGamebryoGame(gameId: string): boolean {
    return ['skyrim', 'skyrimse', 'fallout4', 'falloutnv', 'oblivion'].indexOf(gameId) !== -1;
  }

  private isUnsupportedGame(gameId: string): boolean {
    return ['nomanssky', 'stateofdecay'].indexOf(gameId) !== -1;
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
