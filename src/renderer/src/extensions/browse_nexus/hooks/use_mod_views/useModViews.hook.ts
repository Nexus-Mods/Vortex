import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSelector } from "reselect";

import { canSeeAdultContent, isLoggedIn } from "@/extensions/nexus_integration/selectors";
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
  DEFAULT_PRESET,
  type IModFilters,
  type IModSort,
  isPreset,
  PRESET_FILTERS,
  PRESET_SORTS,
  resolveModView,
} from "../../util/mod_views/modViews";

const NO_VIEWS: IBrowseModsView[] = [];

/** How long the results stay fresh, which a time range's start is rounded down to. */
const RANGE_STEP_MS = 5 * 60 * 1000;

/**
 * Now, rounded down to five minutes, so picking a view again soon after makes the same search and
 * shows its cached results rather than loading them again.
 */
const rangeStart = () => Math.floor(Date.now() / RANGE_STEP_MS) * RANGE_STEP_MS;

const customViews = (state: IState) => state.settings.browseModsViews?.custom ?? NO_VIEWS;

/** The open view, resolved; the same object until the view, its saving or its changes do. */
const openView = createSelector(
  [
    (state: IState) => state.settings.browseModsViews?.selected,
    customViews,
    (state: IState) => state.session.browse?.presetChanges,
    canSeeAdultContent,
  ],
  (selected, custom, presetChanges, canSeeAdult) =>
    resolveModView(selected, custom, presetChanges ?? {}, canSeeAdult),
);

/**
 * Browse's mods views: the open one, resolved, the user's own, and changing, saving and picking
 * them, and whether the user is logged in and can see adult content. `rangeFrom` is when the time
 * range was last picked, to the five minutes before, which the search counts back from; it holds
 * while the view stays open, so its results don't move as time passes.
 */
export const useModViews = () => {
  const dispatch = useDispatch();
  const view = useSelector(openView);
  const views = useSelector(customViews);
  const canSeeAdult = useSelector(canSeeAdultContent);
  const loggedIn = useSelector(isLoggedIn);
  const [rangeFrom, setRangeFrom] = useState(rangeStart);

  /** Changes how the open view filters, starting its time range again. */
  const setFilters = (change: Partial<IModFilters>) => {
    dispatch(setBrowseModsViewSearch(view.viewId, { filters: change }));
    setRangeFrom(rangeStart());
  };

  /** Opens a view; a preset with its filters as they come, its time range starting again. */
  const selectView = (viewId: string) => {
    dispatch(selectBrowseModsView(viewId));
    setRangeFrom(rangeStart());
  };

  /** Changes how the open view sorts. */
  const setSort = (change: Partial<IModSort>) =>
    dispatch(setBrowseModsViewSearch(view.viewId, { sort: change }));

  return {
    ...view,
    views,
    canSeeAdult,
    isLoggedIn: loggedIn,
    rangeFrom,
    setSort,
    setFilters,
    selectView,
    /** Puts the open preset's sort back as it comes. */
    resetSort: () => isPreset(view.viewId) && setSort(PRESET_SORTS[view.viewId]),
    /** Puts the open preset's filters back as they come. */
    resetFilters: () => isPreset(view.viewId) && setFilters(PRESET_FILTERS[view.viewId]),
    /** Puts the open preset's sort and filters back as they come. */
    resetView: () => {
      dispatch(resetBrowseModsView(view.viewId));
      setRangeFrom(rangeStart());
    },
    /**
     * Saves what's showing as a view of the user's own, by name, and opens it; a preset it was made
     * from goes back as it comes, its changes now the new view's. Saves the filters as stored, so
     * adult content left out only because the user can't see it isn't saved as their choice.
     */
    addView: (name: string) => {
      dispatch(
        addBrowseModsView({
          id: `custom-${crypto.randomUUID()}`,
          name,
          sort: view.sort,
          filters: view.storedFilters,
        }),
      );

      if (isPreset(view.viewId)) {
        dispatch(resetBrowseModsView(view.viewId));
      }
    },
    /** Renames a view of the user's own. */
    renameView: (viewId: string, name: string) => dispatch(renameBrowseModsView(viewId, name)),
    /** Deletes a view of the user's own, opening the first preset as picking it would if it was open. */
    removeView: (viewId: string) => {
      dispatch(removeBrowseModsView(viewId));

      if (viewId === view.viewId) {
        selectView(DEFAULT_PRESET);
      }
    },
  };
};

export type IModViews = ReturnType<typeof useModViews>;
