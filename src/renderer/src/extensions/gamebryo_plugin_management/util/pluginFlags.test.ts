import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { makeESPFile } from "../../../test-utils/builders";
import { pluginFlags } from "./pluginFlags";

// a folder that does not exist: the flags come from the parsed header and the file name alone
const DATA = path.join(path.sep, "nowhere", "Data");

describe("pluginFlags", () => {
  it("counts an .esm as a master whatever its header says", () => {
    expect(pluginFlags(path.join(DATA, "Mod.esm"), makeESPFile(), "skyrimse").isMaster).toBe(true);
  });

  it("trusts the header's master flag on an .esp", () => {
    const flags = pluginFlags(
      path.join(DATA, "Mod.esp"),
      makeESPFile({ isMaster: true }),
      "skyrimse",
    );

    expect(flags.isMaster).toBe(true);
  });

  it("reads a ghosted plugin's flags by its real extension", () => {
    const flags = pluginFlags(path.join(DATA, "Mod.esm.GHOST"), makeESPFile(), "skyrimse");

    expect(flags.isMaster).toBe(true);
    expect(flags.isLight).toBe(false);
  });

  it("passes the header's medium flag through", () => {
    const flags = pluginFlags(
      path.join(DATA, "Mod.esm"),
      makeESPFile({ isMedium: true }),
      "starfield",
    );

    expect(flags.isMedium).toBe(true);
  });

  it("counts an .esl as a light master where the game has light plugins", () => {
    const flags = pluginFlags(path.join(DATA, "Mod.esl"), makeESPFile(), "skyrimse");

    expect(flags).toEqual({ isMaster: true, isLight: true, isMedium: false });
  });

  it("reports no light plugin for a game without them", () => {
    const flags = pluginFlags(
      path.join(DATA, "Mod.esl"),
      makeESPFile({ isLight: true }),
      "skyrimvr",
    );

    expect(flags.isLight).toBe(false);
    expect(flags.isMaster).toBe(false);
  });
});
