import { actionsToReducerSpec } from "@/reducers/builder";

import {
  addBrowseModsView,
  removeBrowseModsView,
  renameBrowseModsView,
  selectBrowseModsView,
  setBrowseModsViewSearch,
} from "../../actions/modsViews";
import type { IModFilters, IModSort } from "../../util/mod_views/modViews";

/** How a view sorts and filters the mods. */
export interface IBrowseModsViewSearch {
  /** How it sorts the mods. */
  sort: IModSort;
  /** Every filter the view was saved with; one added since is missing until it's changed. */
  filters: Partial<IModFilters>;
}

/** A view the user made of Browse's mods. */
export interface IBrowseModsView extends IBrowseModsViewSearch {
  /** `custom-` and a UUID, never a preset's. */
  id: string;
  /** What the user called it. */
  name: string;
}

/** settings.browseModsViews: the open view, and the user's own views. */
export interface IBrowseModsViewsState {
  /** The open view, a preset's or the user's own; unset, the first preset. */
  selected?: string;
  /** In the order they were made. */
  custom: IBrowseModsView[];
}

declare module "@/types/IState" {
  interface ISettings {
    /** Browse's mods views: the open one, and the user's own. */
    browseModsViews: IBrowseModsViewsState;
  }
}

const defaultState: IBrowseModsViewsState = { custom: [] };

/** Changes a view of the user's own by id; the same state, so nothing's saved, if none has it. */
const changeCustom = (
  state: IBrowseModsViewsState,
  viewId: string,
  update: (view: IBrowseModsView) => IBrowseModsView,
): IBrowseModsViewsState => {
  if (!state.custom.some((view) => view.id === viewId)) {
    return state;
  }

  return {
    ...state,
    custom: state.custom.map((view) => (view.id === viewId ? update(view) : view)),
  };
};

const actions = {
  selectBrowseModsView,
  addBrowseModsView,
  renameBrowseModsView,
  setBrowseModsViewSearch,
  removeBrowseModsView,
};

export const browseModsViewsReducer = actionsToReducerSpec(defaultState, actions, {
  selectBrowseModsView: (state, viewId) =>
    state.selected === viewId ? state : { ...state, selected: viewId },
  addBrowseModsView: (state, view) => ({
    ...state,
    selected: view.id,
    custom: [...state.custom, view],
  }),
  renameBrowseModsView: (state, { viewId, name }) =>
    changeCustom(state, viewId, (view) => ({ ...view, name })),
  setBrowseModsViewSearch: (state, { viewId, change }) =>
    changeCustom(state, viewId, (view) => ({
      ...view,
      sort: { ...view.sort, ...change.sort },
      filters: { ...view.filters, ...change.filters },
    })),
  // Back to the first preset if it was open.
  removeBrowseModsView: (state, viewId) => ({
    selected: state.selected === viewId ? undefined : state.selected,
    custom: state.custom.filter((view) => view.id !== viewId),
  }),
});
