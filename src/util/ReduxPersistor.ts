import {IPersistor, PersistorKey} from '../types/IExtensionContext';
import { terminate } from '../util/errorHandling';
import { log } from '../util/log';

import Bluebird from 'bluebird';
import * as Redux from 'redux';

function insert(target: any, key: string[], value: any, hive: string) {
  try {
    key.reduce((prev, keySegment: string, idx: number, fullKey: string[]) => {
      if (idx === fullKey.length - 1) {
        // previously we allowed this to cause a crash so we'd get the error reports,
        // but since that doesn't give the user any way to fix the issue, we now
        // fix it on the fly. The error was extremely rare anyway and was caused
        // by very early alpha versions storing some data differently from released
        // versions.
        if (typeof prev !== 'object') {
          log('error', 'invalid application state',
              { key: fullKey.slice(0, idx).join('.'), was: prev });
          prev = {};
        }
        prev[keySegment] = value;
        return prev;
      } else {
        // Ideally there wouldn't be any null values in the state but with extensions
        // we can't really ensure that
        if ((prev[keySegment] === undefined)
            || (prev[keySegment] === null)) {
          prev[keySegment] = {};
        }
        return prev[keySegment];
      }
    }, target);
  } catch (err) {
    const newErr = new Error(`Failed to load application state ${hive}.${key.join('.')}`);
    newErr.stack = err.stack;
    throw newErr;
  }
}

class ReduxPersistor<T> {
  private mStore: Redux.Store<T>;
  private mPersistedState: T;
  private mPersistors: { [key: string]: IPersistor } = {};
  private mHydrating: Set<string> = new Set();
  private mUpdateQueue: Bluebird<void> = Bluebird.resolve();

  constructor(store: Redux.Store<T>) {
    this.mStore = store;
    this.mPersistedState = store.getState();
    store.subscribe(this.handleChange);
  }

  public finalizeWrite(): Bluebird<void> {
    return this.mUpdateQueue;
  }

  public insertPersistor(hive: string, persistor: IPersistor): Bluebird<void> {
    return this.resetData(hive, persistor)
        .then(() => {
          this.mPersistors[hive] = persistor;
          persistor.setResetCallback(() => this.resetData(hive, persistor));
        });
  }

  private resetData(hive: string, persistor: IPersistor): Bluebird<void> {
    const kvProm: Bluebird<Array<{ key: PersistorKey, value: string }>> =
      (persistor.getAllKVs !== undefined)
      ? persistor.getAllKVs()
        .map((kv: { key: PersistorKey, value: string }) =>
          ({ key: kv.key, value: this.deserialize(kv.value) }))
      : persistor.getAllKeys()
      .then(keys =>
        Bluebird.map(keys, key => persistor.getItem(key)
          .then(value => ({ key, value: this.deserialize(value) }))
          .catch(err => {
            if (err.name === 'NotFoundError') {
              // Not sure how this happens, it's ultra-rare. Since we're expecting
              // getAllKeys to return only exising keys, one not existing during this get
              // just means it shouldn't have been returned in the first place.
              // The more worrying part is: If getAllKeys may return keys that don't exist,
              // may it be missing keys that do? Why is this happening in the first place?
              log('error', 'key missing from database', { key });
              return Bluebird.resolve(undefined);
            }
            return Bluebird.reject(err);
          })))
      .filter(kvPair => kvPair !== undefined);

    return kvProm
      .then(kvPairs => {
        const res: any = {};
        kvPairs.forEach(pair => {
          insert(res, pair.key, pair.value, hive);
        });
        this.mHydrating.add(hive);
        this.mStore.dispatch({
          type: '__hydrate',
          payload: { [hive]: res },
        });
        return this.storeDiff(persistor, [], res, this.mStore.getState()[hive])
          .then(() => {
            this.mHydrating.delete(hive);
            return Bluebird.resolve();
          });
      });
  }

  private deserialize(input: string): any {
    if ((input === undefined) || (input.length === 0)) {
      return '';
    } else {
      try {
        return JSON.parse(input);
      } catch (err) {
        return undefined;
      }
    }
  }

