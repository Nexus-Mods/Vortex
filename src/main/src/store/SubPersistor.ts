import type { IPersistor, PersistorKey } from "@vortex/shared/state";

class SubPersistor implements IPersistor {
  public getAllKVs:
    | (() => PromiseLike<Array<{ key: string[]; value: string }>>)
    | undefined = undefined;

  private mWrapped: IPersistor;
  private mHive: string;

  constructor(wrapped: IPersistor, hive: string) {
    this.mWrapped = wrapped;
    this.mHive = hive;

    if (this.mWrapped.getAllKVs) {
      this.getAllKVs = () =>
        this.mWrapped.getAllKVs?.(hive).then((kvs) =>
          kvs
            .filter(
              (kv: { key: PersistorKey; value: string }) => kv.key[0] === hive,
            )
            .map((kv: { key: PersistorKey; value: string }) => ({
              key: kv.key.slice(1),
              value: kv.value,
            })),
        ) ?? Promise.resolve([]);
    }
  }

  public setResetCallback(cb: () => PromiseLike<void>): void {
    this.mWrapped.setResetCallback(cb);
  }

  public getItem(key: string[]): PromiseLike<string> {
    return this.mWrapped.getItem([this.mHive, ...key]);
  }

  public setItem(key: string[], value: string): PromiseLike<void> {
    return this.mWrapped.setItem([this.mHive, ...key], value);
  }

  public removeItem(key: string[]): PromiseLike<void> {
    return this.mWrapped.removeItem([this.mHive, ...key]);
  }

  public getAllKeys(): PromiseLike<string[][]> {
    return this.mWrapped
      .getAllKeys()
      .then((keys) =>
        keys.filter((key) => key[0] === this.mHive).map((key) => key.slice(1)),
      );
  }
}

export default SubPersistor;
