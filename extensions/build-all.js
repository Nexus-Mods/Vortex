const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findExtensions(root) {
  return fs.readdirSync(root)
    .filter(name => fs.statSync(path.join(root, name)).isDirectory())
    .filter(name => fs.existsSync(path.join(root, name, 'build.js')));
}

function runBuild(extPath) {
  const res = spawnSync('npm', ['run', 'webpack'], {
    cwd: extPath,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  return {
    name: path.basename(extPath),
    status: res.status === 0 ? 'success' : 'failure',
    exitCode: res.status,
    output: res.stdout.trim(),
    error: res.stderr.trim(),
  };
}

function main() {
  const root = __dirname;
  const candidates = findExtensions(root);
  const results = candidates.map(name => runBuild(path.join(root, name)));

  const summary = results.map(r => `${r.name}: ${r.status}`).join('\n');
  console.log('Build summary:\n' + summary);

  const failures = results.filter(r => r.status === 'failure');
  if (failures.length > 0) {
    console.log('\nDetailed failures:');
    failures.forEach(f => {
      console.log(`\n=== ${f.name} (exit ${f.exitCode}) ===`);
      console.log(f.output);
      console.error(f.error);
    });
    process.exit(1);
  }
}

main();