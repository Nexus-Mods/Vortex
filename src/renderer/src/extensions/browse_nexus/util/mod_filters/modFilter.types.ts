import type { TFunction } from "i18next";

import type { ModsSearchRequest } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IIconProp } from "@/ui/components/icon/Icon";

import type {
  BrowseModsTracker,
  FilterSource,
  IFilterEventProps,
} from "../../hooks/browse_mods_tracking/browseModsTracker";
import type { IModFilters, ModSortField, TrackedView } from "../mod_views/modViews";

/** What decides whether the user can see adult content. */
export interface IAdultContentAccess {
  /** Whether the user can see adult content. */
  canSeeAdult: boolean;
  /** Whether the user is logged in, without which adult content is never shown. */
  isLoggedIn: boolean;
}

/** One of a filter's choices, in its submenu's words, and briefly, as its chip shows it. */
export interface IModFilterChoice<V> {
  /** What it sets the filter to. */
  value: V;
  /** Its row in the submenu. */
  label: string;
  /** Its chip's label while it's on. */
  short: string;
}

/** What a filter's part of the search depends on besides the filters. */
export interface IModSearchContext {
  /** What the mods are sorted by. */
  sortField: ModSortField;
  /** When the time range was picked, which it counts back from, in ms. */
  rangeFrom: number;
}

/** A change of a filter, as its event reports it. */
export interface IModFilterChange {
  /** The open view, for analytics. */
  view: TrackedView;
  /** The filters after the change. */
  filters: IModFilters;
  /** The filters before it. */
  previous: IModFilters;
  /** Where it was changed from. */
  source: FilterSource;
}

/**
 * One of Browse's mod filters, as a choice of values: everything the menu, its chip, the search
 * and analytics need of it. No UI of its own; `ModFilterMenu` and `ModFilterChip` show any filter.
 */
export interface IModFilter<
  K extends keyof IModFilters = keyof IModFilters,
  E extends keyof IFilterEventProps = never,
> {
  /** Which of the view's filters it is. */
  key: K;
  /** Its row in the Filter menu, and its submenu's name. */
  label: (t: TFunction) => string;
  /** Its row's icon, and its chip's. */
  icon: IIconProp;
  /** The values to pick from, in order. */
  choices: (t: TFunction) => Array<IModFilterChoice<IModFilters[K]>>;
  /** Its submenu's reset. */
  resetLabel: (t: TFunction) => string;
  /** Its chip's button that takes it off. */
  removeLabel: (t: TFunction) => string;
  /**
   * Why the user can't change it, which locks its submenu and chip, saying so, and keeps its chip
   * in the bar; nothing while they can.
   */
  lockedReason?: (t: TFunction, access: IAdultContentAccess) => string | undefined;
  /** Its part of the search request. */
  toSearch: (
    filters: IModFilters,
    context: IModSearchContext,
  ) => Partial<ModsSearchRequest["filters"]>;
  /** Its properties on the events about a search. */
  eventProps: (filters: IModFilters) => Pick<IFilterEventProps, E>;
  /** Sends its event for a change. */
  track: (tracker: BrowseModsTracker, change: IModFilterChange) => void;
}
