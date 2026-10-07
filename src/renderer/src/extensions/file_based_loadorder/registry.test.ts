import { describe, expect, it } from "vitest";

import { makeLoadOrderGameInfo, makeRegisteredLoadOrder } from "../../test-utils/builders";
import {
  entriesForGame,
  findEntry,
  RegistrationRejection,
  registrationRejection,
  resolveEntry,
} from "./registry";
import type { IRegisteredLoadOrder } from "./types/types";
import { DEFAULT_LOAD_ORDER_ID } from "./types/types";

const ids = (entries: readonly IRegisteredLoadOrder[]) =>
  entries.map((registered) => registered.loadOrderId);

describe("resolveEntry", () => {
  it("makes an id-less load order the game's primary", () => {
    const resolved = resolveEntry(makeLoadOrderGameInfo(), false);

    expect(resolved.loadOrderId).toBe(DEFAULT_LOAD_ORDER_ID);
    expect(resolved.isPrimary).toBe(true);
  });

  it("keeps a named load order's id and marks it secondary", () => {
    const resolved = resolveEntry(makeLoadOrderGameInfo({ loadOrderId: "archive" }), false);

    expect(resolved.loadOrderId).toBe("archive");
    expect(resolved.isPrimary).toBe(false);
  });
});

describe("registrationRejection", () => {
  it("accepts a second load order for a game when the ids differ", () => {
    const registered = [
      makeRegisteredLoadOrder(),
      makeRegisteredLoadOrder({ loadOrderId: "archive" }),
    ];

    expect(
      registrationRejection(registered, makeLoadOrderGameInfo({ loadOrderId: "redmod" })),
    ).toBeUndefined();
  });

  it("accepts the same id for a different game", () => {
    expect(
      registrationRejection(
        [makeRegisteredLoadOrder()],
        makeLoadOrderGameInfo({ gameId: "fallout4" }),
      ),
    ).toBeUndefined();
  });

  it("rejects a second id-less registration for a game", () => {
    expect(registrationRejection([makeRegisteredLoadOrder()], makeLoadOrderGameInfo())).toBe(
      RegistrationRejection.Duplicate,
    );
  });

  it("rejects a second registration with the same id", () => {
    const registered = [makeRegisteredLoadOrder({ loadOrderId: "archive" })];

    expect(
      registrationRejection(registered, makeLoadOrderGameInfo({ loadOrderId: "archive" })),
    ).toBe(RegistrationRejection.Duplicate);
  });

  it.each(["", "has space", "has#hash", "dotted.id", "slash/id"])(
    "rejects the load order id %j",
    (loadOrderId) => {
      expect(registrationRejection([], makeLoadOrderGameInfo({ loadOrderId }))).toBe(
        RegistrationRejection.InvalidId,
      );
    },
  );

  it("rejects an id-less load order that claims to adopt the legacy order", () => {
    expect(registrationRejection([], makeLoadOrderGameInfo({ adoptsLegacyOrder: true }))).toBe(
      RegistrationRejection.AdopterWithoutId,
    );
  });

  it("rejects a second adopter for a game", () => {
    const registered = [
      makeRegisteredLoadOrder({ loadOrderId: "redmod", adoptsLegacyOrder: true }),
    ];
    const second = makeLoadOrderGameInfo({ loadOrderId: "archive", adoptsLegacyOrder: true });

    expect(registrationRejection(registered, second)).toBe(RegistrationRejection.SecondAdopter);
  });
});

describe("entriesForGame", () => {
  it("lists the primary first, then by priority, then in registration order", () => {
    const registered = [
      makeRegisteredLoadOrder({ loadOrderId: "late" }),
      makeRegisteredLoadOrder({ loadOrderId: "second", priority: 2 }),
      makeRegisteredLoadOrder({ gameId: "fallout4" }),
      makeRegisteredLoadOrder({ loadOrderId: "first", priority: 1 }),
      makeRegisteredLoadOrder(),
      makeRegisteredLoadOrder({ loadOrderId: "later" }),
    ];

    expect(ids(entriesForGame(registered, "skyrim"))).toEqual([
      DEFAULT_LOAD_ORDER_ID,
      "first",
      "second",
      "late",
      "later",
    ]);
  });

  it("returns nothing for a game without a load order", () => {
    expect(entriesForGame([makeRegisteredLoadOrder()], "fallout4")).toEqual([]);
  });
});

describe("findEntry", () => {
  it("returns the primary when no load order id is given", () => {
    const registered = [
      makeRegisteredLoadOrder({ loadOrderId: "archive" }),
      makeRegisteredLoadOrder(),
    ];

    expect(findEntry(registered, "skyrim")?.loadOrderId).toBe(DEFAULT_LOAD_ORDER_ID);
  });

  it("returns the first listed load order when the game has no primary", () => {
    const registered = [
      makeRegisteredLoadOrder({ loadOrderId: "archive", priority: 2 }),
      makeRegisteredLoadOrder({ loadOrderId: "redmod", priority: 1 }),
    ];

    expect(findEntry(registered, "skyrim")?.loadOrderId).toBe("redmod");
  });

  it("returns the named load order when an id is given", () => {
    const registered = [
      makeRegisteredLoadOrder(),
      makeRegisteredLoadOrder({ loadOrderId: "archive" }),
    ];

    expect(findEntry(registered, "skyrim", "archive")?.loadOrderId).toBe("archive");
  });

  it("returns nothing for an unknown id or game", () => {
    const registered = [makeRegisteredLoadOrder()];

    expect(findEntry(registered, "skyrim", "archive")).toBeUndefined();
    expect(findEntry(registered, "fallout4")).toBeUndefined();
  });
});
