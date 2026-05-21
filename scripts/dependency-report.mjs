import { exec } from "node:child_process";
import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const REPORT_FILE = path.join(ROOT_DIR, "etc", "Dependency Report.md");

async function writeReport() {
  const { stdout: raw } = await execAsync("pnpm -F @vortex/main list --prod --json");

  // pnpm list returns an array of workspace packages, grab the first entry
  const [{ dependencies = {} }] = JSON.parse(raw);

  const rows = Object.entries(dependencies)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([depName, { version: depVersion }]) => `| ${depName} | ${depVersion} |`)
    .join("\n");

  const md = `# Dependency Report

This file was auto-generated, don't edit it directly!

This is a list of all modules leaked by Vortex to extensions. Any module listed here is importable by extensions thanks to nodeIntegration.

## Direct Production Dependencies

| Package | Version |
| ------- | ------- |
${rows}
`;

  await writeFile(REPORT_FILE, md);
  console.log(`Wrote ${Object.keys(dependencies).length} dependencies to ${REPORT_FILE}`);
}

async function main() {
  await writeReport();
}

await main();
