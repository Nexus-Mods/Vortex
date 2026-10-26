import { expect, test } from "vitest";

import { makeGeneratedFileSource, makeLockfile } from "../../../test-utils/lockfileBuilders";
import { addGeneratedFiles } from "./generatedFiles";

test("a generated file joins the lockfile in destination order", () => {
  const lockfile = makeLockfile();
  const pluginsTxt = makeGeneratedFileSource();

  expect(addGeneratedFiles(lockfile, [pluginsTxt]).files).toEqual([pluginsTxt, ...lockfile.files]);
});

test("a generated file replaces a mod file at the same destination", () => {
  const lockfile = makeLockfile();
  const [modFile, otherModFile] = lockfile.files;
  const generated = makeGeneratedFileSource({ destinationPath: modFile.destinationPath });

  expect(addGeneratedFiles(lockfile, [generated]).files).toEqual([generated, otherModFile]);
});

test("a generated file replaces a mod file spelt in another case, at the mod file's spelling", () => {
  const lockfile = makeLockfile();
  const [modFile, otherModFile] = lockfile.files;
  const generated = makeGeneratedFileSource({
    destinationPath: modFile.destinationPath.toUpperCase(),
  });

  expect(addGeneratedFiles(lockfile, [generated]).files).toEqual([
    { ...generated, destinationPath: modFile.destinationPath },
    otherModFile,
  ]);
});
