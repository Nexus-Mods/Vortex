import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { IMod } from '../mod_management/types/IMod';
import { IModActivator } from '../mod_management/types/IModActivator';

import elevated from  '../../util/elevated';
import walk from './walk';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import ipc = require('node-ipc');

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

  public isSupported(state: any): boolean {
    const activeGameId = state.settings.gameMode.current;
    return process.platform === 'win32' && !this.isGamebryoGame(activeGameId);
  }

  public prepare(modsPath: string): Promise<void> {
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

  public finalize(modsPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDone = resolve;
      if (this.mOutstanding.length === 0) {
        this.finish();
      }
    });
  }

  public activate(modsPath: string, mod: IMod): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mOutstanding.push(mod.installationPath);

      ipc.server.emit(this.mElevatedClient, 'create-link',
        { source: mod.installationPath, destination: modsPath });
      resolve();
    });
  }

  public deactivate(modsPath: string): Promise<void> {
    log('info', 'deactivate mods', { modsPath });
    return walk(modsPath, (iterPath: string, stat: fs.Stats) => {
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

  public isActive(): boolean {
    return false;
  }

  private finish() {
    ipc.server.emit(this.mElevatedClient, 'quit');
    ipc.server.stop();
    this.mDone();
  }

  private isGamebryoGame(gameId: string): boolean {
    return ['skyrim', 'skyrimse'].indexOf(gameId) !== -1;
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
