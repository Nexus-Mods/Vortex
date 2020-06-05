import { objDiff } from './util';

import * as Redux from 'redux';

interface IActionLog {
  before: any;
  after?: any;
  action: any;
}

const MAX_ENTRIES = 20;
const BUFFER = 10;

let actions: IActionLog[] = [];

function truncateActions() {
  actions = actions.slice(actions.length - MAX_ENTRIES);
}

let store: Redux.Store<any>;

export function reduxLogger() {
  return (storeIn: Redux.Store<any>) => {
    store = storeIn;
    return (next: Redux.Dispatch) => {
      return <A extends Redux.Action>(action: A): A => {
        if (actions.length > 0) {
          actions[actions.length - 1].after = store.getState();
        }
        actions.push({ before: store.getState(),
                       action });
        if (actions.length > MAX_ENTRIES + BUFFER) {
          truncateActions();
        }
        return next(action);
      };
    };
  };
}

export interface ILog {
  action: { type: string, payload: any };
  delta: any;
}

export function getReduxLog(): Promise<ILog[]> {
  if (actions.length > MAX_ENTRIES) {
    truncateActions();
  }

  if (actions.length > 0) {
    actions[actions.length - 1].after = store.getState();
  }
  return Promise.resolve(actions.map((action: IActionLog, idx: number) => {
    const res: ILog = {
      action: action.action,
      delta: action.after !== undefined ? objDiff(action.before, action.after) : {},
    };
    return res;
  }));
}
