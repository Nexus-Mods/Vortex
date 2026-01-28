import type { IExtensionApi } from "../types/IExtensionContext";
import { getSafe } from "../util/storeHelper";

/**
 * Interface for objects that can be updated when Redux state changes.
 * Works with both class components (which have forceUpdate) and
 * functional component wrappers.
 */
export interface IUpdateable {
  forceUpdate: () => void;
}

class ReduxProp<T> {
  private mInputs: string[][];
  private mFunc: (...args) => T;
  private mApi: IExtensionApi;
  private mSubscribers: IUpdateable[];
  private mUnsubscribe: () => void;

  constructor(api: IExtensionApi, inputs: string[][], func: (...args) => T) {
    this.mInputs = inputs;
    this.mFunc = func;
    this.mApi = api;
    this.mSubscribers = [];
  }

  public attach(component: IUpdateable) {
    if (this.mSubscribers.length === 0) {
      this.subscribe();
    }
    this.mSubscribers.push(component);
  }

  public detach(component: IUpdateable) {
    const idx = this.mSubscribers.indexOf(component);
    this.mSubscribers.splice(idx, 1);
    if (this.mSubscribers.length === 0) {
      this.unsubscribe();
    }
  }

  public calculate(): T {
    if (this.mApi === undefined) {
      return undefined;
    }
    const values = this.mInputs.map((valPath) =>
      getSafe(this.mApi.store.getState(), valPath, undefined),
    );
    return this.mFunc(...values);
  }

  private subscribe() {
    if (this.mApi === undefined) {
      return;
    }
    let oldState = this.mApi.store.getState();
    this.mUnsubscribe = this.mApi.store.subscribe(() => {
      const changed = this.mInputs.find(
        (valPath) =>
          getSafe(oldState, valPath, undefined) !==
          getSafe(this.mApi.store.getState(), valPath, undefined),
      );

      oldState = this.mApi.store.getState();
      if (changed !== undefined) {
        this.mSubscribers.forEach((sub) => sub.forceUpdate());
      }
    });
  }

  private unsubscribe() {
    this.mUnsubscribe();
    this.mUnsubscribe = undefined;
  }
}

export default ReduxProp;
