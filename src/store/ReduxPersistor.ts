import type { IPersistor, PersistorKey } from "../types/IExtensionContext";
import { unknownToError } from "../shared/errors";
import { terminate } from "../util/errorHandling";
import { log } from "../util/log";

import PromiseBB from "bluebird";
import type * as Redux from "redux";

function isObject(state: unknown): state is object {
  return state !== null && typeof state === "object" && !Array.isArray(state);
}

function insertValueAtLeaf<T extends Record<string, unknown>, V>(
  target: T,
  key: string[],
  value: V,
  hive: string,
) {
  try {
    key.reduce<Record<string, unknown>>((prev, keySegment, idx, fullKey) => {
      if (idx === fullKey.length - 1) {
        // previously we allowed this to cause a crash so we'd get the error reports,
        // but since that doesn't give the user any way to fix the issue, we now
        // fix it on the fly. The error was extremely rare anyway and was caused
        // by very early alpha versions storing some data differently from released
        // versions.
        if (typeof prev !== "object") {
          log("error", "invalid application state", {
            key: fullKey.slice(0, idx).join("."),
            was: prev,
          });
          return { [keySegment]: value };
        }
        prev[keySegment] = value;
        return prev;
      } else {
        // Ideally there wouldn't be any null values in the state but with extensions
        // we can't really ensure that
        if (!prev[keySegment]) {
          prev[keySegment] = {};
        }
        return prev[keySegment] as Record<string, unknown>;
      }
    }, target);
  } catch (err) {
    const newErr = new Error(
      `Failed to load application state ${hive}.${key.join(".")}`,
    );
    if (err instanceof Error) {
      newErr.stack = err.stack;
    }

    throw newErr;
  }
}

class ReduxPersistor<T extends Record<string, unknown>> {
  private mStore: Redux.Store<T>;
  private mPersistedState: T;
  private mPersistors: { [key: string]: IPersistor } = {};
  private mHydrating: Set<string> = new Set();
  private mUpdateQueue: PromiseBB<void> = PromiseBB.resolve();

  constructor(store: Redux.Store<T>) {
    this.mStore = store;
    this.mPersistedState = store.getState();
    store.subscribe(this.handleChange);
  }

  public finalizeWrite(): PromiseBB<void> {
    return this.mUpdateQueue;
  }

  public insertPersistor(hive: string, persistor: IPersistor): PromiseBB<void> {
    return this.resetData(hive, persistor).then(() => {
      this.mPersistors[hive] = persistor;
      persistor.setResetCallback(() => this.resetData(hive, persistor));
    });
  }

  private resetData(hive: string, persistor: IPersistor): PromiseBB<void> {
    const kvProm: PromiseBB<Array<{ key: PersistorKey; value: unknown }>> =
      persistor.getAllKVs !== undefined
        ? persistor
            .getAllKVs()
            .map((kv: { key: PersistorKey; value: string }) => ({
              key: kv.key,
              value: this.deserialize(kv.value),
            }))
        : persistor
            .getAllKeys()
            .then((keys) =>
              PromiseBB.map(keys, (key) =>
                persistor
                  .getItem(key)
                  .then((value) => ({ key, value: this.deserialize(value) }))
                  .catch((unknownError) => {
                    const err = unknownToError(unknownError);
                    if (err.name === "NotFoundError") {
                      // Not sure how this happens, it's ultra-rare. Since we're expecting
                      // getAllKeys to return only exising keys, one not existing during this get
                      // just means it shouldn't have been returned in the first place.
                      // The more worrying part is: If getAllKeys may return keys that don't exist,
                      // may it be missing keys that do? Why is this happening in the first place?
                      log("error", "key missing from database", { key });
                      return PromiseBB.resolve(undefined);
                    }
                    return PromiseBB.reject(err);
                  }),
              ),
            )
            .filter((kvPair) => kvPair !== undefined);

    return kvProm.then((kvPairs) => {
      const res = {};
      kvPairs.forEach((pair) => {
        insertValueAtLeaf(res, pair.key, pair.value, hive);
      });
      this.mHydrating.add(hive);
      this.mStore.dispatch({
        type: "__hydrate",
        payload: { [hive]: res },
      });
      return this.storeDiff(
        persistor,
        [],
        res,
        this.mStore.getState()[hive],
      ).then(() => {
        this.mHydrating.delete(hive);
        return PromiseBB.resolve();
      });
    });
  }

