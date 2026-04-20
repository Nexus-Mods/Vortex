import { describe, expect, it } from "vitest";

import { generateConfig, parseConfig } from "./index";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeGeneratorProps = (collectionConfig?: Record<string, any>): any => ({
  collectionMod: {
    attributes: collectionConfig ? { collection: { collectionConfig } } : {},
  },
});

const makeParserProps = (
  collection: Record<string, any> = {},
  gameId = "skyrimse",
): any => ({
  collection,
  gameId,
});

// ---------------------------------------------------------------------------
// generateConfig
// ---------------------------------------------------------------------------

describe("generateConfig", () => {
  it("returns default config when collectionMod has no config", async () => {
    const result = await generateConfig(makeGeneratorProps());

    expect(result).toEqual({ recommendNewProfile: false });
  });

  it("returns stored config from collectionMod attributes", async () => {
    const result = await generateConfig(
      makeGeneratorProps({ recommendNewProfile: true }),
    );

    expect(result.recommendNewProfile).toBe(true);
  });

  it("returns a copy, not a reference to the original", async () => {
    const config = { recommendNewProfile: true };
    const result = await generateConfig(makeGeneratorProps(config));

    expect(result).not.toBe(config);
    expect(result).toEqual(config);
  });
});

// ---------------------------------------------------------------------------
// parseConfig
// ---------------------------------------------------------------------------

describe("parseConfig", () => {
  it("returns default config when collection has no config", async () => {
    const result = await parseConfig(makeParserProps());

    expect(result).toEqual({ recommendNewProfile: false });
  });

  it("returns config from collection data", async () => {
    const result = await parseConfig(
      makeParserProps({ collectionConfig: { recommendNewProfile: true } }),
    );

    expect(result.recommendNewProfile).toBe(true);
  });
});
