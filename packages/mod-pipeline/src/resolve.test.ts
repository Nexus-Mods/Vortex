import { expect, test } from "vitest";

import { loadResolverFixtures } from "./loadFixtures";
import { resolve } from "./resolve";

const fileOverrideFixture = loadResolverFixtures().find(
  ({ fileName }) => fileName === "file-override.json",
)?.fixture;

test("a file override written with Windows separators still leaves the file to the earlier mod", () => {
  if (fileOverrideFixture === undefined) {
    throw new Error("the file-override fixture is missing");
  }
  const { state, gameFacts, expected } = structuredClone(fileOverrideFixture);
  const overridingMod = state.persistent.mods[gameFacts.gameMode]?.["ModB"];
  if (overridingMod === undefined) {
    throw new Error("the file-override fixture has no ModB");
  }
  overridingMod.fileOverrides = overridingMod.fileOverrides?.map((override) =>
    override.replaceAll("/", "\\"),
  );

  expect(resolve(state, gameFacts)).toEqual(expected);
});
