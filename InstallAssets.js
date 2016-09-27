const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const exec = require('child_process').exec;

const data = require('./datafile.json');

const globOptions = { matchBase: true, globstar: true };

if (process.argv.length < 3) {
  process.exit(1);
}
const tgt = process.argv[2];

let childProcesses = [];

// run other, independend commands concurrently to speed things up.
for (let spawn of data.spawn) {
  if (spawn.target.indexOf(tgt) === -1) {
    continue;
  }

  const cmdline = spawn.executable + ' ' + spawn.arguments.join(' ');
  const child = exec(spawn.executable + ' ' + spawn.arguments.join(' '), {
    stdio: [0, 1, 2],
    env: Object.assign({}, process.env, spawn.env)
  });
  console.log('spawned', cmdline);
  child.stdout.on('data', (output) => {
    console.log(spawn.executable, output);
  });
  child.stderr.on('data', (output) => {
    console.log('Error:', spawn.executable, output);
  });
  child.on('close', (code) => {
    console.log('finished', spawn.executable, code);
  });
  childProcesses.push(spawn.executable);
  child.on('exit', () => {
    childProcesses = childProcesses.filter((proc) => proc !== spawn.executable);
  });
}

// copy files
for (let file of data.copy) {
  if (file.target.indexOf(tgt) === -1) {
    continue;
  }

  glob(file.srcPath, globOptions, (globErr, files) => {
    if (globErr !== null) {
      console.err('glob failed', globErr);
    }
    for (let globResult of files) {
      const globTarget = path.join(...globResult.split(/[\/\\]/).slice(file.skipPaths));
      const targetFile = path.join(tgt, file.outPath, globTarget);

      fs.copy(globResult, targetFile, (copyErr) => {
        if (copyErr !== null) {
          console.log('failed to copy', globResult, targetFile, copyErr);
        }
        else {
          console.log('copied', globResult, targetFile);
        }
      });
    }
  });
}

function waitForProcesses() {
  if (childProcesses.length > 0) {
    setTimeout(waitForProcesses, 100);
  }
}

waitForProcesses();
