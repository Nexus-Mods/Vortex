import { glob } from "glob";
import { mkdir, cp } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

import data from "./InstallAssets.json" with { type: "json" };

/** @type (import("glob").GlobOptionsWithFileTypesUnset) */
const globOptions = { matchBase: true, globstar: true };

if (process.argv.length < 3) {
  process.exit(1);
}

const tgt = process.argv[2];

let copies = -1;

try {
  const promises = data.copy.map(async (file) => {
    if (file.target.indexOf(basename(tgt)) === -1) {
      return;
    }

    const files = await glob(file.srcPath, globOptions);
    copies = copies === -1 ? files.length : (copies += files.length);

    const filePromises = files.map(async (globResult) => {
      let globTarget = join(
        ...globResult.split(/[\/\\]/).slice(file.skipPaths),
      );

      if (file.rename) {
        globTarget = join(dirname(globTarget), file.rename);
      }

      const targetFile = join(tgt, file.outPath, globTarget);

      try {
        await mkdir(dirname(targetFile), { recursive: true });
        await cp(globResult, targetFile, { recursive: true });
        console.log("copied", globResult, targetFile);
      } catch (err) {
        console.log("failed to copy", globResult, targetFile, err);
      } finally {
        --copies;
      }
    });

    await Promise.all(filePromises);
  });

  await Promise.all(promises);
} catch (err) {
  console.error(err);
} finally {
  console.log("done");
}
