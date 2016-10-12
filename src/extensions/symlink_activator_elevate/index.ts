import { IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';

import { IMod } from '../mod_management/types/IMod';
import { IModActivator } from '../mod_management/types/IModActivator';

import elevated from './elevated';
import walk from './walk';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import ipc = require('node-ipc');

import * as util from 'util';

class ModActivator implements IModActivator {
  public id: string;
  public name: string;
  public description: string;

  private mElevatedClient: any;
  private mOutstanding: string[];
  private mDone: () => void;

  constructor() {
    this.id = 'link_activator_elevated';
    this.name = 'Symlink activator (Elevated)';
    this.description = 'Installs the mods by setting symlinks in the destination directory. '
                     + 'This implementation will create the symlinks using a separate process '
                     + 'with elevated permissions and therefore works even if NMM2 isn\'t run '
                     + 'as administrator.';
    this.mElevatedClient = null;
  }

  public isSupported(): boolean {
    return process.platform === 'win32';
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
        return elevated(ipcPath, this.remoteCode);
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

  private remoteCode = (ipcClient) => {
    let walk = require('./walk').default;
    let fs = require('fs-extra-promise');
    let path = require('path');

    ipcClient.on('create-link', (payload) => {
      let { source, destination } = payload;
      try {
        walk(source, (iterPath: string, stat: fs.Stats) => {
          let relPath: string = path.relative(source, iterPath);
          let destFile: string = path.join(destination, relPath);
          if (stat.isDirectory()) {
            return fs.mkdirAsync(iterPath);
          } else {
            return fs.symlinkAsync(iterPath, destFile).then(() => {
              ipcClient.emit('log', {
                level: 'info',
                message: 'installed',
                meta: { source: iterPath, destination: destFile },
              });
            }).catch((err) => {
              ipcClient.emit('log', {
                level: 'error',
                message: 'failed to install symlink',
                meta: { err: err.message },
              });
            });
          }
        })
        .finally(() => {
          ipcClient.emit('finished', { source });
        });
      } catch (err) {
        ipcClient.emit('log', {
          level: 'info',
          message: 'failed to create link',
          meta: { err: err.message },
        });
      }
    });
    ipcClient.on('disconnect', () => {
      process.exit(0);
    });
    ipcClient.emit('initialised');
  }
}

interface IExtensionContextEx extends IExtensionContext {
  registerModActivator: (activator: IModActivator) => void;
}

function init(context: IExtensionContextEx): boolean {
  if (context.hasOwnProperty('registerModActivator')) {
    context.registerModActivator(new ModActivator());
  }

  return true;
}

export default init;
