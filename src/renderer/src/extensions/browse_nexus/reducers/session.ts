import { actionsToReducerSpec } from "@/reducers/builder";

import {
  resetBrowseModsView,
  selectBrowseModsView,
  setBrowseModsViewSearch,
} from "../actions/modsViews";
import { setBrowseSection } from "../actions/session";
import type { BrowseSection } from "../util/browseSection";
import { type IModViewChange, isPreset, type ModPreset } from "../util/mod_views/modViews";

/** session.browse: Browse's open section, and the changes to its presets, kept until a restart. */
export interface IBrowseSessionState {
  /** The open section; none for Browse's default. */
  section?: BrowseSection;
  /** What's changed about each preset's sort and filters, over how it comes. */
  presetChanges?: Partial<Record<ModPreset, IModViewChange>>;
}

declare module "@/types/IState" {
  interface ISessionState {
    browse: IBrowseSessionState;
  }
}

const actions = {
  setBrowseSection,
  setBrowseModsViewSearch,
  resetBrowseModsView,
  selectBrowseModsView,
};

/** Changes a preset's changes, leaving a view of the user's own to its own reducer. */
const changePreset = (
  state: IBrowseSessionState,
  viewId: string,
  update: (change: IModViewChange) => IModViewChange,
): IBrowseSessionState => {
  if (!isPreset(viewId)) {
    return state;
  }

  const change = update(state.presetChanges?.[viewId] ?? {});
  return { ...state, presetChanges: { ...state.presetChanges, [viewId]: change } };
};

export const sessionReducer = actionsToReducerSpec<IBrowseSessionState, typeof actions>(
  {},
  actions,
  {
    setBrowseSection: (state, payload) => ({ ...state, section: payload }),
    setBrowseModsViewSearch: (state, { viewId, change }) =>
      changePreset(state, viewId, (previous) => ({
        sort: { ...previous.sort, ...change.sort },
        filters: { ...previous.filters, ...change.filters },
      })),
    resetBrowseModsView: (state, viewId) => changePreset(state, viewId, () => ({})),
    // Picking a preset puts its filters back as they come, keeping its sort.
    selectBrowseModsView: (state, viewId) => changePreset(state, viewId, ({ sort }) => ({ sort })),
  },
);
