import { describe, expect, it, vi } from "vitest";

vi.mock("../../logging", () => {
  const log = vi.fn();
  return { default: log, log };
});

vi.mock("../../util/fs", () => ({
  removeAsync: vi.fn(() => Promise.resolve()),
  statAsync: vi.fn(() => Promise.resolve({ isDirectory: () => true, ctime: new Date(0) })),
  ensureDirAsync: vi.fn(() => Promise.resolve()),
  readdirAsync: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../analytics/mixpanel/modChangeAnalytics", () => ({
  emitModRemoved: vi.fn(),
}));

// util/Steam reaches this at import time, through the eventHandlers graph, and
// off Windows it resolves a Steam install from the home directory. There is no
// ApplicationData to read paths from here.
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

vi.mock("./selectors", () => ({
  installPathForGame: () => "D:\\Vortex Mods\\skyrimse",
  installPath: () => "D:\\Vortex Mods\\skyrimse",
  currentActivator: () => undefined,
}));

import { makeApiHarness, makeMod } from "../../test-utils/builders";
import { onRemoveMods } from "./eventHandlers";
import type InstallManager from "./InstallManager";
import type { IMod } from "./types/IMod";

const GAME = "skyrimse";

const installManager = { markRecentRemoval: vi.fn() } as unknown as InstallManager;

// keyed by modId
function remove(mods: Record<string, IMod>, modIds: string[]) {
  const harness = makeApiHarness({ mods: { [GAME]: mods } });
  return new Promise<typeof harness>((resolve, reject) => {
    onRemoveMods(harness.api, [], installManager, GAME, modIds, (err) =>
      err == null ? resolve(harness) : reject(err),
    );
  });
}

describe("onRemoveMods", () => {
  it("removes a healthy mod", async () => {
    const harness = await remove(
      { "Good Mod-1-0-0": makeMod({ id: "Good Mod-1-0-0", installationPath: "Good Mod-1-0-0" }) },
      ["Good Mod-1-0-0"],
    );

    expect(harness.getState().persistent.mods[GAME]).toEqual({});
  });

  it("removes a record that lost its id field", async () => {
    const harness = await remove(
      {
        "SkyUI_5_2_SE-12604-5-2SE": {
          archiveId: "freshId",
          installationPath: "SkyUI_5_2_SE-12604-5-2SE",
        } as unknown as IMod,
      },
      ["SkyUI_5_2_SE-12604-5-2SE"],
    );

    expect(harness.getState().persistent.mods[GAME]).toEqual({});
  });
});
