import { rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, vi } from "vitest";

import type { IMod } from "../../../extensions/mod_management/types/IMod";
import {
  makeInstalledCollection,
  makeMod,
  makePlugin,
  makeProfileMod,
  makeReference,
  makeRule,
} from "../../../test-utils/builders";
import { seedPluginDir, test } from "../../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../../test-utils/harnessTypes";
import { makeTempDir } from "../../../test-utils/tempDir";
import { setPluginEnabled } from "../actions/loadOrder";
import { setPluginList } from "../actions/plugins";
import { seams } from "../lootMocks";
import { GHOST_EXT } from "../statics";
import {
  checkMissingMasters,
  findMissingMasters,
  makeDescribeMissing,
  masterCheckOf,
  MasterState,
  MissingMasterReporter,
  type IMissingMaster,
} from "./missingMasters";
import toPluginId from "./toPluginId";

vi.mock("./gameSupport", async () => (await import("../lootMocks.js")).gameSupportModule);

interface ISetup {
  // plugin files in the game's Data folder, deployed and known to the plugin list
  deployed?: string[];
  // like deployed, but the file in the Data folder carries the .ghost extension
  ghosted?: string[];
  // plugins known to the plugin list from a mod's staging folder, not deployed
  staged?: string[];
  // plugin files in the Data folder the plugin list does not know
  unscanned?: string[];
  // plugins enabled in the load order
  enabled?: string[];
  // the game's native plugins as lowercase ids
  natives?: string[];
  // masters as each plugin header declares them, keyed by plugin file name
  masters: Record<string, string[]>;
  requiresLoadedMasters?: boolean;
}

async function setup(harness: IGamebryoHarness, opts: ISetup) {
  const base = await makeTempDir("vortex-masters-");
  const inData = [
    ...(opts.deployed ?? []),
    ...(opts.ghosted ?? []).map((name) => name + GHOST_EXT),
  ];
  const dataDir = await seedPluginDir(path.join(base, "data"), [
    ...inData,
    ...(opts.unscanned ?? []),
  ]);
  seams.base = base;
  seams.gameId = "skyrimse";
  seams.nativePlugins = opts.natives ?? [];
  seams.requiresLoadedMasters = opts.requiresLoadedMasters ?? false;

  const known = (names: string[], dir: string, deployed: boolean) =>
    names.map(
      (name) =>
        [toPluginId(name), makePlugin({ filePath: path.join(dir, name), deployed })] as const,
    );
  harness.api.store.dispatch(
    setPluginList(
      Object.fromEntries([
        ...known(inData, dataDir, true),
        ...known(opts.staged ?? [], path.join(base, "staging"), false),
      ]),
    ),
  );
  for (const name of opts.enabled ?? []) {
    harness.api.store.dispatch(setPluginEnabled(name, true));
  }
  const getMasters = (filePath: string) =>
    Promise.resolve(opts.masters[path.basename(filePath)] ?? []);
  const check = () =>
    findMissingMasters(masterCheckOf(harness.getGamebryoState(), "skyrimse"), getMasters);
  return { dataDir, getMasters, check };
}

