import { describe, expect, it } from "vitest";

import type { IMod } from "@/extensions/mod_management/types/IMod";

import { modStatus } from "./modStatus";

const MOD = { id: "skyui" } as IMod;

describe("modStatus", () => {
  it("is an update over installed", () => {
    expect(modStatus({ kind: "installed", mod: MOD, update: "update" })).toBe("update");
    expect(modStatus({ kind: "installed", mod: MOD, update: "update-site" })).toBe("update");
  });

  it("is installed without an update", () => {
    expect(modStatus({ kind: "installed", mod: MOD })).toBe("installed");
  });

  it("is downloaded for a download", () => {
    expect(modStatus({ kind: "downloaded", downloadId: "dl" })).toBe("downloaded");
  });

  it("is none while installing, or for a mod the user hasn't got", () => {
    expect(modStatus({ kind: "installing" })).toBeUndefined();
    expect(modStatus({ kind: "none" })).toBeUndefined();
  });
});
