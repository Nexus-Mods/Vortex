import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { NO_FILTERS } from "../../mod_views/modViews";
import { adultContentFilter, adultContentLockedReason } from "./adultContent";

const t = ((key: string) => key) as TFunction;

const SEARCH = { sortField: "endorsements", rangeFrom: 0 } as const;

describe("adultContentLockedReason", () => {
  it("tells a logged out user to log in", () => {
    expect(adultContentLockedReason(t, { canSeeAdult: false, isLoggedIn: false })).toBe(
      "Log in to view adult content",
    );
  });

  it("tells a user whose preferences hide adult content that they do", () => {
    expect(adultContentLockedReason(t, { canSeeAdult: false, isLoggedIn: true })).toBe(
      "Adult content is disabled in your preferences",
    );
  });

  it("doesn't lock it for a user who can see adult content", () => {
    expect(adultContentLockedReason(t, { canSeeAdult: true, isLoggedIn: true })).toBeUndefined();
  });
});

describe("adultContentFilter", () => {
  it("asks the search for nothing for all content, as it did before there was a choice", () => {
    expect(adultContentFilter.toSearch({ ...NO_FILTERS, adult: "include" }, SEARCH)).toEqual({});
  });

  it("asks the search to leave adult mods out, or for them alone", () => {
    expect(adultContentFilter.toSearch({ ...NO_FILTERS, adult: "exclude" }, SEARCH)).toEqual({
      adult: "exclude",
    });
    expect(adultContentFilter.toSearch({ ...NO_FILTERS, adult: "only" }, SEARCH)).toEqual({
      adult: "only",
    });
  });

  it("names the choice on the events about a search", () => {
    expect(adultContentFilter.eventProps({ ...NO_FILTERS, adult: "only" })).toEqual({
      adult: "only",
    });
  });
});
