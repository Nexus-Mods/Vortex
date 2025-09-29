const Promise = require('bluebird');
const { spawn } = require('child_process');
const copyfiles = require('copyfiles');
const fs = require('fs');
const fsP = require('fs').promises;
const { glob } = require('glob');
const minimist = require('minimist');
const path = require('path');
const rimraf = require('rimraf');
const vm = require('vm');
const crypto = require('crypto');

const projectGroups = JSON.parse(fs.readFileSync('./BuildSubprojects.json'));
const packageJSON = JSON.parse(fs.readFileSync('./package.json'));

const npmcli = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const yarncli = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const useYarn = true;

const globOptions = { };
const copyfilesAsync = Promise.promisify(copyfiles);
const rimrafAsync = Promise.promisify(rimraf);
const globAsync = (pattern, options) => glob(pattern, options);

// IMPROVEMENT 1: Add verbose logging option (will be set from command line args)
let VERBOSE = false;

class Unchanged extends Error {
  constructor(reason) {
    super(`No changes: ${reason}`);
    this.reason = reason;
  }
}

class ConditionNotMet extends Error {
  constructor() {
    super('Condition not met');
  }
}

class ProcessFeedback {
  constructor(id) {
    this.id = id;
    this.output = [];
  }

  finish(desc, code) {
    if (code !== 0 || VERBOSE) {
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
  return spawnAsync(useYarn ? yarncli : npmcli, [command, ...args, '--mutex', 'file'], options, out);
}

// IMPROVEMENT 2: Better change detection with content hashing
async function getProjectHash(basePath, patterns) {
  if (!patterns || patterns.length === 0) {
    // No patterns means always rebuild
    if (VERBOSE) console.log(`No source patterns for ${basePath}`);
    return null;
  }

  const files = await Promise.reduce(patterns,
    async (total, pattern) => {
      // Glob needs forward slashes, even on Windows
      const fullPattern = path.join(basePath, pattern).replace(/\\/g, '/');
      const matches = await globAsync(fullPattern, globOptions);
      if (VERBOSE && matches.length === 0) {
        console.log(`Warning: pattern '${pattern}' matched no files in ${basePath}`);
      }
      // Filter out build artifacts and dependencies to avoid rebuild loops
      const filtered = matches.filter(file =>
        !file.includes(`${path.sep}dist${path.sep}`) &&
        !file.includes(`${path.sep}out${path.sep}`) &&
        !file.includes(`${path.sep}node_modules${path.sep}`) &&
        !file.includes(`${path.sep}validationCode${path.sep}`)); // validationCode is modtype-umm specific generated code
      return [...total, ...filtered];
    }, []);

  if (files.length === 0) {
    if (VERBOSE) console.log(`No files found for patterns in ${basePath}`);
    // Return a hash of the patterns themselves so we detect pattern changes
    const hash = crypto.createHash('md5');
    hash.update(patterns.join('|'));
    return 'empty-' + hash.digest('hex').substring(0, 8);
  }

  // Sort files for consistent hashing
  files.sort();

  const hash = crypto.createHash('md5');

  // Hash file paths and modification times
  for (const filePath of files) {
    try {
      const stat = await fsP.stat(filePath);
      hash.update(filePath);
      hash.update(stat.mtime.toISOString());
      hash.update(stat.size.toString());
    } catch (err) {
      // File might have been deleted
      if (VERBOSE) console.log(`Warning: could not stat ${filePath}: ${err.message}`);
    }
  }

  return hash.digest('hex');
}

// IMPROVEMENT 3: Check for actual changes
async function hasChanges(project, buildState, buildType, force) {
  if (force) {
    if (VERBOSE) console.log(`Force rebuilding ${project.name}`);
    return { changed: true, reason: 'forced' };
  }

  if (!project.sources) {
    if (VERBOSE) console.log(`No sources defined for ${project.name}, rebuilding`);
    return { changed: true, reason: 'no sources defined' };
  }

  const currentHash = await getProjectHash(project.path || '.', project.sources);

  // Handle both old (timestamp) and new (hash) formats
  const previousState = buildState[project.name];
  const previousHash = typeof previousState === 'object' ? previousState.hash : null;

  if (!previousHash) {
    if (VERBOSE) console.log(`No previous build or old format for ${project.name}`);
    return { changed: true, reason: 'first build or format upgrade' };
  }

  if (currentHash !== previousHash) {
    if (VERBOSE) console.log(`Hash changed for ${project.name}: ${previousHash} -> ${currentHash}`);
    return { changed: true, reason: 'files changed', hash: currentHash };
  }

  // IMPROVEMENT 4: Check if output exists
  if (project.copyTo) {
    const outputPath = format(project.copyTo, { BUILD_DIR: buildType });
    const outputExists = await fsP.access(outputPath).then(() => true).catch(() => false);
    if (!outputExists) {
      if (VERBOSE) console.log(`Output missing for ${project.name}: ${outputPath}`);
      return { changed: true, reason: 'output missing' };
    }
  }

  return { changed: false, reason: 'unchanged', hash: currentHash };
}

function format(fmt, parameters) {
  return fmt.replace(/{([a-zA-Z_]+)}/g, (match, key) => {
    return typeof parameters[key] !== 'undefined' ? parameters[key] : match;
  });
}

function processModule(project, buildType, feedback) {
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
    .then(() => npm('add', [project.module], options, feedback));
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
    console.log(project.path, 'took', (Date.now() - start) / 1000, 's');
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
    return Promise.reject(new ConditionNotMet());
  }
  if (project.type === 'install-module') {
    return processModule(project, buildType, feedback);
  } else if (project.type === 'build-copy') {
    return processCustom(project, buildType, feedback, noparallel);
  }
  if (project.type.startsWith('_')) {
    return Promise.resolve();
  }
  return Promise.reject(new Error('invalid project descriptor ' + project.toString()));
}

// IMPROVEMENT 5: Better concurrency control
async function main(args) {
  // Check if buildType is provided
  if (!args._ || args._.length === 0 || !args._[0]) {
    console.error('Error: No build type specified\n');
    showHelp();
    return 1;  // Return exit code directly instead of rejecting
  }

  // Set verbose from command line args
  VERBOSE = args.verbose || args.v || false;

  const globalFeedback = new ProcessFeedback('global');
  const buildType = args._[0];

  process.env.TARGET_ENV = (buildType === 'app') ? 'production' : 'development';

  // Use a different state file name to avoid conflicts with original script
  // Can be overridden with --state-file argument
  const stateFileSuffix = args['state-file'] || 'improved';
  const buildStateName = `./BuildState_${buildType}.${stateFileSuffix}.json`;

  if (VERBOSE) {
    console.log(`Using build state file: ${buildStateName}`);
  }

  let buildState;

  try {
    buildState = JSON.parse(fs.readFileSync(buildStateName));
  } catch (err) {
    buildState = {};
  }

  let failed = false;
  // If --noparallel is set, use concurrency 1, otherwise use -j value or default 8
  const concurrency = args.noparallel ? 1 : (args.j ? parseInt(args.j) : 8);

  // Process groups sequentially, projects in parallel
  for (const projects of projectGroups) {
    await Promise.map(projects, async (project) => {
      if ((project.variant !== undefined) && (buildType !== 'out') && (process.env.VORTEX_VARIANT !== project.variant)) {
        return;
      }

      const feedback = new ProcessFeedback(project.name);

      try {
        const changeInfo = await hasChanges(project, buildState, buildType, args.f);

        if (!changeInfo.changed) {
          console.log(`nothing to do ${project.name} (${changeInfo.reason})`);
          return;
        }

        if (VERBOSE) {
          console.log(`Building ${project.name}: ${changeInfo.reason}`);
        }

        await processProject(project, buildType, feedback, args.noparallel);

        // Save the hash of the successfully built project
        buildState[project.name] = {
          hash: changeInfo.hash || await getProjectHash(project.path || '.', project.sources),
          timestamp: Date.now()
        };

        await fsP.writeFile(buildStateName, JSON.stringify(buildState, undefined, 2));

      } catch (err) {
        if (err instanceof Unchanged) {
          console.log(`nothing to do ${project.name} (${err.reason})`);
        } else if (err instanceof ConditionNotMet) {
          console.log(`condition wasn't met ${project.name}`);
        } else {
          console.error(`failed ${project.name}:`, err.message);
          if (VERBOSE && err.stack) {
            console.error(err.stack);
          }
          failed = true;
        }
      }
    }, { concurrency });
  }

  return failed ? 1 : 0;
}

// Helper function to show help
function showHelp() {
  console.log(`
Usage: node BuildSubprojects.js <buildType> [options]

Build Types:
  out             Development build
  app             Production build

Options:
  -f              Force rebuild all projects
  -j <number>     Set parallel build concurrency (default: 8)
  --noparallel    Disable parallel npm operations
  -v, --verbose   Show detailed build output
  --state-file    State file suffix (default: 'improved')
  -h, --help      Show this help

Examples:
  node BuildSubprojects.js out              # Normal development build
  node BuildSubprojects.js out -f           # Force rebuild everything
  node BuildSubprojects.js out -v           # Verbose output
  node BuildSubprojects.js out -v -j 2      # Verbose with 2 parallel builds
  node BuildSubprojects.js app              # Production build
`);
}

const args = minimist(process.argv.slice(2));

// IMPROVEMENT 6: Add help text
if (args.help || args.h) {
  showHelp();
  process.exit(0);
}

// Run main and handle exit codes properly
(async () => {
  try {
    const firstRun = await main(args);
    if (firstRun === 0) {
      process.exit(0);
    } else {
      // Retry failed builds once
      console.log('Retrying failed builds...');
      const secondRun = await main(args);
      process.exit(secondRun);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    if (VERBOSE && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
})();