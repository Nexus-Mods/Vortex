import { describe, expect, expectTypeOf, it } from "vitest";

import { VortexError } from "../errors/base";
import {
  isVortexProfileId,
  isVortexModId,
  type VortexProfileId,
  toVortexProfileId,
  toVortexModId,
  type VortexModId,
} from "./ids";

describe("id brands", () => {
  it("keep the id they are given", () => {
    expect(toVortexModId("mod-1")).toBe("mod-1");
    expect(toVortexProfileId("profile-1")).toBe("profile-1");
    expect(isVortexModId("mod-1") && isVortexProfileId("profile-1")).toBe(true);
  });

  it.for<[string, unknown]>([
    ["an empty string", ""],
    ["undefined", undefined],
    ["null", null],
    ["a number", 42],
    ["an object", { id: "mod-1" }],
  ])("reject %s", ([, raw]) => {
    expect(isVortexModId(raw)).toBe(false);
    expect(isVortexProfileId(raw)).toBe(false);
    expect(() => toVortexModId(raw)).toThrow(VortexError);
    expect(() => toVortexProfileId(raw)).toThrow(VortexError);
  });

  it("are not made from a plain string or from another kind of id", () => {
    expectTypeOf<string>().not.toExtend<VortexModId>();
    expectTypeOf<VortexProfileId>().not.toExtend<VortexModId>();
    expectTypeOf<VortexModId>().not.toExtend<VortexProfileId>();
    expectTypeOf<VortexModId>().toExtend<string>();
  });
});
