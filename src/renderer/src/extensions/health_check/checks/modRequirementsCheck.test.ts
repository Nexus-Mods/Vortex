import { describe, expect, it, vi } from "vitest";

// partitionNexusMods only needs a deterministic UID builder; it never depends on the
// real Nexus games list being loaded.
vi.mock("../../nexus_integration/util/UIDs", () => ({
  makeModUID: vi.fn(
    (repoInfo: { gameId: string; modId: string }) => `${repoInfo.gameId}-${repoInfo.modId}`,
  ),
}));

import type { IMod } from "../../mod_management/types/IMod";
import type { IProfile } from "../../profile_management/types/IProfile";
import { partitionNexusMods } from "./modRequirementsCheck";

describe("partitionNexusMods", () => {
  /** A minimal enabled Nexus mod with the given Nexus modId and (optional) referenceTag. */
  function nexusMod(id: string, modId: number, referenceTag?: string): IMod {
    return {
      id,
      attributes: { modId, source: "nexus", downloadGame: "skyrimse", referenceTag },
    } as unknown as IMod;
  }

  /** A collection mod carrying the given dependency rules (each with a reference tag). */
  function collectionMod(id: string, rules: Array<{ type: string; tag: string }>): IMod {
    return {
      id,
      type: "collection",
      rules: rules.map((r) => ({ type: r.type, reference: { tag: r.tag } })),
    } as unknown as IMod;
  }

  /** A profile where every given mod id is enabled. */
  function profileWith(...modIds: string[]): IProfile {
    return {
      modState: Object.fromEntries(modIds.map((id) => [id, { enabled: true }])),
    } as unknown as IProfile;
  }

  it("excludes a required collection dependency from self-check but keeps it installed", () => {
    const collection = collectionMod("collection", [{ type: "requires", tag: "tag-req" }]);
    const dep = nexusMod("mod-1", 100, "tag-req");
    const mods = { collection, "mod-1": dep };
    const { checkedModsByUid, installedModUids } = partitionNexusMods(
      [collection, dep],
      mods,
      profileWith("collection", "mod-1"),
      "skyrimse",
    );

    expect(installedModUids.has("skyrimse-100")).toBe(true);
    expect(checkedModsByUid.has("skyrimse-100")).toBe(false);
  });

  it("excludes an optional/recommended collection dependency the same way", () => {
    const collection = collectionMod("collection", [{ type: "recommends", tag: "tag-rec" }]);
    const dep = nexusMod("mod-2", 200, "tag-rec");
    const mods = { collection, "mod-2": dep };
    const { checkedModsByUid, installedModUids } = partitionNexusMods(
      [collection, dep],
      mods,
      profileWith("collection", "mod-2"),
      "skyrimse",
    );

    expect(installedModUids.has("skyrimse-200")).toBe(true);
    expect(checkedModsByUid.has("skyrimse-200")).toBe(false);
  });

  it("keeps a manually installed mod in both sets", () => {
    const manual = nexusMod("mod-3", 300);
    const { checkedModsByUid, installedModUids } = partitionNexusMods(
      [manual],
      { "mod-3": manual },
      profileWith("mod-3"),
      "skyrimse",
    );

    expect(installedModUids.has("skyrimse-300")).toBe(true);
    expect(checkedModsByUid.has("skyrimse-300")).toBe(true);
  });

  it("a collection-managed mod still counts as installed for another mod's requirement", () => {
    const collection = collectionMod("collection", [{ type: "requires", tag: "tag-req" }]);
    const dep = nexusMod("mod-1", 100, "tag-req");
    const other = nexusMod("mod-4", 400);
    const mods = { collection, "mod-1": dep, "mod-4": other };
    const { installedModUids } = partitionNexusMods(
      [collection, dep, other],
      mods,
      profileWith("collection", "mod-1", "mod-4"),
      "skyrimse",
    );

    // If "mod-4" declared a Nexus requirement on modId 100, this is the set the check
    // consults to decide it's satisfied.
    expect(installedModUids.has("skyrimse-100")).toBe(true);
  });
});
