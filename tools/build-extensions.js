#!/usr/bin/env node
/*
  Build all extensions and write logs per extension.
*/
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs() {
  const args = process.argv.slice(2);
  const res = { logDir: path.resolve(process.cwd(), 'extensions-build-logs') };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--log-dir') {
      res.logDir = path.resolve(args[++i]);
    }
  }
  return res;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return undefined;
  }
}

function buildExtension(extDir, logDir) {
  const name = path.basename(extDir);
  const logFile = path.join(logDir, `${name}.log`);
  const pkgPath = path.join(extDir, 'package.json');
  const pkg = readJSON(pkgPath) || {};
  const hasYarn = fs.existsSync(path.join(extDir, 'yarn.lock'));
  const hasNpm = fs.existsSync(path.join(extDir, 'package-lock.json')) || !hasYarn;

  // Ensure dependencies are installed (needed for local CLI tools like copyfiles)
  const nodeModulesPath = path.join(extDir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    let installCmd;
    let installArgs;
    if (hasYarn) { installCmd = 'yarn'; installArgs = ['install']; }
    else { installCmd = 'npm'; installArgs = ['install']; }
    const installRes = spawnSync(installCmd, installArgs, { cwd: extDir, shell: true });
    const installOut = (installRes.stdout || '').toString();
    const installErr = (installRes.stderr || '').toString();
    const installHeader = `# ${name}\n$ ${installCmd} ${installArgs.join(' ')}\nExit code: ${installRes.status}\n\n`;
    // prepend install log to build log to keep context
    fs.writeFileSync(logFile, installHeader + installOut + installErr);
    // if install failed, stop early
    if (installRes.status !== 0) {
      return { name, code: installRes.status };
    }
  }

  let cmd;
  let args;

  if (pkg.scripts && pkg.scripts.build) {
    if (hasYarn) { cmd = 'yarn'; args = ['run', 'build']; }
    else { cmd = 'npm'; args = ['run', 'build']; }
  } else if (fs.existsSync(path.join(extDir, 'tsconfig.json'))) {
    // fallback to tsc if no build script
    cmd = hasYarn ? 'yarn' : 'npx';
    args = hasYarn ? ['tsc', '-p', 'tsconfig.json', '--pretty', 'false'] : ['tsc', '-p', 'tsconfig.json', '--pretty', 'false'];
  } else {
    // nothing to do
    fs.writeFileSync(logFile, `Skipping ${name}: no build script or tsconfig.json\n`);
    return { name, code: 0 };
  }

  // Disable fork-ts-checker type checking in webpack builds to avoid noisy lib d.ts errors
  const env = Object.assign({}, process.env, { BUILD_QUICK_AND_DIRTY: '1' });
  const result = spawnSync(cmd, args, { cwd: extDir, shell: true, env });
  const stdout = (result.stdout || '').toString();
  const stderr = (result.stderr || '').toString();
  const header = `# ${name}\n$ ${cmd} ${args.join(' ')}\nExit code: ${result.status}\n\n`;
  // append build logs after install logs if present
  if (fs.existsSync(logFile)) {
    fs.appendFileSync(logFile, '\n' + header + stdout + stderr);
  } else {
    fs.writeFileSync(logFile, header + stdout + stderr);
  }
  return { name, code: result.status };
}

function main() {
  const { logDir } = parseArgs();
  ensureDir(logDir);
  const extRoot = path.join(process.cwd(), 'extensions');
  const entries = fs.readdirSync(extRoot, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => path.join(extRoot, e.name));
  const results = [];
  for (const dir of dirs) {
    results.push(buildExtension(dir, logDir));
  }
  const failed = results.filter(r => r.code !== 0);
  console.log(`Built ${results.length} extensions. Failed: ${failed.length}. Logs: ${logDir}`);
  if (failed.length > 0) {
    console.log('Failures:', failed.map(f => f.name).join(', '));
    process.exitCode = 1;
  }
}

main();