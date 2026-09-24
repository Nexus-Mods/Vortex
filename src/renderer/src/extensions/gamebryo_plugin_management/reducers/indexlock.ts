import update from "immutability-helper";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/indexlock";
import toPluginId from "../util/toPluginId";

// manually locked mod indices, keyed by game id then plugin id
export type ILockedIndices = Record<string, Record<string, number>>;

/** Locks are keyed by plugin id, so any spelling of a plugin's name lands on the same entry. */
export const indexReducer = actionsToReducerSpec<ILockedIndices, typeof actions>({}, actions, {
  lockPluginIndex: (state, payload) => {
    const pluginId = toPluginId(payload.plugin);
    const locks = state[payload.gameId] ?? {};
    // an unchanged lock keeps the state reference, so the watchers do not re-apply the locks
    if (locks[pluginId] === payload.index) {
      return state;
    }
    return payload.index !== undefined
      ? update(state, { [payload.gameId]: { $set: { ...locks, [pluginId]: payload.index } } })
      : update(state, { [payload.gameId]: { $unset: [pluginId] } });
  },
});
