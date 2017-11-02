import {IPersistor} from '../types/IExtensionContext';
import delayed from './delayed';
import { log } from './log';

import * as Promise from 'bluebird';
import levelup = require('levelup');
import { intersection, without } from 'lodash';
import * as path from 'path';

interface IPersistSettings {
}

const SEPARATOR: string = '###';

class LevelPersist implements IPersistor {
  public static create(persistPath: string): Promise<LevelPersist> {
    return new Promise<LevelPersist>((resolve, reject) => {
      const db = (levelup as any)(persistPath, undefined, (err) => {
        if (err !== null) {
          log('info', 'failed to open db', err);
          resolve(
              delayed(100).then(() => LevelPersist.create(persistPath)));
        } else {
          resolve(new LevelPersist(db));
        }
      });
    });
  }

  private mDB: levelup.LevelUp;

  constructor(db: levelup.LevelUp) {
    this.mDB = db;
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
