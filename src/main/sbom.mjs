#!/usr/bin/env node

import { exec } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const WORKSPACE = join(import.meta.dirname, "../..");
const OUTPUT = join(WORKSPACE, "assets", "bom.json");

const { stdout } = await execAsync("pnpm sbom -P --sbom-format cyclonedx --reporter=silent", {
  cwd: import.meta.dirname,
  maxBuffer: 64 * 1024 * 1024,
});

JSON.parse(stdout);

await writeFile(OUTPUT, stdout);
console.log(`Wrote SBOM to ${OUTPUT}`);
