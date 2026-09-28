import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { ghost, isGhosted, unghost } from "./ghost";

const DATA = path.join(path.sep, "games", "Skyrim", "Data");

describe("isGhosted", () => {
  it("recognises the ghost suffix in any casing", () => {
    expect(isGhosted(path.join(DATA, "Mod.esp.ghost"))).toBe(true);
    expect(isGhosted(path.join(DATA, "Mod.esp.GHOST"))).toBe(true);
    expect(isGhosted(path.join(DATA, "Mod.esp.Ghost"))).toBe(true);
  });

  it("leaves a plugin without the suffix alone", () => {
    expect(isGhosted(path.join(DATA, "Mod.esp"))).toBe(false);
    expect(isGhosted(path.join(DATA, "ghost.esm"))).toBe(false);
  });
});

describe("unghost", () => {
  it("strips the suffix and keeps the directory and the plugin extension", () => {
    expect(unghost(path.join(DATA, "Mod.esm.GHOST"))).toBe(path.join(DATA, "Mod.esm"));
  });

  it("returns a plugin without the suffix unchanged", () => {
    expect(unghost(path.join(DATA, "Mod.esm"))).toBe(path.join(DATA, "Mod.esm"));
  });
});

describe("ghost", () => {
  it("adds the suffix once, whatever casing the plugin carried", () => {
    expect(ghost(path.join(DATA, "Mod.esm"))).toBe(path.join(DATA, "Mod.esm.ghost"));
    expect(ghost(path.join(DATA, "Mod.esm.GHOST"))).toBe(path.join(DATA, "Mod.esm.ghost"));
  });
});
