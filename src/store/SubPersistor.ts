import type { IPersistor, PersistorKey } from "../types/IExtensionContext";

import type PromiseBB from "bluebird";

class SubPersistor implements IPersistor {
  public getAllKVs: () => PromiseBB<Array<{ key: string[]; value: string }>> =
    undefined;

  private mWrapped: IPersistor;
  private mHive: string;

  constructor(wrapped: IPersistor, hive: string) {
    this.mWrapped = wrapped;
    this.mHive = hive;

    if (wrapped.getAllKVs !== undefined) {
      this.getAllKVs = () =>
        this.mWrapped
          .getAllKVs(hive)
          .filter(
            (kv: { key: PersistorKey; value: string }) => kv.key[0] === hive,
          )
          .map((kv: { key: PersistorKey; value: string }) => ({
            key: kv.key.slice(1),
            value: kv.value,
          }));
    }
  }

  public setResetCallback(cb: () => PromiseBB<void>): void {
    this.mWrapped.setResetCallback(cb);
  }

  public getItem(key: string[]): PromiseBB<string> {
    return this.mWrapped.getItem([].concat(this.mHive, key));
  }

  public setItem(key: string[], value: string): PromiseBB<void> {
    return this.mWrapped.setItem([].concat(this.mHive, key), value);
  }

  public removeItem(key: string[]): PromiseBB<void> {
    return this.mWrapped.removeItem([].concat(this.mHive, key));
  }

  public getAllKeys(): PromiseBB<string[][]> {
    return this.mWrapped
      .getAllKeys()
      .then((keys) =>
        keys.filter((key) => key[0] === this.mHive).map((key) => key.slice(1)),
      );
  }
}

export default SubPersistor;