describe("findMissingMasters", () => {
  test("reports nothing when every master is enabled and in the game folder", async ({
    makeGamebryo,
  }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp", "M.esm"],
      enabled: ["A.esp", "M.esm"],
      masters: { "A.esp": ["M.esm"] },
    });

    expect(await check()).toEqual([]);
  });

  test("reports a master that is neither in the game folder nor known as not installed", async ({
    makeGamebryo,
  }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    expect(await check()).toEqual<IMissingMaster[]>([
      { plugin: "a.esp", master: "M.esm", state: MasterState.NotInstalled },
    ]);
  });

  test("reports a master staged by an enabled mod but not deployed as not deployed", async ({
    makeGamebryo,
  }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp"],
      staged: ["M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    expect(await check()).toEqual<IMissingMaster[]>([
      { plugin: "a.esp", master: "M.esm", state: MasterState.NotDeployed },
    ]);
  });

  test("reports a master in the game folder but disabled as not enabled", async ({
    makeGamebryo,
  }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp", "M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    expect(await check()).toEqual<IMissingMaster[]>([
      { plugin: "a.esp", master: "M.esm", state: MasterState.NotEnabled },
    ]);
  });

  test("reports a ghosted master in the game folder as not enabled", async ({ makeGamebryo }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp"],
      ghosted: ["M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    expect(await check()).toEqual<IMissingMaster[]>([
      { plugin: "a.esp", master: "M.esm", state: MasterState.NotEnabled },
    ]);
  });

  test("reports a deployed master whose file is gone as removed externally", async ({
    makeGamebryo,
  }) => {
    const { dataDir, check } = await setup(makeGamebryo(), {
      deployed: ["A.esp", "M.esm"],
      enabled: ["A.esp", "M.esm"],
      masters: { "A.esp": ["M.esm"] },
    });
    await rm(path.join(dataDir, "M.esm"));

    expect(await check()).toEqual<IMissingMaster[]>([
      { plugin: "a.esp", master: "M.esm", state: MasterState.RemovedExternally },
    ]);
  });

  test("reports a master in the game folder the plugin list does not know as unscanned", async ({
    makeGamebryo,
  }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp"],
      unscanned: ["M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    expect(await check()).toEqual<IMissingMaster[]>([
      { plugin: "a.esp", master: "M.esm", state: MasterState.Unscanned },
    ]);
  });

  test("counts native plugins as enabled masters", async ({ makeGamebryo }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp", "Skyrim.esm"],
      enabled: ["A.esp"],
      natives: ["skyrim.esm"],
      masters: { "A.esp": ["Skyrim.esm"] },
    });

    expect(await check()).toEqual([]);
  });

  test("ignores the masters of disabled plugins", async ({ makeGamebryo }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    expect(await check()).toEqual([]);
  });

  test("requires disabled plugins' masters to be loadable when the game needs them", async ({
    makeGamebryo,
  }) => {
    const { check } = await setup(makeGamebryo(), {
      deployed: ["A.esp", "B.esp", "N.esm"],
      unscanned: ["U.esm"],
      masters: { "A.esp": ["M.esm", "U.esm"], "B.esp": ["N.esm"] },
      requiresLoadedMasters: true,
    });

    expect(await check()).toEqual<IMissingMaster[]>([
      { plugin: "a.esp", master: "M.esm", state: MasterState.NotInstalled },
      { plugin: "a.esp", master: "U.esm", state: MasterState.Unscanned },
    ]);
  });
});

