import { describe, expect, it, vi } from "vitest";

import type { IMod } from "../../types/IMod";

// Nexus Mods identifies each file, so the update check can say which to update to.
vi.mock("../modSource", () => ({
  getModSource: (id: string) => ({ id, options: { supportsModId: true } }),
}));

import { collectionRevisions, modHasUpdate } from "./modHasUpdate";

const mod = (attributes: object, type = "") =>
  ({ id: "a", type, state: "installed", attributes }) as unknown as IMod;

const NEXUS = { source: "nexus", fileId: 100, version: "1.0" };

describe("modHasUpdate", () => {
  it("has an update for a mod with a newer file, or one to pick from its page", () => {
    expect(modHasUpdate(mod({ ...NEXUS, newestVersion: "1.1", newestFileId: 101 }))).toBe(true);
    expect(modHasUpdate(mod({ ...NEXUS, newestVersion: "1.1", newestFileId: "unknown" }))).toBe(
      true,
    );
  });

  it("has none for a mod that's current, or only bugged", () => {
    expect(modHasUpdate(mod({ ...NEXUS, newestVersion: "1.0" }))).toBe(false);
    expect(modHasUpdate(mod({ ...NEXUS, newestVersion: "1.0", bugMessage: "Broken" }))).toBe(false);
  });

  it("has one for a collection with a newer revision, and none otherwise", () => {
    expect(modHasUpdate(mod({ version: "10", newestVersion: "11" }, "collection"))).toBe(true);
    expect(modHasUpdate(mod({ version: "11", newestVersion: "10" }, "collection"))).toBe(false);
  });
});

describe("collectionRevisions", () => {
  it("knows the installed and newest revisions, never older than what's installed", () => {
    expect(collectionRevisions(mod({ version: "12", newestVersion: "10" }, "collection"))).toEqual({
      revision: 12,
      newest: 12,
      hasUpdate: false,
    });
  });
});
