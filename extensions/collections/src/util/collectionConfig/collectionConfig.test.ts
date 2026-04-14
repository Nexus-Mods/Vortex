import { describe, expect, it } from "vitest";

import { generateConfig, parseConfig } from "./index";

// ---------------------------------------------------------------------------
// generateConfig
// ---------------------------------------------------------------------------

describe("generateConfig", () => {
  it("returns default config when collectionMod has no config", async () => {
    const result = await generateConfig({
      collectionMod: { attributes: {} },
    } as any);

    expect(result).toEqual({ recommendNewProfile: false });
  });

  it("returns stored config from collectionMod attributes", async () => {
    const result = await generateConfig({
      collectionMod: {
        attributes: {
          collection: {
            collectionConfig: { recommendNewProfile: true },
          },
        },
      },
    } as any);

    expect(result.recommendNewProfile).toBe(true);
  });

  it("returns a copy, not a reference to the original", async () => {
    const config = { recommendNewProfile: true };
    const result = await generateConfig({
      collectionMod: {
        attributes: { collection: { collectionConfig: config } },
      },
    } as any);

    expect(result).not.toBe(config);
    expect(result).toEqual(config);
  });
});

// ---------------------------------------------------------------------------
// parseConfig
// ---------------------------------------------------------------------------

describe("parseConfig", () => {
  it("returns default config when collection has no config", async () => {
    const result = await parseConfig({
      collection: {},
      gameId: "skyrimse",
    } as any);

    expect(result).toEqual({ recommendNewProfile: false });
  });

  it("returns config from collection data", async () => {
    const result = await parseConfig({
      collection: {
        collectionConfig: { recommendNewProfile: true },
      },
      gameId: "skyrimse",
    } as any);

    expect(result.recommendNewProfile).toBe(true);
  });
});
