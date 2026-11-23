import { describe, expect, test, vi } from "vitest";

import { makeApiHarness, makeLoadOrderEntry } from "../../../test-utils/builders";
import type { IProfile } from "../../profile_management/types/IProfile";
import type { ICollection } from "../types/ICollection";
import {
  chooseCollectionLoadOrder,
  mergeCollectionPluginOrder,
  savedBethesdaOrder,
} from "./bethesdaLoadOrder";

const profile: IProfile = {
  id: "classic",
  gameId: "fallout4",
  modState: {},
  name: "Existing",
  lastActivated: 0,
};
const entry = (id: string, modId = "member", enabled = true) =>
  makeLoadOrderEntry({ id, name: id, enabled, modId });
const manifest = (entries: ReturnType<typeof entry>[]) =>
  ({ fbLoadOrders: [{ id: "bethesda-plugins", entries }] }) as ICollection;

describe("Bethesda collection load order", () => {
  test("ignores absent, empty and ambiguous saved orders", () => {
    expect(savedBethesdaOrder({} as ICollection)).toBeUndefined();
    expect(savedBethesdaOrder(manifest([]))).toBeUndefined();
    expect(savedBethesdaOrder(manifest([entry("a.esp"), entry("A.esp")]))).toBeUndefined();
    expect(savedBethesdaOrder(manifest([entry("a.esp")]))).toEqual([entry("a.esp")]);
  });

  test("applies member order and enabled flags without moving unrelated or unavailable entries", () => {
    const native = { ...entry("base.esm"), locked: true };
    const unrelated = entry("unrelated.esp", "other");
    const deployed = [native, entry("a.esp"), unrelated, entry("b.esp")];
    const saved = [
      entry("B.esp", "curator-id", false),
      entry("missing.esp"),
      entry("a.esp"),
      unrelated,
      native,
    ];

    expect(mergeCollectionPluginOrder(deployed, saved, new Set(["member"]))).toEqual([
      native,
      entry("b.esp", "member", false),
      unrelated,
      entry("a.esp"),
    ]);
  });

  test("uses the saved order on a newly created active profile without prompting", async () => {
    const h = makeApiHarness();
    h.setState((state) => {
      state.persistent.profiles[profile.id] = profile;
      state.settings.profiles.activeProfileId = profile.id;
    });

    await expect(
      chooseCollectionLoadOrder(h.api, profile, { newProfileId: profile.id }),
    ).resolves.toBe("apply");
    expect(h.dialogCalls).toEqual([]);
  });

  test.each([
    ["Use Saved Order", "apply"],
    ["Keep Current Sorting", "keep"],
    ["Cancel", "cancel"],
  ])("honors %s for an existing profile", async (action, expected) => {
    const h = makeApiHarness();
    h.setState((state) => {
      state.persistent.profiles[profile.id] = profile;
      state.settings.profiles.activeProfileId = profile.id;
    });
    h.setNextDialog({ action, input: {} });
    const activateProfile = vi.fn();

    await expect(chooseCollectionLoadOrder(h.api, profile, { activateProfile })).resolves.toBe(
      expected,
    );
    expect(h.dialogCalls).toHaveLength(1);
    expect(activateProfile).not.toHaveBeenCalled();
  });
  test.each([
    ["Use Saved Order", "apply"],
    ["Keep Current Sorting", "keep"],
    ["Cancel", "cancel"],
  ])("asks again when resuming in Classic and honors %s", async (action, expected) => {
    const h = makeApiHarness();
    h.setState((state) => {
      state.persistent.profiles[profile.id] = profile;
      state.settings.profiles.activeProfileId = profile.id;
      state.settings.plugins = {
        ...state.settings.plugins,
        betaLoadOrder: { [profile.id]: false },
      };
    });
    h.setNextDialog({ action, input: {} });

    await expect(chooseCollectionLoadOrder(h.api, profile, {}, "apply")).resolves.toBe(expected);
    expect(h.dialogCalls).toHaveLength(1);
  });
});
