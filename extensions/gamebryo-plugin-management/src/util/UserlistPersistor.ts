import { ILOOTList } from '../types/ILOOTList';

import {gameSupported, lootAppPath} from './gameSupport';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import { safeDump, safeLoad } from 'js-yaml';
import * as path from 'path';
import { fs, log, types, util } from 'vortex-api';

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
  private mFailed: boolean = false;
  private mOnError: (message: string, details: Error) =>  void;
  private mMode: 'userlist' | 'masterlist';

  constructor(mode: 'userlist' | 'masterlist',
              onError: (message: string, details: Error) => void) {
    this.mUserlist = {
      globals: [],
      plugins: [],
    };
    this.mOnError = onError;
    this.mMode = mode;
  }

  public disable(): Promise<void> {
    return this.enqueue(() => new Promise<void>(resolve => {
      this.mUserlist = {
        globals: [],
        plugins: [],
      };
      this.mUserlistPath = undefined;
      this.mLoaded = false;
      if (this.mResetCallback) {
        this.mResetCallback();
      }
      resolve();
    }));
  }

  public loadFiles(gameMode: string): Promise<void> {
    if (!gameSupported(gameMode)) {
      return Promise.resolve();
    }
    this.mUserlistPath = (this.mMode === 'userlist')
      ? path.join(app.getPath('userData'), gameMode, 'userlist.yaml')
      : path.resolve(lootAppPath(gameMode), 'masterlist.yaml');

    // read the files now and update the store
    return this.deserialize();
  }

  public setResetCallback(cb: () => void) {
    this.mResetCallback = cb;
  }

  public getItem(key: string[]): Promise<string> {
    return Promise.resolve(JSON.stringify(this.mUserlist[key[0]]));
  }

  public setItem(key: string[], value: string): Promise<void> {
    this.mUserlist[key[0]] = JSON.parse(value);
    return this.serialize();
  }

  public removeItem(key: string[]): Promise<void> {
    this.mUserlist[key[0]] = [];
    return this.serialize();
  }

  public getAllKeys(): Promise<string[][]> {
    return Promise.resolve(Object.keys(this.mUserlist).map(key => [key]));
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.mSerializeQueue = this.mSerializeQueue.then(fn);
    return this.mSerializeQueue;
  }

  private reportError(message: string, detail: Error) {
    if (!this.mFailed) {
      this.mOnError(message, detail);
      this.mFailed = true;
    }
  }

  private serialize(): Promise<void> {
    if (!this.mLoaded) {
      // this happens during initialization, when the persistor is initially created, with default
      // values.
      return Promise.resolve();
    }
    // ensure we don't try to concurrently write the files
    this.mSerializeQueue = this.mSerializeQueue.then(() => this.doSerialize());
    return this.mSerializeQueue;
  }

  private doSerialize(): Promise<void> {
    if ((this.mUserlist === undefined)
        || (this.mUserlistPath === undefined)
        || (this.mMode === 'masterlist')) {
      return;
    }

    const id = require('shortid').generate();
    const userlistPath = this.mUserlistPath;

    this.mSerializing = true;
    return fs.writeFileAsync(userlistPath + '.tmp', safeDump(this.mUserlist))
      .then(() => fs.renameAsync(userlistPath + '.tmp', userlistPath))
      .then(() => { this.mFailed = false; })
      .catch(err => {
        this.reportError('failed to write userlist', err);
      })
      .finally(() => {
        this.mSerializing = false;
      });
  }

  private deserialize(): Promise<void> {
    if (this.mUserlist === undefined) {
      return Promise.resolve();
    }

    return fs.readFileAsync(this.mUserlistPath)
    .then((data: NodeBuffer) => {
      this.mUserlist = safeLoad(data.toString(), { json: true } as any);
      if (this.mResetCallback) {
        this.mResetCallback();
        this.mLoaded = true;
      }
    })
    .catch(err => {
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
