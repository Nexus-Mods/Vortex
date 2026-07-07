import { describe, expect, it } from "vitest";

import type { ICollection } from "../../types/ICollection";
import type {
  ICollectionConfig,
  IConfigGeneratorProps,
  IConfigParserProps,
} from "../../types/ICollectionConfig";
import { generateConfig, parseConfig } from "./index";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeGeneratorProps = (collectionConfig?: Record<string, unknown>): IConfigGeneratorProps =>
  ({
    collectionMod: {
      attributes: collectionConfig ? { collection: { collectionConfig } } : {},
    },
  }) as unknown as IConfigGeneratorProps;

const makeParserProps = (
  collection: Partial<Omit<ICollection, "collectionConfig">> & {
    collectionConfig?: Partial<ICollectionConfig>;
  } = {},
  gameId = "skyrimse",
): IConfigParserProps =>
  ({
    collection,
    gameId,
  }) as unknown as IConfigParserProps;

// ---------------------------------------------------------------------------
// generateConfig
// ---------------------------------------------------------------------------

describe("generateConfig", () => {
  it("returns default config when collectionMod has no config", async () => {
    const result = await generateConfig(makeGeneratorProps());

    expect(result).toEqual({
      recommendNewProfile: false,
      excludePluginRules: false,
    });
  });

  it("returns stored config from collectionMod attributes", async () => {
    const result = await generateConfig(makeGeneratorProps({ recommendNewProfile: true }));

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

    expect(result).toEqual({
      recommendNewProfile: false,
      excludePluginRules: false,
    });
  });

  it("returns config from collection data", async () => {
    const result = await parseConfig(
      makeParserProps({ collectionConfig: { recommendNewProfile: true } }),
    );

    expect(result.recommendNewProfile).toBe(true);
  });
});
