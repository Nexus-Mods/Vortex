import {IPersistor} from '../types/IExtensionContext';

import * as Promise from 'bluebird';
import * as _ from 'lodash';

function insert(target: any, key: string[], value: any) {
  try {
    key.reduce((prev, keySegment: string, idx: number, fullKey: string[]) => {
      if (idx === fullKey.length - 1) {
        prev[keySegment] = value;
        return prev;
      } else {
        if (prev[keySegment] === undefined) {
          prev[keySegment] = {};
        }
        return prev[keySegment];
      }
    }, target);
  } catch (err) {
    throw err;
  }
}

class ReduxPersistor<T> {
  private mUnsubscribe: () => void;
  private mStore: Redux.Store<T>;
  private mPersistedState: T;
  private mPersistors: { [key: string]: IPersistor } = {};
  private mHydrating: Set<string> = new Set();

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
          .then(value => ({ key, value: this.deserialize(value) }
          ))))
      .then(kvPairs => {
        const res: any = {};
        kvPairs.forEach(pair => {
          insert(res, pair.key, pair.value);
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
    if (input.length === 0) {
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
    this.mPersistedState = newState;
    if (oldState !== newState) {
      this.storeDiffHive(oldState, newState);
    }
  }

  private doRecurse(state: any): boolean {
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

    if (this.doRecurse(oldState)) {
      const oldkeys = Object.keys(oldState);
      const newkeys = Object.keys(newState);

      return Promise.mapSeries(oldkeys,
        key => (newState[key] === undefined)
          ? this.remove(persistor, [].concat(statePath, key), oldState[key])
          : this.storeDiff(persistor, [].concat(statePath, key), oldState[key], newState[key]))
      .then(() => Promise.mapSeries(newkeys,
        key => (oldState[key] === undefined)
          ? this.add(persistor, [].concat(statePath, key), newState[key])
          : Promise.resolve()))
      .then(() => undefined);
    } else {
      persistor.setItem(statePath, this.serialize(newState));
    }
  }

  private remove(persistor: IPersistor, statePath: string[], state: any): Promise<void> {
    return this.doRecurse(state)
      ? Promise.mapSeries(Object.keys(state), key =>
          this.remove(persistor, [].concat(statePath, key), state[key]))
        .then(() => undefined)
      : persistor.removeItem(statePath);
  }

  private add(persistor: IPersistor, statePath: string[], state: any): Promise<void> {
    return this.doRecurse(state)
      ? Promise.mapSeries(Object.keys(state), key =>
          this.add(persistor, [].concat(statePath, key), state[key]))
        .then(() => undefined)
      : persistor.setItem(statePath, this.serialize(state));
  }
}

export default ReduxPersistor;
