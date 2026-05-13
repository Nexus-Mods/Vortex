#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const EXTENSIONS_DIR = path.resolve(import.meta.dirname);
const BASE_DIR = path.dirname(import.meta.dirname);

function copyExtension(extension, target) {
  const outputDir = path.basename(extension);

  const sourceDir = path.join(EXTENSIONS_DIR, extension, "dist");
  const destDir = path.join(BASE_DIR, "src", "main", target, "bundledPlugins", outputDir);

  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    fs.cpSync(srcPath, destPath, { recursive: true });
  }

  console.log(`Copied ${files.length} files to ${destDir}`);
}

// Derive extension name from CWD if not provided as an argument
const extensionArg = process.argv[2];
const target = process.argv[3] ?? process.argv[2];

let extension;
if (extensionArg && extensionArg !== "out" && extensionArg !== "dist") {
  // Explicit extension name passed
  extension = extensionArg;
} else {
  // Infer from CWD — expect CWD to be inside the extension folder
  const cwd = process.cwd();
  const rel = path.relative(EXTENSIONS_DIR, cwd);
  if (!rel || rel.startsWith("..")) {
    console.error(
      `Error: CWD (${cwd}) is not inside the extensions directory (${EXTENSIONS_DIR}).`,
    );
    console.error(
      "Either run this script from within an extension folder, or pass the extension name explicitly.",
    );
    process.exit(1);
  }
  // Use the relative path directly (e.g. "my-ext" or "category/my-ext")
  extension = rel.split(path.sep).slice(0, 2).join(path.sep);
}

if (!target || (target !== "out" && target !== "dist")) {
  console.error("Error: target is required (out or dist)");
  console.error("Usage: node copy-extension.mjs [extension] <target>");
  process.exit(1);
}

const extDir = path.join(EXTENSIONS_DIR, extension);
if (!fs.existsSync(extDir)) {
  console.error(`Error: Extension directory does not exist: ${extDir}`);
  process.exit(1);
}

console.log(`Extension: ${extension}`);
copyExtension(extension, target);
