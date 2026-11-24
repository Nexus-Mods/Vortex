import { describe, expect, it } from "vitest";

import type { IProfile } from "../../profile_management/types/IProfile";
import { byRecentlyUsed } from "./recentlyUsed";

const profile = (id: string, gameId: string, lastActivated: number | undefined): IProfile => ({
  id,
  gameId,
  name: "Default",
  modState: {},
  lastActivated: lastActivated as number,
});

const profilesOf = (...list: IProfile[]) =>
  Object.fromEntries(list.map((entry) => [entry.id, entry]));

const sorted = (profiles: { [profileId: string]: IProfile }, gameIds: string[]) =>
  gameIds
    .map((id) => ({ id }))
    .sort(byRecentlyUsed(profiles))
    .map((game) => game.id);

describe("byRecentlyUsed", () => {
  it("puts the most recently used game first", () => {
    const profiles = profilesOf(profile("p1", "old", 100), profile("p2", "new", 300));

    expect(sorted(profiles, ["old", "new"])).toEqual(["new", "old"]);
  });

  it("uses a game's newest profile", () => {
    const profiles = profilesOf(
      profile("p1", "two-profiles", 100),
      profile("p2", "two-profiles", 500),
      profile("p3", "other", 300),
    );

    expect(sorted(profiles, ["other", "two-profiles"])).toEqual(["two-profiles", "other"]);
  });

  it("keeps the order correct around a game that was never activated", () => {
    const profiles = profilesOf(
      profile("p1", "older", 100),
      profile("p2", "never", undefined),
      profile("p3", "newest", 300),
    );

    expect(sorted(profiles, ["older", "never", "newest"])).toEqual(["newest", "older", "never"]);
  });

  it("uses the timestamp a game has when another of its profiles was never activated", () => {
    const profiles = profilesOf(
      profile("p1", "partly", undefined),
      profile("p2", "partly", 500),
      profile("p3", "other", 300),
    );

    expect(sorted(profiles, ["other", "partly"])).toEqual(["partly", "other"]);
  });

  it("sorts a game without profiles last", () => {
    const profiles = profilesOf(profile("p1", "used", 100));

    expect(sorted(profiles, ["no-profile", "used"])).toEqual(["used", "no-profile"]);
  });
});
