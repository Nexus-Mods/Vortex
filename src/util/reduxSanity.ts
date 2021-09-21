import { setdefault } from './util';

import * as Redux from 'redux';

export class StateError extends Error {
  private mAction: Redux.Action;
  constructor(action: Redux.Action, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.mAction = action;
  }
}

export type SanityCheck = (state: any, action: Redux.Action) => string | false;

const sanityChecks: { [type: string]: SanityCheck[] } = {};

export function reduxSanity(callback: (err: StateError) => void) {
  return (store: Redux.Store<any>) =>
    (next: Redux.Dispatch) =>
      <A extends Redux.Action>(action: A): A => {
        let invalid: boolean = false;
        (sanityChecks[action.type as string] || []).forEach(check => {
          const res = check(store.getState(), action);
          if (res === false) {
            invalid = true;
          } else if (res !== undefined) {
            callback(new StateError(action, res));
            invalid = true;
          }
        });
        if (invalid) {
          return action;
        }
        return next(action);
      };
}

export function registerSanityCheck(type: string, check: SanityCheck) {
  setdefault(sanityChecks, type, []).push(check);
}
