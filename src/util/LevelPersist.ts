import {IPersistor} from '../types/IExtensionContext';
import delayed from './delayed';
import { log } from './log';

import * as Promise from 'bluebird';
import * as encode from 'encoding-down';
import * as leveldown from 'leveldown';
import * as levelup from 'levelup';

const SEPARATOR: string = '###';

export class DatabaseLocked extends Error {
  constructor() {
    super('Database is locked');
    this.name = this.constructor.name;
  }
}

function openDB(dbPath: string): Promise<levelup.LevelUp> {
  return new Promise<levelup.LevelUp>((resolve, reject) => {
    (levelup as any)(encode(leveldown(dbPath)),
                     { keyEncoding: 'utf8', valueEncoding: 'utf8' }, (err, db) => {
      if (err !== null) {
        return reject(err);
      }
      return resolve(db);
    });
  });
}

class LevelPersist implements IPersistor {
  public static create(persistPath: string, tries: number = 10): Promise<LevelPersist> {
    return openDB(persistPath)
      .then(db => new LevelPersist(db))
      .catch(err => {
        if (tries === 0) {
          log('info', 'failed to open db', err);
          return Promise.reject(new DatabaseLocked());
        } else {
          return delayed(500).then(() => LevelPersist.create(persistPath, tries - 1));
        }
      });
  }

  private mDB: levelup.LevelUp;

  constructor(db: levelup.LevelUp) {
    this.mDB = db;
  }

  public setResetCallback(cb: () => Promise<void>): void {
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
          .on('data', data => {
            keys.push(data.split(SEPARATOR));
          })
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
