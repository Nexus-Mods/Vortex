import { IPersistor, PersistorKey } from '../types/IExtensionContext';

// TODO: Remove Bluebird import - using native Promise;
import { promiseFilter, promiseMap } from './promise-helpers';

class SubPersistor implements IPersistor {
  public getAllKVs: () => Promise<Array<{ key: string[], value: string }>> = undefined;

  private mWrapped: IPersistor;
  private mHive: string;

  constructor(wrapped: IPersistor, hive: string) {
    this.mWrapped = wrapped;
    this.mHive = hive;

    if (wrapped.getAllKVs !== undefined) {
      this.getAllKVs = () => this.mWrapped.getAllKVs(hive)
        .then(kvs => promiseFilter(kvs, (kv: { key: PersistorKey, value: string }) => Promise.resolve(kv.key[0] === hive)))
        .then(filtered => promiseMap(filtered, (kv: { key: PersistorKey, value: string }) =>
          Promise.resolve({ key: kv.key.slice(1), value: kv.value })));
    }
  }

  public setResetCallback(cb: () => Promise<void>): void {
    this.mWrapped.setResetCallback(cb);
  }

  public getItem(key: string[]): Promise<string> {
    return this.mWrapped.getItem([].concat(this.mHive, key));
  }

  public setItem(key: string[], value: string): Promise<void> {
    return this.mWrapped.setItem([].concat(this.mHive, key), value);
  }

  public removeItem(key: string[]): Promise<void> {
    return this.mWrapped.removeItem([].concat(this.mHive, key));
  }

  public getAllKeys(): Promise<string[][]> {
    return this.mWrapped.getAllKeys()
      .then(keys => keys
        .filter(key => key[0] === this.mHive)
        .map(key => key.slice(1)));
  }
}

export default SubPersistor;
