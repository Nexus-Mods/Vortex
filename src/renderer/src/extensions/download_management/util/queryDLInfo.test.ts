import Bluebird from "bluebird";
import { describe, expect, it, vi } from "vitest";

// Regression test for https://github.com/Nexus-Mods/Vortex/issues/21979
//
// An md5 lookup is game-agnostic. A shared third-party dependency (BepInEx, a
// config manager, a mod loader) that another author re-uploaded to Nexus for a
// different game is byte-identical, so the lookup matches and hands back that
// foreign mod's record - complete with an `nxm://` sourceURI. queryDLInfo used
// to stamp `source: 'nexus'` plus the foreign mod/file/game ids onto the
// download and move it to the foreign game, and the update check then queried
// an unrelated mod.
//
// The fix: hits are scoped to the domains the download is filed under before
// the match ladder runs, so a foreign-domain record is never a candidate.

const games: { [id: string]: any } = {};
vi.mock("../../gamemode_management/selectors", () => ({
  knownGames: () => Object.values(games),
  gameById: (_state: any, id: string) => games[id],
}));
vi.mock("../../profile_management/selectors", () => ({
  activeGameId: () => "hollowknightsilksong",
}));
vi.mock("../../../util/log", () => ({ log: vi.fn() }));

import { downloadDomains, queryInfoInternal, scopeToDomains } from "./queryDLInfo";

const DL_ID = "dl-1";

const hit = (domainName: string, sourceURI: string, fileName = "ConfigurationManager.zip") =>
  ({
    key: sourceURI,
    value: { gameId: domainName, domainName, fileName, sourceURI, source: "nexus" },
  }) as any;

// the record an md5 lookup returns for a re-uploaded copy: real Nexus mod, wrong game
const foreignHit = hit("megastoresimulator", "nxm://megastoresimulator/mods/7/files/123");
const ownHit = hit("hollowknightsilksong", "nxm://hollowknightsilksong/mods/50/files/200");

function run(lookupResults: any[], dlModInfo: any = undefined, dlGames = ["hollowknightsilksong"]) {
  const dispatched: any[] = [];
  const emitted: Array<{ event: string; args: any[] }> = [];

  const dl = {
    game: dlGames,
    fileMD5: "abc123",
    size: 4096,
    localPath: "ConfigurationManager.zip",
    modInfo: dlModInfo,
  };
  const state = { persistent: { downloads: { files: { [DL_ID]: dl } } } };

  const api: any = {
    store: {
      getState: () => state,
      dispatch: (action: any) => {
        dispatched.push(action);
        return action;
      },
    },
    getState: () => state,
    lookupModMeta: () => Bluebird.resolve(lookupResults),
    emitAndAwait: (event: string, ...args: any[]) => {
      emitted.push({ event, args });
      return Promise.resolve([]);
    },
  };

  return Bluebird.resolve(queryInfoInternal(api, DL_ID, false)).then(() => {
    // batchDispatch wraps the setDownloadModInfo actions in a single batch action
    const infoSets = dispatched
      .flatMap((a: any) => (Array.isArray(a?.payload) ? a.payload : [a]))
      .filter((a: any) => a?.type === "SET_DOWNLOAD_MODINFO")
      .map((a: any) => a.payload as { key: string; value: any });
    return { infoSets, emitted };
  });
}

const keys = (infoSets: Array<{ key: string }>) => infoSets.map((s) => s.key);
const valueOf = (infoSets: Array<{ key: string; value: any }>, key: string) =>
  infoSets.find((s) => s.key === key)?.value;

describe("downloadDomains", () => {
  it("maps each game to its nexus domain and always allows 'site'", () => {
    games.somegame = { id: "somegame", details: { nexusPageId: "some-game-page" } };
    try {
      expect(downloadDomains({} as any, ["somegame", "skyrimvr"])).toEqual(
        new Set(["some-game-page", "skyrimspecialedition", "site"]),
      );
    } finally {
      delete games.somegame;
    }
  });

  it("falls back to the raw id for a game Vortex does not know", () => {
    expect(downloadDomains({} as any, ["hollowknightsilksong"])).toEqual(
      new Set(["hollowknightsilksong", "site"]),
    );
  });
});

describe("scopeToDomains", () => {
  it("drops hits from other domains and keeps domain-less (non-nexus meta server) hits", () => {
    const noDomain = {
      key: "x",
      value: { fileName: "a.zip", sourceURI: "https://example.com" },
    } as any;
    expect(
      scopeToDomains([foreignHit, ownHit, noDomain], new Set(["hollowknightsilksong"])),
    ).toEqual([ownHit, noDomain]);
  });
});

describe("queryInfoInternal metadata stamping (#21979)", () => {
  it("stamps nothing when the only md5 hit is a re-upload on another game's page", async () => {
    const { infoSets, emitted } = await run([foreignHit]);

    expect(infoSets).toEqual([]);
    expect(emitted.find((e) => e.event === "set-download-games")).toBeUndefined();
  });

  it("stamps nexus identity for a hit on the download's own game", async () => {
    const { infoSets, emitted } = await run([ownHit]);

    expect(valueOf(infoSets, "source")).toBe("nexus");
    expect(valueOf(infoSets, "nexus.ids.modId")).toBe(50);
    expect(valueOf(infoSets, "nexus.ids.fileId")).toBe(200);
    expect(valueOf(infoSets, "nexus.ids.gameId")).toBe("hollowknightsilksong");
    expect(emitted.find((e) => e.event === "set-download-games")).toBeUndefined();
  });

  it("prefers the own-game hit even when the foreign one has the exact filename", async () => {
    const renamedOwn = hit(
      "hollowknightsilksong",
      "nxm://hollowknightsilksong/mods/50/files/200",
      "renamed-by-user.zip",
    );
    const { infoSets } = await run([foreignHit, renamedOwn]);

    expect(valueOf(infoSets, "nexus.ids.modId")).toBe(50);
  });

  it("accepts a hit on the shared domain of a compatible-download game", async () => {
    const sseHit = hit("skyrimspecialedition", "nxm://skyrimspecialedition/mods/1/files/2");
    const { infoSets } = await run([sseHit], undefined, ["skyrimse", "skyrimvr"]);

    expect(valueOf(infoSets, "nexus.ids.modId")).toBe(1);
  });

  it("accepts a hit on 'site' and files the download there", async () => {
    const siteHit = hit("site", "nxm://site/mods/876/files/5");
    const { infoSets, emitted } = await run([siteHit]);

    expect(valueOf(infoSets, "nexus.ids.gameId")).toBe("site");
    const move = emitted.find((e) => e.event === "set-download-games");
    expect(move?.args[1]).toEqual(["site", "hollowknightsilksong"]);
  });

  it("still honours the pre-existing fileId-mismatch guard for a real nexus download", async () => {
    const { infoSets } = await run([ownHit], { nexus: { ids: { fileId: 999 } } });

    // server handed back data for a different file than we downloaded - ignore all of it
    expect(keys(infoSets)).toContain("meta");
    expect(keys(infoSets)).not.toContain("source");
    expect(keys(infoSets).some((k) => k.startsWith("nexus.ids."))).toBe(false);
  });

  it("marks a non-nexus meta-server hit as source 'unknown' (unchanged catch branch)", async () => {
    const metaServerHit = {
      key: "m",
      value: { fileName: "ConfigurationManager.zip", sourceURI: "https://example.com/not-nxm" },
    } as any;
    const { infoSets } = await run([metaServerHit]);

    expect(valueOf(infoSets, "source")).toBe("unknown");
  });
});
