import { IExtensionContext } from '../../types/IExtensionContext';
import elevated from  '../../util/elevated';
import { log } from '../../util/log';
import { activeGameId } from '../../util/selectors';

import { IMod } from '../mod_management/types/IMod';
import { IFileChange, IModActivator } from '../mod_management/types/IModActivator';

import walk from './walk';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import ipc = require('node-ipc');
import * as path from 'path';

import { remoteCode } from './remoteCode';

class ModActivator implements IModActivator {
  public id: string;
  public name: string;
  public description: string;

  private mElevatedClient: any;
  private mOutstanding: string[];
  private mDone: () => void;

  constructor() {
    this.id = 'symlink_activator_elevated';
    this.name = 'Symlink activator (Elevated)';
    this.description = 'Installs the mods by setting symlinks in the destination directory. '
                     + 'This implementation will create the symlinks using a separate process '
                     + 'with elevated permissions and therefore works even if NMM2 isn\'t run '
                     + 'as administrator.';
    this.mElevatedClient = null;
  }

  public isSupported(state: any): string {
    if (process.platform !== 'win32') {
      return 'Not required on non-windows systems';
    }
    const gameId = activeGameId(state);
    if (this.isGamebryoGame(gameId)) {
      return 'Doesn\'t work wtih the gamebryo engine.';
    }
    return undefined;
  }

  public prepare(dataPath: string): Promise<void> {
    this.mOutstanding = [];
    this.mDone = null;
    const ipcPath: string = 'nmm_elevate_symlink';
    return new Promise<void>((resolve, reject) => {
      ipc.serve(ipcPath, () => {
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
          this.mElevatedClient = null;
        });
        ipc.server.on('log', (data: any) => {
          log(data.level, data.message, data.meta);
        });
        return elevated(ipcPath, remoteCode, { gugu: 42 }, __dirname);
      });
      ipc.server.start();
    });
  }

  public finalize(dataPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDone = resolve;
      if (this.mOutstanding.length === 0) {
        this.finish();
      }
    });
  }

  public activate(installPath: string, dataPath: string, mod: IMod): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mOutstanding.push(mod.installationPath);

      ipc.server.emit(this.mElevatedClient, 'create-link',
        { source: path.join(installPath, mod.installationPath), destination: dataPath });
      resolve();
    });
  }

  public deactivate(dataPath: string, mod: IMod): Promise<void> {
    return Promise.reject(new Error('not implemented'));
  }

  public purge(installPath: string, dataPath: string): Promise<void> {
    log('info', 'deactivate mods', { dataPath });
    return walk(dataPath, (iterPath: string, stat: fs.Stats) => {
      if (stat.isSymbolicLink()) {
        return fs.realpathAsync(iterPath)
          .then((realPath: string) => {
            // TODO: we should check here if the link actually leads to the
            //   our mods directory
            return fs.unlinkAsync(iterPath);
          });
      }
    });
  }

  public externalChanges(installPath: string, dataPath: string): Promise<IFileChange[]> {
    return Promise.resolve([]);
  }

  public forgetFiles(filePaths: string[]): Promise<void> {
    return Promise.resolve();
  }

  public isActive(): boolean {
    return false;
  }

  private finish() {
    ipc.server.emit(this.mElevatedClient, 'quit');
    ipc.server.stop();
    this.mDone();
  }

  private isGamebryoGame(gameId: string): boolean {
    return ['skyrim', 'skyrimse', 'fallout4', 'falloutnv', 'oblivion'].indexOf(gameId) !== -1;
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerModActivator: (activator: IModActivator) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerModActivator(new ModActivator());

  return true;
}

export default init;
