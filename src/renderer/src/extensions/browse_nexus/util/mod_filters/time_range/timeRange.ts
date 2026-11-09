import type { ModsSearchRequest } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import type { ModSortField, ModTimeRange } from "../../mod_views/modViews";
import type { IModFilter } from "../modFilter.types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The search's date filter for a time range, counting back from `from`: mods created within it, or
 * updated within it for the `updated` sort; none for all time.
 */
export const timeRangeSearch = (
  timeRange: ModTimeRange,
  field: ModSortField,
  from: number,
): Pick<ModsSearchRequest["filters"], "created_at" | "updated_at"> => {
  if (timeRange === "all") {
    return {};
  }

  const since = new Date(from - Number(timeRange) * DAY_MS);
  const range = { gte: since.toISOString() };

  return field === "updated" ? { updated_at: range } : { created_at: range };
};

/** The time range filter: how far back the mods go, counted from when it was picked. */
export const timeRangeFilter: IModFilter<"timeRange", "time_range"> = {
  key: "timeRange",
  label: (t) => t("Dates"),
  icon: "calendar_today",
  choices: (t) => [
    { value: "1", label: t("Last 24 hours"), short: t("24 hours") },
    { value: "7", label: t("Last 7 days"), short: t("7 days") },
    { value: "14", label: t("Last 14 days"), short: t("14 days") },
    { value: "28", label: t("Last 28 days"), short: t("28 days") },
    { value: "365", label: t("Last year"), short: t("1 year") },
    { value: "all", label: t("All time"), short: t("All time") },
  ],
  resetLabel: (t) => t("Reset date to default"),
  removeLabel: (t) => t("Remove time range filter"),
  toSearch: (filters, { sortField, rangeFrom }) =>
    timeRangeSearch(filters.timeRange, sortField, rangeFrom),
  eventProps: (filters) => ({ time_range: filters.timeRange }),
  track: (tracker, { view, filters, previous, source }) =>
    tracker.trackTimeRangeChanged({
      view,
      time_range: filters.timeRange,
      previous_time_range: previous.timeRange,
      source,
    }),
};
