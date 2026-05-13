#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node copy-native.mjs <file1> <file2> ...");
  process.exit(1);
}

const files = args.filter((arg) => !arg.startsWith("-") && !/^\d+$/.test(arg));
const copyFlags =
  args.filter((arg) => arg.startsWith("-") || /^\d+$/.test(arg)).join(" ") || "-u 1 -f";

const missingFiles = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error("Missing native files:");
  for (const file of missingFiles) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

const destDir = "dist";
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const fileList = files.join(" ");
const command = `copyfiles ${copyFlags} ${fileList} ${destDir}`;

try {
  execSync(command, { stdio: "inherit" });
} catch (err) {
  console.error("Failed to copy native files");
  process.exit(1);
}
