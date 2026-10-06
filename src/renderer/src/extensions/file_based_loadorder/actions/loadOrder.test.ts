import { describe, expect, it } from "vitest";

import { makeLoadOrder } from "../../../test-utils/builders";
import { DEFAULT_LOAD_ORDER_ID } from "../types/types";
import { setFBLoadOrder, setFBLoadOrderEntry } from "./loadOrder";

describe("setFBLoadOrder", () => {
  it.for([undefined, DEFAULT_LOAD_ORDER_ID])(
    "writes the primary load order with id %j as a payload without an id",
    (loadOrderId) => {
      const loadOrder = makeLoadOrder("a.pak");

      expect(setFBLoadOrder("profile", loadOrder, loadOrderId).payload).toEqual({
        profileId: "profile",
        loadOrder,
      });
    },
  );

  it("writes a named load order with its id", () => {
    const loadOrder = makeLoadOrder("a.pak");

    expect(setFBLoadOrder("profile", loadOrder, "archive").payload).toEqual({
      profileId: "profile",
      loadOrder,
      loadOrderId: "archive",
    });
  });
});

describe("setFBLoadOrderEntry", () => {
  it("writes a primary entry as a payload without an id", () => {
    const [loEntry] = makeLoadOrder("a.pak");

    expect(setFBLoadOrderEntry("profile", loEntry, DEFAULT_LOAD_ORDER_ID).payload).toEqual({
      profileId: "profile",
      loEntry,
    });
  });
});
