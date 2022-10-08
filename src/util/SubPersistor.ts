import { IPersistor, PersistorKey } from '../types/IExtensionContext';

import Bluebird from 'bluebird';

class SubPersistor implements IPersistor {
  public getAllKVs: () => Bluebird<Array<{ key: string[], value: string }>> = undefined;

  private mWrapped: IPersistor;
  private mHive: string;

  constructor(wrapped: IPersistor, hive: string) {
    this.mWrapped = wrapped;
    this.mHive = hive;

    if (wrapped.getAllKVs !== undefined) {
      this.getAllKVs = () => this.mWrapped.getAllKVs(hive)
        .filter((kv: { key: PersistorKey, value: string }) => kv.key[0] === hive)
        .map((kv: { key: PersistorKey, value: string }) =>
          ({ key: kv.key.slice(1), value: kv.value }));
    }
  }

  public setResetCallback(cb: () => Bluebird<void>): void {
    this.mWrapped.setResetCallback(cb);
  }

  public getItem(key: string[]): Bluebird<string> {
    return this.mWrapped.getItem([].concat(this.mHive, key));
  }

  public setItem(key: string[], value: string): Bluebird<void> {
    return this.mWrapped.setItem([].concat(this.mHive, key), value);
  }

  public removeItem(key: string[]): Bluebird<void> {
    return this.mWrapped.removeItem([].concat(this.mHive, key));
  }

  public getAllKeys(): Bluebird<string[][]> {
    return this.mWrapped.getAllKeys()
      .then(keys => keys
        .filter(key => key[0] === this.mHive)
        .map(key => key.slice(1)));
  }
}

export default SubPersistor;
