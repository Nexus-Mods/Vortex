import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { types } from "@nexusmods/vortex-api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import findConflicts from "./conflicts";

const GAME_ID = "tier0-game";

describe("findConflicts", () => {
  let root: string;
  let stagingPath: string;
  let gamePath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-conflicts-"));
    stagingPath = path.join(root, "staging");
    gamePath = path.join(root, "game");
    fs.mkdirSync(gamePath, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const addMod = (id: string, files: string[]): types.IMod => {
    for (const file of files) {
      const full = path.join(stagingPath, id, file);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, id);
    }
    return {
      id,
      type: "",
      state: "installed",
      installationPath: id,
      attributes: { name: id },
    } as types.IMod;
  };

  // a game as built for tier 0: no mergeMods
  const makeGame = (mergeMods?: boolean): types.IGame =>
    ({
      id: GAME_ID,
      mergeMods,
      getModPaths: () => ({ "": gamePath }),
    }) as unknown as types.IGame;

  const makeApi = (): types.IExtensionApi =>
    ({
      getState: () => ({
        settings: { gameMode: { discovered: { [GAME_ID]: { path: gamePath } } } },
      }),
    }) as unknown as types.IExtensionApi;

  it("finds a file shared by two mods when the game has no mergeMods", async () => {
    const mods = [addMod("a", ["shared.txt", "only-a.txt"]), addMod("b", ["shared.txt"])];

    const conflicts = await findConflicts(makeApi(), makeGame(), stagingPath, mods, undefined);

    expect(conflicts["a"]?.map((conflict) => conflict.otherMod.id)).toEqual(["b"]);
    expect(conflicts["b"]?.map((conflict) => conflict.otherMod.id)).toEqual(["a"]);
  });

  it("finds the same conflict when mergeMods is set explicitly", async () => {
    const mods = [addMod("a", ["shared.txt"]), addMod("b", ["shared.txt"])];

    const conflicts = await findConflicts(makeApi(), makeGame(true), stagingPath, mods, undefined);

    expect(Object.keys(conflicts).sort()).toEqual(["a", "b"]);
  });

  it("reports no conflict for mods with different files", async () => {
    const mods = [addMod("a", ["a.txt"]), addMod("b", ["b.txt"])];

    const conflicts = await findConflicts(makeApi(), makeGame(), stagingPath, mods, undefined);

    expect(conflicts).toEqual({});
  });
});
