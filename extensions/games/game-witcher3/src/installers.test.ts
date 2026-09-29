import path from "node:path";

import { describe, expect, it } from "vitest";

import { GAME_ID } from "./common";
import { MAX_MOD_NAME_LENGTH } from "./edition";
import { installContent, testSupportedContent } from "./installers";

// Built with the host's separators, as the file lists Vortex passes in are.
const SCRIPT = path.join("content", "scripts", "x.ws");
const STAGING = path.join(path.parse(process.cwd()).root, "staging");

describe("testSupportedContent", () => {
  it("claims archives that are a bare content directory", async () => {
    const result = await testSupportedContent([SCRIPT], GAME_ID);
    expect(result.supported).toBeTruthy();
  });

  it("leaves archives with no top level content directory alone", async () => {
    // These belong to the mod/dlc installers; claiming them here routes the
    // files through the wrong destination logic.
    const result = await testSupportedContent([path.join("modFoo", SCRIPT)], GAME_ID);
    expect(result.supported).toBeFalsy();
  });

  it("ignores archives for other games", async () => {
    const result = await testSupportedContent([SCRIPT], "skyrim");
    expect(result.supported).toBeFalsy();
  });
});

describe("installContent", () => {
  const DEST = path.join(STAGING, "Some Mod-1234.installing");

  it("returns instructions in the shape the install manager expects", async () => {
    const result = await installContent([SCRIPT], DEST);
    expect(Array.isArray(result.instructions)).toBe(true);
  });

  it("names the mod folder after the archive rather than its staging path", async () => {
    const result = await installContent([SCRIPT], DEST);
    expect(result.instructions[0].destination).toBe(
      path.join("modSomeMod-1234", "content", "scripts", "x.ws"),
    );
  });

  it("keeps the mod folder within the length the game accepts", async () => {
    const result = await installContent(
      [path.join("content", "x.ws")],
      path.join(STAGING, `${"A".repeat(120)}.installing`),
    );
    const folder = result.instructions[0].destination.split(/[\\/]/)[0];
    expect(folder.length).toBeLessThanOrEqual(MAX_MOD_NAME_LENGTH);
  });
});
