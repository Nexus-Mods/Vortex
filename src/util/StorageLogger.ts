import { LogLevel, log } from './log';

interface IStorage {
  getItem: (key: string, cb: (error: Error, result?: string) => void) => any;
  setItem: (key: string, value: string | number, cb: (error: Error) => void) => void;
  removeItem: (key: string, cb: (error: Error) => void) => void;
  getAllKeys: (cb: (error: Error, keys?: string[]) => void) => void;
}

/**
 * logs all write-operations to the redux-persist storage backend
 * 
 * @class StorageLogger
 * @implements {IStorage}
 */
class StorageLogger implements IStorage {

  private mNested: IStorage;
  private mLogLevel: LogLevel;

  constructor(nestedStorage: IStorage, logLevel: LogLevel = 'info') {
    this.mNested = nestedStorage;
    this.mLogLevel = logLevel;
  }

  public getItem (key: string, cb: (error: Error, result?: string) => void) {
    // don't log read access
    return this.mNested.getItem(key, cb);
  }

  public setItem (key: string, value: string | number, cb: (error: Error) => void) {
    log(this.mLogLevel, 'set item', { key, value });
    this.mNested.setItem(key, value, cb);
  }

  public removeItem (key: string, cb: (error: Error) => void) {
    log(this.mLogLevel, 'remove item', { key });
    this.mNested.removeItem(key, cb);
  }

  public getAllKeys (cb: (error: Error, keys?: string[]) => void) {
    this.mNested.getAllKeys(cb);
  }
}

export default StorageLogger;
