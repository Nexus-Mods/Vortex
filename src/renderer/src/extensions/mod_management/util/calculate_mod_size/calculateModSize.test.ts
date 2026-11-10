import { mkdir, writeFile } from "node:fs/promises";
import * as path from "path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTempDir } from "@/test-utils/tempDir";
import type { IState } from "@/types/IState";

const { staging } = vi.hoisted(() => ({ staging: { current: "" } }));

// The real selector resolves placeholders against Vortex's own paths.
vi.mock("../../selectors", () => ({
  installPathForGame: () => staging.current,
}));

import { setModAttribute } from "../../actions/mods";
import { calculateModSize } from "./calculateModSize.util";

const storeWith = (mods: { [modId: string]: object }) => ({
  getState: () => ({ persistent: { mods: { game: mods } } }) as unknown as IState,
  dispatch: vi.fn(),
});

describe("calculateModSize", () => {
  beforeEach(async () => {
    staging.current = await makeTempDir("vortex-mod-size-");
  });

  it("keeps the size of the mod's staging folder on the mod", async () => {
    await mkdir(path.join(staging.current, "alpha", "textures"), { recursive: true });
    await writeFile(path.join(staging.current, "alpha", "alpha.esp"), Buffer.alloc(1000));
    await writeFile(path.join(staging.current, "alpha", "textures", "a.dds"), Buffer.alloc(48));
    const store = storeWith({ a: { id: "a", installationPath: "alpha" } });

    await calculateModSize(store, "game", "a");

    expect(store.dispatch).toHaveBeenCalledWith(setModAttribute("game", "a", "modSize", 1048));
  });

  it("leaves a mod that isn't installed alone", async () => {
    const store = storeWith({});

    await calculateModSize(store, "game", "a");

    expect(store.dispatch).not.toHaveBeenCalled();
  });

  // The folder walk treats a missing folder as empty, which would record the mod as 0 B.
  it("keeps the size it had when the mod's folder is gone", async () => {
    const store = storeWith({ a: { id: "a", installationPath: "alpha" } });

    await expect(calculateModSize(store, "game", "a")).resolves.toBeUndefined();
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
