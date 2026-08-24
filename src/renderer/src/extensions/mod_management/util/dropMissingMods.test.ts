import { describe, expect, it } from "vitest";

import { makeApiHarness, makeMod } from "../../../test-utils/builders";
import type { IMod } from "../types/IMod";
import { canDropMissingMod, dropMissingMods } from "./dropMissingMods";

const GAME = "skyrimse";

/** a record left with no state field at all, as found in a corrupted mods table */
function statelessMod(overrides: Partial<IMod> = {}): IMod {
  return { archiveId: "freshId", installationPath: "modId1", ...overrides } as IMod;
}

describe("canDropMissingMod", () => {
  it("drops an installed mod", () => {
    expect(canDropMissingMod(makeMod({ state: "installed" }))).toBe(true);
  });

  it("drops a downloaded mod", () => {
    expect(canDropMissingMod(makeMod({ state: "downloaded" }))).toBe(true);
  });

  it("keeps a mod that is still installing", () => {
    expect(canDropMissingMod(makeMod({ state: "installing" }))).toBe(false);
  });

  it("keeps a mod that is still downloading", () => {
    expect(canDropMissingMod(makeMod({ state: "downloading" }))).toBe(false);
  });

  it("keeps a record that isn't there", () => {
    expect(canDropMissingMod(undefined)).toBe(false);
  });

  it("drops a record that has no state", () => {
    // nothing is in flight, so there is nothing to protect and the record has
    // to go - otherwise "Mods changed on disk" lists it with no way to clear it.
    expect(canDropMissingMod(statelessMod())).toBe(true);
  });
});

describe("dropMissingMods", () => {
  it("removes only the named mods", () => {
    const knownMods = {
      gone: makeMod({ id: "gone", installationPath: "gone" }),
      kept: makeMod({ id: "kept", installationPath: "kept" }),
    };
    const harness = makeApiHarness({ mods: { [GAME]: knownMods } });

    dropMissingMods(harness.api, GAME, knownMods, ["gone"]);

    expect(Object.keys(harness.getState().persistent.mods[GAME])).toEqual(["kept"]);
  });

  it("leaves an in-flight install in place", () => {
    const knownMods = {
      installing: makeMod({ id: "installing", state: "installing" }),
    };
    const harness = makeApiHarness({ mods: { [GAME]: knownMods } });

    dropMissingMods(harness.api, GAME, knownMods, ["installing"]);

    expect(Object.keys(harness.getState().persistent.mods[GAME])).toEqual(["installing"]);
  });

  it("removes a stateless record", () => {
    const knownMods = { phantom: statelessMod({ installationPath: "phantom" }) };
    const harness = makeApiHarness({ mods: { [GAME]: knownMods } });

    dropMissingMods(harness.api, GAME, knownMods, ["phantom"]);

    expect(harness.getState().persistent.mods[GAME]).toEqual({});
  });

  it("does nothing for a name it doesn't know", () => {
    const harness = makeApiHarness({ mods: { [GAME]: {} } });

    dropMissingMods(harness.api, GAME, {}, ["never-heard-of-it"]);

    expect(harness.getState().persistent.mods[GAME]).toEqual({});
  });
});
