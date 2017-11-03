import {IPersistor} from '../types/IExtensionContext';
import delayed from './delayed';
import { log } from './log';

import * as Promise from 'bluebird';
import levelup = require('levelup');
import { intersection, without } from 'lodash';
import * as path from 'path';

const SEPARATOR: string = '###';

function openDB(dbPath: string): Promise<levelup.LevelUp> {
  return new Promise<levelup.LevelUp>((resolve, reject) => {
    (levelup as any)(dbPath, undefined, (err, db) => {
      if (err !== null) {
        return reject(err);
      }
      return resolve(db);
    });
  });
}

class LevelPersist implements IPersistor {
  public static create(persistPath: string): Promise<LevelPersist> {
    return openDB(persistPath)
      .then(db => new LevelPersist(db))
      .catch(err => {
        log('info', 'failed to open db', err);
        return delayed(100).then(() => LevelPersist.create(persistPath));
      });
  }

  private mDB: levelup.LevelUp;

  constructor(db: levelup.LevelUp) {
    this.mDB = db;
  }

  public changeDatabase(dbPath: string): Promise<void> {
    return openDB(dbPath)
      .then(db => {
        this.mDB.close();
        this.mDB = db;
      })
      .catch(err => {
        log('info', 'failed to open db', err);
        return delayed(100).then(() => this.changeDatabase(dbPath));
      });
  }

  public setResetCallback(cb: () => void): void {
    return undefined;
  }

  public getItem(key: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      this.mDB.get(key.join(SEPARATOR), (error, value) => {
        if (error) {
          return reject(error);
        }
        return resolve(value);
      });
    });
  }

  public getAllKeys(): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const keys: string[][] = [];
      this.mDB.createKeyStream()
          .on('data', data => keys.push(data.split(SEPARATOR)))
          .on('error', error => reject(error))
          .on('close', () => resolve(keys));
    });
  }

  public setItem(statePath: string[], newState: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDB.put(statePath.join(SEPARATOR), newState, error => {
        if (error) {
          return reject(error);
        }
        return resolve();
      });
    });
  }

  public removeItem(statePath: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDB.del(statePath.join(SEPARATOR), error => {
        if (error) {
          return reject(error);
        }
        return resolve();
      });
    });
  }
}

export default LevelPersist;
