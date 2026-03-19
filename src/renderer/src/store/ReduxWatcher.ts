import type * as Redux from "redux";

import { isEqual } from "lodash";

import { unknownToError } from "@vortex/shared";

const select = (state: any, selector: string[]) =>
  selector.reduce((prev: any, current: string) => prev[current], state);

interface IParameters<T, U> {
  store: Redux.Store<T>;
  selector: string[];
  prevState: T;
  currentState: T;
  prevValue: U;
  currentValue: U;
}

type WatchCallback<T, U> = (parameters: IParameters<T, U>) => void;

interface IWatch<T, U> {
  selector: string[];
  listeners: Array<WatchCallback<T, U>>;
}

/**
 * this is a rewrite of redux-watcher (https://github.com/imsun/redux-watcher/)
 * The base idea is the same, it's a way to subscribe to changes on a redux store
 * with lower overhead and a memory of the previous state.
 * Compared to redux-watcher this is more forgiving if the monitored part of the state
 * doesn't actually exist
 */
class ReduxWatcher<T> {
  private mWatchList: { [key: string]: IWatch<T, any> } = {};
  private mLastState: T;

  constructor(
    store: Redux.Store<T>,
    onError: (err: Error, selector: string[]) => void,
  ) {
    this.mLastState = store.getState();

    store.subscribe(() => {
      const currentState = store.getState();
      const lastState = this.mLastState;
      Object.values(this.mWatchList).forEach(({ selector, listeners }) => {
        try {
          const prevValue = select(lastState, selector);
          const currentValue = select(currentState, selector);
          // TODO: shouldn't be a comparison by identity be good enough?
          if (!isEqual(prevValue, currentValue)) {
            const parameters = {
              store,
              selector,
              prevState: lastState,
              currentState,
              prevValue,
              currentValue,
            };
            listeners.forEach((listener) => listener(parameters));
          }
        } catch (unknownError) {
          const err = unknownToError(unknownError);
          onError(err, selector);
        }
      });

      this.mLastState = currentState;
    });
  }

  public on<U>(selector: string[], listener: WatchCallback<T, U>) {
    const id = this.selectorId(selector);
    if (this.mWatchList[id] === undefined) {
      this.mWatchList[id] = { selector, listeners: [] };
    }

    this.mWatchList[id].listeners.push(listener);
  }

  public off<U>(selector: string[], listener: WatchCallback<T, U>) {
    const id = this.selectorId(selector);
    if (this.mWatchList[id] !== undefined) {
      const idx = this.mWatchList[id].listeners.indexOf(listener);
      if (idx !== undefined) {
        this.mWatchList[id].listeners.splice(idx, 1);
      }
    }
  }

  private selectorId(selector: string[]): string {
    return JSON.stringify(selector);
  }
}

export default ReduxWatcher;
