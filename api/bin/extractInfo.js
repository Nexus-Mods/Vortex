#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function transformName(input) {
  return input.charAt(0).toUpperCase() + input.substr(1).replace(/-([a-z])/g, (match, m1) => ' ' + m1.toUpperCase());
}

/**
 * function intended to be run during build of an extension,
 * extracting details about it from its package.json
 * @param {string} extPath path to the extension
 * @returns {any} an extensionInfo object
 */
function extractExtensionInfo(extPath) {
  const pkgInfo = JSON.parse(fs.readFileSync(path.join(extPath, 'package.json')).toString());

  return {
    name: transformName(pkgInfo.name),
    author: pkgInfo.author,
    version: pkgInfo.version,
    description: pkgInfo.description,
  };
}

fs.writeFileSync(path.join('dist', 'info.json'), JSON.stringify(extractExtensionInfo(process.cwd())));
