import path from "node:path";

import minimatch from "minimatch";
import { describe, expect, it } from "vitest";

import { DO_NOT_DEPLOY, IGNORE_CONFLICTS } from "./common";
import { installMenuMod } from "./installers";

// Use the same case-insensitive glob matching as the deployment blacklist.
const matches = (file: string, patterns: string[]) =>
  patterns.some((pattern) => minimatch(file, pattern, { nocase: true }));

const SETTINGS_FILES = [
  "input.settings.part.txt",
  "user.settings.part.txt",
  "dx12user.settings.part.txt",
];

describe("settings fragment deployment", () => {
  it.each(SETTINGS_FILES)("keeps %s available to the post-deployment merger", async (filename) => {
    const fragment = path.join("Mods", "modExample", filename);
    const result = await installMenuMod([fragment], path.join("staging", "Example.installing"));
    const deployed = result.instructions
      .filter((instruction) => instruction.type === "copy")
      .map((instruction) => instruction.destination)
      .filter((destination) => !matches(destination, DO_NOT_DEPLOY));

    expect(deployed).toContain(fragment);
  });

  it.each(SETTINGS_FILES)("continues to ignore conflicts for %s", (filename) => {
    expect(matches(path.join("Mods", "modExample", filename), IGNORE_CONFLICTS)).toBe(true);
  });

  it("continues to exclude the root readme from deployment and conflicts", () => {
    expect(matches("readme.txt", DO_NOT_DEPLOY)).toBe(true);
    expect(matches("readme.txt", IGNORE_CONFLICTS)).toBe(true);
  });

  it("keeps script conflicts visible", () => {
    const script = path.join("Mods", "modExample", "content", "scripts", "player.ws");
    expect(matches(script, DO_NOT_DEPLOY)).toBe(false);
    expect(matches(script, IGNORE_CONFLICTS)).toBe(false);
  });
});
