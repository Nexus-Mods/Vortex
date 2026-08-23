import { generateKeyPairSync, sign } from "crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadCatalog, versionMatches } from "./catalog";
import type {
  IGameVersionCatalog,
  IGameVersionTransitionProvider,
} from "./types/IGameVersionTransitionProvider";

function provider(publicKey: string): IGameVersionTransitionProvider {
  return {
    id: "test-provider",
    priority: 1,
    supportedGames: ["test-game"],
    supportedStores: ["steam"],
    supportedPlatforms: [process.platform],
    catalog: {
      url: "https://example.invalid/catalog.json",
      trustedKeys: { current: publicKey },
    },
    launchMode: "direct",
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("loadCatalog", () => {
  it("accepts a catalog signed by a trusted Ed25519 key", async () => {
    const keys = generateKeyPairSync("ed25519");
    const catalog: IGameVersionCatalog = {
      schemaVersion: 1,
      providerId: "test-provider",
      games: [],
    };
    const payload = Buffer.from(JSON.stringify(catalog));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          keyId: "current",
          payload: payload.toString("base64"),
          signature: sign(null, payload, keys.privateKey).toString("base64"),
        }),
      }),
    );

    const result = await loadCatalog(
      provider(keys.publicKey.export({ format: "pem", type: "spki" }).toString()),
    );

    expect(result.catalog).toEqual(catalog);
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a modified catalog", async () => {
    const keys = generateKeyPairSync("ed25519");
    const signedPayload = Buffer.from(
      JSON.stringify({ schemaVersion: 1, providerId: "test-provider", games: [] }),
    );
    const modifiedPayload = Buffer.from(
      JSON.stringify({ schemaVersion: 1, providerId: "other-provider", games: [] }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          keyId: "current",
          payload: modifiedPayload.toString("base64"),
          signature: sign(null, signedPayload, keys.privateKey).toString("base64"),
        }),
      }),
    );

    await expect(
      loadCatalog(provider(keys.publicKey.export({ format: "pem", type: "spki" }).toString())),
    ).rejects.toThrow("signature is invalid");
  });
});

describe("versionMatches", () => {
  it("matches canonical versions and aliases without case sensitivity", () => {
    const target = { version: "1.5.97.0", aliases: ["1.5.97"] };

    expect(versionMatches(target, "1.5.97.0")).toBe(true);
    expect(versionMatches(target, " 1.5.97 ")).toBe(true);
    expect(versionMatches(target, "1.6.1170.0")).toBe(false);
  });
});
