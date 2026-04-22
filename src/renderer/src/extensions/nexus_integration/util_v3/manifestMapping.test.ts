import type { ICollectionManifest } from "@nexusmods/nexus-api";

import { describe, it, expect } from "vitest";

import { toV3CollectionPayload } from "./manifestMapping";

const makeManifest = (
  overrides: Partial<ICollectionManifest> = {},
): ICollectionManifest => ({
  info: overrides.info ?? {
    author: "TestAuthor",
    authorUrl: "https://nexusmods.com/users/123",
    name: "Test Collection",
    description: "A test collection",
    summary: "Test summary",
    domainName: "skyrimspecialedition",
    gameVersions: ["1.6.640"],
  },
  mods: overrides.mods ?? [
    {
      name: "Test Mod",
      version: "1.0.0",
      optional: false,
      domainName: "skyrimspecialedition",
      source: {
        type: "nexus",
        modId: 12345,
        fileId: 67890,
        md5: "abc123",
        fileSize: 1024,
        updatePolicy: "exact",
        logicalFilename: "testmod",
        fileExpression: "testmod-{version}.zip",
      },
      author: "ModAuthor",
    },
  ],
});

describe("toV3CollectionPayload", () => {
  it("converts info fields from camelCase to snake_case", () => {
    const manifest = makeManifest();
    const payload = toV3CollectionPayload(manifest);

    expect(payload.collection_manifest.info).toEqual({
      author: "TestAuthor",
      author_url: "https://nexusmods.com/users/123",
      name: "Test Collection",
      description: "A test collection",
      summary: "Test summary",
      domain_name: "skyrimspecialedition",
      game_versions: ["1.6.640"],
    });
  });

  it("converts mod fields from camelCase to snake_case", () => {
    const manifest = makeManifest();
    const payload = toV3CollectionPayload(manifest);

    expect(payload.collection_manifest.mods).toHaveLength(1);
    expect(payload.collection_manifest.mods[0]).toEqual({
      name: "Test Mod",
      version: "1.0.0",
      optional: false,
      domain_name: "skyrimspecialedition",
      source: {
        type: "nexus",
        mod_id: "12345",
        file_id: "67890",
        md5: "abc123",
        file_size: 1024,
        update_policy: "exact",
        logical_filename: "testmod",
        file_expression: "testmod-{version}.zip",
        url: null,
        adult_content: null,
      },
      author: "ModAuthor",
    });
  });

  it("converts mod_id and file_id to strings", () => {
    const manifest = makeManifest();
    const payload = toV3CollectionPayload(manifest);
    const source = payload.collection_manifest.mods[0].source;

    expect(typeof source.mod_id).toBe("string");
    expect(typeof source.file_id).toBe("string");
  });

  it("defaults adult_content to false", () => {
    const manifest = makeManifest();
    expect(toV3CollectionPayload(manifest).adult_content).toBe(false);
  });

  it("passes through adult_content when specified", () => {
    const manifest = makeManifest();
    expect(toV3CollectionPayload(manifest, true).adult_content).toBe(true);
    expect(toV3CollectionPayload(manifest, false).adult_content).toBe(false);
  });

  it("sets collection_schema_id to 1", () => {
    const manifest = makeManifest();
    const payload = toV3CollectionPayload(manifest);

    expect(payload.collection_schema_id).toBe(1);
  });

  it("handles missing optional fields with null", () => {
    const manifest = makeManifest({
      info: {
        author: "Author",
        name: "Name",
        domainName: "skyrim",
      },
      mods: [
        {
          name: "Mod",
          version: "1.0",
          optional: true,
          domainName: "skyrim",
          source: {
            type: "direct",
            url: "https://example.com/mod.zip",
          },
        },
      ],
    });

    const payload = toV3CollectionPayload(manifest);
    const info = payload.collection_manifest.info;

    expect(info.author_url).toBeNull();
    expect(info.description).toBeNull();
    expect(info.summary).toBeNull();
    expect(info.game_versions).toBeNull();

    const source = payload.collection_manifest.mods[0].source;
    expect(source.mod_id).toBeNull();
    expect(source.file_id).toBeNull();
    expect(source.md5).toBeNull();
    expect(source.file_size).toBeNull();
  });

  it("handles all source types", () => {
    const sourceTypes = ["nexus", "direct", "browse", "manual"] as const;

    for (const type of sourceTypes) {
      const manifest = makeManifest({
        mods: [
          {
            name: "Mod",
            version: "1.0",
            optional: false,
            domainName: "skyrim",
            source: { type },
          },
        ],
      });
      const payload = toV3CollectionPayload(manifest);
      expect(payload.collection_manifest.mods[0].source.type).toBe(type);
    }
  });

  it("handles multiple mods", () => {
    const manifest = makeManifest({
      mods: [
        {
          name: "Mod A",
          version: "1.0",
          optional: false,
          domainName: "skyrim",
          source: { type: "nexus", modId: 1, fileId: 2 },
        },
        {
          name: "Mod B",
          version: "2.0",
          optional: true,
          domainName: "fallout4",
          source: { type: "direct", url: "https://example.com" },
        },
      ],
    });

    const payload = toV3CollectionPayload(manifest);
    expect(payload.collection_manifest.mods).toHaveLength(2);
    expect(payload.collection_manifest.mods[0].name).toBe("Mod A");
    expect(payload.collection_manifest.mods[1].name).toBe("Mod B");
    expect(payload.collection_manifest.mods[1].domain_name).toBe("fallout4");
  });

  it("handles mod with no author", () => {
    const manifest = makeManifest({
      mods: [
        {
          name: "Mod",
          version: "1.0",
          optional: false,
          domainName: "skyrim",
          source: { type: "nexus" },
        },
      ],
    });

    const payload = toV3CollectionPayload(manifest);
    expect(payload.collection_manifest.mods[0].author).toBeNull();
  });
});
