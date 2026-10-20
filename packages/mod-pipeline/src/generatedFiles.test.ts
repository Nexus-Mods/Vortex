import { expect, test } from "vitest";

import { addGeneratedFiles } from "./generatedFiles";
import { loadFixture } from "./loadFixtures";
import { LockfileSchema, type Lockfile } from "./lockfile";
import { makeGeneratedFile } from "./testBuilders";

const singleModLockfile = (): Lockfile => loadFixture("single-mod.json").expected;

test("a generated file joins the lockfile in destination order", () => {
  const lockfile = singleModLockfile();
  const pluginsTxt = makeGeneratedFile();

  const withGenerated = addGeneratedFiles(lockfile, [pluginsTxt]);

  expect(withGenerated.files).toEqual([pluginsTxt, ...lockfile.files]);
  expect(LockfileSchema.safeParse(withGenerated).success).toBe(true);
});

test("a generated file replaces a mod file at the same destination", () => {
  const lockfile = singleModLockfile();
  const [modFile, otherModFile] = lockfile.files;
  if (modFile === undefined) {
    throw new Error("the single-mod fixture has no files");
  }
  const generated = makeGeneratedFile({ destinationPath: modFile.destinationPath });

  expect(addGeneratedFiles(lockfile, [generated]).files).toEqual([generated, otherModFile]);
});

test("a destination generated twice is rejected", () => {
  expect(() =>
    addGeneratedFiles(singleModLockfile(), [makeGeneratedFile(), makeGeneratedFile()]),
  ).toThrow("generated twice");
});
