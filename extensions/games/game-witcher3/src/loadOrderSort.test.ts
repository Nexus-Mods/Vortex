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
