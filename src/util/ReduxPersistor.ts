import {IPersistor} from '../types/IExtensionContext';
import { terminate } from '../util/errorHandling';

import * as Promise from 'bluebird';
import * as Redux from 'redux';

function insert(target: any, key: string[], value: any, hive: string) {
  try {
    key.reduce((prev, keySegment: string, idx: number, fullKey: string[]) => {
      if (idx === fullKey.length - 1) {
        // this could cause an exception if prev isn't an object, but only if
        // we previously stored incorrect data. We'd want to fix the error that
        // caused that, so we allow the exception to bubble up
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
  private mUpdateQueue: Promise<void> = Promise.resolve();

  constructor(store: Redux.Store<T>) {
    this.mStore = store;
    this.mPersistedState = store.getState();
    store.subscribe(this.handleChange);
  }

  public insertPersistor(hive: string, persistor: IPersistor): Promise<void> {
    return this.resetData(hive, persistor)
        .then(() => {
          this.mPersistors[hive] = persistor;
          persistor.setResetCallback(() => {
            this.resetData(hive, persistor);
          });
        });
  }

  private resetData(hive: string, persistor: IPersistor): Promise<void> {
    return persistor.getAllKeys()
      .then(keys =>
        Promise.map(keys, key => persistor.getItem(key)
          .then(value => ({ key, value: this.deserialize(value) }))))
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
        this.mHydrating.delete(hive);
        return Promise.resolve();
      });
  }

  private deserialize(input: string): any {
    if ((input === undefined) || (input.length === 0)) {
      return '';
    } else {
      return JSON.parse(input);
    }
  }

  private serialize(input: any): string {
    return JSON.stringify(input);
  }

  private handleChange = () => {
    const oldState = this.mPersistedState;
    const newState = this.mStore.getState();

    this.mUpdateQueue = this.mUpdateQueue
      .then(() => {
        this.doProcessChange(oldState, newState);
      });
  }

  private doProcessChange(oldState: any, newState: any) {
    if (oldState !== newState) {
      this.mPersistedState = newState;
      this.storeDiffHive(oldState, newState)
        .catch(err => {
          // this should really never go wrong
          terminate({
            message: 'Failed to store application state',
            stack: err.stack,
          }, undefined);
        });
    }
  }

  private isObject(state: any): boolean {
    return (state !== null) && (typeof(state) === 'object') && !Array.isArray(state);
  }

  private storeDiffHive(oldState: any, newState: any): Promise<void> {
    let res = Promise.resolve();

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
                    oldState: any, newState: any): Promise<void> {
    if (oldState === newState) {
      return Promise.resolve();
    }

    try {
      if (this.isObject(oldState) && this.isObject(newState)) {
        const oldkeys = Object.keys(oldState);
        const newkeys = Object.keys(newState);

        return Promise.mapSeries(oldkeys,
          key => (newState[key] === undefined)
              // keys that exist in oldState but not newState
            ? this.remove(persistor, [].concat(statePath, key), oldState[key])
              // keys that exist in both
            : this.storeDiff(persistor, [].concat(statePath, key), oldState[key], newState[key]))
          .then(() => Promise.mapSeries(newkeys,
            key => ((oldState[key] === undefined) && (newState[key] !== undefined))
                // keys that exist in newState but not oldState
              ? this.add(persistor, [].concat(statePath, key), newState[key])
                // keys that exist in both - already handled above
              : Promise.resolve()))
          .then(() => undefined);
      } else {
        return this.add(persistor, statePath, newState);
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  private remove(persistor: IPersistor, statePath: string[], state: any): Promise<void> {
    return this.isObject(state)
      ? Promise.mapSeries(Object.keys(state), key =>
          this.remove(persistor, [].concat(statePath, key), state[key]))
        .then(() => undefined)
      : persistor.removeItem(statePath);
  }

  private add(persistor: IPersistor, statePath: string[], state: any): Promise<void> {
    return this.isObject(state)
      ? Promise.mapSeries(Object.keys(state), key =>
          this.add(persistor, [].concat(statePath, key), state[key]))
        .then(() => undefined)
      : persistor.setItem(statePath, this.serialize(state));
  }
}

export default ReduxPersistor;
