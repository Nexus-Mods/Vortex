import { describe, expect, it } from "vitest";

import { makeLoadOrderEntry } from "../../test-utils/builders";
import { loadOrderToPersist } from "./resolveLoadOrder";
import type { LoadOrder } from "./types/types";

// Deliberately not alphabetical, so a reset to disk order is visible in the assertion.
const stored: LoadOrder = [
  makeLoadOrderEntry({ id: "zulu.pak", modId: "mod-zulu" }),
  makeLoadOrderEntry({ id: "alpha.pak", modId: "mod-alpha" }),
];

const ids = (loadOrder: LoadOrder) => loadOrder.map((entry) => entry.id);

describe("loadOrderToPersist", () => {
  it("keeps the stored order when the game reports no entries", () => {
    expect(ids(loadOrderToPersist(stored, undefined))).toEqual(["zulu.pak", "alpha.pak"]);
  });

  it("keeps the stored order when the game reports an empty list", () => {
    expect(ids(loadOrderToPersist(stored, []))).toEqual(["zulu.pak", "alpha.pak"]);
  });

  it("takes the game's order when it reports one", () => {
    const deserialized: LoadOrder = [
      makeLoadOrderEntry({ id: "alpha.pak", modId: "mod-alpha" }),
      makeLoadOrderEntry({ id: "zulu.pak", modId: "mod-zulu" }),
    ];
    expect(ids(loadOrderToPersist(stored, deserialized))).toEqual(["alpha.pak", "zulu.pak"]);
  });

  it("takes the game's order when nothing is stored yet", () => {
    const deserialized: LoadOrder = [makeLoadOrderEntry({ id: "alpha.pak", modId: "mod-alpha" })];
    expect(ids(loadOrderToPersist(undefined, deserialized))).toEqual(["alpha.pak"]);
  });

  it("returns an empty order when neither side has entries", () => {
    expect(loadOrderToPersist(undefined, undefined)).toEqual([]);
  });
});
