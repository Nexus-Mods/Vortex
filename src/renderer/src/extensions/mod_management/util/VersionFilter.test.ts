import { describe, expect, it } from "vitest";

import { makeApiHarness, makeMod, makeProfile } from "../../../test-utils/builders";
import type { IApiHarness } from "../../../test-utils/harnessTypes";
import type { IMod, IModAttributes } from "../types/IMod";
import VersionFilter from "./VersionFilter";

const GAME_ID = "skyrimse";
const OTHER_GAME_ID = "fallout4";
const PROFILE_ID = "profile-skyrimse";
const OTHER_PROFILE_ID = "profile-fallout4";

/**
 * A harness seeded with the mods each game has installed, active on GAME_ID.
 * VersionFilter resolves the game through the active profile, so `activeProfileId` is
 * what decides which mod list the counts come from.
 */
function seed(mods: Record<string, Record<string, IMod>>): IApiHarness {
  const harness = makeApiHarness({
    profiles: { [PROFILE_ID]: makeProfile({ id: PROFILE_ID, gameId: GAME_ID }) },
    mods,
  });
  harness.setState((draft) => {
    draft.settings.profiles.activeProfileId = PROFILE_ID;
  });
  return harness;
}

/**
 * An installed mod that reports the given Nexus mod id. `modId` is typed loosely
 * because ICommonModAttributes declares it a number while the store also holds the
 * string form (from meta lookups) and the nullish forms these tests cover.
 */
function installed(id: string, modId: unknown): IMod {
  return makeMod({ id, state: "installed", attributes: { modId } as IModAttributes });
}

function byId(...mods: IMod[]): Record<string, IMod> {
  return Object.fromEntries(mods.map((mod) => [mod.id, mod]));
}

