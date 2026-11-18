import { describe, expect, it } from "vitest";

import { makeMod } from "@/test-utils/builders";

import { modsSharedValue } from "./modsSharedValue";

describe("modsSharedValue", () => {
  it("is the value every mod has", () => {
    const mods = [makeMod({ id: "a", type: "dinput" }), makeMod({ id: "b", type: "dinput" })];

    expect(modsSharedValue(mods, ({ type }) => type)).toEqual({
      value: "dinput",
      isVarious: false,
    });
  });

  it("is various, and empty, where they differ", () => {
    const mods = [makeMod({ id: "a", type: "dinput" }), makeMod({ id: "b", type: "" })];

    expect(modsSharedValue(mods, ({ type }) => type)).toEqual({ value: "", isVarious: true });
  });
});
