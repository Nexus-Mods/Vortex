import * as fs from "node:fs";
import * as path from "node:path";
import { rolldown } from "rolldown";

import { createConfig, mainOutputDirectory } from "../../rolldown.base.mjs";

const INPUT = path.resolve(import.meta.dirname, "src", "main.ts");
const OUTPUT = path.join(mainOutputDirectory, "main.cjs");

const config = createConfig(INPUT, OUTPUT, "cjs", [], (id) => {
  if (id.startsWith("@vortex/shared")) return false;

  if (id.startsWith(".")) return false;
  if (path.isAbsolute(id)) return false;

  return true;
});

const bundle = await rolldown(config);
await bundle.write(config.output);

// Copy SQL query files to output directory
const queriesSrc = path.resolve(import.meta.dirname, "..", "..", "src", "queries");
const queriesDest = path.join(mainOutputDirectory, "queries");

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.name.endsWith(".sql")) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(queriesSrc)) {
  copyDirSync(queriesSrc, queriesDest);
}
