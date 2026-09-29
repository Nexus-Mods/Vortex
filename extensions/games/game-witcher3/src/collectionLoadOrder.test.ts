import { types } from "@nexusmods/vortex-api";
import { describe, expect, it } from "vitest";

import { genCollectionLoadOrder, withPositionPrefix } from "./collectionLoadOrder";

const entry = (modId: string): types.IFBLOLoadOrderEntry => ({
  id: modId,
  modId,
  name: modId,
  enabled: true,
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
    const loadOrder = [entry("modC"), entry("modA"), entry("modB")];

    const result = genCollectionLoadOrder(loadOrder, mods("modA", "modB", "modC"));

    expect(modIds(result)).toEqual(["modC", "modA", "modB"]);
  });

  it("keeps locked entries that have no corresponding mod", () => {
    const loadOrder = [entry("mod0000____CompilationTrigger"), entry("modA")];

    const result = genCollectionLoadOrder(loadOrder, mods("modA"));

    expect(modIds(result)).toEqual(["mod0000____CompilationTrigger", "modA"]);
  });

  it("drops entries whose mod is not managed", () => {
    const loadOrder = [entry("modA"), entry("modGone"), entry("modB")];

    const result = genCollectionLoadOrder(loadOrder, mods("modA", "modB"));

    expect(modIds(result)).toEqual(["modA", "modB"]);
  });

  it("drops collections", () => {
    const loadOrder = [entry("modA"), entry("someCollection")];
    const available = mods("modA");
    available.someCollection = mod("someCollection", "collection");

    const result = genCollectionLoadOrder(loadOrder, available);

    expect(modIds(result)).toEqual(["modA"]);
  });

  it("numbers the exported entries by their position", () => {
    const loadOrder = [entry("modC"), entry("modGone"), entry("modA")];

    const result = genCollectionLoadOrder(loadOrder, mods("modA", "modC"));

    expect(result.map((item) => item.data.prefix)).toEqual([0, 1]);
  });
});

describe("withPositionPrefix", () => {
  it("replaces any existing prefix with the entry's position and keeps other data", () => {
    const result = withPositionPrefix([
      { ...entry("modA"), data: { prefix: "41", other: true } },
      entry("modB"),
    ]);

    expect(result.map((item) => item.data)).toEqual([{ prefix: 0, other: true }, { prefix: 1 }]);
  });
});
