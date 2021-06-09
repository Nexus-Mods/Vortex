import { addReducer, IReducerSpec } from '../../types/IExtensionContext';
import {getSafe, pushSafe, setDefaultArray, setSafe} from '../../util/storeHelper';

import * as actions from './actions';
import { IHistoryEvent, IHistoryStack } from './types';

export interface IHistoryPersistent {
  historyStacks: { [key: string]: IHistoryEvent[] };
}

const persistentReducer: IReducerSpec<IHistoryPersistent> = {
  reducers: {
    ...addReducer(actions.addHistoryEvent, (state, payload) => {
      const path = ['historyStacks', payload.stack];
      const copy = getSafe(state, path, [])
        .slice(payload.limit * -1 - 1);
      copy.push(payload.event);
      return setSafe(state, path, copy);
    }),
    ...addReducer(actions.setHistoryEvent, (state, payload) => {
      const idx = state.historyStacks[payload.stack].findIndex(evt => evt.id === payload.event.id);
      const copy = setSafe(state, ['historyStacks', payload.stack, idx], payload.event);
      return copy;
    }),
    ...addReducer(actions.markHistoryReverted, (state, payload) => {
      const idx = state.historyStacks[payload.stack].findIndex(evt => evt.id === payload.event.id);
      const copy = setSafe(state, ['historyStacks', payload.stack, idx, 'reverted'], true);
      return copy;
    }),
  },
  defaults: {
    historyStacks: {},
  },
};

export interface IHistoryState {
  stackToShow: string;
}

const sessionReducer: IReducerSpec<IHistoryState> = {
  reducers: {
    ...addReducer(actions.showHistory, (state, payload) =>
      setSafe(state, ['stackToShow'], payload)),
  },
  defaults: {
    stackToShow: undefined,
  },
};

export { persistentReducer, sessionReducer };
