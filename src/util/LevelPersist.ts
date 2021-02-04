import {IPersistor} from '../types/IExtensionContext';
import { DataInvalid } from './CustomErrors';
import { log } from './log';

import Promise from 'bluebird';
import encode from 'encoding-down';
import leveldownT from 'leveldown';
import * as levelup from 'levelup';

const SEPARATOR: string = '###';

const READ_TIMEOUT: number = 10000;

export class DatabaseLocked extends Error {
  constructor() {
    super('Database is locked');
    this.name = this.constructor.name;
  }
}

function repairDB(dbPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    log('warn', 'repairing database', dbPath);
    const leveldown: typeof leveldownT = require('leveldown');
    leveldown.repair(dbPath, (err: Error) => {
      if (err !== null) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function openDB(dbPath: string): Promise<levelup.LevelUp> {
  return new Promise<levelup.LevelUp>((resolve, reject) => {
    const leveldown: typeof leveldownT = require('leveldown');
    const db = levelup.default(encode(leveldown(dbPath)),
                     { keyEncoding: 'utf8', valueEncoding: 'utf8' }, (err) => {
      if (err !== null) {
        return reject(err);
      }
      return resolve(db);
    });
  });
}

class LevelPersist implements IPersistor {
  public static create(persistPath: string,
                       tries: number = 10,
                       repair: boolean = false): Promise<LevelPersist> {
    return (repair ? repairDB(persistPath) : Promise.resolve())
      .then(() => openDB(persistPath))
      .then(db => new LevelPersist(db))
      .catch(err => {
        if (err instanceof DataInvalid) {
          return Promise.reject(err);
        }
        if (tries === 0) {
          log('info', 'failed to open db', err);
          return Promise.reject(new DatabaseLocked());
        } else {
          return Promise.delay(500)
            .then(() => LevelPersist.create(persistPath, tries - 1, false));
        }
      });
  }

  private mDB: levelup.LevelUp;

  constructor(db: levelup.LevelUp) {
    this.mDB = db;
  }

  public close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDB.close((err) =>
        !!err ? reject(err) : resolve());
    });
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

  public getAllKeys(options?: any): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const keys: string[][] = [];
      let resolved = false;
      this.mDB.createKeyStream(options)
          .on('data', data => {
            keys.push(data.split(SEPARATOR));
          })
          .on('error', error => {
            if (!resolved) {
              reject(error);
              resolved = true;
            }
          })
          .on('close', () => {
            if (!resolved) {
              resolve(keys);
              resolved = true;
            }
          });
    });
  }

  public getAllKVs(prefix?: string): Promise<Array<{ key: string[], value: string }>> {
    return new Promise((resolve, reject) => {
        const kvs: Array<{ key: string[], value: string }> = [];

        const options = (prefix === undefined)
          ? undefined
          : {
            gt: `${prefix}${SEPARATOR}`,
            lt: `${prefix}${SEPARATOR}zzzzzzzzzzz`,
          };

        this.mDB.createReadStream(options)
          .on('data', data => {
            kvs.push({ key: data.key.split(SEPARATOR), value: data.value });
          })
          .on('error', error => {
            reject(error);
          })
          .on('close', () => {
            resolve(kvs);
          });
      });
  }

  public setItem(statePath: string[], newState: string): Promise<void> {
    const stackErr = new Error();
    return new Promise<void>((resolve, reject) => {
      this.mDB.put(statePath.join(SEPARATOR), newState, error => {
        if (error) {
          error.stack = stackErr.stack;
          log('error', 'Failed to write to leveldb', {
            message: error.message,
            stack: error.message + '\n' + stackErr.stack,
            insp: require('util').inspect(error),
          });
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
