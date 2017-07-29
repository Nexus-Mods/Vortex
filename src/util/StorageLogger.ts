import { IStorage } from '../types/IStorage';

import { log, LogLevel } from './log';

import * as _ from 'lodash';

/**
 * logs all write-operations to the redux-persist storage backend
 *
 * @class StorageLogger
 * @implements {IStorage}
 */
class StorageLogger implements IStorage {

  private mNested: IStorage;
  private mLogLevel: LogLevel;
  private mCache: any = {};

  constructor(nestedStorage: IStorage, logLevel: LogLevel = 'info') {
    this.mNested = nestedStorage;
    this.mLogLevel = logLevel;
  }

  public getItem(key: string, cb: (error: Error, result?: string) => void) {
    // don't log read access
    return this.mNested.getItem(key, cb);
  }

  public setItem(key: string, value: string | number, cb: (error: Error) => void) {
    if (!_.isEqual(this.mCache[key], value)) {
      if (typeof(value) === 'string') {
        log(this.mLogLevel, 'set item', {key, value});
      } else {
        log(this.mLogLevel, 'set item', {key, value});
      }
      this.mCache[key] = value;
    } else {
      log(this.mLogLevel, 'set item (unchanged)', {key});
    }
    this.mNested.setItem(key, value, cb);
  }

  public removeItem(key: string, cb: (error: Error) => void) {
    log(this.mLogLevel, 'remove item', { key });
    this.mNested.removeItem(key, cb);
  }

  public getAllKeys(cb: (error: Error, keys?: string[]) => void) {
    this.mNested.getAllKeys(cb);
  }
}

export default StorageLogger;
