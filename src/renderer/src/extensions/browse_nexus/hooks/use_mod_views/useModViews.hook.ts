import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSelector } from "reselect";

import type { IState } from "@/types/IState";

import {
  addBrowseModsView,
  removeBrowseModsView,
  renameBrowseModsView,
  resetBrowseModsView,
  selectBrowseModsView,
  setBrowseModsViewSearch,
} from "../../actions/modsViews";
import type { IBrowseModsView } from "../../reducers/mods_views/modsViews";
import {
  type IModFilters,
  type IModSort,
  isPreset,
  PRESET_FILTERS,
  PRESET_SORTS,
  resolveModView,
} from "../../util/mod_views/modViews";

const NO_VIEWS: IBrowseModsView[] = [];

const customViews = (state: IState) => state.settings.browseModsViews?.custom ?? NO_VIEWS;

/** The open view, resolved; the same object until the view, its saving or its changes do. */
const openView = createSelector(
  [
    (state: IState) => state.settings.browseModsViews?.selected,
    customViews,
    (state: IState) => state.session.browse?.presetChanges,
  ],
  (selected, custom, presetChanges) => resolveModView(selected, custom, presetChanges ?? {}),
);

/**
 * Browse's mods views: the open one, resolved, the user's own, and changing, saving and picking
 * them. `rangeFrom` is when the time range was last picked, which the search counts back from.
 */
export const useModViews = () => {
  const dispatch = useDispatch();
  const view = useSelector(openView);
  const views = useSelector(customViews);
  const [rangeFrom, setRangeFrom] = useState(() => Date.now());

  /** Changes how the open view filters, starting its time range from now. */
  const setFilters = (change: Partial<IModFilters>) => {
    dispatch(setBrowseModsViewSearch(view.id, { filters: change }));
    setRangeFrom(Date.now());
  };

  /** Changes how the open view sorts. */
  const setSort = (change: Partial<IModSort>) =>
    dispatch(setBrowseModsViewSearch(view.id, { sort: change }));

  return {
    ...view,
    view: view.id,
    views,
    rangeFrom,
    setSort,
    setFilters,
    /** Opens a view; a preset with its filters as they come. */
    selectView: (viewId: string) => {
      dispatch(selectBrowseModsView(viewId));
      setRangeFrom(Date.now());
    },
    /** Puts the open preset's sort back as it comes. */
    resetSort: () => isPreset(view.id) && setSort(PRESET_SORTS[view.id]),
    /** Puts the open preset's filters back as they come. */
    resetFilters: () => isPreset(view.id) && setFilters(PRESET_FILTERS[view.id]),
    /** Puts the open preset's sort and filters back as they come. */
    resetView: () => {
      dispatch(resetBrowseModsView(view.id));
      setRangeFrom(Date.now());
    },
    /** Saves what's showing as a view of the user's own, by name, and opens it. */
    addView: (name: string) =>
      dispatch(
        addBrowseModsView({
          id: `custom-${crypto.randomUUID()}`,
          name,
          sort: view.sort,
          filters: view.filters,
        }),
      ),
    /** Renames a view of the user's own. */
    renameView: (viewId: string, name: string) => dispatch(renameBrowseModsView(viewId, name)),
    /** Deletes a view of the user's own, opening the first preset if it was open. */
    removeView: (viewId: string) => dispatch(removeBrowseModsView(viewId)),
  };
};

export type IModViews = ReturnType<typeof useModViews>;
