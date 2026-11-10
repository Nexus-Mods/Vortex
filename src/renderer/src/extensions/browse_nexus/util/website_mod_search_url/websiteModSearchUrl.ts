import type { GameDomain } from "@vortex/shared";

import { NEXUS_BASE_URL } from "@/extensions/nexus_integration/constants";

import type { IModFilters, IModSort, ModSortField } from "../mod_views/modViews";

/** What Browse is showing, to search for on the website. */
export interface IWebsiteModSearch {
  /** The search text, once Browse has a search box. */
  text?: string;
  /** How the mods are sorted. */
  sort: IModSort;
  /** Which filters narrow them. */
  filters: IModFilters;
}

/** Each of Browse's sorts as the website's mod listing names it. */
const WEBSITE_SORTS: Record<ModSortField, string> = {
  new: "createdAt",
  updated: "updatedAt",
  endorsements: "endorsements",
  downloads: "downloads",
};

/**
 * The game's mods on Nexus Mods, searched, sorted and filtered as Browse has them, in the query the
 * website's mod listing reads. All time, and all content, are the site's defaults, so they're left
 * out; with all content the site also goes by the user's own preference. Mods that don't support
 * Vortex aren't left out, so the site can show what Browse hides.
 */
export const websiteModSearchUrl = (
  domain: GameDomain,
  { text, sort, filters }: IWebsiteModSearch,
) => {
  const query = new URLSearchParams();
  const keyword = text?.trim();

  if (keyword) {
    query.set("keyword", keyword);
  }

  query.set("sort", WEBSITE_SORTS[sort.field]);
  query.set("sortDirection", sort.direction.toUpperCase());

  if (filters.timeRange !== "all") {
    query.set("timeRange", filters.timeRange);
  }

  if (filters.adult === "exclude") {
    query.set("adultContent", "false");
  }

  if (filters.adult === "only") {
    query.set("showAdultContent", "true");
  }

  return `${NEXUS_BASE_URL}/games/${domain}/mods?${query}`;
};
