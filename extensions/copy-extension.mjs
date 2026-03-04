#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const EXTENSIONS_DIR = path.resolve(import.meta.dirname);
const BASE_DIR = path.dirname(import.meta.dirname);

function copyExtension(extension, target) {
  const sourceDir = path.join(EXTENSIONS_DIR, extension, 'dist');
  const destDir = path.join(BASE_DIR, 'src', 'main', target, 'bundledPlugins', extension);

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

const extension = process.argv[2];
const target = process.argv[3];

if (!extension) {
  console.error('Usage: node copy-extension.mjs <extension> <target>');
  console.error('  <extension>  - Extension folder name (e.g., titlebar-launcher)');
  console.error('  <target>     - "out" or "dist"');
  process.exit(1);
}

if (!target) {
  console.error('Error: target is required (out or dist)');
  process.exit(1);
}

if (target !== 'out' && target !== 'dist') {
  console.error(`Error: target must be "out" or "dist", got "${target}"`);
  process.exit(1);
}

const extDir = path.join(EXTENSIONS_DIR, extension);
if (!fs.existsSync(extDir)) {
  console.error(`Error: Extension directory does not exist: ${extDir}`);
  process.exit(1);
}

copyExtension(extension, target);
