import Bluebird from "bluebird";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for https://github.com/Nexus-Mods/Vortex/issues/21979
//
// An md5 lookup is game-agnostic. A shared third-party dependency (BepInEx, a
// config manager, a mod loader) that another author re-uploaded to Nexus for a
// different game is byte-identical, so the lookup matches and hands back that
// foreign mod's record - complete with an `nxm://` sourceURI. queryDLInfo used
// to stamp `source: 'nexus'` plus the foreign mod/file/game ids onto the
// download unconditionally, and the update check then queried an unrelated mod.
//
// The fix: if an extension (or a non-Nexus downloader) already declared where
// the file came from, that wins over the md5 guess.

const metaLookupMatch = vi.fn();
vi.mock("../../mod_management/util/metaLookupMatch", () => ({
  default: (...args: any[]) => metaLookupMatch(...args),
}));
vi.mock("../../gamemode_management/selectors", () => ({ knownGames: () => [] }));
vi.mock("../../profile_management/selectors", () => ({
  activeGameId: () => "hollowknightsilksong",
}));
vi.mock("../../../util/log", () => ({ log: vi.fn() }));

import { queryInfoInternal } from "./queryDLInfo";

const DL_ID = "dl-1";
const FOREIGN_SOURCE_URI = "nxm://megastoresimulator/mods/7/files/123";

// the record an md5 lookup returns for a re-uploaded copy: real Nexus mod, wrong game
const foreignMatch = {
  value: {
    gameId: "megastoresimulator",
    domainName: "megastoresimulator",
    fileName: "ConfigurationManager.zip",
    sourceURI: FOREIGN_SOURCE_URI,
    source: "nexus",
  },
};

function run(dlModInfo: any) {
  const dispatched: any[] = [];
  const emitted: Array<{ event: string; args: any[] }> = [];

  const dl = {
    game: ["hollowknightsilksong"],
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
    lookupModMeta: () => Bluebird.resolve([foreignMatch] as any),
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

describe("queryInfoInternal metadata stamping (#21979)", () => {
  beforeEach(() => {
    metaLookupMatch.mockReset();
    metaLookupMatch.mockReturnValue(foreignMatch);
  });

  it("keeps an extension-declared source and skips the nexus stamping on an md5 hit", async () => {
    const { infoSets, emitted } = await run({ source: "website" });

    // the looked-up description/author blob is still recorded
    expect(keys(infoSets)).toContain("meta");
    // but none of the nexus identity is
    expect(keys(infoSets)).not.toContain("source");
    expect(keys(infoSets).some((k) => k.startsWith("nexus.ids."))).toBe(false);
    // and the download is not moved to the foreign game
    expect(emitted.find((e) => e.event === "set-download-games")).toBeUndefined();
  });

  it("still stamps nexus identity when no source was declared", async () => {
    const { infoSets, emitted } = await run(undefined);

    const bySource = infoSets.find((s) => s.key === "source");
    expect(bySource?.value).toBe("nexus");
    expect(infoSets.find((s) => s.key === "nexus.ids.modId")?.value).toBe(7);
    expect(infoSets.find((s) => s.key === "nexus.ids.fileId")?.value).toBe(123);
    expect(infoSets.find((s) => s.key === "nexus.ids.gameId")?.value).toBe("megastoresimulator");
    // gameId (silksong) != resolved game (megastoresimulator), so the move fires
    expect(emitted.find((e) => e.event === "set-download-games")).toBeDefined();
  });

  it("still honours the pre-existing fileId-mismatch guard for a real nexus download", async () => {
    const { infoSets } = await run({ nexus: { ids: { fileId: 999 } } });

    // server handed back data for a different file than we downloaded - ignore all of it
    expect(keys(infoSets)).toContain("meta");
    expect(keys(infoSets)).not.toContain("source");
    expect(keys(infoSets).some((k) => k.startsWith("nexus.ids."))).toBe(false);
  });

  // A collection that lists a shared loader (BepInEx, a config manager) as a *Nexus*
  // dependency downloads the correct file from the correct nxm link, so `source` is
  // legitimately 'nexus' and the new guard above must not fire. What catches the md5
  // collision here is the pre-existing fileId-mismatch guard: the download carries the
  // real fileId, the foreign record names a different one. The download must come out
  // with its own identity intact - anything else re-points the member at a foreign mod.
  it("leaves a collection's nexus dependency alone when its md5 collides", async () => {
    const { infoSets, emitted } = await run({
      source: "nexus",
      nexus: {
        ids: { modId: 42, fileId: 555 },
        // InstallManager.downloadURL tags collection members with the parent, and
        // nxm-resolve stamps modId/fileId but no gameId
        parentCollectionId: 900,
        parentRevisionId: 901,
      },
    });

    expect(keys(infoSets)).toContain("meta");
    expect(keys(infoSets)).not.toContain("source");
    expect(keys(infoSets).some((k) => k.startsWith("nexus.ids."))).toBe(false);
    expect(emitted.find((e) => e.event === "set-download-games")).toBeUndefined();
  });

  it("marks a non-nexus meta-server hit as source 'unknown' (unchanged catch branch)", async () => {
    metaLookupMatch.mockReturnValue({
      value: {
        gameId: "megastoresimulator",
        domainName: "megastoresimulator",
        fileName: "ConfigurationManager.zip",
        sourceURI: "https://example.com/not-an-nxm-link",
      },
    });

    const { infoSets } = await run(undefined);

    expect(infoSets.find((s) => s.key === "source")?.value).toBe("unknown");
  });
});
