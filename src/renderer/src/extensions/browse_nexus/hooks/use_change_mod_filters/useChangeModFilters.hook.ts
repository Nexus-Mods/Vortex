import { MOD_FILTERS } from "../../util/mod_filters/modFilterList";
import type { IModFilters } from "../../util/mod_views/modViews";
import type { FilterSource } from "../browse_mods_tracking/browseModsTracker";
import { useBrowseModsTracker } from "../browse_mods_tracking/BrowseModsTracking.context";
import type { IModSearch } from "../use_mod_search/useModSearch.hook";

/**
 * Changes some of the open view's filters, from wherever they were changed, and sends each changed
 * filter's event; any already as asked are left be.
 */
export const useChangeModFilters = (search: IModSearch) => {
  const tracker = useBrowseModsTracker();

  return (change: Partial<IModFilters>, source: FilterSource) => {
    const changed: Partial<IModFilters> = Object.fromEntries(
      Object.entries(change).filter(
        ([key, value]) => value !== search.filters[key as keyof IModFilters],
      ),
    );

    if (!Object.keys(changed).length) {
      return;
    }

    search.setFilters(changed);

    const filters = { ...search.filters, ...changed };
    MOD_FILTERS.filter(({ key }) => key in changed).forEach(({ track }) =>
      track(tracker, { view: search.trackedView, filters, previous: search.filters, source }),
    );
  };
};