  private serialize(input: any): string {
    return JSON.stringify(input);
  }

  private handleChange = () => {
    const oldState = this.mPersistedState;
    const newState = this.mStore.getState();
    this.mPersistedState = newState;

    this.mUpdateQueue = this.mUpdateQueue
      .then(() => this.doProcessChange(oldState, newState));
  }

  private doProcessChange(oldState: any, newState: any) {
    if (oldState === newState) {
      return Bluebird.resolve();
    }

    return this.ensureStoreDiffHive(oldState, newState);
  }

  private ensureStoreDiffHive(oldState: any, newState: any) {
    return this.storeDiffHive(oldState, newState)
      .catch(err => {
        // Only way this has ever gone wrong during alpha is when the disk
        // is full, which is nothing we can fix.
        if ((err.message.match(/IO error: .*Append: cannot write/) !== null)
            || (err.stack.match(/IO error: .*Append: cannot write/) !== null)) {
          terminate({
            message: 'There is not enough space on the disk, Vortex needs to quit now to '
                   + 'ensure you\'re not losing further work. Please free up some space, '
                   + 'then restart Vortex.',
          }, undefined, false);
          // If we get here, the user has ignored us. What an idiot.
          // Oh well, try to retry the store,otherwise things will just get worse.
          return this.ensureStoreDiffHive(oldState, newState);
        } else {
          terminate({
            message: `Failed to store application state: ${err.message}`,
            stack: err.stack,
          }, undefined, true);
        }
      });
  }

  private isObject(state: any): boolean {
    return (state !== null) && (typeof(state) === 'object') && !Array.isArray(state);
  }

  private storeDiffHive(oldState: any, newState: any): Bluebird<void> {
    let res = Bluebird.resolve();

    Object.keys(oldState).forEach(key => {
      if ((oldState[key] !== newState[key])
          && (this.mPersistors[key] !== undefined)
          && !this.mHydrating.has(key)) {
        res = res.then(() =>
          this.storeDiff(this.mPersistors[key], [], oldState[key], newState[key]));
      }
    });
    return res.then(() => undefined);
  }

  private storeDiff(persistor: IPersistor, statePath: string[],
                    oldState: any, newState: any): Bluebird<void> {
    if ((persistor === undefined) || (oldState === newState)) {
      return Bluebird.resolve();
    }

    try {
      if (this.isObject(oldState) && this.isObject(newState)) {
        const oldkeys = Object.keys(oldState);
        const newkeys = Object.keys(newState);

        return Bluebird.mapSeries(oldkeys,
          key => (newState[key] === undefined)
              // keys that exist in oldState but not newState
            ? this.remove(persistor, [].concat(statePath, key), oldState[key])
              // keys that exist in both
            : this.storeDiff(persistor, [].concat(statePath, key), oldState[key], newState[key]))
          .then(() => Bluebird.mapSeries(newkeys,
            key => ((oldState[key] === undefined) && (newState[key] !== undefined))
              // keys that exist in newState but not oldState
              ? this.add(persistor, [].concat(statePath, key), newState[key])
              // keys that exist in both - already handled above
              : Bluebird.resolve()))
          .then(() => undefined);
      } else {
        return (newState !== undefined)
          ? this.add(persistor, statePath, newState)
          : this.remove(persistor, statePath, oldState);
      }
    } catch (err) {
      return Bluebird.reject(err);
    }
  }

  private remove(persistor: IPersistor, statePath: string[], state: any): Bluebird<void> {
    return this.isObject(state)
      ? Bluebird.mapSeries(Object.keys(state), key =>
          this.remove(persistor, [].concat(statePath, key), state[key]))
        .then(() => undefined)
      : persistor.removeItem(statePath);
  }

  private add(persistor: IPersistor, statePath: string[], state: any): Bluebird<void> {
    if (state === undefined) {
      return Bluebird.resolve();
    }
    return this.isObject(state)
      ? Bluebird.mapSeries(Object.keys(state), key =>
          this.add(persistor, [].concat(statePath, key), state[key]))
        .then(() => undefined)
      : persistor.setItem(statePath, this.serialize(state));
  }
}

export default ReduxPersistor;
