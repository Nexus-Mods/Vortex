import { describe, expect } from "vitest";

import { flushAsync } from "../../test-utils/async";
import { makeLoadOrderEntry, makeMod } from "../../test-utils/builders";
import { test } from "../../test-utils/fbloTest";
import type { IFbloHarness } from "../../test-utils/harnessTypes";
import { addMod, removeMod } from "../mod_management/actions/mods";
import { setModEnabled } from "../profile_management/actions/profiles";
import { setFBLoadOrder } from "./actions/loadOrder";
import type { ILoadOrderEntry, LoadOrder } from "./types/types";

// The acceptance suite for keeping the user's load order through deployments: the real reducers,
// the real handlers and the real registry, driven by the events Vortex emits.

const entry = (id: string, overrides: Partial<ILoadOrderEntry> = {}) =>
  makeLoadOrderEntry({ id, ...overrides });

const ids = (loadOrder: readonly ILoadOrderEntry[]) => loadOrder.map((item) => item.id);

// a game whose load order file currently reads back as the given order
const readsBack = (loadOrder: LoadOrder | undefined) => () => Promise.resolve(loadOrder);

// a game's load order file: reads return what it holds, writes from Vortex replace it, and
// gameRewrites models the game or a deployment changing it underneath Vortex
function gameLoadOrderFile(initial: LoadOrder) {
  let contents = initial;
  // every order Vortex wrote, in order
  const writtenByVortex: LoadOrder[] = [];
  return {
    contents: () => contents,
    writtenByVortex,
    gameRewrites: (loadOrder: LoadOrder) => {
      contents = loadOrder;
    },
    deserializeLoadOrder: () => Promise.resolve(contents),
    serializeLoadOrder: (loadOrder: LoadOrder) => {
      contents = loadOrder;
      writtenByVortex.push(loadOrder);
      return Promise.resolve();
    },
  };
}

const deploy = (fblo: IFbloHarness) => fblo.emitAndAwait("did-deploy", fblo.profileId);

const purge = async (fblo: IFbloHarness) => {
  await fblo.emitAndAwait("will-purge", fblo.profileId);
  await fblo.emitAndAwait("did-purge", fblo.profileId);
};

