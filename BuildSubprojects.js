const Promise = require('bluebird');
const { spawn } = require('child_process');
const copyfiles = require('copyfiles');
const fs = require('fs');
const fsP = require('fs').promises;
const minimist = require('minimist');
const path = require('path');
const rimraf = require('rimraf');
const vm = require('vm');

// Platform detection utilities
function isWindows() {
  return process.platform === 'win32';
}

function isMacOS() {
  return process.platform === 'darwin';
}

const projectGroups = JSON.parse(fs.readFileSync('./BuildSubprojects.json'));

const packageJSON = JSON.parse(fs.readFileSync('./package.json'));

const npmcli = isWindows() ? 'npm.cmd' : 'npm';

const yarncli = isWindows() ? 'yarn.cmd' : 'yarn';

const useYarn = true;

//const rebuild = path.join('node_modules', '.bin', process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild');
const globOptions = { };

const copyfilesAsync = Promise.promisify(copyfiles);
const rimrafAsync = Promise.promisify(rimraf);

class Unchanged extends Error {
  constructor(message = 'No changes') {
    super(message);
  }
}

class ConditionNotMet extends Error {
  constructor(project, condition) {
    super('condition not met');
    this.project = project;
    this.condition = condition;
  }
}
class ProcessFeedback {
  constructor(id) {
    this.id = id;
    this.output = [];
  }

  finish(desc, code) {
    if (code !== 0) {
      this.output.forEach((line) => console.log(line));
    }
    console.log(`(${this.id}) ${desc} finished with code ${code}`);
  }

  log(data) {
    if (data === undefined) {
      return;
    }
    let lines = data.split(/[\r\n\t]+/);
    lines.forEach((line) => {
      if (line.length > 0) {
        this.output.push(`-- ${line}`);
      }
    });
  }

  err(data) {
    if (data === undefined) {
      return;
    }
    let lines = data.split(/[\r\n\t]+/);
    lines.forEach((line) => {
      if (line.length > 0) {
        this.output.push(`xx ${line}`);
      }
    });
  }
}

