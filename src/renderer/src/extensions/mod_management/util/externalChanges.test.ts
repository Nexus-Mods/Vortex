import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IDeployedFile,
  IDeploymentMethod,
  IExtensionApi,
  IFileChange,
} from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { MERGED_PATH } from "../modMerging";

// Mock fs. applyFileActions inside dealWithExternalChanges calls into it
// whenever any auto-resolved changes are present. Real fs ops would fail in a
// unit test, so make every call a no-op.
vi.mock("../../../util/fs", () => ({
  removeAsync: vi.fn(() => Promise.resolve()),
  moveAsync: vi.fn(() => Promise.resolve()),
  statAsync: vi.fn(() => Promise.resolve({ mtime: new Date(0) })),
  lstatAsync: vi.fn(() => Promise.resolve({ mtime: new Date(0) })),
}));

vi.mock("../../../logging", () => {
  const log = vi.fn();
  return { default: log, log };
});

// Required mocks for the real InstallManager imported below. The integration
// test at the bottom builds a real InstallManager so it can drive the
// markRecentInstall / markRecentRemoval / consumeRecentChanges flow against
// the live implementation (rather than re-stating the resulting Set inline).
vi.mock("../util/dependencies");
vi.mock("../../../util/api");
vi.mock("../../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

// Capture every payload passed to showExternalChanges so each test can assert
// what would have been surfaced to the user.
const showExternalChangesCalls: Array<{ [typeId: string]: IFileChange[] }> = [];
// externalChanges.ts only imports `showExternalChanges` from this module, so
// stubbing that one export is sufficient. The returned thunk resolves with
// [] (simulating the user clicking Confirm without overriding any default
// action); downstream applyFileActions is still exercised but is a no-op
// given mocked fs.
vi.mock("../actions/session", () => ({
  showExternalChanges: vi.fn((changes: { [typeId: string]: IFileChange[] }) => {
    return () => {
      showExternalChangesCalls.push(changes);
      return Promise.resolve([]);
    };
  }),
}));

import InstallManager from "../InstallManager";
import { classifyExternalChange, dealWithExternalChanges } from "./externalChanges";

function makeRefchange(source: string, filePath: string): IFileChange {
  return {
    filePath,
    source,
    sourceTime: new Date(0),
    destTime: new Date(0),
    changeType: "refchange",
  };
}

function makeSrcDeleted(source: string, filePath: string): IFileChange {
  return {
    filePath,
    source,
    sourceTime: new Date(0),
    destTime: new Date(0),
    changeType: "srcdeleted",
  };
}

function makeApi(opts: {
  externalChanges: IFileChange[];
  activeSession?: unknown;
  // Mods Vortex still has in state, keyed by installationPath. Omitted means
  // "no mods table for this game", which is deliberately distinct from an
  // empty table.
  mods?: { [installationPath: string]: unknown };
  profiles?: { [profileId: string]: unknown };
  activeProfileId?: string;
}): {
  api: IExtensionApi;
  activator: IDeploymentMethod;
} {
  const state = {
    persistent: {
      profiles: opts.profiles ?? {
        "test-profile": {
          id: "test-profile",
          gameId: "skyrimse",
        },
      },
      ...(opts.mods === undefined ? {} : { mods: { skyrimse: opts.mods } }),
    },
    session: {
      collections: { activeSession: opts.activeSession ?? undefined },
    },
    settings: {
      profiles: { activeProfileId: opts.activeProfileId ?? "test-profile" },
    },
  } as unknown as IState;

  const api: IExtensionApi = {
    store: {
      getState: () => state,
      dispatch: vi.fn((action: unknown) => {
        // Honour thunks (functions). That's how showExternalChanges resolves.
        if (typeof action === "function") {
          return (action as (d: unknown) => unknown)(vi.fn());
        }
        return action;
      }),
    },
    events: {
      emit: vi.fn(),
    },
  } as unknown as IExtensionApi;

  const activator: IDeploymentMethod = {
    externalChanges: vi.fn(() => Promise.resolve(opts.externalChanges)),
  } as unknown as IDeploymentMethod;

  return { api, activator };
}

const FAKE_STAGING = "C:\\staging";
const FAKE_MOD_PATHS = { "": "C:\\game\\Data" };
// dealWithExternalChanges iterates over lastDeployment keys (modTypes) to
// dispatch applyFileActions; the per-entry contents don't matter once changes
// are produced by the (mocked) activator.
const FAKE_LAST_DEPLOYMENT: { [typeId: string]: IDeployedFile[] } = { "": [] };

describe("dealWithExternalChanges", () => {
  beforeEach(() => {
    showExternalChangesCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("auto-resolves __merged changes regardless of recentChanges", async () => {
    const { api, activator } = makeApi({
      externalChanges: [makeRefchange(`${MERGED_PATH}_skyrim`, "Data/merged.esp")],
    });

    await dealWithExternalChanges(
      api,
      activator,
      "test-profile",
      FAKE_STAGING,
      FAKE_MOD_PATHS,
      FAKE_LAST_DEPLOYMENT,
      new Set(),
    );

    expect(showExternalChangesCalls).toHaveLength(0);
  });

  it("auto-resolves every change during a collection install", async () => {
    const { api, activator } = makeApi({
      externalChanges: [
        makeRefchange("some-mod-A", "Data/a.bsa"),
        makeRefchange("some-mod-B", "Data/b.bsa"),
      ],
      activeSession: { collectionSlug: "fake-collection", state: "installing" },
    });

    await dealWithExternalChanges(
      api,
      activator,
      "test-profile",
      FAKE_STAGING,
      FAKE_MOD_PATHS,
      FAKE_LAST_DEPLOYMENT,
      new Set(),
    );

    expect(showExternalChangesCalls).toHaveLength(0);
  });

  it("treats an undefined recentChanges as 'nothing recently touched'", async () => {
    const { api, activator } = makeApi({
      externalChanges: [makeRefchange("any-mod", "Data/file.esp")],
    });

    await dealWithExternalChanges(
      api,
      activator,
      "test-profile",
      FAKE_STAGING,
      FAKE_MOD_PATHS,
      FAKE_LAST_DEPLOYMENT,
      undefined,
    );

    expect(showExternalChangesCalls).toHaveLength(1);
    expect(showExternalChangesCalls[0][""]?.[0].source).toBe("any-mod");
  });

  // A deployment cycle consumes the recentChanges snapshot ONCE at the start,
  // then runs dealWithExternalChanges against that snapshot. If a second
  // install completes after the snapshot is taken (e.g. parallel installers,
  // or an install that finished while the first deployment was still in
  // flight), its installation path is not in the local recentChanges seen
  // by the current dealWithExternalChanges call. A refchange attributed to
  // that just-installed mod therefore surfaces to the user, even though
  // Vortex did install it. This is correct behavior given the input; the
  // upstream concern is whether two install/deploy flows should overlap at
  // all. Locks in the snapshot-at-consume-time contract between
  // InstallManager and dealWithExternalChanges.
  it("only auto-resolves against the recentChanges snapshot taken at consume time", async () => {
    const gameId = "skyrimse";
    const modA = "mod-A-installed-before-consume";
    const modB = "mod-B-installed-after-consume";

    const state = {
      persistent: {
        mods: {
          [gameId]: {
            [modA]: { id: modA, installationPath: modA },
            [modB]: { id: modB, installationPath: modB },
          },
        },
      },
    };
    const installManagerApi = {
      getState: vi.fn(() => state),
      store: { dispatch: vi.fn(), getState: vi.fn(() => state) },
      events: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
      onAsync: vi.fn(),
      onStateChange: vi.fn(),
      sendNotification: vi.fn(),
      dismissNotification: vi.fn(),
      showErrorNotification: vi.fn(),
      translate: vi.fn((key: string) => key),
      registerInstaller: vi.fn(),
    } as unknown as IExtensionApi;
    const installManager = new InstallManager(installManagerApi, vi.fn());

    // Install A completes BEFORE the deployment cycle starts.
    installManager.markRecentInstall(modA, gameId);

    // Deployment cycle begins: snapshot recentChanges.
    const snapshot = installManager.consumeRecentChanges();
    expect(snapshot).toEqual(new Set([modA]));

    // Install B completes WHILE the deployment cycle is in flight, after
    // the snapshot has been taken. Its path goes into the next batch.
    installManager.markRecentInstall(modB, gameId);

    // The current deployment cycle calls dealWithExternalChanges with the
    // snapshot. The activator reports a refchange attributed to mod B
    // (a stale manifest entry, an in-flight unlink/relink, etc.).
    const { api, activator } = makeApi({
      externalChanges: [makeRefchange(modA, "Data/a.esp"), makeRefchange(modB, "Data/b.esp")],
    });

    await dealWithExternalChanges(
      api,
      activator,
      "test-profile",
      FAKE_STAGING,
      FAKE_MOD_PATHS,
      FAKE_LAST_DEPLOYMENT,
      snapshot,
    );

    // A is auto-resolved (in snapshot), B surfaces (not in snapshot).
    expect(showExternalChangesCalls).toHaveLength(1);
    const surfaced = showExternalChangesCalls[0][""];
    expect(surfaced).toHaveLength(1);
    expect(surfaced?.[0].source).toBe(modB);

    // The next deployment cycle would pick up B.
    expect(installManager.consumeRecentChanges()).toEqual(new Set([modB]));
  });
});

describe("classifyExternalChange", () => {
  it("auto-resolves a deleted source when its owning mod was uninstalled", () => {
    const change: IFileChange = {
      filePath: "SKSE/Plugins/example.dll",
      source: "removed-mod-installation-path",
      changeType: "srcdeleted",
    };

    expect(
      classifyExternalChange(change, {
        isInstallingCollection: false,
        recentChanges: new Set(),
        installedSources: new Set(),
      }),
    ).toBe("autoResolved");
  });

  it("still surfaces a deleted source for a mod Vortex considers installed", () => {
    const change: IFileChange = {
      filePath: "SKSE/Plugins/example.dll",
      source: "installed-mod",
      changeType: "srcdeleted",
    };

    expect(
      classifyExternalChange(change, {
        isInstallingCollection: false,
        recentChanges: new Set(),
        installedSources: new Set(["installed-mod"]),
      }),
    ).toBe("rest");
  });
});

// Cross-session case. The recentChanges allow-list is in-memory, so after a
// restart it is empty and cannot explain a srcdeleted left behind by a mod the
// user uninstalled before quitting. Vortex's own state is the durable signal:
// if the owning mod is gone, a missing staging source is expected.
describe("dealWithExternalChanges: uninstalled mods", () => {
  const KEEPER = "still-installed-mod";
  const REMOVED = "uninstalled-mod";
  const INSTALLED = { [KEEPER]: { id: KEEPER, installationPath: KEEPER } };

  beforeEach(() => {
    showExternalChangesCalls.length = 0;
  });

  const run = (changes: IFileChange[], recentChanges: Set<string> | undefined) => {
    const { api, activator } = makeApi({ externalChanges: changes, mods: INSTALLED });
    return dealWithExternalChanges(
      api,
      activator,
      "test-profile",
      FAKE_STAGING,
      FAKE_MOD_PATHS,
      FAKE_LAST_DEPLOYMENT,
      recentChanges,
    );
  };

  it("does not ask the user about a mod they uninstalled", async () => {
    await run([makeSrcDeleted(REMOVED, "SKSE/Plugins/example.dll")], new Set());
    expect(showExternalChangesCalls).toHaveLength(0);
  });

  it("does not ask the user when recentChanges is undefined", async () => {
    await run([makeSrcDeleted(REMOVED, "SKSE/Plugins/example.dll")], undefined);
    expect(showExternalChangesCalls).toHaveLength(0);
  });

  it("still surfaces a deleted source when the mod is still installed", async () => {
    await run([makeSrcDeleted(KEEPER, "Data/keeper.esp")], new Set());
    expect(showExternalChangesCalls).toHaveLength(1);
    expect(showExternalChangesCalls[0][""]?.[0].source).toBe(KEEPER);
  });

  it("drops only the orphan when both appear in one batch", async () => {
    await run(
      [
        makeSrcDeleted(REMOVED, "SKSE/Plugins/example.dll"),
        makeSrcDeleted(KEEPER, "Data/keeper.esp"),
      ],
      new Set(),
    );
    expect(showExternalChangesCalls).toHaveLength(1);
    const surfaced = showExternalChangesCalls[0][""];
    expect(surfaced).toHaveLength(1);
    expect(surfaced?.[0].source).toBe(KEEPER);
  });

  // Removing the LAST mod takes the game's whole mod table with it, so the
  // lookup yields no table at all rather than an empty one. That still means
  // "nothing installed", not "unknown", and the orphan must be dropped.
  it("drops the orphan when the removed mod was the only one", async () => {
    const { api, activator } = makeApi({
      externalChanges: [makeSrcDeleted(REMOVED, "Data/only.esp")],
      // no `mods` key at all for this game
    });

    await dealWithExternalChanges(
      api,
      activator,
      "test-profile",
      FAKE_STAGING,
      FAKE_MOD_PATHS,
      FAKE_LAST_DEPLOYMENT,
      new Set(),
    );

    expect(showExternalChangesCalls).toHaveLength(0);
  });

  // checkForExternalChanges tolerates a stale profileId via its activeProfile
  // fallback, so the suppression must resolve the game the same way. Deriving
  // it from persistent.profiles[profileId] alone yields undefined for a stale
  // id, and an empty installedSources Set would then make every source look
  // uninstalled and auto-resolve genuine changes.
  it("still surfaces a deleted source when profileId is stale", async () => {
    const { api, activator } = makeApi({
      externalChanges: [makeSrcDeleted(KEEPER, "Data/keeper.esp")],
      mods: INSTALLED,
      profiles: { "active-profile": { id: "active-profile", gameId: "skyrimse" } },
      activeProfileId: "active-profile",
    });

    await dealWithExternalChanges(
      api,
      activator,
      "stale-profile",
      FAKE_STAGING,
      FAKE_MOD_PATHS,
      FAKE_LAST_DEPLOYMENT,
      new Set(),
    );

    expect(showExternalChangesCalls).toHaveLength(1);
  });
});
