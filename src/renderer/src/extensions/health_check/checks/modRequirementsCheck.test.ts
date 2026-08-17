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
    // needs to be distinct from it.
    repoInfo.gameId === "site" && repoInfo.modId === "1" ? "9856949944321" : "other-uid",
  ),
}));

import { numericGameIdToDomainName } from "@/extensions/nexus_integration/util";

import { resolveRequirementTarget } from "./modRequirementsCheck";

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
