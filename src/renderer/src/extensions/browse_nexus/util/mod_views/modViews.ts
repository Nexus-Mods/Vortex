import type { ModsSearchRequest } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import type { IBrowseModsView } from "../../reducers/mods_views/modsViews";

/** Browse's view presets, each with a sort and filters of its own. */
export const ModPreset = {
  trending: "trending",
  popular: "popular",
  new: "new",
} as const;

export type ModPreset = (typeof ModPreset)[keyof typeof ModPreset];

/** Whether a view's id is a preset's, rather than a view of the user's own. */
export const isPreset = (view: string | undefined): view is ModPreset =>
  Object.values(ModPreset).some((preset) => preset === view);

/** A view as analytics names it: its preset, or `custom` for the user's own, never their name. */
export type TrackedView = ModPreset | "custom";

/** A view's analytics name, from its id. */
export const trackedViewOf = (viewId: string): TrackedView =>
  isPreset(viewId) ? viewId : "custom";

/** What the mods can be sorted by. */
export type ModSortField = ModsSearchRequest["sort"]["field"];

/** Which way round they're sorted. */
export type ModSortDirection = ModsSearchRequest["sort"]["direction"];

/** How far back the mods go, in days or all time. */
export type ModTimeRange = "1" | "7" | "14" | "28" | "365" | "all";

/** Whether adult mods are shown alongside the rest, left out, or shown alone. */
export type ModAdultContent = NonNullable<ModsSearchRequest["filters"]["adult"]>;

/** How a view sorts the mods. */
export interface IModSort {
  /** What they're sorted by. */
  field: ModSortField;
  /** Which way round. */
  direction: ModSortDirection;
}

/** Which of the mods a view shows. */
export interface IModFilters {
  /** How far back they go: created within it, or updated within it for `updated`. */
  timeRange: ModTimeRange;
  /** Whether adult mods are shown alongside the rest, left out, or shown alone. */
  adult: ModAdultContent;
}

/** What's changed about a view's sort and filters, over how it comes or was saved. */
export interface IModViewChange {
  /** The parts of its sort that changed. */
  sort?: Partial<IModSort>;
  /** The filters that changed. */
  filters?: Partial<IModFilters>;
}

/** Each preset's sort as it comes: Trending the most endorsed, Most popular the most downloaded. */
export const PRESET_SORTS: Record<ModPreset, IModSort> = {
  trending: { field: "endorsements", direction: "desc" },
  popular: { field: "downloads", direction: "desc" },
  new: { field: "new", direction: "desc" },
};

/** Each preset's filters as they come. */
export const PRESET_FILTERS: Record<ModPreset, IModFilters> = {
  trending: { timeRange: "7", adult: "include" },
  popular: { timeRange: "7", adult: "include" },
  new: { timeRange: "all", adult: "include" },
};

/** No filter narrowing the mods, which saved filters go over, for any added since. */
export const NO_FILTERS: IModFilters = { timeRange: "all", adult: "include" };

/** The preset Browse opens on, and goes back to when the open view is gone. */
export const DEFAULT_PRESET: ModPreset = ModPreset.trending;

/**
 * Filters as a user sees them: one who can't see adult content gets none, whatever was picked,
 * as the search would leave it out anyway.
 */
const forViewer = (filters: IModFilters, canSeeAdult: boolean): IModFilters =>
  canSeeAdult ? filters : { ...filters, adult: "exclude" };

/** The filters, of a set, that differ from another. */
const changedFilters = (filters: IModFilters, from: IModFilters) =>
  (Object.keys(filters) as Array<keyof IModFilters>).filter((key) => filters[key] !== from[key]);

/** The open view, resolved: how it sorts and filters, and how that differs from how it comes. */
export interface IResolvedModView {
  /** A preset's id, or a view of the user's own. */
  viewId: string;
  /** Its name for analytics: its preset, or `custom`. */
  trackedView: TrackedView;
  /** How it sorts the mods, with any changes. */
  sort: IModSort;
  /** How it filters the mods as the user sees them: no adult mods for one who can't see them. */
  filters: IModFilters;
  /** The same, as stored: what saving it as a view keeps. */
  storedFilters: IModFilters;
  /** Which filters narrow the mods. */
  activeFilters: Array<keyof IModFilters>;
  /** How many filters narrow the mods. */
  activeFilterCount: number;
  /** Whether a preset's sort differs from how it comes; never so for the user's own. */
  canResetSort: boolean;
  /** Which of a preset's filters differ from how they come; none for the user's own. */
  changedFilters: Array<keyof IModFilters>;
  /** How many of a preset's filters differ from how they come; none for the user's own. */
  changedFilterCount: number;
  /** Whether a preset's sort or filters differ from how they come. */
  isEdited: boolean;
}

/**
 * The open view, from its id, the user's own views and the presets' changes: a view of the user's
 * own as saved, or a preset as it comes with its changes; the first preset if the view is gone.
 * For a user who can't see adult content, adult mods are left out, which isn't a change.
 */
export const resolveModView = (
  selected: string | undefined,
  custom: IBrowseModsView[],
  presetChanges: Partial<Record<ModPreset, IModViewChange>>,
  canSeeAdult: boolean,
): IResolvedModView => {
  const saved = custom.find((view) => view.id === selected);
  const preset = isPreset(selected) ? selected : DEFAULT_PRESET;
  const viewId = saved?.id ?? preset;
  const change = saved ? {} : (presetChanges[preset] ?? {});
  const sort = { ...(saved?.sort ?? PRESET_SORTS[preset]), ...change.sort };
  const storedFilters = {
    ...NO_FILTERS,
    ...(saved?.filters ?? PRESET_FILTERS[preset]),
    ...change.filters,
  };
  const filters = forViewer(storedFilters, canSeeAdult);
  const canResetSort =
    !saved &&
    (sort.field !== PRESET_SORTS[preset].field ||
      sort.direction !== PRESET_SORTS[preset].direction);
  const active = changedFilters(filters, forViewer(NO_FILTERS, canSeeAdult));
  const changed = saved
    ? []
    : changedFilters(filters, forViewer(PRESET_FILTERS[preset], canSeeAdult));

  return {
    viewId,
    trackedView: trackedViewOf(viewId),
    sort,
    filters,
    storedFilters,
    activeFilters: active,
    activeFilterCount: active.length,
    canResetSort,
    changedFilters: changed,
    changedFilterCount: changed.length,
    isEdited: canResetSort || changed.length > 0,
  };
};
