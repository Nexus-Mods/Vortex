#!/usr/bin/env node

import { cp, mkdir, rm } from "node:fs/promises";
import { join, basename, dirname } from "node:path";

import { glob } from "glob";

const WORKSPACE = join(import.meta.dirname, "../..");
const DEST = join(import.meta.dirname, "build/bundledPlugins");

await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });

const distDirs = await glob("extensions/{*/dist,games/*/dist}", { cwd: WORKSPACE });

for (const dir of distDirs) {
  const name = basename(dirname(dir));
  await cp(join(WORKSPACE, dir), join(DEST, name), { recursive: true });
}

console.log(`copied ${distDirs.length} extensions`);
