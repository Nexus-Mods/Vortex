import { describe, expect, it } from "vitest";

import { makeRegisteredLoadOrder } from "../../../test-utils/builders";
import { DEFAULT_LOAD_ORDER_ID } from "../types/types";
import { headerActionInstanceId, resolveActiveLoadOrderId } from "./tabs";

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

describe("headerActionInstanceId", () => {
  it("names the shown load order when the game gave it an id", () => {
    expect(headerActionInstanceId("archive")).toBe("archive");
  });

  it("passes no instance id for a load order the game left unnamed", () => {
    expect(headerActionInstanceId(DEFAULT_LOAD_ORDER_ID)).toBeUndefined();
  });

  it("passes no instance id for a game without load orders", () => {
    expect(headerActionInstanceId(undefined)).toBeUndefined();
  });
});
