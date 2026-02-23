const Promise = require("bluebird");
const { spawn } = require("child_process");
const copyfiles = require("copyfiles");
const fs = require("fs");
const fsP = require("fs").promises;
const { glob } = require("glob");
const minimist = require("minimist");
const path = require("path");
const rimraf = require("rimraf");
const vm = require("vm");

const projectGroups = JSON.parse(fs.readFileSync("./BuildSubprojects.json"));

const packageJSON = JSON.parse(fs.readFileSync("./package.json"));

const npmcli = process.platform === "win32" ? "npm.cmd" : "npm";

const yarncli = process.platform === "win32" ? "yarn.cmd" : "yarn";

const useYarn = true;

//const rebuild = path.join('node_modules', '.bin', process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild');
const globOptions = {};

const copyfilesAsync = Promise.promisify(copyfiles);
const rimrafAsync = Promise.promisify(rimraf);
const globAsync = (pattern, options) => glob(pattern, options);

class Unchanged extends Error {
  constructor() {
    super("No changes");
  }
}

class NotSupportedOnOS extends Error {
  constructor() {
    super("not supported on this OS");
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
    let desc = `${options.cwd || "."}/${exe} ${args.join(" ")}`;
    out.log("started: " + desc);
    try {
      let proc = spawn(exe, args, { ...options, shell: true });
      proc.stdout.on("data", (data) => out.log(data.toString()));
      proc.stderr.on("data", (data) => out.err(data.toString()));
      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
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
  if (!useYarn && command === "add") {
    command = "install";
  }
  return spawnAsync(
    useYarn ? yarncli : npmcli,
    [command, ...args, "--mutex", "file"],
    options,
    out,
  );
}

function changes(basePath, patterns, force) {
  if (patterns === undefined || force) {
    return Promise.resolve();
  }
  // glob all the patterns, then map all the files to their last modified time,
  // then get the newest of those modified times
  return Promise.reduce(
    patterns,
    (total, pattern) =>
      globAsync(path.join(basePath, pattern), globOptions).then((files) =>
        [].concat(total, files),
      ),
    [],
  )
    .map((filePath) => fsP.stat(filePath).then((stat) => stat.mtime.getTime()))
    .then((fileTimes) => Math.max(...fileTimes));
}

function format(fmt, parameters) {
  return fmt.replace(/{([a-zA-Z_]+)}/g, (match, key) => {
    return typeof parameters[key] !== "undefined" ? parameters[key] : match;
  });
}

function processModule(project, buildType, feedback) {
  let options = {};
  let modulePath;
  if (buildType !== "out") {
    options.cwd = path.join(__dirname, buildType);
    modulePath = path.join(buildType, "node_modules", project.module);
  } else {
    options.cwd = __dirname;
    modulePath = path.join("node_modules", project.module);
  }

  let build =
    project.build !== undefined && project.build !== false
      ? npm("install", [], { cwd: project.path }, feedback).then(() =>
          npm(
            "run",
            [typeof project.build === "string" ? project.build : "build"],
            { cwd: project.path },
            feedback,
          ),
        )
      : Promise.resolve();

  return build
    .then(() => rimrafAsync(modulePath))
    .then(() => npm("add", [project.module], options, feedback));
}

async function updateSourceMap(filePath) {
  let dat = await fs.promises.readFile(filePath, { encoding: "utf8" });

  const modPath = path.basename(path.dirname(filePath));

  dat = dat.replace(
    /\/\/# sourceMappingURL=([a-z\-.]+\.js\.map)$/,
    `//# sourceMappingURL=bundledPlugins/${modPath}/$1`,
  );

  await fs.promises.writeFile(filePath, dat);
}

function processCustom(project, buildType, feedback, noparallel) {
  const start = Date.now();
  let instArgs = noparallel ? ["--network-concurrency", "1"] : [];
  let res = npm("install", instArgs, { cwd: project.path }, feedback).then(() =>
    npm(
      "run",
      [typeof project.build === "string" ? project.build : "build"],
      { cwd: project.path },
      feedback,
    ),
  );
  if (project.copyTo !== undefined) {
    const source = path.join(project.path, "dist", "**", "*");
    const output = format(project.copyTo, { BUILD_DIR: buildType });
    feedback.log("copying files", source, output);
    res = res
      .then(() => copyfilesAsync([source, output], project.depth || 3))
      .then(() => updateSourceMap(path.join(output, "index.js")));
  }
  res = res.then(() => {
    console.log(project.path, "took", (Date.now() - start) / 1000, "s");
  });
  return res;
}

function processProject(project, buildType, feedback, noparallel) {
  if (project.os !== undefined) {
    if (!project.os.includes(process.platform)) {
      return Promise.reject(new NotSupportedOnOS());
    }
  }

  if (project.type === "install-module") {
    return processModule(project, buildType, feedback);
  } else if (project.type === "build-copy") {
    return processCustom(project, buildType, feedback, noparallel);
    // } else if (project.type === 'electron-rebuild') {
    //   return processRebuild(project, buildType, feedback);
  }
  if (project.type.startsWith("_")) {
    return Promise.resolve();
  }
  return Promise.reject(
    new Error("invalid project descriptor " + project.toString()),
  );
}

function main(args) {
  if (args.length === 0) {
    console.error("No command line parameters specified");
    return Promise.reject(1);
  }

  const globalFeedback = new ProcessFeedback("global");

  const buildType = args._[0];

  process.env.TARGET_ENV = buildType === "app" ? "production" : "development";

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
  return Promise.each(projectGroups, (projects) =>
    Promise.map(
      projects,
      (project) => {
        if (
          project.variant !== undefined &&
          buildType !== "out" &&
          process.env.VORTEX_VARIANT !== project.variant
        ) {
          return Promise.resolve();
        }
        let feedback = new ProcessFeedback(project.name);
        return changes(
          project.path || ".",
          project.sources,
          args.f || buildState[project.name] === undefined,
        )
          .then((lastChange) => {
            if (
              lastChange !== undefined &&
              lastChange < buildState[project.name]
            ) {
              return Promise.reject(new Unchanged());
            }
            return processProject(
              project,
              buildType,
              feedback,
              args.noparallel || process.env.NO_PARALLEL,
            );
          })
          .then(() => {
            buildState[project.name] = Date.now();
            return fsP.writeFile(
              buildStateName,
              JSON.stringify(buildState, undefined, 2),
            );
          })
          .catch((err) => {
            if (err instanceof Unchanged) {
              console.log("nothing to do", project.name);
            } else if (err instanceof NotSupportedOnOS) {
              console.log("not supported on this OS", project.name);
            } else {
              console.error("failed ", project.name, err);
              failed = true;
            }
          });
      },
      { concurrency: args.noparallel || process.env.NO_PARALLEL ? 1 : 10 },
    ),
  ).then(() => (failed ? 1 : 0));
}

const args = minimist(process.argv.slice(2));
main(args)
  // just run a second time, to repeat all failed builds
  .then(() => main(args))
  .then((res) => process.exit(res));
