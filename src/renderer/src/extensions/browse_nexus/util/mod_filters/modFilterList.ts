import type { IFilterEventProps } from "../../hooks/browse_mods_tracking/browseModsTracker";
import type { IModFilters } from "../mod_views/modViews";
import { adultContentFilter } from "./adult_content/adultContent";
import type { IModFilter, IModSearchContext } from "./modFilter.types";
import { timeRangeFilter } from "./time_range/timeRange";

/** Browse's mod filters, in the Filter menu's order, which their chips in the bar follow. */
export const MOD_FILTERS: readonly IModFilter[] = [timeRangeFilter, adultContentFilter];

/** The search request's filters from every filter's part. */
export const filtersToSearch = (filters: IModFilters, context: IModSearchContext) =>
  MOD_FILTERS.reduce((search, { toSearch }) => ({ ...search, ...toSearch(filters, context) }), {});

/** Every filter's properties on the events about a search. */
export const filterEventProps = (filters: IModFilters): IFilterEventProps => ({
  ...timeRangeFilter.eventProps(filters),
  ...adultContentFilter.eventProps(filters),
});
