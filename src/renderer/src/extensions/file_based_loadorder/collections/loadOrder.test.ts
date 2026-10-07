import { describe, expect } from "vitest";

import { makeLoadOrderEntry, makeMod, makeRegisteredLoadOrder } from "../../../test-utils/builders";
import { test } from "../../../test-utils/fbloTest";
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
