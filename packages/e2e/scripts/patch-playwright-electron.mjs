/**
 * Patches Playwright's Electron launcher to work with Electron 30+.
 *
 * Electron 30+ (Chrome 138+) rejects --remote-debugging-port as a CLI argument.
 * The fix (microsoft/playwright#39012) moves it to app.commandLine.appendSwitch()
 * in the loader script, but this hasn't been released in a stable version yet.
 *
 * This script applies the same patch locally until Playwright ships it.
 * It can be removed once Playwright >= 1.59.0 (or whichever stable version includes the fix).
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm');
const playwrightDirs = fs.readdirSync(pnpmDir).filter(d => d.startsWith('playwright-core@'));

if (playwrightDirs.length === 0) {
  console.log('[patch] playwright-core not found in pnpm store, skipping.');
  process.exit(0);
}

for (const dir of playwrightDirs) {
  const electronDir = path.join(pnpmDir, dir, 'node_modules', 'playwright-core', 'lib', 'server', 'electron');
  const electronJs = path.join(electronDir, 'electron.js');
  const loaderJs = path.join(electronDir, 'loader.js');

  if (!fs.existsSync(electronJs)) {
    console.log(`[patch] ${dir}: electron.js not found, skipping.`);
    continue;
  }

  // Patch electron.js: remove --remote-debugging-port=0 from CLI args
  let electronCode = fs.readFileSync(electronJs, 'utf8');
  if (electronCode.includes('"--remote-debugging-port=0"')) {
    electronCode = electronCode.replace(
      'let electronArguments = ["--inspect=0", "--remote-debugging-port=0",',
      'let electronArguments = ["--inspect=0",'
    );
    fs.writeFileSync(electronJs, electronCode);
    console.log(`[patch] ${dir}/electron.js: removed --remote-debugging-port=0 from CLI args`);
  } else {
    console.log(`[patch] ${dir}/electron.js: already patched or fix shipped`);
  }

  // Patch loader.js: use app.commandLine.appendSwitch instead of CLI arg
  if (!fs.existsSync(loaderJs)) {
    console.log(`[patch] ${dir}: loader.js not found, skipping.`);
    continue;
  }

  let loaderCode = fs.readFileSync(loaderJs, 'utf8');
  if (loaderCode.includes('--remote-debugging-port=0')) {
    // Handle both single and double quote variants
    loaderCode = loaderCode.replace(
      /process\.argv\.splice\(1, process\.argv\.indexOf\(["']--remote-debugging-port=0["']\)\);/,
      'process.argv.splice(1, process.argv.indexOf("--inspect=0"));\napp.commandLine.appendSwitch("remote-debugging-port", "0");'
    );
    fs.writeFileSync(loaderJs, loaderCode);
    console.log(`[patch] ${dir}/loader.js: switched to app.commandLine.appendSwitch()`);
  } else {
    console.log(`[patch] ${dir}/loader.js: already patched or fix shipped`);
  }
}

console.log('[patch] Done.');
