import { afterEach, describe, expect, it, vi } from "vitest";

const { setupAutoUpdaterMock } = vi.hoisted(() => ({ setupAutoUpdaterMock: vi.fn() }));

vi.mock("./autoupdater", () => ({ setupAutoUpdater: setupAutoUpdaterMock }));
vi.mock("../logging", () => ({ log: vi.fn() }));

import { initUpdater, isUpdaterActive } from "./updater";

afterEach(() => {
  vi.unstubAllEnvs();
});

// The built-in feed points at the official Vortex releases: running it would
// replace mkeiitmods with Vortex.
describe("mkeiitmods updater", () => {
  it("is off for every install type, also with the development opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isUpdaterActive("regular")).toBe(false);
    expect(isUpdaterActive("managed")).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VORTEX_DEV_UPDATER", "1");
    expect(isUpdaterActive("regular")).toBe(false);
  });

  it("never sets up the auto-updater", () => {
    vi.stubEnv("NODE_ENV", "production");
    initUpdater("regular");
    expect(setupAutoUpdaterMock).not.toHaveBeenCalled();
  });
});
