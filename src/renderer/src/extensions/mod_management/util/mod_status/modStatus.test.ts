import { describe, expect, it } from "vitest";

import { makeMod } from "@/test-utils/builders";

import { localModStatus } from "./modStatus";

const NEXUS = { source: "nexus", fileId: 100, version: "1.0" };

describe("localModStatus", () => {
  it("is downloaded for a mod that's downloaded but not installed", () => {
    expect(localModStatus(makeMod({ state: "downloaded" }))).toBe("downloaded");
  });

  it("is update for an installed mod with a newer file out", () => {
    const mod = makeMod({ attributes: { ...NEXUS, newestVersion: "1.1", newestFileId: 101 } });

    expect(localModStatus(mod)).toBe("update");
  });

  it("is nothing for an installed mod that's up to date, or one being installed", () => {
    expect(localModStatus(makeMod({ attributes: NEXUS }))).toBeUndefined();
    expect(localModStatus(makeMod({ state: "installing" }))).toBeUndefined();
  });
});
