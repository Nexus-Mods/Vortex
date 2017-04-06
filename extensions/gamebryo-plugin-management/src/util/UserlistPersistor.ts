import { ILOOTList } from '../types/ILOOTList';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import { safeDump, safeLoad } from 'js-yaml';
import { log, types, util } from 'nmm-api';
import * as path from 'path';

const app = appIn || remote.app;

/**
 * persistor syncing to and from the loot userlist.yaml file
 * 
 * @class UserlistPersistor
 * @implements {types.IPersistor}
 */
class UserlistPersistor implements types.IPersistor {
  private mResetCallback: () => void;
  private mUserlistPath: string;
  private mUserlist: ILOOTList;
  private mSerializing: boolean = false;
  private mSerializeQueue: Promise<void> = Promise.resolve();

  private mLoaded: boolean = false;

  constructor() {
    this.mUserlist = {
      globals: [],
      plugins: [],
    };
  }

  public loadFiles(gameMode: string) {
    this.mUserlistPath = path.join(app.getPath('userData'), gameMode, 'userlist.yaml');
    // read the files now and update the store
    this.deserialize();
  }

  public setResetCallback(cb: () => void) {
    this.mResetCallback = cb;
  }

  public getItem(key: string, cb: (error: Error, result?: string) => void): void {
    cb(null, JSON.stringify(this.mUserlist || { globals: [], plugins: [] }));
  }

  public setItem(key: string, value: string, cb: (error: Error) => void): void {
    this.mUserlist = JSON.parse(value);
    this.serialize().then(() => cb(null));
  }

  public removeItem(key: string, cb: (error: Error) => void): void {
    delete this.mUserlist[key];
    this.serialize().then(() => cb(null));
  }

  public getAllKeys(cb: (error: Error, keys?: string[]) => void): void {
    cb(null, ['userlist']);
  }

  private serialize(): Promise<void> {
    if (!this.mLoaded) {
      // this happens during initialization, when the persistor is initially created, with default
      // values.
      return Promise.resolve();
    }
    // ensure we don't try to concurrently write the files
    this.mSerializeQueue = this.mSerializeQueue.then(() => {
      this.doSerialize();
    });
    return this.mSerializeQueue;
  }

  private doSerialize(): Promise<void> {
    if (this.mUserlist === undefined) {
      return;
    }

    this.mSerializing = true;
    return fs.writeFileAsync(this.mUserlistPath + '.tmp', safeDump(this.mUserlist))
      .then(() => fs.renameAsync(this.mUserlistPath + '.tmp', this.mUserlistPath))
      .catch((err) => {
        // TODO: report to the user? The problem is that this might occur repeatedly so we
        //   need to be careful to not spam the user
        log('error', 'failed to write userlist', { err });
      })
      .finally(() => {
        this.mSerializing = false;
      });
  }

  private deserialize(): Promise<void> {
    if (this.mUserlist === undefined) {
      return;
    }

    fs.readFileAsync(this.mUserlistPath)
    .then((data: NodeBuffer) => {
      this.mUserlist = safeLoad(data.toString());
      if (this.mResetCallback) {
        this.mResetCallback();
        this.mLoaded = true;
      }
    })
    .catch((err) => {
      if (err.code === 'ENOENT') {
        this.mUserlist = {
          globals: [],
          plugins: [],
        };
        this.mLoaded = true;
      } else {
        // if we can't read the file but the file is there,
        // we would be destroying its content if we don't quit right now.
        util.terminate({
          message: 'Failed to read userlist file for this game',
          details: err,
        });
      }
    });
  }
}

export default UserlistPersistor;
