import { describe, expect, it, vi } from "vitest";

import type { IMod, IModAttributes, IModRule } from "../types/IMod";
import { collectionNamesByMod } from "./collectionMembership";

vi.mock("../../../util/log", () => ({
  log: vi.fn(),
}));

const createMod = (id: string, attributes: IModAttributes, extra: Partial<IMod> = {}): IMod => ({
  id,
  state: "installed",
  type: "",
  installationPath: `mods/${id}`,
  attributes,
  ...extra,
});

const requiresRule = (fileMD5: string): IModRule => ({
  type: "requires",
  reference: { fileMD5 },
});

const createCollection = (id: string, name: string, rules: IModRule[]): IMod =>
  createMod(id, { customFileName: name }, { type: "collection", rules });

const toMap = (...mods: IMod[]) =>
  mods.reduce<{ [modId: string]: IMod }>((prev, mod) => ({ ...prev, [mod.id]: mod }), {});

describe("collectionNamesByMod", () => {
  const memberA = createMod("member-a", { fileMD5: "md5-a", fileName: "a.7z" });
  const memberB = createMod("member-b", { fileMD5: "md5-b", fileName: "b.7z" });
  const standalone = createMod("standalone", { fileMD5: "md5-x", fileName: "x.7z" });

  it("returns nothing when no collection is installed", () => {
    const mods = toMap(memberA, standalone);

    expect(collectionNamesByMod(mods, ["member-a", "standalone"])).toEqual({});
  });

  it("names the collection a mod belongs to", () => {
    const collection = createCollection("col-1", "Immersive and Adult", [requiresRule("md5-a")]);
    const mods = toMap(collection, memberA, standalone);

    expect(collectionNamesByMod(mods, ["member-a", "standalone"])).toEqual({
      "member-a": ["Immersive and Adult"],
    });
  });

  it("lists every collection a mod belongs to", () => {
    const first = createCollection("col-1", "First", [requiresRule("md5-a")]);
    const second = createCollection("col-2", "Second", [requiresRule("md5-a")]);
    const mods = toMap(first, second, memberA);

    expect(collectionNamesByMod(mods, ["member-a"])).toEqual({
      "member-a": ["First", "Second"],
    });
  });

  it("counts recommended members as part of the collection", () => {
    const collection = createCollection("col-1", "Optional Pack", [
      { type: "recommends", reference: { fileMD5: "md5-b" } },
    ]);
    const mods = toMap(collection, memberB);

    expect(collectionNamesByMod(mods, ["member-b"])).toEqual({ "member-b": ["Optional Pack"] });
  });

  it("ignores rules that do not add a mod", () => {
    const collection = createCollection("col-1", "Ordering Only", [
      { type: "before", reference: { fileMD5: "md5-a" } },
    ]);
    const mods = toMap(collection, memberA);

    expect(collectionNamesByMod(mods, ["member-a"])).toEqual({});
  });

  it("only reports the requested mods", () => {
    const collection = createCollection("col-1", "Pack", [
      requiresRule("md5-a"),
      requiresRule("md5-b"),
    ]);
    const mods = toMap(collection, memberA, memberB);

    expect(collectionNamesByMod(mods, ["member-b"])).toEqual({ "member-b": ["Pack"] });
  });

  it("never reports a collection mod itself", () => {
    const collection = createCollection("col-1", "Pack", [requiresRule("md5-a")]);
    const mods = toMap(collection, memberA);

    expect(collectionNamesByMod(mods, ["col-1"])).toEqual({});
  });

  it("skips ids that are not installed", () => {
    const collection = createCollection("col-1", "Pack", [requiresRule("md5-a")]);
    const mods = toMap(collection, memberA);

    expect(collectionNamesByMod(mods, ["missing"])).toEqual({});
  });
});
