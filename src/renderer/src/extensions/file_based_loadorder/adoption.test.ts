import { describe, expect, it } from "vitest";

import { makeLoadOrder, makeRegisteredLoadOrder } from "../../test-utils/builders";
import { adoptedLoadOrder, orphansLegacyOrder } from "./adoption";

const adopter = makeRegisteredLoadOrder({ loadOrderId: "redmod", adoptsLegacyOrder: true });

describe("adoptedLoadOrder", () => {
  it("starts an adopter from a copy of the legacy order", () => {
    const legacy = makeLoadOrder("a.pak", "b.pak");

    const adopted = adoptedLoadOrder(adopter, legacy, undefined);

    expect(adopted).toEqual(legacy);
    expect(adopted).not.toBe(legacy);
  });

  it("does not seed an adopter that already has an order, even an emptied one", () => {
    expect(adoptedLoadOrder(adopter, makeLoadOrder("a.pak"), [])).toBeUndefined();
  });

  it("does not seed from an empty legacy order", () => {
    expect(adoptedLoadOrder(adopter, [], undefined)).toBeUndefined();
    expect(adoptedLoadOrder(adopter, undefined, undefined)).toBeUndefined();
  });

  it("does not seed a load order that does not adopt", () => {
    expect(
      adoptedLoadOrder(
        makeRegisteredLoadOrder({ loadOrderId: "archive" }),
        makeLoadOrder("a.pak"),
        undefined,
      ),
    ).toBeUndefined();
  });
});

describe("orphansLegacyOrder", () => {
  it("flags named-only load orders that leave a populated legacy order unclaimed", () => {
    const entries = [
      makeRegisteredLoadOrder({ loadOrderId: "archive" }),
      makeRegisteredLoadOrder({ loadOrderId: "redmod" }),
    ];

    expect(orphansLegacyOrder(entries, makeLoadOrder("a.pak"))).toBe(true);
  });

  it("accepts a game whose primary still reads the legacy order", () => {
    expect(
      orphansLegacyOrder(
        [makeRegisteredLoadOrder(), makeRegisteredLoadOrder({ loadOrderId: "archive" })],
        makeLoadOrder("a.pak"),
      ),
    ).toBe(false);
  });

  it("accepts a game with an adopter", () => {
    expect(
      orphansLegacyOrder(
        [adopter, makeRegisteredLoadOrder({ loadOrderId: "archive" })],
        makeLoadOrder("a.pak"),
      ),
    ).toBe(false);
  });

  it("accepts an empty legacy order", () => {
    expect(orphansLegacyOrder([makeRegisteredLoadOrder({ loadOrderId: "archive" })], [])).toBe(
      false,
    );
  });
});
