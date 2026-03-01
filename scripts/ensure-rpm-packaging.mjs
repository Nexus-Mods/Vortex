#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function ensureLinuxTargets(filePath) {
  const source = readText(filePath);
  const json = JSON.parse(source);
  const linux = json.linux ?? {};
  const currentTargets = Array.isArray(linux.target)
    ? linux.target
    : linux.target != null
      ? [linux.target]
      : [];

  const nextTargets = [...new Set([...currentTargets, 'zip', 'rpm'])];

  if (JSON.stringify(currentTargets) === JSON.stringify(nextTargets)) {
    return;
  }

  const replacement = JSON.stringify(nextTargets);

  const updated = source.replace(
    /("linux"\s*:\s*\{[\s\S]*?"target"\s*:\s*)(\[[^\]]*\]|"[^"]+")/m,
    `$1${replacement}`,
  );

  writeText(filePath, updated);
}

function ensureLinuxRpmBuilderConfig(filePath) {
  const content = {
    extends: './electron-builder.config.json',
    linux: {
      target: ['rpm', 'zip'],
    },
    extraResources: ['./nsis/**/*', '../../locales'],
  };

  const next = `${JSON.stringify(content, null, 2)}\n`;
  const current = fs.existsSync(filePath) ? readText(filePath) : '';

  if (current !== next) {
    writeText(filePath, next);
  }
}

function ensureMainPackageScript(filePath) {
  const source = readText(filePath);
  const json = JSON.parse(source);
  const scripts = json.scripts ?? {};
  const targetValue =
    'node ./prepare-dist-package.mjs && pnpm install --dir=./dist && pnpm electron-builder --config ./electron-builder.linux-rpm.json --publish never';

  if (scripts['package:linux:rpm'] === targetValue) {
    return;
  }

  const scriptLine = `    "package:linux:rpm": "${targetValue}"`;
  const hasKey = /\n\s+"package:linux:rpm"\s*:\s*"[^"]*"\s*,?/m.test(source);

  let updated;
  if (hasKey) {
    updated = source.replace(
      /(\n\s+"package:linux:rpm"\s*:\s*")([^"]*)("\s*,?)/m,
      `$1${targetValue}$3`,
    );
  } else {
    updated = source.replace(
      /(\n\s+"package:nosign"\s*:\s*"[^"]*"\s*)(,?)/m,
      (_, line, comma) => `${line}${comma}\n${scriptLine},`,
    );
  }

  writeText(filePath, updated);
}

function run() {
  const builderConfigPath = path.join(repoRoot, 'src/main/electron-builder.config.json');
  const builderLinuxConfigPath = path.join(repoRoot, 'src/main/electron-builder.linux-rpm.json');
  const mainPackagePath = path.join(repoRoot, 'src/main/package.json');

  ensureLinuxTargets(builderConfigPath);
  ensureLinuxRpmBuilderConfig(builderLinuxConfigPath);
  ensureMainPackageScript(mainPackagePath);
}

run();
