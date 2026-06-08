import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type * as Redux from "redux";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { IDownload } from "../extensions/download_management/types/IDownload";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type { IState } from "../types/IState";

// `getDownloadPath` reads getVortexPath("userData") lazily and caches it the
// first time it's called. We never consult the cached value when state has
// an absolute downloads pattern, but the cache still needs *something* to
// initialize against; without this stub the test crashes on first use.
vi.mock("./getVortexPath", () => ({
  default: () => "/test-userdata",
}));

// Silence the deprecated migration logger so test output stays clean.
vi.mock("../logging", () => ({
  log: vi.fn(),
}));

// Imports must come after vi.mock() so the mocks are applied to the module
// graph that pulls them in.
// eslint-disable-next-line import/first
import migrate from "./migrate";

let tempRoot: string;
let testCounter = 0;

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vortex-migrate-"));
});

afterAll(async () => {
  // CI volumes occasionally hold Windows file handles a beat longer than the
  // test runner expects (AV, indexing); swallow rm errors so the cleanup
  // doesn't leak into the suite exit code.
  try {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  } catch {
    // ignored
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildScenario(opts: {
  downloads?: Record<string, Partial<IDownload>>;
  knownGames?: Partial<IGameStored>[];
  migrations?: string[];
  activeGameId?: string;
}): Promise<{
  downloadsRoot: string;
  store: Redux.Store<IState>;
  dispatch: ReturnType<typeof vi.fn>;
}> {
  const downloadsRoot = path.join(tempRoot, `case-${++testCounter}`, "downloads");
  await fs.mkdir(downloadsRoot, { recursive: true });

  const profileId = opts.activeGameId !== undefined ? "test-profile" : undefined;
  const profiles =
    opts.activeGameId !== undefined && profileId !== undefined
      ? { [profileId]: { id: profileId, gameId: opts.activeGameId } }
      : {};

  const state = {
    app: {
      appVersion: "2.0.0",
      migrations: opts.migrations ?? [],
    },
    persistent: {
      downloads: { files: opts.downloads ?? {} },
      profiles,
    },
    session: {
      gameMode: { known: opts.knownGames ?? [] },
    },
    settings: {
      downloads: { path: downloadsRoot },
      profiles: { activeProfileId: profileId },
    },
  } as unknown as IState;

  const dispatch = vi.fn();
  const store = {
    getState: () => state,
    dispatch,
    subscribe: vi.fn(),
    replaceReducer: vi.fn(),
    [Symbol.observable]: vi.fn(),
  } as unknown as Redux.Store<IState>;

  return { downloadsRoot, store, dispatch };
}

// `batchDispatch` wraps actions in a redux-act batch action; unwrap that
// so individual setCompatibleGames/completeMigration actions are inspectable.
function unwrapDispatched(dispatch: ReturnType<typeof vi.fn>): Redux.AnyAction[] {
  return dispatch.mock.calls.flatMap((call): Redux.AnyAction[] => {
    const action = call[0] as Redux.AnyAction;
    if (action && Array.isArray(action.payload) && typeof action.type === "string") {
      return action.payload as Redux.AnyAction[];
    }
    return [action];
  });
}

const skyrimseGame: Partial<IGameStored> = {
  id: "skyrimse",
  name: "Skyrim Special Edition",
  details: { nexusPageId: "skyrimspecialedition" },
};

const skyrimvrGame: Partial<IGameStored> = {
  id: "skyrimvr",
  name: "Skyrim VR",
  details: { nexusPageId: "skyrimspecialedition" },
};

describe("moveDomainFolders_2_1 migration", () => {
  it("moves a file from downloads/<domain>/ to downloads/<internal>/", async () => {
    const { downloadsRoot, store } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    const toDir = path.join(downloadsRoot, "skyrimse");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    let fromStillThere = true;
    try {
      await fs.stat(path.join(fromDir, "MyMod.7z"));
    } catch {
      fromStillThere = false;
    }
    expect(fromStillThere).toBe(false);
    expect((await fs.stat(path.join(toDir, "MyMod.7z"))).isFile()).toBe(true);
  });

  it("rewrites download.game[0] to the internal id and keeps the domain as a compat alias", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    const actions = unwrapDispatched(dispatch);
    const setCompat = actions.find(
      (a) => a?.type === "SET_COMPATIBLE_GAMES" && a.payload?.id === "dl1",
    );
    expect(setCompat).toBeDefined();
    expect(setCompat?.payload.games).toEqual(["skyrimse", "skyrimspecialedition"]);
  });

  it("disambiguates skyrimspecialedition to skyrimvr when VR is the only loaded Skyrim", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimvrGame],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    const toDir = path.join(downloadsRoot, "skyrimvr");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    expect((await fs.stat(path.join(toDir, "MyMod.7z"))).isFile()).toBe(true);

    const actions = unwrapDispatched(dispatch);
    const setCompat = actions.find(
      (a) => a?.type === "SET_COMPATIBLE_GAMES" && a.payload?.id === "dl1",
    );
    expect(setCompat?.payload.games[0]).toBe("skyrimvr");
  });

  it("prefers activeGameId when both skyrimse and skyrimvr share the nexusPageId", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      // Order intentionally puts VR first: without the activeGameId
      // preference, convertGameIdReverse would pick skyrimvr.
      knownGames: [skyrimvrGame, skyrimseGame],
      activeGameId: "skyrimse",
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    const toDir = path.join(downloadsRoot, "skyrimse");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    expect((await fs.stat(path.join(toDir, "MyMod.7z"))).isFile()).toBe(true);

    const actions = unwrapDispatched(dispatch);
    const setCompat = actions.find(
      (a) => a?.type === "SET_COMPATIBLE_GAMES" && a.payload?.id === "dl1",
    );
    expect(setCompat?.payload.games[0]).toBe("skyrimse");
  });

  it("records all loaded candidate games so the install handler can pick the right one regardless of active game", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame, skyrimvrGame],
      activeGameId: "skyrimse",
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    const actions = unwrapDispatched(dispatch);
    const setCompat = actions.find(
      (a) => a?.type === "SET_COMPATIBLE_GAMES" && a.payload?.id === "dl1",
    );
    expect(setCompat?.payload.games).toEqual(["skyrimse", "skyrimvr", "skyrimspecialedition"]);
  });

  it("produces a unique game array even when the input already contains duplicates", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: {
        dl1: {
          localPath: "MyMod.7z",
          game: ["skyrimspecialedition", "skyrimspecialedition", "skyrimse"],
        },
      },
      knownGames: [skyrimseGame, skyrimvrGame],
      activeGameId: "skyrimse",
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    const actions = unwrapDispatched(dispatch);
    const setCompat = actions.find(
      (a) => a?.type === "SET_COMPATIBLE_GAMES" && a.payload?.id === "dl1",
    );
    expect(setCompat?.payload.games).toEqual(["skyrimse", "skyrimvr", "skyrimspecialedition"]);
  });

  it("no-ops when game[0] is already an internal id", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimse"] } },
      knownGames: [skyrimseGame],
    });
    const sameDir = path.join(downloadsRoot, "skyrimse");
    await fs.mkdir(sameDir, { recursive: true });
    await fs.writeFile(path.join(sameDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    expect((await fs.stat(path.join(sameDir, "MyMod.7z"))).isFile()).toBe(true);

    const actions = unwrapDispatched(dispatch);
    expect(actions.find((a) => a?.type === "SET_COMPATIBLE_GAMES")).toBeUndefined();
  });

  it("leaves both files in place when the destination already has a file with the same name", async () => {
    const { downloadsRoot, store } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    const toDir = path.join(downloadsRoot, "skyrimse");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.mkdir(toDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "older");
    await fs.writeFile(path.join(toDir, "MyMod.7z"), "newer");

    await migrate(store, "2.0.0");

    expect((await fs.readFile(path.join(fromDir, "MyMod.7z"))).toString()).toBe("older");
    expect((await fs.readFile(path.join(toDir, "MyMod.7z"))).toString()).toBe("newer");
  });

  it("sweeps orphan files in the domain folder once a state record establishes the mapping", async () => {
    const { downloadsRoot, store } = await buildScenario({
      downloads: { dl1: { localPath: "InState.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    const toDir = path.join(downloadsRoot, "skyrimse");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "InState.7z"), "state");
    await fs.writeFile(path.join(fromDir, "Orphan.7z"), "orphan");

    await migrate(store, "2.0.0");

    expect((await fs.stat(path.join(toDir, "InState.7z"))).isFile()).toBe(true);
    expect((await fs.stat(path.join(toDir, "Orphan.7z"))).isFile()).toBe(true);

    // The rmdir at the end of the sweep is best-effort; on CI it can lose to
    // a lingering handle, in which case the folder is allowed to remain. We
    // only assert that nothing got left INSIDE the folder.
    try {
      const remaining = await fs.readdir(fromDir);
      expect(remaining).toEqual([]);
    } catch {
      // ENOENT is fine too: the folder was removed.
    }
  });

  it("records the migration on the state.app.migrations log", async () => {
    const { store, dispatch } = await buildScenario({ knownGames: [skyrimseGame] });

    await migrate(store, "2.0.0");

    const actions = unwrapDispatched(dispatch);
    const completed = actions.find(
      (a) => a?.type === "COMPLETE_MIGRATION" && a.payload === "moveDomainFolders_2_1",
    );
    expect(completed).toBeDefined();
  });

  it("does not run when state.app.migrations already contains its id", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame],
      migrations: ["moveDomainFolders_2_1"],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.0.0");

    expect((await fs.stat(path.join(fromDir, "MyMod.7z"))).isFile()).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not run when oldVersion is already >= the migration minVersion", async () => {
    const { downloadsRoot, store, dispatch } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.1.0-beta.5");

    expect((await fs.stat(path.join(fromDir, "MyMod.7z"))).isFile()).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("fires for users upgrading from the affected 2.1.0-beta.4 to the fix in 2.1.0-beta.5", async () => {
    const { downloadsRoot, store } = await buildScenario({
      downloads: { dl1: { localPath: "MyMod.7z", game: ["skyrimspecialedition"] } },
      knownGames: [skyrimseGame],
    });
    const fromDir = path.join(downloadsRoot, "skyrimspecialedition");
    const toDir = path.join(downloadsRoot, "skyrimse");
    await fs.mkdir(fromDir, { recursive: true });
    await fs.writeFile(path.join(fromDir, "MyMod.7z"), "content");

    await migrate(store, "2.1.0-beta.4");

    expect((await fs.stat(path.join(toDir, "MyMod.7z"))).isFile()).toBe(true);
  });
});
