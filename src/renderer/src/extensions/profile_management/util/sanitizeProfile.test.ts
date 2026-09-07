import { describe, expect, it, vi } from "vitest";

vi.mock("../../../logging", () => {
  const log = vi.fn();
  return { default: log, log };
});

import { makeApiHarness, makeMod, makeProfile, makeProfileMod } from "../../../test-utils/builders";
import type { IMod } from "../../mod_management/types/IMod";
import type { IProfileMod } from "../types/IProfile";
import { sanitizeProfile } from "./sanitizeProfile";

const GAME = "cyberpunk2077";

/**
 * `mods` is the whole persistent.mods slice, so a test can tell the game entry
 * being present-but-empty apart from it being absent entirely.
 */
function forgottenMods(
  // keyed by modId
  modState: Record<string, IProfileMod>,
  // keyed by gameId, then modId
  mods: Record<string, Record<string, IMod>>,
) {
  const harness = makeApiHarness({ mods });
  const profile = makeProfile({ id: "profile1", gameId: GAME, modState });

  sanitizeProfile(harness.api.store, profile);

  return harness.dispatched
    .filter((action) => action.type === "FORGET_PROFILE_MOD")
    .map((action) => (action.payload as { modId: string }).modId);
}

describe("sanitizeProfile", () => {
  it("forgets a mod that is no longer installed", () => {
    const forgotten = forgottenMods(
      { installed: makeProfileMod(), gone: makeProfileMod() },
      { [GAME]: { installed: makeMod({ id: "installed" }) } },
    );

    expect(forgotten).toEqual(["gone"]);
  });

  it("keeps mods that are still installed", () => {
    const forgotten = forgottenMods(
      { installed: makeProfileMod() },
      { [GAME]: { installed: makeMod({ id: "installed" }) } },
    );

    expect(forgotten).toEqual([]);
  });

  it("forgets every mod once the user has removed them all", () => {
    // removeMod leaves the game entry behind as an empty table, so this really
    // is "nothing is installed any more" and the stale flags have to go.
    const forgotten = forgottenMods(
      { modA: makeProfileMod(), modB: makeProfileMod() },
      { [GAME]: {} },
    );

    expect(forgotten).toEqual(["modA", "modB"]);
  });

  it("keeps the profile when the game's mod table is missing entirely", () => {
    // a game that genuinely has no mods still has an empty table, so no entry
    // at all means it never loaded. The enabled flags live only on the profile.
    const forgotten = forgottenMods(
      { modA: makeProfileMod(), modB: makeProfileMod(), modC: makeProfileMod({ enabled: false }) },
      {},
    );

    expect(forgotten).toEqual([]);
  });

  it("does nothing for a profile with no mod state", () => {
    const forgotten = forgottenMods({}, { [GAME]: { installed: makeMod({ id: "installed" }) } });

    expect(forgotten).toEqual([]);
  });
});
