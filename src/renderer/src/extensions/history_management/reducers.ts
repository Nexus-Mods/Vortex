import { actionsToReducerSpec } from "../../reducers/builder";
import { addHistoryEvent, markHistoryReverted, setHistoryEvent, showHistory } from "./actions";
import type { IHistoryEvent } from "./types";

export interface IHistoryPersistent {
  historyStacks: { [key: string]: IHistoryEvent[] };
}

const persistentActions = { addHistoryEvent, setHistoryEvent, markHistoryReverted };
const sessionActions = { showHistory };

const persistentReducer = actionsToReducerSpec<IHistoryPersistent, typeof persistentActions>(
  {
    historyStacks: {},
  },
  persistentActions,
  {
    addHistoryEvent: (state, payload) => {
      const { stack, event, limit } = payload;
      const kept = (state.historyStacks?.[stack] ?? []).slice(limit * -1 - 1);
      return { ...state, historyStacks: { ...state.historyStacks, [stack]: [...kept, event] } };
    },
    setHistoryEvent: (state, payload) => {
      const { stack, event } = payload;
      const events = state.historyStacks[stack].slice();
      const idx = events.findIndex((evt) => evt.id === event.id);
      events[idx] = event;
      return { ...state, historyStacks: { ...state.historyStacks, [stack]: events } };
    },
    markHistoryReverted: (state, payload) => {
      const { stack, event } = payload;
      const events = state.historyStacks[stack].slice();
      const idx = events.findIndex((evt) => evt.id === event.id);
      events[idx] = { ...events[idx], reverted: true };
      return { ...state, historyStacks: { ...state.historyStacks, [stack]: events } };
    },
  },
);

export interface IHistoryState {
  stackToShow: string;
}

const sessionReducer = actionsToReducerSpec<IHistoryState, typeof sessionActions>(
  {
    stackToShow: undefined,
  },
  sessionActions,
  {
    showHistory: (state, payload) => ({ ...state, stackToShow: payload }),
  },
);

export { persistentReducer, sessionReducer };