describe("after a deployment", () => {
  test("entries the game reports go back to the user's order", async ({ makeFblo }) => {
    const fblo = makeFblo();
    fblo.registerLoadOrder({
      deserializeLoadOrder: readsBack([entry("c.pak"), entry("a.pak"), entry("b.pak")]),
    });
    fblo.api.store.dispatch(
      setFBLoadOrder(fblo.profileId, [entry("a.pak"), entry("b.pak"), entry("c.pak")]),
    );

    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["a.pak", "b.pak", "c.pak"]);
  });

  test("an updated mod keeps its position when the update renames its entries", async ({
    makeFblo,
  }) => {
    const fblo = makeFblo({ mods: { "mod-a": makeMod({ id: "mod-a" }) } });
    fblo.registerLoadOrder({
      deserializeLoadOrder: readsBack([
        entry("x.pak"),
        entry("y.pak"),
        entry("a-2.0", { name: "A", modId: "mod-a" }),
      ]),
    });
    fblo.api.store.dispatch(
      setFBLoadOrder(fblo.profileId, [
        entry("x.pak"),
        entry("a-1.0", { name: "A", modId: "mod-a" }),
        entry("y.pak"),
      ]),
    );

    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["x.pak", "a-2.0", "y.pak"]);
  });

  test("a Nexus mod reinstalled under a new Vortex id keeps its position", async ({ makeFblo }) => {
    const fblo = makeFblo({
      mods: {
        "mod-old": makeMod({ id: "mod-old", attributes: { modId: 42 } }),
        "mod-new": makeMod({ id: "mod-new", attributes: { modId: 42 } }),
      },
    });
    fblo.registerLoadOrder({
      deserializeLoadOrder: readsBack([
        entry("x.pak"),
        entry("y.pak"),
        entry("new-a", { name: "A", modId: "mod-new" }),
      ]),
    });
    fblo.api.store.dispatch(
      setFBLoadOrder(fblo.profileId, [
        entry("old-a", { name: "A", modId: "mod-old" }),
        entry("x.pak"),
        entry("y.pak"),
      ]),
    );

    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["new-a", "x.pak", "y.pak"]);
  });

  test("a newly installed mod stays where the game put it", async ({ makeFblo }) => {
    const fblo = makeFblo();
    fblo.registerLoadOrder({
      deserializeLoadOrder: readsBack([entry("b.pak"), entry("new.pak"), entry("a.pak")]),
    });
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, [entry("a.pak"), entry("b.pak")]));

    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["a.pak", "new.pak", "b.pak"]);
  });

  test("a removed mod leaves the order", async ({ makeFblo }) => {
    const fblo = makeFblo();
    fblo.registerLoadOrder({ deserializeLoadOrder: readsBack([entry("b.pak"), entry("a.pak")]) });
    fblo.api.store.dispatch(
      setFBLoadOrder(fblo.profileId, [entry("a.pak"), entry("gone.pak"), entry("b.pak")]),
    );

    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["a.pak", "b.pak"]);
  });

  test.for<LoadOrder | undefined>([undefined, []])(
    "the user's order survives a game that reads back %j",
    async (readBack, { makeFblo }) => {
      const fblo = makeFblo();
      const stored = [entry("a.pak"), entry("b.pak")];
      fblo.registerLoadOrder({ deserializeLoadOrder: readsBack(readBack) });
      fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, stored));

      await deploy(fblo);

      expect(fblo.loadOrder()).toEqual(stored);
    },
  );

  test("each of a game's load orders keeps its own order", async ({ makeFblo }) => {
    const fblo = makeFblo();
    fblo.registerLoadOrder({
      deserializeLoadOrder: readsBack([entry("b.pak"), entry("shared.pak"), entry("a.pak")]),
    });
    fblo.registerLoadOrder({
      loadOrderId: "redmod",
      deserializeLoadOrder: readsBack([entry("shared.pak"), entry("r.pak")]),
    });
    fblo.api.store.dispatch(
      setFBLoadOrder(fblo.profileId, [entry("shared.pak"), entry("a.pak"), entry("b.pak")]),
    );
    fblo.api.store.dispatch(
      setFBLoadOrder(fblo.profileId, [entry("r.pak"), entry("shared.pak")], "redmod"),
    );

    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["shared.pak", "a.pak", "b.pak"]);
    expect(ids(fblo.loadOrder("redmod"))).toEqual(["r.pak", "shared.pak"]);
  });

  test("a profile with nothing stored gets an order it can change", async ({ makeFblo }) => {
    const fblo = makeFblo();
    fblo.registerLoadOrder({ deserializeLoadOrder: readsBack([]) });

    await deploy(fblo);

    // game extensions read the stored order straight from state, and some change it in place
    expect(fblo.loadOrder()).toEqual([]);
    expect(Object.isFrozen(fblo.loadOrder())).toBe(false);
  });

  test("a load order whose condition is off is left alone", async ({ makeFblo }) => {
    const fblo = makeFblo();
    const stored = [entry("a.pak"), entry("b.pak")];
    fblo.registerLoadOrder({
      condition: () => false,
      deserializeLoadOrder: readsBack([entry("b.pak")]),
    });
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, stored));

    await deploy(fblo);

    expect(fblo.loadOrder()).toEqual(stored);
  });
});

