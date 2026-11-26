import { VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { makeMod } from "@/test-utils/builders";

import { categoryChangeActions } from "./categoryChangeActions";

const GAME = VortexGameId("skyrimse");

const valuesOf = (actions: unknown[]) =>
  actions.map((action) => (action as { payload: { value: unknown } }).payload.value);

describe("categoryChangeActions", () => {
  it("clears the category when the select is cleared", () => {
    const actions = categoryChangeActions(
      GAME,
      [makeMod({ id: "a" }), makeMod({ id: "b", state: "downloaded" })],
      undefined,
    );

    expect(valuesOf(actions)).toEqual([undefined, undefined]);
  });

  it("saves a numeric category id as its text", () => {
    expect(valuesOf(categoryChangeActions(GAME, [makeMod({ id: "a" })], 5))).toEqual(["5"]);
  });

  it("saves a category id as given", () => {
    expect(valuesOf(categoryChangeActions(GAME, [makeMod({ id: "a" })], "12"))).toEqual(["12"]);
  });
});
