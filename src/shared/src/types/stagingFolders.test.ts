import { describe, expect, expectTypeOf, it } from "vitest";

import { VortexError } from "../errors/base";
import type { VortexModId } from "./ids";
import { VortexModStagingFolder, VortexStagingFolder } from "./stagingFolders";

describe("staging folder brands", () => {
  it("keep the folder they are given", () => {
    expect(VortexStagingFolder("D:\\Vortex Mods\\skyrimse")).toBe("D:\\Vortex Mods\\skyrimse");
    expect(VortexModStagingFolder("mod-1-folder")).toBe("mod-1-folder");
  });

  it("reject an empty string", () => {
    expect(() => VortexStagingFolder("")).toThrow(VortexError);
    expect(() => VortexModStagingFolder("")).toThrow(VortexError);
  });

  it("are not made from a plain string, from each other or from a mod id", () => {
    expectTypeOf<string>().not.toExtend<VortexStagingFolder>();
    expectTypeOf<string>().not.toExtend<VortexModStagingFolder>();
    expectTypeOf<VortexModStagingFolder>().not.toExtend<VortexStagingFolder>();
    expectTypeOf<VortexStagingFolder>().not.toExtend<VortexModStagingFolder>();
    expectTypeOf<VortexModId>().not.toExtend<VortexModStagingFolder>();
    expectTypeOf<VortexModStagingFolder>().not.toExtend<VortexModId>();
    expectTypeOf<VortexModStagingFolder>().toExtend<string>();
  });
});