describe("through a reinstall", () => {
  const vortexModId = "mod-a";
  const userOrder = [
    entry("x.pak"),
    entry("a-1.0", { name: "A", modId: vortexModId }),
    entry("y.pak"),
  ];

  type GameLoadOrderFile = ReturnType<typeof gameLoadOrderFile>;

  // the game extension lists a deployed mod in its file from its own did-deploy handler, as
  // Witcher 3 does, so Vortex's own did-deploy read happens before the mod is listed
  function gameExtensionListsOnDeploy(
    fblo: IFbloHarness,
    gameFile: GameLoadOrderFile,
    deployedEntry: ILoadOrderEntry,
  ) {
    fblo.api.onAsync("did-deploy", async () => {
      await Promise.resolve();
      gameFile.gameRewrites([...gameFile.contents(), deployedEntry]);
    });
  }

  // the old mod leaves as a replacement and the game extension drops it from its file
  async function removeForReplacement(
    fblo: IFbloHarness,
    gameFile: GameLoadOrderFile,
    fileWithoutMod: LoadOrder,
  ) {
    await fblo.emitAndAwait("will-remove-mods", fblo.gameId, [vortexModId], {
      willBeReplaced: true,
    });
    gameFile.gameRewrites(fileWithoutMod);
  }

  // A mod reinstalled in place: removed as a replacement, added back under the same Vortex id,
  // enabled, then deployed. With the page open, the page reads the file back on the refresh.
  async function reinstall(
    fblo: IFbloHarness,
    gameFile: GameLoadOrderFile,
    fileWithoutMod: LoadOrder,
    pageOpen: boolean,
  ) {
    await removeForReplacement(fblo, gameFile, fileWithoutMod);
    fblo.api.store.dispatch(setModEnabled(fblo.profileId, vortexModId, false));
    fblo.api.store.dispatch(removeMod(fblo.gameId, vortexModId));
    await flushAsync();
    fblo.api.store.dispatch(addMod(fblo.gameId, makeMod({ id: vortexModId })));
    fblo.api.store.dispatch(setModEnabled(fblo.profileId, vortexModId, true));
    await flushAsync();
    await deploy(fblo);
    if (pageOpen) {
      fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, gameFile.contents()));
    }
    fblo.emit("mods-did-deploy", fblo.profileId);
    await flushAsync();
  }

  // the game never received an order without the mod
  const everyWriteListsTheMod = (gameFile: GameLoadOrderFile) =>
    gameFile.writtenByVortex.every((written) => written.some((item) => item.modId === vortexModId));

  test.for([
    ["with the load order page closed", false],
    ["with the load order page open", true],
  ] as const)(
    "a reinstalled mod returns to its position %s",
    async ([, pageOpen], { makeFblo }) => {
      const fblo = makeFblo({ mods: { [vortexModId]: makeMod({ id: vortexModId }) } });
      const gameFile = gameLoadOrderFile(userOrder);
      fblo.registerLoadOrder(gameFile);
      gameExtensionListsOnDeploy(fblo, gameFile, entry("a-2.0", { name: "A", modId: vortexModId }));
      fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, userOrder));

      await reinstall(fblo, gameFile, [entry("y.pak"), entry("x.pak")], pageOpen);

      expect(ids(fblo.loadOrder())).toEqual(["x.pak", "a-2.0", "y.pak"]);
      expect(ids(gameFile.contents())).toEqual(["x.pak", "a-2.0", "y.pak"]);
      expect(everyWriteListsTheMod(gameFile)).toBe(true);
    },
  );

  test("a reinstalled mod the game lists during the deployment returns to its position", async ({
    makeFblo,
  }) => {
    const fblo = makeFblo({ mods: { [vortexModId]: makeMod({ id: vortexModId }) } });
    const gameFile = gameLoadOrderFile(userOrder);
    fblo.registerLoadOrder(gameFile);
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, userOrder));
    fblo.api.onAsync("will-deploy", () => {
      gameFile.gameRewrites([
        entry("y.pak"),
        entry("a-2.0", { name: "A", modId: vortexModId }),
        entry("x.pak"),
      ]);
      return Promise.resolve();
    });

    await removeForReplacement(fblo, gameFile, [entry("y.pak"), entry("x.pak")]);
    fblo.api.store.dispatch(setModEnabled(fblo.profileId, vortexModId, false));
    await flushAsync();
    fblo.api.store.dispatch(setModEnabled(fblo.profileId, vortexModId, true));
    await flushAsync();
    await fblo.emitAndAwait("will-deploy", fblo.profileId);
    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["x.pak", "a-2.0", "y.pak"]);
    expect(ids(gameFile.contents())).toEqual(["x.pak", "a-2.0", "y.pak"]);
    expect(everyWriteListsTheMod(gameFile)).toBe(true);
  });

  test("a reinstalled mod keyed by its Vortex id returns to its position", async ({ makeFblo }) => {
    // some games key entries by the Vortex mod id and set no modId
    const fblo = makeFblo({ mods: { [vortexModId]: makeMod({ id: vortexModId }) } });
    const keyedByModId = [entry("x.pak"), entry(vortexModId), entry("y.pak")];
    const gameFile = gameLoadOrderFile(keyedByModId);
    fblo.registerLoadOrder(gameFile);
    gameExtensionListsOnDeploy(fblo, gameFile, entry(vortexModId));
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, keyedByModId));

    await reinstall(fblo, gameFile, [entry("y.pak"), entry("x.pak")], false);

    expect(ids(fblo.loadOrder())).toEqual(["x.pak", vortexModId, "y.pak"]);
    expect(ids(gameFile.contents())).toEqual(["x.pak", vortexModId, "y.pak"]);
  });

  test("the user's next change after the reinstall is written to the game", async ({
    makeFblo,
  }) => {
    const fblo = makeFblo({ mods: { [vortexModId]: makeMod({ id: vortexModId }) } });
    const gameFile = gameLoadOrderFile(userOrder);
    fblo.registerLoadOrder(gameFile);
    gameExtensionListsOnDeploy(fblo, gameFile, entry("a-2.0", { name: "A", modId: vortexModId }));
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, userOrder));
    await reinstall(fblo, gameFile, [entry("y.pak"), entry("x.pak")], true);

    const reordered = [
      entry("y.pak"),
      entry("x.pak"),
      entry("a-2.0", { name: "A", modId: vortexModId }),
    ];
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, reordered));

    expect(gameFile.contents()).toEqual(reordered);
  });

  test("a replacement that never lands stops holding the order at the next deployment", async ({
    makeFblo,
  }) => {
    const fblo = makeFblo({ mods: { [vortexModId]: makeMod({ id: vortexModId }) } });
    const gameFile = gameLoadOrderFile(userOrder);
    fblo.registerLoadOrder(gameFile);
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, userOrder));

    await removeForReplacement(fblo, gameFile, [entry("y.pak"), entry("x.pak")]);
    fblo.api.store.dispatch(removeMod(fblo.gameId, vortexModId));
    await deploy(fblo);
    const reordered = [entry("x.pak"), entry("y.pak")];
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, reordered));

    expect(gameFile.contents()).toEqual(reordered);
  });

  test("a mod removed for good does not hold the order", async ({ makeFblo }) => {
    const fblo = makeFblo({ mods: { [vortexModId]: makeMod({ id: vortexModId }) } });
    const gameFile = gameLoadOrderFile(userOrder);
    fblo.registerLoadOrder(gameFile);
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, userOrder));

    await fblo.emitAndAwait("will-remove-mods", fblo.gameId, [vortexModId], {});
    const remaining = [entry("y.pak"), entry("x.pak")];
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, remaining));

    expect(gameFile.contents()).toEqual(remaining);
  });
});