  private deserialize(input: string): unknown {
    if (input === undefined || input.length === 0) {
      return "";
    } else {
      try {
        return JSON.parse(input);
      } catch {
        return undefined;
      }
    }
  }

  private serialize<T>(input: T): string {
    return JSON.stringify(input);
  }

  private handleChange = () => {
    const oldState = this.mPersistedState;
    const newState = this.mStore.getState();
    this.mPersistedState = newState;

    this.mUpdateQueue = this.mUpdateQueue.then(() =>
      this.doProcessChange(oldState, newState),
    );
  };

  private doProcessChange(oldState: T, newState: T): PromiseBB<void> {
    if (oldState === newState) {
      return PromiseBB.resolve();
    }

    return this.ensureStoreDiffHive(oldState, newState);
  }

  private ensureStoreDiffHive(oldState: T, newState: T): PromiseBB<void> {
    return this.storeDiffHive(oldState, newState).catch((unknownError) => {
      const err = unknownToError(unknownError);
      // Only way this has ever gone wrong during alpha is when the disk
      // is full, which is nothing we can fix.
      if (
        err.message.match(/IO error: .*Append: cannot write/) !== null ||
        err.stack?.match(/IO error: .*Append: cannot write/) !== null
      ) {
        terminate(
          {
            message:
              "There is not enough space on the disk, Vortex needs to quit now to " +
              "ensure you're not losing further work. Please free up some space, " +
              "then restart Vortex.",
          },
          undefined,
          false,
        );
        // If we get here, the user has ignored us. What an idiot.
        // Oh well, try to retry the store,otherwise things will just get worse.
        return this.ensureStoreDiffHive(oldState, newState);
      } else {
        terminate(
          {
            message: `Failed to store application state: ${err.message}`,
            stack: err.stack,
          },
          undefined,
          true,
        );
      }
    });
  }

  private storeDiffHive(oldState: T, newState: T): PromiseBB<void> {
    let res = PromiseBB.resolve();

    Object.keys(oldState).forEach((key) => {
      if (
        oldState[key] !== newState[key] &&
        this.mPersistors[key] !== undefined &&
        !this.mHydrating.has(key)
      ) {
        res = res.then(() =>
          this.storeDiff(
            this.mPersistors[key],
            [],
            oldState[key],
            newState[key],
          ),
        );
      }
    });
    return res.then(() => undefined);
  }

  private storeDiff<T = unknown>(
    persistor: IPersistor,
    statePath: string[],
    oldState: T,
    newState: T,
  ): PromiseBB<void> {
    if (persistor === undefined || oldState === newState) {
      return PromiseBB.resolve();
    }

    try {
      if (isObject(oldState) && isObject(newState)) {
        const oldkeys = Object.keys(oldState);
        const newkeys = Object.keys(newState);

        return PromiseBB.mapSeries(oldkeys, (key) =>
          newState[key] === undefined
            ? // keys that exist in oldState but not newState
              this.remove(persistor, [...statePath, key], oldState[key])
            : // keys that exist in both
              this.storeDiff(
                persistor,
                [...statePath, key],
                oldState[key],
                newState[key],
              ),
        )
          .then(() =>
            PromiseBB.mapSeries(newkeys, (key) =>
              oldState[key] === undefined && newState[key] !== undefined
                ? // keys that exist in newState but not oldState
                  this.add(persistor, [...statePath, key], newState[key])
                : // keys that exist in both - already handled above
                  PromiseBB.resolve(),
            ),
          )
          .then(() => undefined);
      } else {
        return newState !== undefined
          ? this.add(persistor, statePath, newState)
          : this.remove(persistor, statePath, oldState);
      }
    } catch (err) {
      return PromiseBB.reject(err);
    }
  }

  private remove<T>(
    persistor: IPersistor,
    statePath: string[],
    state: T,
  ): PromiseBB<void> {
    return isObject(state)
      ? PromiseBB.mapSeries(Object.keys(state), (key) =>
          this.remove(persistor, [...statePath, key], state[key]),
        ).then(() => undefined)
      : persistor.removeItem(statePath);
  }

  private add<T>(
    persistor: IPersistor,
    statePath: string[],
    state: T,
  ): PromiseBB<void> {
    if (state === undefined) {
      return PromiseBB.resolve();
    }
    return isObject(state)
      ? PromiseBB.mapSeries(Object.keys(state), (key) =>
          this.add(persistor, [...statePath, key], state[key]),
        ).then(() => undefined)
      : persistor.setItem(statePath, this.serialize(state));
  }
}

export default ReduxPersistor;