describe("checkMissingMasters", () => {
  test("flags the plugin and warns when its master is the user's to install", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const { getMasters } = await setup(harness, {
      deployed: ["A.esp"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    const result = await checkMissingMasters(harness.api, getMasters);

    expect(result?.severity).toBe("warning");
    expect(result?.description.long).toContain("M.esm");
    expect(harness.pluginList()["a.esp"].warnings).toEqual({ "missing-master": true });
  });

  test("does not let the user suppress the result", async ({ makeGamebryo }) => {
    const harness = makeGamebryo();
    const { getMasters } = await setup(harness, {
      deployed: ["A.esp"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    const result = await checkMissingMasters(harness.api, getMasters);

    expect(result?.allowSuppress).toBe(false);
  });

  test("warns about a staged master while the deployment that would place it is pending", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const { getMasters } = await setup(harness, {
      deployed: ["A.esp"],
      staged: ["M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });
    harness.setState((draft) => {
      draft.persistent.deployment.needToDeploy["skyrimse"] = true;
    });

    const result = await checkMissingMasters(harness.api, getMasters);

    expect(result?.severity).toBe("warning");
  });

  test("answers an error when a staged master is still not deployed after deployments settled", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const { getMasters } = await setup(harness, {
      deployed: ["A.esp"],
      staged: ["M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });

    const result = await checkMissingMasters(harness.api, getMasters);

    expect(result?.severity).toBe("error");
  });

  test("answers an error when a master Vortex deployed is gone from the game folder", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const { dataDir, getMasters } = await setup(harness, {
      deployed: ["A.esp", "M.esm"],
      enabled: ["A.esp", "M.esm"],
      masters: { "A.esp": ["M.esm"] },
    });
    await rm(path.join(dataDir, "M.esm"));

    const result = await checkMissingMasters(harness.api, getMasters);

    expect(result?.severity).toBe("error");
  });

  test("answers nothing and clears the flag once every master is available", async ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();
    const { getMasters } = await setup(harness, {
      deployed: ["A.esp", "M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });
    await checkMissingMasters(harness.api, getMasters);

    harness.api.store.dispatch(setPluginEnabled("M.esm", true));
    const result = await checkMissingMasters(harness.api, getMasters);

    expect(result).toBeUndefined();
    expect(harness.pluginList()["a.esp"].warnings).toEqual({ "missing-master": false });
  });
});

describe("makeDescribeMissing", () => {
  const gts = makeInstalledCollection({
    id: "gts",
    attributes: { collectionSlug: "qdurkx", revisionNumber: 117 },
    rules: [makeRule({ reference: makeReference({ tag: "tag-a" }) })],
  });
  const member = (id: string, modId: number, fileId: number, tag?: string) =>
    makeMod({ id, attributes: { modId, fileId, referenceTag: tag } });

  // A.esp needs M.esm; both mods are installed, the collection installed A.esp's
  const arrange = async (harness: IGamebryoHarness, mods: Record<string, IMod>) => {
    await setup(harness, {
      deployed: ["A.esp"],
      staged: ["M.esm"],
      enabled: ["A.esp"],
      masters: { "A.esp": ["M.esm"] },
    });
    harness.api.store.dispatch(
      setPluginList({
        "a.esp": makePlugin({ filePath: "A.esp", modId: "dependent-mod" }),
        "m.esm": makePlugin({ filePath: "M.esm", modId: "master-mod", deployed: false }),
      }),
    );
    harness.setState((draft) => {
      draft.persistent.mods["skyrimse"] = mods;
      draft.persistent.profiles[harness.profileId].modState = { gts: makeProfileMod() };
    });
    const state = harness.getGamebryoState();
    // the run found this one master missing, plus a master the user simply has not installed
    const entry: IMissingMaster = {
      plugin: "a.esp",
      master: "M.esm",
      state: MasterState.NotDeployed,
    };
    const missing: IMissingMaster[] = [
      entry,
      { plugin: "a.esp", master: "N.esm", state: MasterState.NotInstalled },
    ];
    return makeDescribeMissing(state, "skyrimse", masterCheckOf(state, "skyrimse"), missing)(entry);
  };

  test("carries both sides' mods and the collection they came from", async ({ makeGamebryo }) => {
    const attributes = await arrange(makeGamebryo(), {
      gts,
      "dependent-mod": member("dependent-mod", 94293, 420501, "tag-a"),
      "master-mod": member("master-mod", 42990, 188271, "tag-a"),
    });

    expect(attributes).toMatchObject({
      "master.name": "M.esm",
      "master.state": "not-deployed",
      "master.mod_id": 42990,
      "master.file_id": 188271,
      "master.collection": "qdurkx@117",
      "master.same_collection": true,
      "plugin.name": "a.esp",
      "plugin.mod_id": 94293,
      "plugin.collection": "qdurkx@117",
      "collections.enabled": "qdurkx@117",
      "collections.count": 1,
      // both missing masters counted, only the one contradicting the plugin list worth a span
      "missing.count": 2,
      "missing.contradicting": 1,
    });
  });

  // the case worth spotting: the dependent came from a collection, the master did not
  test("says the two sides came from different places", async ({ makeGamebryo }) => {
    const attributes = await arrange(makeGamebryo(), {
      gts,
      "dependent-mod": member("dependent-mod", 94293, 420501, "tag-a"),
      "master-mod": member("master-mod", 42990, 188271),
    });

    expect(attributes["master.same_collection"]).toBeUndefined();
    expect(attributes["master.collection"]).toBeUndefined();
    expect(attributes["plugin.collection"]).toBe("qdurkx@117");
  });

  test("leaves out what it cannot resolve", async ({ makeGamebryo }) => {
    const attributes = await arrange(makeGamebryo(), { gts });

    expect(attributes).not.toHaveProperty("master.mod_id");
    expect(attributes).not.toHaveProperty("plugin.mod_id");
    expect(attributes["master.name"]).toBe("M.esm");
  });
});

describe("MissingMasterReporter", () => {
  const removed: IMissingMaster = {
    plugin: "a.esp",
    master: "M.esm",
    state: MasterState.RemovedExternally,
  };
  const staged: IMissingMaster = {
    plugin: "a.esp",
    master: "N.esm",
    state: MasterState.NotDeployed,
  };
  const describe_ = (entry: IMissingMaster) => ({ "master.name": entry.master });
  const makeDescribe = () => describe_;
  const makeReporter = () => {
    const record = vi.fn();
    return { record, reporter: new MissingMasterReporter(record) };
  };

  test("records one span when a master enters a state the plugin list got wrong, not again while it stays", () => {
    const { record, reporter } = makeReporter();

    reporter.report("skyrimse", [removed], true, makeDescribe);
    reporter.report("skyrimse", [removed], true, makeDescribe);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.any(String), expect.any(Error), {
      "master.name": "M.esm",
    });
  });

  test("records nothing for masters the user has not installed or enabled", () => {
    const { record, reporter } = makeReporter();

    reporter.report(
      "skyrimse",
      [
        { plugin: "a.esp", master: "M.esm", state: MasterState.NotInstalled },
        { plugin: "a.esp", master: "O.esm", state: MasterState.NotEnabled },
      ],
      true,
      makeDescribe,
    );

    expect(record).not.toHaveBeenCalled();
  });

  test("records again when a master returns to a state the plugin list got wrong", () => {
    const { record, reporter } = makeReporter();

    reporter.report("skyrimse", [removed], true, makeDescribe);
    reporter.report("skyrimse", [], true, makeDescribe);
    reporter.report("skyrimse", [removed], true, makeDescribe);

    expect(record).toHaveBeenCalledTimes(2);
  });

  // a master that stays undeployed once every deployment has finished is the shape a stuck
  // collection install leaves behind
  test("records a master still not deployed once deployments have settled", () => {
    const { record, reporter } = makeReporter();

    reporter.report("skyrimse", [staged], false, makeDescribe);
    expect(record).not.toHaveBeenCalled();

    reporter.report("skyrimse", [staged], true, makeDescribe);

    expect(record).toHaveBeenCalledTimes(1);
  });

  test("does not record a master again after a deployment interrupted the runs", () => {
    const { record, reporter } = makeReporter();

    reporter.report("skyrimse", [removed], true, makeDescribe);
    reporter.report("skyrimse", [removed], false, makeDescribe);
    reporter.report("skyrimse", [removed], true, makeDescribe);

    expect(record).toHaveBeenCalledTimes(1);
  });

  // a broken collection repeats the same story in every span, so the run reports a sample
  test("reports at most 25 masters per run and never revisits the rest", () => {
    const { record, reporter } = makeReporter();
    const many: IMissingMaster[] = Array.from({ length: 40 }, (_unused, idx) => ({
      plugin: `a${idx}.esp`,
      master: `M${idx}.esm`,
      state: MasterState.RemovedExternally,
    }));

    reporter.report("skyrimse", many, true, makeDescribe);
    expect(record).toHaveBeenCalledTimes(25);

    reporter.report("skyrimse", many, true, makeDescribe);

    expect(record).toHaveBeenCalledTimes(25);
  });

  test("describes only the masters it reports", () => {
    const { reporter } = makeReporter();
    const describeSpy = vi.fn(describe_);

    reporter.report(
      "skyrimse",
      [removed, { plugin: "a.esp", master: "O.esm", state: MasterState.NotEnabled }],
      true,
      () => describeSpy,
    );

    expect(describeSpy).toHaveBeenCalledTimes(1);
    expect(describeSpy).toHaveBeenCalledWith(removed);
  });

  test("reads the state a description needs only when it reports a master", () => {
    const { reporter } = makeReporter();
    const makeDescribeSpy = vi.fn(makeDescribe);

    reporter.report("skyrimse", [staged], false, makeDescribeSpy);
    reporter.report(
      "skyrimse",
      [{ ...staged, state: MasterState.NotEnabled }],
      true,
      makeDescribeSpy,
    );
    expect(makeDescribeSpy).not.toHaveBeenCalled();

    reporter.report("skyrimse", [removed], true, makeDescribeSpy);

    expect(makeDescribeSpy).toHaveBeenCalledTimes(1);
  });
});
