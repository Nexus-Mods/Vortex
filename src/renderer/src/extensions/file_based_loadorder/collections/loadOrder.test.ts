import { describe, expect, vi } from "vitest";

import { makeLoadOrderEntry, makeMod, makeRegisteredLoadOrder } from "../../../test-utils/builders";
import { test } from "../../../test-utils/fbloTest";
import type { IExtensionContext } from "../../../types/IExtensionContext";
import initFileBasedLoadOrder from "../index";
import { storedNamedLoadOrder } from "../selectors";
import { CollectionParseError, type ICollection } from "../types/collections";
import type { LoadOrder } from "../types/types";
import { generate, parser } from "./loadOrder";

const mods = { "mod-a": makeMod({ id: "mod-a" }), "mod-b": makeMod({ id: "mod-b" }) };

const entry = (id: string, modId: string) => makeLoadOrderEntry({ id, modId });

// a game whose load order file currently reads back as the given order
const readsBack = (loadOrder: LoadOrder) => () => Promise.resolve(loadOrder);

// a collection manifest carrying the given load order data
const collectionWith = (loadOrderData: Partial<ICollection>) =>
  ({ info: {}, mods: [], modRules: [], loadOrder: [], ...loadOrderData }) as ICollection;

describe("generate", () => {
  test("the registered Workshop exporter follows the latest Beta order and skips Classic", async ({
    makeFblo,
  }) => {
    const fblo = makeFblo({ mods });
    const registerAPI = vi.fn();
    const registerCollectionFeature = vi.fn();
    initFileBasedLoadOrder({
      api: fblo.api,
      optional: { registerCollectionFeature },
      registerAPI,
      registerActionCheck: vi.fn(),
      registerMainPage: vi.fn(),
      registerReducer: vi.fn(),
      once: vi.fn(),
    } as unknown as IExtensionContext);

    let beta = false;
    let order = [entry("a.esp", "mod-a"), entry("b.esp", "mod-b")];
    const addLoadOrderPage = registerAPI.mock.calls.find(
      ([name]) => name === "addLoadOrderPage",
    )[1];
    addLoadOrderPage({
      gameId: fblo.gameId,
      loadOrderId: "bethesda-plugins",
      condition: () => beta,
      deserializeLoadOrder: () => Promise.resolve(order),
      writesOnUserEdit: true,
    });
    const exportWorkshop = registerCollectionFeature.mock.calls[0][1];
    const exportBoth = () => exportWorkshop(fblo.gameId, ["mod-a", "mod-b"]);
    await expect(exportBoth()).resolves.toBeUndefined();

    beta = true;
    await expect(exportBoth()).resolves.toEqual({
      loadOrder: [],
      fbLoadOrders: [{ id: "bethesda-plugins", entries: order }],
    });

    order = [{ ...order[1], enabled: false }, order[0]];
    await expect(exportBoth()).resolves.toEqual({
      loadOrder: [],
      fbLoadOrders: [{ id: "bethesda-plugins", entries: order }],
    });

    beta = false;
    await expect(exportBoth()).resolves.toBeUndefined();
  });

  test("a single load order exports the legacy key only", async ({ makeFblo }) => {
    const fblo = makeFblo({ mods });
    const primary = fblo.registerLoadOrder({
      deserializeLoadOrder: readsBack([entry("a.pak", "mod-a"), entry("b.pak", "mod-b")]),
    });

    const exported = await generate(fblo.api, [primary], ["mod-a"], mods);

    expect(Object.keys(exported)).toEqual(["loadOrder"]);
    expect(exported.loadOrder.map((item) => item.id)).toEqual(["a.pak"]);
  });

  test("named load orders export beside the primary's", async ({ makeFblo }) => {
    const fblo = makeFblo({ mods });
    const primary = fblo.registerLoadOrder({
      deserializeLoadOrder: readsBack([entry("a.pak", "mod-a")]),
    });
    const redmod = fblo.registerLoadOrder({
      loadOrderId: "redmod",
      deserializeLoadOrder: readsBack([entry("a.redmod", "mod-a"), entry("b.redmod", "mod-b")]),
    });

    const exported = await generate(fblo.api, [primary, redmod], ["mod-a", "mod-b"], mods);

    expect(exported.loadOrder.map((item) => item.id)).toEqual(["a.pak"]);
    expect(exported.fbLoadOrders).toEqual([
      { id: "redmod", entries: [entry("a.redmod", "mod-a"), entry("b.redmod", "mod-b")] },
    ]);
  });

  test("direct writers export collection members and leave applying them to the game", async ({
    makeFblo,
  }) => {
    const fblo = makeFblo({ mods });
    const deployed = [{ ...entry("b.esp", "mod-b"), enabled: false }, entry("a.esm", "mod-a")];
    const validate = vi.fn().mockResolvedValue(undefined);
    const direct = fblo.registerLoadOrder({
      loadOrderId: "manual",
      deserializeLoadOrder: readsBack(deployed),
      validate,
      writesOnUserEdit: true,
    });

    const exported = await generate(fblo.api, [direct], ["mod-b"], mods);
    expect(validate).not.toHaveBeenCalled();
    expect(exported.fbLoadOrders).toEqual([{ id: "manual", entries: [deployed[0]] }]);

    await parser(fblo.api, [direct], fblo.gameId, collectionWith(exported));
    expect(storedNamedLoadOrder(fblo.getState(), fblo.profileId, "manual")).toBeUndefined();
  });

  test("a game without a primary exports its adopter's order as the legacy key", async ({
    makeFblo,
  }) => {
    const fblo = makeFblo({ mods });
    const archive = fblo.registerLoadOrder({
      loadOrderId: "archive",
      deserializeLoadOrder: readsBack([entry("a.archive", "mod-a")]),
    });
    const redmod = fblo.registerLoadOrder({
      loadOrderId: "redmod",
      adoptsLegacyOrder: true,
      deserializeLoadOrder: readsBack([entry("a.redmod", "mod-a")]),
    });

    const exported = await generate(fblo.api, [archive, redmod], ["mod-a"], mods);

    expect(exported.loadOrder.map((item) => item.id)).toEqual(["a.redmod"]);
    expect(exported.fbLoadOrders.map((named) => named.id)).toEqual(["archive", "redmod"]);
  });
});