describe("VersionFilter", () => {
  describe("isEmpty", () => {
    it("treats a missing or empty selection as no filter", () => {
      const filter = new VersionFilter();

      expect(filter.isEmpty(undefined)).toBe(true);
      expect(filter.isEmpty([])).toBe(true);
      expect(filter.isEmpty(["multi-version"])).toBe(false);
    });
  });

  describe("existing presets", () => {
    // these presets decide on the row alone and never consult the store, so they all
    // share one empty state rather than seeding mod lists the filter never reads
    const state = seed({}).getState();

    it("passes every row through when nothing is selected", () => {
      const filter = new VersionFilter();
      const mod = installed("a", 42);

      expect(filter.matches([], mod, state)).toBe(true);
      expect(filter.matches(undefined, mod, state)).toBe(true);
    });

    it("matches mods with no source on missing-meta", () => {
      const filter = new VersionFilter();
      const noSource = installed("a", 42);
      const withSource = makeMod({
        id: "b",
        state: "installed",
        attributes: { modId: 43, source: "nexus", fileId: 1 },
      });

      expect(filter.matches(["missing-meta"], noSource, state)).toBe(true);
      expect(filter.matches(["missing-meta"], withSource, state)).toBe(false);
    });

    it("matches mods with a newer version available on has-update", () => {
      const filter = new VersionFilter();
      const outdated = makeMod({
        id: "a",
        attributes: { source: "nexus", version: "1.0.0", newestVersion: "1.1.0" },
      });
      const current = makeMod({
        id: "b",
        attributes: { source: "nexus", version: "1.1.0", newestVersion: "1.1.0" },
      });

      expect(filter.matches(["has-update"], outdated, state)).toBe(true);
      expect(filter.matches(["has-update"], current, state)).toBe(false);
    });

    it("matches an explicitly picked version", () => {
      const filter = new VersionFilter();
      const mod = makeMod({ id: "a", attributes: { version: "1.0.0" } });
      const noVersion = makeMod({ id: "b", attributes: {} });

      expect(filter.matches(["v:1.0.0"], mod, state)).toBe(true);
      expect(filter.matches(["v:2.0.0"], mod, state)).toBe(false);
      expect(filter.matches(["v:1.0.0"], noVersion, state)).toBe(false);
    });

    it("returns undefined for a row with no value", () => {
      const filter = new VersionFilter();

      expect(filter.matches(["multi-version"], undefined, state)).toBeUndefined();
    });
  });

  describe("multi-version", () => {
    it("matches mods that have more than one version installed", () => {
      const filter = new VersionFilter();
      const v1 = installed("a", 42);
      const v2 = installed("b", 42);
      const { getState } = seed({ [GAME_ID]: byId(v1, v2) });

      expect(filter.matches(["multi-version"], v1, getState())).toBe(true);
      expect(filter.matches(["multi-version"], v2, getState())).toBe(true);
    });

    it("does not match a mod that only has one version installed", () => {
      const filter = new VersionFilter();
      const only = installed("a", 42);
      const other = installed("b", 43);
      const { getState } = seed({ [GAME_ID]: byId(only, other) });

      expect(filter.matches(["multi-version"], only, getState())).toBe(false);
    });

    it("ignores versions that are only downloaded or still installing", () => {
      const filter = new VersionFilter();
      const current = installed("a", 42);
      const archive = makeMod({ id: "b", state: "downloaded", attributes: { modId: 42 } });
      const pending = makeMod({ id: "c", state: "installing", attributes: { modId: 42 } });
      const { getState } = seed({ [GAME_ID]: byId(current, archive, pending) });

      expect(filter.matches(["multi-version"], current, getState())).toBe(false);
    });

    it("never matches a row that isn't itself installed", () => {
      const filter = new VersionFilter();
      const v1 = installed("a", 42);
      const v2 = installed("b", 42);
      // the mods page lists finished downloads as rows too, and those carry the same
      // modId; an archive is not one of the installed versions the filter is about
      const archive = makeMod({ id: "c", state: "downloaded", attributes: { modId: 42 } });
      const { getState } = seed({ [GAME_ID]: byId(v1, v2, archive) });

      expect(filter.matches(["multi-version"], archive, getState())).toBe(false);
    });

    it.each<[string, unknown]>([
      ["undefined", undefined],
      ["null", null],
      ["empty string", ""],
      ["zero", 0],
    ])("never groups mods whose mod id is %s", (_label, modId) => {
      // manually installed mods have no modId at all, and the mods reducer only drops an
      // attribute when it is set to undefined, so a failed meta lookup can leave a nullish
      // or empty one behind. All of these mean "no mod id" - grouping on them reports
      // unrelated mods as versions of each other
      const filter = new VersionFilter();
      const one = installed("a", modId);
      const two = installed("b", modId);
      const { getState } = seed({ [GAME_ID]: byId(one, two) });

      expect(filter.matches(["multi-version"], one, getState())).toBe(false);
      expect(filter.matches(["multi-version"], two, getState())).toBe(false);
    });

    it("counts numeric and string mod ids as the same mod", () => {
      // modId arrives as a number from the api and as a string from some meta lookups;
      // both have to land in the same bucket or a mod split across the two
      // representations never registers as having multiple versions
      const filter = new VersionFilter();
      const numeric = installed("a", 42);
      const text = installed("b", "42");
      const { getState } = seed({ [GAME_ID]: byId(numeric, text) });

      expect(filter.matches(["multi-version"], numeric, getState())).toBe(true);
      expect(filter.matches(["multi-version"], text, getState())).toBe(true);
    });

    it("combines with the other presets as an or", () => {
      const filter = new VersionFilter();
      const single = makeMod({
        id: "a",
        state: "installed",
        attributes: { modId: 42, source: "nexus", version: "1.0.0", newestVersion: "1.1.0" },
      });
      const { getState } = seed({ [GAME_ID]: byId(single) });

      expect(filter.matches(["multi-version"], single, getState())).toBe(false);
      expect(filter.matches(["multi-version", "has-update"], single, getState())).toBe(true);
    });

    it("survives a game with no mods at all", () => {
      const filter = new VersionFilter();
      const orphan = installed("a", 42);

      expect(filter.matches(["multi-version"], orphan, seed({}).getState())).toBe(false);
      expect(filter.matches(["multi-version"], orphan, seed({ [GAME_ID]: {} }).getState())).toBe(
        false,
      );
    });

    it("survives having no active profile", () => {
      const filter = new VersionFilter();
      const orphan = installed("a", 42);
      const harness = seed({ [GAME_ID]: byId(orphan, installed("b", 42)) });
      harness.setState((draft) => {
        draft.settings.profiles.activeProfileId = undefined;
      });

      expect(filter.matches(["multi-version"], orphan, harness.getState())).toBe(false);
    });
  });

  describe("count cache", () => {
    it("walks the mod list once per pass rather than once per row", () => {
      // the reason the cache exists: matches() runs for every row, so a rescan per row
      // makes the filter quadratic in the size of the mod list
      const filter = new VersionFilter();
      // 100 mods with two installed versions each
      const mods = byId(
        ...Array.from({ length: 200 }, (_, idx) => installed(`m${idx}`, Math.floor(idx / 2) + 1)),
      );

      let scans = 0;
      const counted = new Proxy(mods, {
        ownKeys(target) {
          scans += 1;
          return Reflect.ownKeys(target);
        },
      });
      const { getState } = seed({ [GAME_ID]: counted });

      const matched = Object.values(mods).filter(
        (mod) => filter.matches(["multi-version"], mod, getState()) === true,
      );

      expect(scans).toBe(1);
      expect(matched).toHaveLength(200);
    });

    it("picks up an uninstall on the next pass", () => {
      const filter = new VersionFilter();
      const v1 = installed("a", 42);
      const v2 = installed("b", 42);
      const harness = seed({ [GAME_ID]: byId(v1, v2) });

      expect(filter.matches(["multi-version"], v1, harness.getState())).toBe(true);

      // the reducer replaces the slice on uninstall, and that replacement is what
      // invalidates the cache
      harness.setState((draft) => {
        draft.persistent.mods[GAME_ID] = byId(v1);
      });

      expect(filter.matches(["multi-version"], v1, harness.getState())).toBe(false);
    });

    it("picks up a second version being installed on the next pass", () => {
      const filter = new VersionFilter();
      const v1 = installed("a", 42);
      const v2 = installed("b", 42);
      const harness = seed({ [GAME_ID]: byId(v1) });

      expect(filter.matches(["multi-version"], v1, harness.getState())).toBe(false);

      harness.setState((draft) => {
        draft.persistent.mods[GAME_ID] = byId(v1, v2);
      });

      expect(filter.matches(["multi-version"], v1, harness.getState())).toBe(true);
    });

    it("does not carry counts across a game switch", () => {
      // one filter instance serves the mods page for every game, so counts from the
      // game the user came from must not decide what the next game shows
      const filter = new VersionFilter();
      const skyrimV1 = installed("a", 42);
      const skyrimV2 = installed("b", 42);
      const falloutOnly = installed("c", 42);
      const harness = seed({
        [GAME_ID]: byId(skyrimV1, skyrimV2),
        [OTHER_GAME_ID]: byId(falloutOnly),
      });

      expect(filter.matches(["multi-version"], skyrimV1, harness.getState())).toBe(true);

      harness.setState((draft) => {
        draft.persistent.profiles[OTHER_PROFILE_ID] = makeProfile({
          id: OTHER_PROFILE_ID,
          gameId: OTHER_GAME_ID,
        });
        draft.settings.profiles.activeProfileId = OTHER_PROFILE_ID;
      });
      expect(filter.matches(["multi-version"], falloutOnly, harness.getState())).toBe(false);

      harness.setState((draft) => {
        draft.settings.profiles.activeProfileId = PROFILE_ID;
      });
      expect(filter.matches(["multi-version"], skyrimV1, harness.getState())).toBe(true);
    });

    it("keeps two filter instances independent", () => {
      const one = new VersionFilter();
      const two = new VersionFilter();
      const v1 = installed("a", 42);
      const v2 = installed("b", 42);

      expect(one.matches(["multi-version"], v1, seed({ [GAME_ID]: byId(v1, v2) }).getState())).toBe(
        true,
      );
      expect(two.matches(["multi-version"], v1, seed({ [GAME_ID]: byId(v1) }).getState())).toBe(
        false,
      );
    });
  });
});
