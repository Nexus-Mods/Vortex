import { describe, expect, expectTypeOf, it } from "vitest";

import { VortexError } from "../errors/base";
import { VortexModId, VortexProfileId } from "./ids";

describe("id brands", () => {
  it("keep the id they are given", () => {
    expect(VortexModId("mod-1")).toBe("mod-1");
    expect(VortexProfileId("profile-1")).toBe("profile-1");
  });

  it("reject an empty string", () => {
    expect(() => VortexModId("")).toThrow(VortexError);
    expect(() => VortexProfileId("")).toThrow(VortexError);
  });

  it("are not made from a plain string or from another kind of id", () => {
    expectTypeOf<string>().not.toExtend<VortexModId>();
    expectTypeOf<VortexProfileId>().not.toExtend<VortexModId>();
    expectTypeOf<VortexModId>().not.toExtend<VortexProfileId>();
    expectTypeOf<VortexModId>().toExtend<string>();
  });
});
