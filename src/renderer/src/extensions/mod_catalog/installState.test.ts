import { describe, expect, it } from "vitest";

import type { IMod } from "../mod_management/types/IMod";
import { catalogInstallState, installedFromNexus } from "./installState";

function mod(id: string, attributes: Record<string, unknown>): IMod {
  return { id, state: "installed", type: "", installationPath: id, attributes } as IMod;
}

const catalogMod = { modId: 1511, version: "0.5.27" };

describe("catalogInstallState", () => {
  it("is not installed when no Nexus mod with that id is present", () => {
    const mods = {
      other: mod("other", { source: "nexus", modId: 99, version: "1.0" }),
      local: mod("local", { modId: 1511, version: "0.5.27" }), // not from Nexus
    };
    expect(catalogInstallState(mods, catalogMod)).toBe("not-installed");
    expect(catalogInstallState(undefined, catalogMod)).toBe("not-installed");
  });

  it("is installed when the installed version matches the site", () => {
    const mods = { a: mod("a", { source: "nexus", modId: 1511, version: "v0.5.27" }) };
    expect(catalogInstallState(mods, catalogMod)).toBe("installed");
  });

  it("matches mod ids stored as strings", () => {
    expect(
      installedFromNexus({ a: mod("a", { source: "nexus", modId: "1511" }) }, 1511),
    ).toHaveLength(1);
  });

  it("reports an update when the site has another version", () => {
    const mods = { a: mod("a", { source: "nexus", modId: 1511, version: "0.5.20" }) };
    expect(catalogInstallState(mods, catalogMod)).toBe("update-available");
  });

  it("reports an update found by the regular update check", () => {
    const mods = {
      a: mod("a", {
        source: "nexus",
        modId: 1511,
        version: "0.5.27",
        fileId: 1,
        newestFileId: 2,
        newestVersion: "0.5.27",
      }),
    };
    expect(catalogInstallState(mods, catalogMod)).toBe("update-available");
  });
});
