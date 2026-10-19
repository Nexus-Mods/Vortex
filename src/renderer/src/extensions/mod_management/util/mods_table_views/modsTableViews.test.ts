import { describe, expect, it, vi } from "vitest";

// Nexus Mods identifies each file, so the update check can say which to update to.
vi.mock("../modSource", () => ({
  getModSource: (id: string) => ({ id, options: { supportsModId: true } }),
}));

import { collectionsByMod } from "../../../collections/util/collectionsByMod";
import type { IModWithState } from "../../types/IModProps";
import { availableViews, groupMods, sharedMods } from "./modsTableViews";

const t = ((key: string) => key) as Parameters<typeof groupMods>[2];

const mod = (id: string, name: string, extra: object = {}) =>
  ({ id, enabled: true, attributes: { name }, ...extra }) as unknown as IModWithState;

const collection = (id: string, name: string, memberIds: string[]) =>
  mod(id, name, {
    type: "collection",
    rules: memberIds.map((memberId) => ({ type: "requires", reference: { id: memberId } })),
  });

// Beta is only Xenon's; Gamma is Xenon's and Yttrium's and Zinc's; Alpha is in none.
const MODS = {
  a: mod("a", "Alpha"),
  b: mod("b", "Beta"),
  c: mod("c", "Gamma"),
  x: collection("x", "Xenon", ["b", "c"]),
  y: collection("y", "Yttrium", ["c"]),
  z: collection("z", "Zinc", ["c"]),
};

const group = (id: string) =>
  groupMods(MODS, "collection", t, collectionsByMod(MODS)).find((g) => g.id === id);

describe("sharedMods", () => {
  it("finds a collection's mods other collections have too, and names those, by name", () => {
    const shared = sharedMods(group("x"), collectionsByMod(MODS));

    expect(shared.rows.map(({ mod }) => mod.id)).toEqual(["c"]);
    expect(shared.collections).toEqual(["Yttrium", "Zinc"]);
  });

  it("counts any collection for a group that isn't one", () => {
    const authorGroup = { id: "author:Ann", label: "Ann", rows: group("x").rows };

    expect(sharedMods(authorGroup, collectionsByMod(MODS)).collections).toEqual([
      "Xenon",
      "Yttrium",
      "Zinc",
    ]);
  });

  it("finds none for the mods in no collection", () => {
    expect(sharedMods(group("no-collection"), collectionsByMod(MODS)).rows).toEqual([]);
  });
});

describe("groupMods by collection", () => {
  const summary = (mods: typeof MODS) =>
    groupMods(mods, "collection", t, collectionsByMod(mods)).map(({ id, rows }) => [
      id,
      rows.map((row) => row.mod.id),
    ]);

  it("groups the mods in no collection first, then each collection's mods, by name", () => {
    expect(summary(MODS)).toEqual([
      ["no-collection", ["a"]],
      ["x", ["b", "c"]],
      ["y", ["c"]],
      ["z", ["c"]],
    ]);
  });

  it("lists a mod once in a collection that requires it twice", () => {
    expect(summary({ ...MODS, y: collection("y", "Yttrium", ["c", "c"]) })).toContainEqual([
      "y",
      ["c"],
    ]);
  });

  it("leaves the mods ungrouped without a collection", () => {
    expect(groupMods({ a: MODS.a }, "collection", t, {})).toBeUndefined();
  });
});

describe("groupMods by a column", () => {
  const category = {
    id: "category",
    header: "Category",
    groupBy: ({ mod }: { mod: IModWithState }) => String(mod.attributes?.category ?? ""),
  };

  const CATEGORISED = {
    a: mod("a", "Alpha", { attributes: { name: "Alpha", category: "Weapons" } }),
    b: mod("b", "Beta", { attributes: { name: "Beta", category: "Armour" } }),
    c: mod("c", "Gamma", { attributes: { name: "Gamma", category: "Weapons" } }),
    d: mod("d", "Delta"),
  };

  it("groups the mods without a value first, then by each value, by name", () => {
    const groups = groupMods(CATEGORISED, "category", t, {}, category);

    expect(groups.map(({ id, label, rows }) => [id, label, rows.map((row) => row.name)])).toEqual([
      ["no-category", "No {{column}}", ["Delta"]],
      ["category:Armour", "Armour", ["Beta"]],
      ["category:Weapons", "Weapons", ["Alpha", "Gamma"]],
    ]);
  });

  it("puts the values a column orders first, in its order, then the rest by name", () => {
    const groups = groupMods(
      CATEGORISED,
      "category",
      t,
      {},
      {
        ...category,
        groupOrder: ["Weapons"],
      },
    );

    expect(groups.map(({ label }) => label)).toEqual(["No {{column}}", "Weapons", "Armour"]);
  });

  it("leaves the mods ungrouped without the column it names", () => {
    expect(groupMods(CATEGORISED, "category", t, {})).toBeUndefined();
    expect(groupMods(CATEGORISED, "none", t, {}, category)).toBeUndefined();
  });
});

describe("availableViews", () => {
  const offersUpdates = (mods: { [id: string]: IModWithState }) =>
    availableViews(mods).some((view) => view.id === "updates");
  const NEXUS = { name: "Alpha", source: "nexus", fileId: 100, version: "1.0" };

  it("offers Updates for an installed mod with an update", () => {
    const a = mod("a", "Alpha", {
      state: "installed",
      attributes: { ...NEXUS, newestVersion: "1.1", newestFileId: 101 },
    });

    expect(offersUpdates({ a })).toBe(true);
  });

  it("doesn't offer Updates for a mod that's only bugged, which has no update", () => {
    const a = mod("a", "Alpha", {
      state: "installed",
      attributes: { ...NEXUS, newestVersion: "1.0", bugMessage: "Broken" },
    });

    expect(offersUpdates({ a })).toBe(false);
  });

  it("offers Updates for a collection with a newer revision", () => {
    const x = mod("x", "Xenon", {
      state: "installed",
      type: "collection",
      attributes: { name: "Xenon", version: "10", newestVersion: "11" },
    });

    expect(offersUpdates({ x })).toBe(true);
  });
});
