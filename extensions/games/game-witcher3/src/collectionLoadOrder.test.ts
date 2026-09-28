import { types } from "@nexusmods/vortex-api";
import { describe, expect, it } from "vitest";

import { genCollectionLoadOrder } from "./collectionLoadOrder";

const entry = (modId: string, prefix: number): types.IFBLOLoadOrderEntry => ({
  id: modId,
  modId,
  name: modId,
  enabled: true,
  data: { prefix },
});

const mod = (id: string, type = ""): types.IMod => ({
  id,
  type,
  state: "installed",
  installationPath: id,
  attributes: {},
});

// key: mod id
const mods = (...ids: string[]): Record<string, types.IMod> =>
  Object.fromEntries(ids.map((id) => [id, mod(id)]));

const modIds = (loadOrder: types.LoadOrder) => loadOrder.map((item) => item.modId);

describe("genCollectionLoadOrder", () => {
  it("keeps the load order in the order the entries arrive in", () => {
    // data.prefix is only refreshed on deploy, so an entry moved on the load
    // order page still carries the prefix it had in its old position.
    const loadOrder = [entry("modA", 3), entry("modB", 1), entry("modC", 2)];

    const result = genCollectionLoadOrder(loadOrder, mods("modA", "modB", "modC"));

    expect(modIds(result)).toEqual(["modA", "modB", "modC"]);
  });

  it("keeps locked entries that have no corresponding mod", () => {
    const loadOrder = [entry("mod0000____CompilationTrigger", 1), entry("modA", 2)];

    const result = genCollectionLoadOrder(loadOrder, mods("modA"));

    expect(modIds(result)).toEqual(["mod0000____CompilationTrigger", "modA"]);
  });

  it("drops entries whose mod is not managed", () => {
    const loadOrder = [entry("modA", 1), entry("modGone", 2), entry("modB", 3)];

    const result = genCollectionLoadOrder(loadOrder, mods("modA", "modB"));

    expect(modIds(result)).toEqual(["modA", "modB"]);
  });

  it("drops collections", () => {
    const loadOrder = [entry("modA", 1), entry("someCollection", 2)];
    const available = mods("modA");
    available.someCollection = mod("someCollection", "collection");

    const result = genCollectionLoadOrder(loadOrder, available);

    expect(modIds(result)).toEqual(["modA"]);
  });

  it("carries the prefix through untouched", () => {
    const loadOrder = [entry("modA", 7)];

    const result = genCollectionLoadOrder(loadOrder, mods("modA"));

    expect(result[0].data.prefix).toBe(7);
  });
});