function spawnAsync(exe, args, options, out) {
  return new Promise((resolve, reject) => {
    let desc = `${options.cwd || '.'}/${exe} ${args.join(' ')}`;
    out.log('started: ' + desc);
    try {
      let proc = spawn(exe, args, { ...options, shell: true });
      proc.stdout.on('data', (data) => out.log(data.toString()));
      proc.stderr.on('data', (data) => out.err(data.toString()));
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        out.finish(desc, code);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${args} failed with code ${code}`));
        }
      });
    } catch (err) {
      out.err(`failed to spawn ${desc}: ${err.message}`);
      reject(err);
    }
  });
}

let nextId = 0;
function getId() {
  return nextId++;
}

function npm(command, args, options, out) {
  if (!useYarn && (command === 'add')) {
    command = 'install';
  }
  // Remove --mutex option on macOS as it causes issues with rsync
  const mutexArgs = isMacOS() ? [] : ['--mutex', 'file'];
  return spawnAsync(useYarn ? yarncli : npmcli, [command, ...args, ...mutexArgs], options, out);
}

function changes(basePath, patterns, force) {
  if ((patterns === undefined) || force) {
    return Promise.resolve();
  }

  // Use the glob module instead of our custom patternMatcher
  const glob = require('glob');

  try {
    // Flatten all patterns into a single array of files
    const allFiles = patterns.flatMap(pattern => {
      // Handle different pattern types using glob
      return glob.sync(pattern, { cwd: basePath });
    }).filter(file => file !== undefined);

    if (allFiles.length === 0) {
      return Promise.resolve();
    }

    const fileTimes = allFiles.map(filePath => {
      try {
        const fullPath = path.join(basePath, filePath);
        const stat = fs.statSync(fullPath);
        return stat.mtime.getTime();
      } catch (err) {
        return 0;
      }
    });

    return Promise.resolve(Math.max(...fileTimes));
  } catch (err) {
    return Promise.resolve();
  }
}

function format(fmt, parameters) {
  return fmt.replace(/{([a-zA-Z_]+)}/g, (match, key) => {
    return typeof parameters[key] !== 'undefined' ? parameters[key] : match;
  });
}

function processModule(project, buildType, feedback) {
  const start = Date.now();
  let options = {};
  let modulePath;
  if (buildType !== 'out') {
    options.cwd = path.join(__dirname, buildType);
    modulePath = path.join(buildType, 'node_modules', project.module);
  } else {
    options.cwd = __dirname;
    modulePath = path.join('node_modules', project.module);
  }

  let build = project.build !== undefined && project.build !== false
    ? npm('install', [], { cwd: project.path }, feedback)
      .then(() => npm('run', [typeof project.build === 'string' ? project.build : 'build'], { cwd: project.path }, feedback))
    : Promise.resolve();

  return build
    .then(() => rimrafAsync(modulePath))
    .then(() => npm('add', [project.module], options, feedback))
    .then(() => {
      const elapsed = (Date.now() - start) / 1000;
      return { elapsed };
    });
}

async function updateSourceMap(filePath) {
  let dat = await fs.promises.readFile(filePath, { encoding: 'utf8' });

  const modPath = path.basename(path.dirname(filePath));

  dat = dat.replace(/\/\/# sourceMappingURL=([a-z\-.]+\.js\.map)$/,
    `//# sourceMappingURL=bundledPlugins/${modPath}/$1`);

  await fs.promises.writeFile(filePath, dat);
}

function processCustom(project, buildType, feedback, noparallel) {
  const start = Date.now();
  let instArgs = noparallel ? ['--network-concurrency', '1'] : [];
  let res = npm('install', instArgs, { cwd: project.path }, feedback)
      .then(() => npm('run', [typeof project.build === 'string' ? project.build : 'build'], { cwd: project.path }, feedback));
  if (project.copyTo !== undefined) {
    const source = path.join(project.path, 'dist', '**', '*');
    const output = format(project.copyTo, { BUILD_DIR: buildType });
    feedback.log('copying files', source, output);
    res = res
      .then(() => copyfilesAsync([source, output], project.depth || 3))
      .then(() => updateSourceMap(path.join(output, 'index.js')));

  }
  res = res.then(() => {
    const elapsed = (Date.now() - start) / 1000;
    return { elapsed };
  })
  return res;
}

function evalCondition(condition, context) {
  if (condition === undefined) {
    return true;
  }
  const script = new vm.Script(condition);
  return script.runInNewContext({ ... context, process });
}

function processProject(project, buildType, feedback, noparallel) {
  if (!evalCondition(project.condition, { buildType })) {
    return Promise.reject(new ConditionNotMet(project, project.condition));
  }
  if (project.type === 'install-module') {
    return processModule(project, buildType, feedback);
  } else if (project.type === 'build-copy') {
    return processCustom(project, buildType, feedback, noparallel);
  // } else if (project.type === 'electron-rebuild') {
  //   return processRebuild(project, buildType, feedback);
  }
  if (project.type.startsWith('_')) {
    return Promise.resolve(null);
  }
  return Promise.reject(new Error('invalid project descriptor ' + project.toString()));
}

function main(args) {
  if (args.length === 0) {
    console.error('No command line parameters specified');
    return Promise.reject(1);
  }

  const globalFeedback = new ProcessFeedback('global');

  const buildType = args._[0];
  const targetProject = args._[1]; // Optional project name filter

  process.env.TARGET_ENV = (buildType === 'app')
    ? 'production' : 'development';

  const buildStateName = `./BuildState_${buildType}.json`;
  let buildState;

  try {
    buildState = JSON.parse(fs.readFileSync(buildStateName));
  } catch (err) {
    buildState = {};
  }

  let failed = false;

  // the projects file contains groups of projects
  // each group is processed in parallel
  return Promise.each(projectGroups, (projects) => {
    return Promise.map(projects, (project) => {
    // Filter by target project if specified
    if (targetProject && project.name !== targetProject) {
      return Promise.resolve();
    }
    if ((project.variant !== undefined) && (buildType !== 'out') && (process.env.VORTEX_VARIANT !== project.variant)) {
      return Promise.resolve();
    }
    let feedback = new ProcessFeedback(project.name);
    return changes(project.path || '.', project.sources, args.f || (buildState[project.name] === undefined))
        .then((lastChange) => {
          if ((lastChange !== undefined) && (lastChange < buildState[project.name])) {
            const platform = isWindows() ? 'Windows' : isMacOS() ? 'macOS' : 'Linux';
            return Promise.reject(new Unchanged(`Extension "${project.name}" is already up-to-date and compatible with ${platform}, no rebuild needed (use -f to force rebuild)`));
          }
          return processProject(project, buildType, feedback, args.noparallel);
        })
        .then((result) => {
          const platformName = isWindows() ? 'Windows' : 
                              isMacOS() ? 'macOS' : 
                              process.platform === 'linux' ? 'Linux' : process.platform;
          if (result && result.elapsed) {
            console.log(`Successfully built extension "${project.name}" in ${result.elapsed} s - compatible with ${platformName} ✅`);
          } else {
            console.log(`Successfully built "${project.name}" - compatible with ${platformName} ✅`);
          }
          buildState[project.name] = Date.now();
          return fsP.writeFile(buildStateName, JSON.stringify(buildState, undefined, 2));
        })
        .catch((err) => {
          if (err instanceof Unchanged) {
            console.log(`✅ ${err.message}`);
            return Promise.resolve();
          } else if (err instanceof ConditionNotMet) {
            const targetPlatform = err.condition?.includes('win32') ? 'Windows' : 
                                 err.condition?.includes('darwin') ? 'macOS' : 
                                 err.condition?.includes('linux') ? 'Linux' : 'unknown';
            const currentPlatform = isWindows() ? 'Windows' : 
                                  isMacOS() ? 'macOS' : 
                                  process.platform === 'linux' ? 'Linux' : process.platform;
            console.log(`⏭️  Skipping ${targetPlatform}-only module "${project.name}" as we are running on ${currentPlatform}`);
            return Promise.resolve();
          } else {
            console.error('failed ', project.name, err);
            failed = true;
            return Promise.resolve();
          }
        })
        ;
    });
  }, { concurrency: 1 })
  .then(() => failed ? 1 : 0);
}

const args = minimist(process.argv.slice(2));
main(args)
  .then(firstRunResult => {
    // only run a second time if there were failures in the first run
    if (firstRunResult === 1) {
      console.log('\nRetrying failed builds...');
      return main(args);
    } else {
      console.log('\nAll builds completed successfully on first run.');
      return firstRunResult;
    }
  })
  .then(res => process.exit(res));