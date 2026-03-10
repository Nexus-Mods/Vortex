#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";

function transformName(input) {
  return (
    input.charAt(0).toUpperCase() +
    input.substr(1).replace(/-([a-z])/g, (match, m1) => " " + m1.toUpperCase())
  );
}

function getExtensionName(pkgInfo) {
  if (pkgInfo.config && pkgInfo.config.game) {
    return `Game: ${pkgInfo.config.game}`;
  }
  if (pkgInfo.config && pkgInfo.config.extensionName) {
    return pkgInfo.config.extensionName;
  }
  return transformName(pkgInfo.name);
}

/**
 * function intended to be run during build of an extension,
 * extracting details about it from its package.json
 * @param {string} extPath path to the extension
 * @returns {import('vortex-api').types.IExtension} an extensionInfo object
 */
function extractExtensionInfo(extPath) {
  const pkgInfo = JSON.parse(
    fs.readFileSync(path.join(extPath, "package.json")).toString(),
  );

  return {
    name: getExtensionName(pkgInfo),
    namespace: pkgInfo.config?.namespace,
    author: pkgInfo.author,
    version: pkgInfo.version,
    description: pkgInfo.description,
    issueTrackerURL: pkgInfo.config?.issueTracker,
  };
}

fs.writeFileSync(
  path.join("dist", "info.json"),
  JSON.stringify(extractExtensionInfo(process.cwd())),
);
