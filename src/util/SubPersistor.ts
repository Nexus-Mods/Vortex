import { IPersistor } from '../types/IExtensionContext';

import * as Promise from 'bluebird';

class SubPersistor implements IPersistor {
  private mWrapped: IPersistor;
  private mHive: string;

  constructor(wrapped: IPersistor, hive: string) {
    this.mWrapped = wrapped;
    this.mHive = hive;
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
