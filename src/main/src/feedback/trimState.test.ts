import { describe, expect, it } from "vitest";

import { ANY, keyPatternFor, TRIMMED_PATHS, trimFeedbackState, type StatePath } from "./trimState";

const exportedState = () => ({
  settings: { interface: { language: "en" } },
  session: {
    extensions: { available: [{ name: "Some extension" }], updateTime: 1 },
    gameMode: { known: [{ id: "skyrimse" }], detectedGames: [{ id: "skyrimse" }] },
    notifications: { notifications: [] },
  },
  persistent: {
    changelogs: { changelogs: [{ version: "2.11.0", text: "Notes" }] },
    history: { historyStacks: { mods: [{ type: "mod-installed" }] } },
    mods: {
      skyrimse: {
        "mod-a": {
          id: "mod-a",
          state: "installed",
          installationPath: "mod-a",
          rules: [{ type: "requires", reference: { description: "A rule's own text" } }],
          attributes: {
            name: "Mod A",
            modId: 1,
            fileId: 2,
            homepage: "https://example.com/mod-a",
            newestVersion: "1.2",
            newestFileId: 3,
            endorsed: "Endorsed",
            author: "Someone",
            uploader: "someone",
            uploaderId: 7,
            uploaderUrl: "https://example.com/users/7",
            uploaderAvatar: "https://example.com/7.png",
            uploadedTimestamp: 1,
            updatedTimestamp: 2,
            allowRating: true,
            description: "The whole mod page",
            shortDescription: "The summary",
            newestChangelog: { changes: ["Fixed"] },
            pictureUrl: "https://example.com/a.png",
          },
        },
      },
    },
    downloads: {
      speed: 0,
      files: {
        "dl-a": {
          state: "finished",
          localPath: "a.zip",
          modInfo: {
            name: "Mod A",
            meta: { details: { description: "From the metadata server" } },
            nexus: {
              ids: { modId: 1, fileId: 2 },
              modInfo: { name: "Mod A", description: "The whole mod page", summary: "The summary" },
              fileInfo: { file_name: "a.zip" },
              revisionInfo: { revisionNumber: 3, modFiles: [{ fileId: 2 }] },
            },
          },
        },
      },
    },
    collections: {
      collections: { abc: { info: { name: "A collection" } } },
      revisions: {
        "357089": {
          timestamp: 1,
          info: { id: 357089, revisionNumber: 3, modFiles: [{ fileId: 2 }] },
        },
      },
    },
  },
});

/** A requirements check's result, as the health check stores it. */
const healthCheckResult = () => ({
  checkId: "requirements",
  status: "warning",
  details: { missing: 2 },
  metadata: { gameId: "skyrimse", modsChecked: 3, modRequirements: { 1: [{ modId: 2 }] } },
});