describe("parser", () => {
  const twoLoadOrders = (gameId: string) => [
    makeRegisteredLoadOrder({ gameId }),
    makeRegisteredLoadOrder({ gameId, loadOrderId: "redmod" }),
  ];

  test("a collection without named load orders sets the primary only", async ({ makeFblo }) => {
    const fblo = makeFblo();

    await parser(
      fblo.api,
      twoLoadOrders(fblo.gameId),
      fblo.gameId,
      collectionWith({ loadOrder: [entry("a.pak", "mod-a")] }),
    );

    expect(fblo.loadOrder().map((item) => item.id)).toEqual(["a.pak"]);
    expect(fblo.loadOrder("redmod")).toEqual([]);
  });

  test("named load orders in a collection land in their slots", async ({ makeFblo }) => {
    const fblo = makeFblo();

    await parser(
      fblo.api,
      twoLoadOrders(fblo.gameId),
      fblo.gameId,
      collectionWith({
        loadOrder: [entry("a.pak", "mod-a")],
        fbLoadOrders: [{ id: "redmod", entries: [entry("a.redmod", "mod-a")] }],
      }),
    );

    expect(fblo.loadOrder().map((item) => item.id)).toEqual(["a.pak"]);
    expect(fblo.loadOrder("redmod").map((item) => item.id)).toEqual(["a.redmod"]);
  });

  test("a named load order the game does not register is skipped", async ({ makeFblo }) => {
    const fblo = makeFblo();

    await parser(
      fblo.api,
      [makeRegisteredLoadOrder({ gameId: fblo.gameId })],
      fblo.gameId,
      collectionWith({ fbLoadOrders: [{ id: "redmod", entries: [entry("a.redmod", "mod-a")] }] }),
    );

    expect(storedNamedLoadOrder(fblo.getState(), fblo.profileId, "redmod")).toBeUndefined();
  });

  test.for<[string, object]>([
    ["named load orders that are not a list", { fbLoadOrders: "redmod" }],
    ["a named load order without an id", { fbLoadOrders: [{ entries: [] }] }],
    [
      "a named load order whose entries are not a list",
      { fbLoadOrders: [{ id: "redmod", entries: "a" }] },
    ],
    ["an entry without an id", { fbLoadOrders: [{ id: "redmod", entries: [{ name: "a" }] }] }],
  ])("rejects %s", async ([, loadOrderData], { makeFblo }) => {
    const fblo = makeFblo();

    await expect(
      parser(fblo.api, twoLoadOrders(fblo.gameId), fblo.gameId, collectionWith(loadOrderData)),
    ).rejects.toBeInstanceOf(CollectionParseError);
    expect(storedNamedLoadOrder(fblo.getState(), fblo.profileId, "redmod")).toBeUndefined();
  });
});
