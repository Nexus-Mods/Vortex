#!/usr/bin/env node
/*
 * Quick codemod to reduce common TS errors across extensions:
 * - Replace `new Promise(` with `new Bluebird(` when Bluebird is imported
 * - Replace `Promise.resolve(` with `Bluebird.resolve(` when Bluebird is imported
 * - Replace `fs.readFile(` with `fs.readFileAsync(` when using vortex-api util/fs
 */
const fs = require('fs');
const path = require('path');

function walk(dir, list = []) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of ents) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, list);
    } else {
      list.push(p);
    }
  }
  return list;
}

function hasBluebirdImport(src) {
  return (/import\s+Bluebird\s+from\s+['"]bluebird['"];?/m.test(src)
    || /import\s+\*\s+as\s+Bluebird\s+from\s+['"]bluebird['"];?/m.test(src));
}

function usesVortexFs(src) {
  // Either direct util/fs import or destructured { fs } from vortex-api
  return (/from\s+['"]vortex-api\/lib\/util\/fs['"];?/m.test(src)
    || /import\s+\{[^}]*\bfs\b[^}]*\}\s+from\s+['"]vortex-api['"];?/m.test(src));
}

function transformFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const bluebirdPresent = hasBluebirdImport(src);
  const vortexFsPresent = usesVortexFs(src);

  if (bluebirdPresent) {
    // new Promise -> new Bluebird
    const replNewPromise = src.replace(/new\s+Promise\s*\(/g, (m) => {
      changed = true;
      return 'new Bluebird(';
    });
    if (replNewPromise !== src) src = replNewPromise;

    // Promise.resolve -> Bluebird.resolve
    const replPromiseResolve = src.replace(/Promise\.resolve\s*\(/g, (m) => {
      changed = true;
      return 'Bluebird.resolve(';
    });
    if (replPromiseResolve !== src) src = replPromiseResolve;

    // Wrap items in Bluebird.any([...]) with Bluebird.resolve(...)
    const anyRegex = /Bluebird\.any\s*\(\s*\[(.*?)\]\s*\)/gs;
    src = src.replace(anyRegex, (full, inner) => {
      const items = inner.split(',').map(s => s.trim()).filter(s => s.length > 0);
      const wrapped = items.map(s => {
        if (/^Bluebird\.(resolve|any|all|race)/.test(s) || /^new\s+Bluebird\s*\(/.test(s)) {
          return s;
        }
        return `Bluebird.resolve(${s})`;
      });
      changed = true;
      return `Bluebird.any([ ${wrapped.join(', ')} ])`;
    });
  }

  if (vortexFsPresent) {
    // readFile( -> readFileAsync( when using vortex-api fs
    const replReadFile = src.replace(/([\s.;])readFile\s*\(/g, (m, pre) => {
      changed = true;
      return pre + 'readFileAsync(';
    });
    if (replReadFile !== src) src = replReadFile;

    // stat( -> statAsync(
    const replStat = src.replace(/([\s.;])stat\s*\(/g, (m, pre) => {
      changed = true;
      return pre + 'statAsync(';
    });
    if (replStat !== src) src = replStat;

    // readdir( -> readdirAsync(
    const replReaddir = src.replace(/([\s.;])readdir\s*\(/g, (m, pre) => {
      changed = true;
      return pre + 'readdirAsync(';
    });
    if (replReaddir !== src) src = replReaddir;
  }

  // getBoundingClientRect safety: ensure node is Element
  if (/getBoundingClientRect\s*\(/.test(src)) {
    const replGBCR = src.replace(/(const\s+hoverBoundingRect\s*=\s*)([^;]+)\.getBoundingClientRect\s*\(\)/, (m, pre, nodeExpr) => {
      changed = true;
      return `${pre}((${nodeExpr}) as Element).getBoundingClientRect()`;
    });
    if (replGBCR !== src) src = replGBCR;
  }

  if (changed) {
    fs.writeFileSync(filePath, src, 'utf8');
    return true;
  }
  return false;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const extDir = path.join(root, 'extensions');
  const extList = fs.readdirSync(extDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(extDir, d.name));

  let totalChanged = 0;
  for (const ext of extList) {
    const pkgPath = path.join(ext, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const srcDir = path.join(ext, 'src');
    if (!fs.existsSync(srcDir)) continue;

    const files = walk(srcDir).filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'));
    let changedCount = 0;
    for (const file of files) {
      try {
        if (transformFile(file)) changedCount += 1;
      } catch (e) {
        // continue on errors but log
        process.stderr.write(`[fix-extensions] Failed ${file}: ${e.message}\n`);
      }
    }
    if (changedCount > 0) {
      totalChanged += changedCount;
      process.stdout.write(`[fix-extensions] ${path.basename(ext)}: changed ${changedCount} files\n`);
    }
  }
  process.stdout.write(`[fix-extensions] Total changed files: ${totalChanged}\n`);
}

if (require.main === module) {
  main();
}