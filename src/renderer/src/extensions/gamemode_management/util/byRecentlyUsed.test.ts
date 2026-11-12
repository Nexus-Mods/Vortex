import { describe, expect, it } from "vitest";

import type { IProfile } from "../../profile_management/types/IProfile";
import type { IGameStored } from "../types/IGameStored";
import { byRecentlyUsed, lastUsed } from "./byRecentlyUsed";

const game = (id: string): IGameStored => ({ id, name: id, requiredFiles: [], executable: "" });

// lastActivated is optional here because a game's first profile is created without one
const profile = (id: string, gameId: string, lastActivated?: number): IProfile =>
  ({ id, gameId, name: "Default", modState: {}, lastActivated }) as IProfile;

const toProfiles = (...list: IProfile[]): { [profileId: string]: IProfile } =>
  Object.fromEntries(list.map((prof) => [prof.id, prof]));

describe("lastUsed", () => {
  it("returns the latest activation across the game's profiles", () => {
    const profiles = toProfiles(
      profile("p1", "skyrimse", 100),
      profile("p2", "skyrimse", 300),
      profile("p3", "fallout4", 500),
    );

    expect(lastUsed(profiles, "skyrimse")).toBe(300);
  });

  it("returns 0 for a game whose profile was never activated", () => {
    const profiles = toProfiles(profile("p1", "skyrimse"));

    expect(lastUsed(profiles, "skyrimse")).toBe(0);
  });

  it("returns 0 for a game with no profiles", () => {
    expect(lastUsed({}, "skyrimse")).toBe(0);
  });
});

describe("byRecentlyUsed", () => {
  it("puts the most recently activated game first", () => {
    const profiles = toProfiles(
      profile("p1", "skyrimse", 100),
      profile("p2", "fallout4", 300),
      profile("p3", "starfield", 200),
    );

    const sorted = [game("skyrimse"), game("fallout4"), game("starfield")].sort(
      byRecentlyUsed(profiles),
    );

    expect(sorted.map((g) => g.id)).toEqual(["fallout4", "starfield", "skyrimse"]);
  });

  // LAZ-1637: a never-activated profile made the comparator return NaN, so the result
  // depended on the input order and the last-used game wasn't reliably first
  it("sorts consistently when a managed game was never activated", () => {
    const profiles = toProfiles(
      profile("p1", "skyrimse", 100),
      profile("p2", "fallout4", 300),
      profile("p3", "starfield"),
      profile("p4", "oblivion", 200),
    );
    const games = ["starfield", "skyrimse", "fallout4", "oblivion"].map(game);
    const expected = ["fallout4", "oblivion", "skyrimse", "starfield"];

    expect(games.sort(byRecentlyUsed(profiles)).map((g) => g.id)).toEqual(expected);
    expect(
      [...games]
        .reverse()
        .sort(byRecentlyUsed(profiles))
        .map((g) => g.id),
    ).toEqual(expected);
  });

  it("never returns NaN, including for games with no profiles", () => {
    const compare = byRecentlyUsed(toProfiles(profile("p1", "starfield")));

    expect(compare(game("starfield"), game("skyrimse"))).toBe(0);
    expect(compare(game("skyrimse"), game("fallout4"))).toBe(0);
  });
});
