import * as path from "path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IState } from "@/types/IState";

const { folderSize } = vi.hoisted(() => ({ folderSize: vi.fn() }));

vi.mock("@/util/calculateFolderSize", () => ({ default: folderSize }));

// The real selector resolves placeholders against Vortex's own paths.
vi.mock("../selectors", () => ({
  installPathForGame: (_state: unknown, gameId: string) => path.join("staging", gameId),
}));

import { setModAttribute } from "../actions/mods";
import { calculateModSize } from "./calculateModSize";

const storeWith = (mods: { [modId: string]: object }) => ({
  getState: () => ({ persistent: { mods: { game: mods } } }) as unknown as IState,
  dispatch: vi.fn(),
});

describe("calculateModSize", () => {
  beforeEach(() => {
    folderSize.mockReset();
  });

  it("keeps the size of the mod's staging folder on the mod", async () => {
    folderSize.mockResolvedValue(2048);
    const store = storeWith({ a: { id: "a", installationPath: "alpha" } });

    await calculateModSize(store, "game", "a");

    expect(folderSize).toHaveBeenCalledWith(path.join("staging", "game", "alpha"));
    expect(store.dispatch).toHaveBeenCalledWith(setModAttribute("game", "a", "modSize", 2048));
  });

  it("leaves a mod that isn't installed alone", async () => {
    const store = storeWith({});

    await calculateModSize(store, "game", "a");

    expect(folderSize).not.toHaveBeenCalled();
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it("keeps the size it had when the folder can't be read", async () => {
    folderSize.mockRejectedValue(new Error("EPERM"));
    const store = storeWith({ a: { id: "a", installationPath: "alpha" } });

    await expect(calculateModSize(store, "game", "a")).resolves.toBeUndefined();
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
