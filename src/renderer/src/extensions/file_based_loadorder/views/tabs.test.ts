import { describe, expect, it } from "vitest";

import { makeRegisteredLoadOrder } from "../../../test-utils/builders";
import { DEFAULT_LOAD_ORDER_ID } from "../types/types";
import { resolveActiveLoadOrderId } from "./tabs";

const entries = [makeRegisteredLoadOrder(), makeRegisteredLoadOrder({ loadOrderId: "archive" })];

describe("resolveActiveLoadOrderId", () => {
  it("keeps the selected load order while the game registers it", () => {
    expect(resolveActiveLoadOrderId(entries, "archive")).toBe("archive");
  });

  it("opens the game's first load order when nothing is selected", () => {
    expect(resolveActiveLoadOrderId(entries, undefined)).toBe(DEFAULT_LOAD_ORDER_ID);
  });

  it("opens the game's first load order when the selected one is gone", () => {
    expect(resolveActiveLoadOrderId(entries, "redmod")).toBe(DEFAULT_LOAD_ORDER_ID);
  });

  it("opens nothing for a game without load orders", () => {
    expect(resolveActiveLoadOrderId([], "archive")).toBeUndefined();
  });
});
