import { IStorage } from '../types/IStorage';
import delayed from './delayed';
import { log } from './log';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import levelup = require('levelup');
import * as path from 'path';
import { objDiff } from './util';

const app = appIn || remote.app;

class LevelStorage implements IStorage {
  public static create(basePath: string, name: string): Promise<LevelStorage> {
    return new Promise<LevelStorage>((resolve, reject) => {
      const db =
          (levelup as any)(path.join(basePath, name), undefined, (err) => {
            if (err !== null) {
              log('info', 'failed to open db', err);
              resolve(
                  delayed(100).then(() => LevelStorage.create(basePath, name)));
            } else {
              resolve(new LevelStorage(db));
            }
          });
    });
  }

  private mPrev: { [key: string]: any } = {};
  private mDB: levelup.LevelUp;

  constructor(db: levelup.LevelUp) {
    this.mDB = db;
  }

  public close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDB.close(err => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  public getItem(key: string, callback?: (error?: Error, result?: string) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      this.mDB.get(key, (error, value) => {
        if (callback) {
          callback(error, value);
        }
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      });
    });
  }

  public setItem(key: string, value: string, callback?: (error?: Error) => void): Promise<void> {
    const diff = objDiff(this.mPrev[key] || {}, JSON.parse(value));
    this.mPrev[key] = JSON.parse(value);
    return new Promise<void>((resolve, reject) => {
      this.mDB.put(key, value, (error) => {
        if (callback) {
          callback(error);
        }
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public removeItem(key: string, callback?: (error?: Error) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDB.del(key, (error) => {
        if (callback) {
          callback(error);
        }
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public getAllKeys(callback?: (error: Error, keys: string[]) => void): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const keys: string[] = [];
      let error: Error = null;
      this.mDB.createKeyStream()
      .on('data', key => keys.push(key))
      .on('error', err => error = err)
      .on('end', () => {
        if (callback) {
          callback(error, keys);
        }
        if (error) {
          reject(error);
        } else {
          resolve(keys);
        }
      });
    });
  }
}

export default LevelStorage;
