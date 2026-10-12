import { types } from "@nexusmods/vortex-api";
import { describe, expect, it } from "vitest";

import { LOCKED_PREFIX } from "./common";
import { sortLoadOrderAlphabetically } from "./loadOrderSort";

const entry = (modId: string): types.IFBLOLoadOrderEntry => ({
  id: modId,
  modId,
  name: modId,
  enabled: true,
});
const entries = (...ids: string[]) => ids.map(entry);
const ids = (loadOrder: types.LoadOrder) => loadOrder.map((item) => item.id);

describe("sortLoadOrderAlphabetically", () => {
  it("orders mods by folder name, ignoring case", () => {
    const sorted = sortLoadOrderAlphabetically(entries("modB", "moda", "ModC"));

    expect(ids(sorted)).toEqual(["moda", "modB", "ModC"]);
  });

  it("orders digits before underscores", () => {
    const sorted = sortLoadOrderAlphabetically(entries("mod_Beta", "mod0Alpha"));

    expect(ids(sorted)).toEqual(["mod0Alpha", "mod_Beta"]);
  });

  it("orders digits, then underscores, then letters, then tildes", () => {
    const sorted = sortLoadOrderAlphabetically(entries("mod~x", "modAx", "mod_x", "mod0x"));

    expect(ids(sorted)).toEqual(["mod0x", "mod_x", "modAx", "mod~x"]);
  });

  it("keeps locked entries at the top in their existing order", () => {
    const sorted = sortLoadOrderAlphabetically(
      entries("modB", `${LOCKED_PREFIX}Merged`, "modA", `${LOCKED_PREFIX}Compilation`),
    );

    expect(ids(sorted)).toEqual([
      `${LOCKED_PREFIX}Merged`,
      `${LOCKED_PREFIX}Compilation`,
      "modA",
      "modB",
    ]);
  });

  it("stamps each entry with its new position", () => {
    const sorted = sortLoadOrderAlphabetically(entries("modB", "modA"));

    expect(sorted.map((item) => item.data?.prefix)).toEqual([0, 1]);
  });
});
