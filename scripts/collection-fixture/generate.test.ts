import { describe, expect, it } from "vitest";

import { parseArgs, sizeFromArgs, specFromArgs } from "./generate";
import { DEFAULT_COLLECTION_SHARE, TIERS } from "./tiers";

const size = (...argv: string[]) => sizeFromArgs(parseArgs(argv));

describe("sizeFromArgs", () => {
  it("defaults to the typical tier split by the default collection share", () => {
    const typical = TIERS.typical;
    const members = Math.round(typical.total * DEFAULT_COLLECTION_SHARE);
    expect(size()).toEqual({
      members,
      library: typical.total - members,
      enabled: typical.enabled,
      tier: "typical",
    });
  });

  it("takes every tier's total and enabled figures from the benchmark specification", () => {
    for (const tier of Object.values(TIERS)) {
      const result = size("--tier", tier.id);
      expect(result.members + result.library).toBe(tier.total);
      expect(result.enabled).toBe(tier.enabled);
    }
    expect(size("--tier", "power")).toMatchObject({ enabled: 1221 });
    expect(size("--tier", "heavy").members + size("--tier", "heavy").library).toBe(570);
  });

  it("puts the whole tier in the collection with a share of 1", () => {
    expect(size("--tier", "heavy", "--collection-share", "1")).toMatchObject({
      members: 570,
      library: 0,
    });
  });

  it("lets explicit counts override the tier's split", () => {
    expect(size("--tier", "typical", "--members", "100", "--enabled", "90")).toEqual({
      members: 100,
      library: 50,
      enabled: 90,
      tier: "typical",
    });
  });

  it("uses exactly the counts given when there is no tier", () => {
    expect(size("--members", "400", "--library", "100")).toEqual({
      members: 400,
      library: 100,
      enabled: 435,
    });
  });

  it("rejects an unknown tier and an out-of-range share", () => {
    expect(() => size("--tier", "huge")).toThrow("--tier must be one of");
    expect(() => size("--collection-share", "0")).toThrow("--collection-share");
    expect(() => size("--collection-share", "1.5")).toThrow("--collection-share");
  });
});

describe("specFromArgs", () => {
  it("defaults to Skyrim Special Edition and names the collection after the tier", () => {
    const spec = specFromArgs(parseArgs(["--out", "fixture-out"]));
    expect(spec.game).toBe("skyrimse");
    expect(spec.tier).toBe("typical");
    expect(spec.collectionName).toBe("Fixture Collection skyrimse typical");
  });
});
