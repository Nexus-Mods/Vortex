import { describe, expect, it, vi } from "vitest";

const preload = vi.hoisted(() => ({ app: { relaunch: vi.fn() } }));

vi.mock("./preloadAccess", () => ({ getPreloadApi: () => preload }));

import { isRelaunching, relaunch } from "./commandLine";

describe("relaunch", () => {
  it("reports a relaunch only after relaunch() is called", () => {
    expect(isRelaunching()).toBe(false);

    relaunch(["--game", "skyrimse"]);

    expect(isRelaunching()).toBe(true);
    expect(preload.app.relaunch).toHaveBeenCalledWith(["--game", "skyrimse"]);
  });
});
