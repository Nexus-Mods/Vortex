import { GameDomain } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { NEXUS_BASE_URL } from "@/extensions/nexus_integration/constants";

import { type IModFilters, type ModSortField, NO_FILTERS } from "../mod_views/modViews";
import { type IWebsiteModSearch, websiteModSearchUrl } from "./websiteModSearchUrl";

const DOMAIN = GameDomain("skyrimspecialedition");

/** A search sorted by most endorsed, with no filters, with these changes. */
const searchWith = (
  change: Omit<Partial<IWebsiteModSearch>, "filters"> & { filters?: Partial<IModFilters> } = {},
): IWebsiteModSearch => ({
  sort: { field: "endorsements" as ModSortField, direction: "desc" as const },
  ...change,
  filters: { ...NO_FILTERS, ...change.filters },
});

/** The URL's query, by parameter. */
const paramsOf = (search: IWebsiteModSearch) =>
  Object.fromEntries(new URL(websiteModSearchUrl(DOMAIN, search)).searchParams);

describe("websiteModSearchUrl", () => {
  it("opens the game's mods, sorted as Browse has them", () => {
    expect(websiteModSearchUrl(DOMAIN, searchWith())).toBe(
      `${NEXUS_BASE_URL}/games/skyrimspecialedition/mods?sort=endorsements&sortDirection=DESC`,
    );
  });

  it("carries the search text as typed", () => {
    expect(paramsOf(searchWith({ text: 'say "hi" & bye' })).keyword).toBe('say "hi" & bye');
  });

  it("leaves out a search of only spaces", () => {
    expect(paramsOf(searchWith({ text: "  " }))).not.toHaveProperty("keyword");
  });

  it.each<[ModSortField, string]>([
    ["new", "createdAt"],
    ["updated", "updatedAt"],
    ["endorsements", "endorsements"],
    ["downloads", "downloads"],
  ])("sorts %s as the site's %s", (field, sort) => {
    expect(paramsOf(searchWith({ sort: { field, direction: "desc" } })).sort).toBe(sort);
  });

  it("sorts the other way round", () => {
    expect(
      paramsOf(searchWith({ sort: { field: "downloads", direction: "asc" } })).sortDirection,
    ).toBe("ASC");
  });

  it("carries the time range", () => {
    expect(paramsOf(searchWith({ filters: { timeRange: "7" } })).timeRange).toBe("7");
  });

  it("leaves out all time, the site's own default", () => {
    expect(paramsOf(searchWith({ filters: { timeRange: "all" } }))).not.toHaveProperty("timeRange");
  });

  it("leaves adult mods out", () => {
    expect(paramsOf(searchWith({ filters: { adult: "exclude" } }))).toMatchObject({
      adultContent: "false",
    });
  });

  it("shows only adult mods", () => {
    expect(paramsOf(searchWith({ filters: { adult: "only" } }))).toMatchObject({
      showAdultContent: "true",
    });
  });

  it("leaves all content to the site's default", () => {
    const params = paramsOf(searchWith({ filters: { adult: "include" } }));
    expect(params).not.toHaveProperty("adultContent");
    expect(params).not.toHaveProperty("showAdultContent");
  });
});