describe("trimFeedbackState", () => {
  it("drops the lists that are the same for every user", () => {
    const state = exportedState();

    trimFeedbackState(state);

    expect(state.session.extensions).toEqual({ updateTime: 1 });
    expect(state.session.gameMode).toEqual({ detectedGames: [{ id: "skyrimse" }] });
    expect(state.persistent).not.toHaveProperty("changelogs");
  });

  it("drops what a mod copies from its page, and keeps its ids, homepage, update state and rules", () => {
    const state = exportedState();

    trimFeedbackState(state);

    expect(state.persistent.mods.skyrimse["mod-a"]).toEqual({
      id: "mod-a",
      state: "installed",
      installationPath: "mod-a",
      rules: [{ type: "requires", reference: { description: "A rule's own text" } }],
      attributes: {
        name: "Mod A",
        modId: 1,
        fileId: 2,
        homepage: "https://example.com/mod-a",
        newestVersion: "1.2",
        newestFileId: 3,
        endorsed: "Endorsed",
      },
    });
  });

  it("drops what a download caches from Nexus Mods and the metadata server, and keeps its ids", () => {
    const state = exportedState();

    trimFeedbackState(state);

    expect(state.persistent.downloads.files["dl-a"]).toEqual({
      state: "finished",
      localPath: "a.zip",
      modInfo: {
        name: "Mod A",
        nexus: {
          ids: { modId: 1, fileId: 2 },
          revisionInfo: { revisionNumber: 3 },
        },
      },
    });
  });

  it("drops the file list of a cached collection revision, and keeps the collection", () => {
    const state = exportedState();

    trimFeedbackState(state);

    expect(state.persistent.collections).toEqual({
      collections: { abc: { info: { name: "A collection" } } },
      revisions: { "357089": { timestamp: 1, info: { id: 357089, revisionNumber: 3 } } },
    });
  });

  it("drops a rule reference's file list where the rule holds the same list", () => {
    const files = [{ path: "a.esp", md5: "abc" }];
    const state = {
      persistent: {
        mods: {
          skyrimse: {
            collection: {
              rules: [
                {
                  type: "requires",
                  fileList: files,
                  reference: { fileMD5: "m", fileList: [...files] },
                },
                {
                  type: "requires",
                  fileList: files,
                  reference: { fileList: [{ path: "b.esp", md5: "d" }] },
                },
                { type: "requires", reference: { fileList: files } },
                { type: "requires", fileList: files, reference: { fileMD5: "m" } },
                "not a rule",
              ],
            },
          },
        },
      },
    };

    trimFeedbackState(state);

    expect(state.persistent.mods.skyrimse.collection.rules).toEqual([
      { type: "requires", fileList: files, reference: { fileMD5: "m" } },
      { type: "requires", fileList: files, reference: { fileList: [{ path: "b.esp", md5: "d" }] } },
      { type: "requires", reference: { fileList: files } },
      { type: "requires", fileList: files, reference: { fileMD5: "m" } },
      "not a rule",
    ]);
  });

  it("drops an installed mod's file list where a rule holds the same list, and only then", () => {
    const files = [{ path: "a.esp", md5: "abc" }];
    const own = [{ path: "own.esp", md5: "def" }];
    const state = {
      persistent: {
        mods: {
          skyrimse: {
            collection: {
              rules: [{ type: "requires", fileList: files, reference: { fileList: files } }],
            },
            fromCollection: { attributes: { name: "A", fileList: [...files] } },
            other: { attributes: { name: "B", fileList: own } },
          },
        },
      },
    };

    trimFeedbackState(state);

    expect(state.persistent.mods.skyrimse.fromCollection.attributes).toEqual({ name: "A" });
    expect(state.persistent.mods.skyrimse.other.attributes).toEqual({ name: "B", fileList: own });
    expect(state.persistent.mods.skyrimse.collection.rules).toEqual([
      { type: "requires", fileList: files, reference: {} },
    ]);
  });

  it("drops the mod requirements a health check fetched, and keeps the rest of its result", () => {
    const state = {
      session: { healthCheck: { results: { requirements: healthCheckResult() }, lastFullRun: 5 } },
      persistent: { healthCheck: { results: { requirements: healthCheckResult() } } },
    };

    trimFeedbackState(state);

    const trimmed = {
      checkId: "requirements",
      status: "warning",
      details: { missing: 2 },
      metadata: { gameId: "skyrimse", modsChecked: 3 },
    };
    expect(state.session.healthCheck).toEqual({
      results: { requirements: trimmed },
      lastFullRun: 5,
    });
    expect(state.persistent.healthCheck).toEqual({ results: { requirements: trimmed } });
  });

  it("leaves everything else as it was", () => {
    const state = exportedState();

    trimFeedbackState(state);

    expect(state.settings).toEqual({ interface: { language: "en" } });
    expect(state.session.notifications).toEqual({ notifications: [] });
    expect(state.persistent.history).toEqual({
      historyStacks: { mods: [{ type: "mod-installed" }] },
    });
    expect(state.persistent.downloads.speed).toBe(0);
  });

  it.each([
    [{}],
    [{ persistent: null, session: "nope" }],
    [{ persistent: { mods: { skyrimse: { "mod-a": null, "mod-b": { attributes: 5 } } } } }],
    [{ persistent: { downloads: { files: { a: { modInfo: { nexus: null } }, b: 7 } } } }],
    [{ persistent: { collections: { revisions: ["not", "a", "map"] } } }],
  ])("leaves a state of another shape alone (%j)", (state) => {
    const before = JSON.stringify(state);

    expect(() => trimFeedbackState(state)).not.toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });
});

/** Every concrete key path a trimmed path names, with a made-up id for each ANY. */
const concrete = (path: StatePath): string[][] =>
  path.reduce<string[][]>(
    (paths, segment) => {
      const keys = segment === ANY ? ["id.1"] : typeof segment === "string" ? [segment] : segment;
      return paths.flatMap((prefix) => keys.map((key) => [...prefix, key]));
    },
    [[]],
  );

/** An object holding `value` at `keys`. */
const objectWith = (keys: string[], value: unknown): Record<string, unknown> =>
  keys.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<string, unknown>;

describe("TRIMMED_PATHS", () => {
  it.each(TRIMMED_PATHS.map((path) => [concrete(path)[0]!.join("."), path] as const))(
    "leaves out %s the same way as main reads it and as it trims what was read",
    (_name, path) => {
      const pattern = new RegExp(keyPatternFor(path[0], [path]));
      for (const keys of concrete(path)) {
        const key = keys.join("###");
        // the key, what is stored below it, and not a key that only starts the same
        expect(pattern.test(key)).toBe(true);
        expect(pattern.test(`${key}###below`)).toBe(true);
        expect(pattern.test(`${key}Other`)).toBe(false);

        const state = objectWith(keys, "trimmed");
        trimFeedbackState(state);
        expect(JSON.stringify(state)).not.toContain("trimmed");
      }
    },
  );

  it("matches no key of a hive it has no paths for", () => {
    expect(new RegExp(keyPatternFor("settings", TRIMMED_PATHS)).test("settings###window")).toBe(
      false,
    );
  });
});