describe("after a purge", () => {
  test("the order is the game's", async ({ makeFblo }) => {
    const fblo = makeFblo();
    fblo.registerLoadOrder({ deserializeLoadOrder: readsBack([entry("b.pak"), entry("a.pak")]) });
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, [entry("a.pak"), entry("b.pak")]));

    await purge(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["b.pak", "a.pak"]);
  });

  test("the user's order survives a game that reads back nothing", async ({ makeFblo }) => {
    const fblo = makeFblo();
    const stored = [entry("a.pak"), entry("b.pak")];
    fblo.registerLoadOrder({ deserializeLoadOrder: readsBack([]) });
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, stored));

    await purge(fblo);

    expect(fblo.loadOrder()).toEqual(stored);
  });

  test("the next deployment restores the user's order", async ({ makeFblo }) => {
    const fblo = makeFblo();
    const userOrder = [entry("a.pak"), entry("native.esm"), entry("b.pak")];
    const gameFile = gameLoadOrderFile(userOrder);
    fblo.registerLoadOrder(gameFile);
    fblo.api.store.dispatch(setFBLoadOrder(fblo.profileId, userOrder));

    await fblo.emitAndAwait("will-purge", fblo.profileId);
    gameFile.gameRewrites([entry("native.esm")]);
    await fblo.emitAndAwait("did-purge", fblo.profileId);
    gameFile.gameRewrites([entry("b.pak"), entry("native.esm"), entry("a.pak")]);
    await deploy(fblo);

    expect(ids(fblo.loadOrder())).toEqual(["a.pak", "native.esm", "b.pak"]);
    expect(ids(gameFile.contents())).toEqual(["a.pak", "native.esm", "b.pak"]);
  });
});
