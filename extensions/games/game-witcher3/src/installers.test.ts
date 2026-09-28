import path from "node:path";

import { describe, expect, it } from "vitest";

import { GAME_ID } from "./common";
import { MAX_MOD_NAME_LENGTH } from "./edition";
import { installContent, testSupportedContent } from "./installers";

describe("testSupportedContent", () => {
  it("claims archives that are a bare content directory", async () => {
    const result = await testSupportedContent(["content\\scripts\\x.ws"], GAME_ID);
    expect(result.supported).toBeTruthy();
  });

  it("leaves archives with no top level content directory alone", async () => {
    // These belong to the mod/dlc installers; claiming them here routes the
    // files through the wrong destination logic.
    const result = await testSupportedContent(["modFoo\\content\\scripts\\x.ws"], GAME_ID);
    expect(result.supported).toBeFalsy();
  });

  it("ignores archives for other games", async () => {
    const result = await testSupportedContent(["content\\scripts\\x.ws"], "skyrim");
    expect(result.supported).toBeFalsy();
  });
});

describe("installContent", () => {
  const DEST = "C:\\staging\\Some Mod-1234.installing";

  it("returns instructions in the shape the install manager expects", async () => {
    const result = await installContent(["content\\scripts\\x.ws"], DEST);
    expect(Array.isArray(result.instructions)).toBe(true);
  });

  it("names the mod folder after the archive rather than its staging path", async () => {
    const result = await installContent(["content\\scripts\\x.ws"], DEST);
    expect(result.instructions[0].destination).toBe(
      path.join("modSomeMod-1234", "content", "scripts", "x.ws"),
    );
  });

  it("keeps the mod folder within the length the game accepts", async () => {
    const result = await installContent(
      ["content\\x.ws"],
      `C:\\staging\\${"A".repeat(120)}.installing`,
    );
    const folder = result.instructions[0].destination.split(/[\\/]/)[0];
    expect(folder.length).toBeLessThanOrEqual(MAX_MOD_NAME_LENGTH);
  });
});
