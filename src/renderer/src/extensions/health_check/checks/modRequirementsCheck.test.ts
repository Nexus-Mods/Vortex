import { beforeEach, describe, expect, it, vi } from "vitest";

// Only resolveRequirementTarget's dependencies matter here: the domain lookup and the
// canonical UID builder. Both are faked deterministically so the test never depends on
// the real Nexus games list being loaded.
vi.mock("@/extensions/nexus_integration/util", () => ({
  nexusGamesProm: vi.fn(() => Promise.resolve([])),
  numericGameIdToDomainName: vi.fn(),
}));
vi.mock("@/extensions/nexus_integration/util/UIDs", () => ({
  VORTEX_MOD_UID: "9856949944321",
  makeModUID: vi.fn((repoInfo: { gameId: string; modId: string }) =>
    // "site" + modId "1" is the one case the check cares about; everything else just
    // needs to be distinct per (gameId, modId) pair.
    repoInfo.gameId === "site" && repoInfo.modId === "1"
      ? "9856949944321"
      : `${repoInfo.gameId}-${repoInfo.modId}`,
  ),
}));

import type { IMod } from "@/extensions/mod_management/types/IMod";
import { numericGameIdToDomainName } from "@/extensions/nexus_integration/util";
import type { IProfile } from "@/extensions/profile_management/types/IProfile";

import { partitionNexusMods, resolveRequirementTarget } from "./modRequirementsCheck";

const mockDomainName = vi.mocked(numericGameIdToDomainName);

describe("resolveRequirementTarget", () => {
  beforeEach(() => {
    mockDomainName.mockReset();
  });

  it("treats a requirement resolving to the Vortex mod page (site/1) as having no target", () => {
    mockDomainName.mockReturnValue("site");
    const target = resolveRequirementTarget({ modId: "1", gameId: "2295" }, "skyrimse");
    expect(target).toBeNull();
  });

  it("does not special-case other mods on the site domain", () => {
    mockDomainName.mockReturnValue("site");
    const target = resolveRequirementTarget({ modId: "2", gameId: "2295" }, "skyrimse");
    expect(target).not.toBeNull();
    expect(target?.requiredModId).toBe(2);
  });

  it("does not special-case mod id 1 on a non-site domain", () => {
    mockDomainName.mockReturnValue("skyrimse");
    const target = resolveRequirementTarget({ modId: "1", gameId: "1704" }, "skyrimse");
    expect(target).not.toBeNull();
    expect(target?.domainName).toBe("skyrimse");
  });
});

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
