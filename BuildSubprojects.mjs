import { glob } from "glob";
import parseArgs from "minimist";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as fsP from "node:fs/promises";
import * as path from "node:path";
import copyfiles from "copyfiles";
import pLimit from "p-limit";

import projectGroups from "./BuildSubprojects.json" with { type: "json" };

const npmcli = process.platform === "win32" ? "npm.cmd" : "npm";
const yarncli = process.platform === "win32" ? "yarn.cmd" : "yarn";
const useYarn = true;

const copyfilesAsync = (args, config) =>
  new Promise((resolve) => copyfiles(args, config, resolve));

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

async function changes(basePath, patterns, force) {
  if (patterns === undefined || force) {
    return;
  }

  // glob all the patterns, then map all the files to their last modified time,
  // then get the newest of those modified times
  const filePaths = await patterns.reduce((promiseChain, pattern) => {
    return promiseChain.then(async (total) => {
      const files = await glob(path.join(basePath, pattern), {});
      return [...total, ...files];
    });
  }, Promise.resolve([]));

  const fileTimes = await Promise.all(
    filePaths.map(async (filePath) => {
      const stat = await fsP.stat(filePath);
      return stat.mtime.getTime();
    }),
  );

  return Math.max(fileTimes);
}

function format(fmt, parameters) {
  return fmt.replace(/{([a-zA-Z_]+)}/g, (match, key) => {
    return typeof parameters[key] !== "undefined" ? parameters[key] : match;
  });
}

async function updateSourceMap(filePath) {
  let dat = await fsP.readFile(filePath, { encoding: "utf8" });

  const modPath = path.basename(path.dirname(filePath));

  dat = dat.replace(
    /\/\/# sourceMappingURL=([a-z\-.]+\.js\.map)$/,
    `//# sourceMappingURL=bundledPlugins/${modPath}/$1`,
  );

  await fsP.writeFile(filePath, dat);
}

async function processCustom(project, buildDir, feedback, noparallel) {
  const start = Date.now();
  let instArgs = noparallel ? ["--network-concurrency", "1"] : [];

  await npm("install", instArgs, { cwd: project.path }, feedback);
  await npm(
    "run",
    [typeof project.build === "string" ? project.build : "build"],
    { cwd: project.path },
    feedback,
  );

  if (project.copyTo !== undefined) {
    const source = path.join(project.path, "dist", "**", "*");
    const output = format(project.copyTo, { BUILD_DIR: buildDir });
    feedback.log("copying files", source, output);

    // NOTE(erri120): this is fucking stupid but I can't be bothered to change it
    await copyfilesAsync([source, output], project.depth || 3);
    await updateSourceMap(path.join(output, "index.js"));
  }

  console.log(project.path, "took", (Date.now() - start) / 1000, "s");
}

function processProject(project, buildDir, feedback, noparallel) {
  if (project.os !== undefined) {
    if (!project.os.includes(process.platform)) {
      return Promise.reject(new NotSupportedOnOS());
    }
  }

  if (project.type === "build-copy") {
    return processCustom(project, buildDir, feedback, noparallel);
  }

  if (project.type.startsWith("_")) {
    return Promise.resolve();
  }
  return Promise.reject(
    new Error("invalid project descriptor " + project.toString()),
  );
}

async function work(project, buildType, buildDir, buildState, buildStateName) {
  try {
    if (
      project.variant !== undefined &&
      buildType !== "out" &&
      process.env.VORTEX_VARIANT !== project.variant
    ) {
      return;
    }

    let feedback = new ProcessFeedback(project.name);

    const lastChange = await changes(
      project.path || ".",
      project.sources,
      args.f || buildState[project.name] === undefined,
    );

    if (lastChange !== undefined && lastChange < buildState[project.name]) {
      throw new Unchanged();
    }

    await processProject(
      project,
      buildDir,
      feedback,
      args.noparallel || process.env.NO_PARALLEL,
    );

    buildState[project.name] = Date.now();
    await fsP.writeFile(
      buildStateName,
      JSON.stringify(buildState, undefined, 2),
    );
  } catch (err) {
    if (err instanceof Unchanged) {
      console.log("nothing to do", project.name);
    } else if (err instanceof NotSupportedOnOS) {
      console.log("not supported on this OS", project.name);
    } else {
      console.error("failed ", project.name, err);
      return true;
    }
  }
  return false;
}

async function main(args) {
  if (args.length === 0) {
    console.error("No command line parameters specified");
    return;
  }

  const globalFeedback = new ProcessFeedback("global");

  const buildDir = args._[0];
  const buildType = path.basename(buildDir);

  process.env.TARGET_ENV = buildType === "dist" ? "production" : "development";

  const buildStateName = `./BuildState_${buildType}.json`;
  let buildState;

  try {
    buildState = JSON.parse(fs.readFileSync(buildStateName));
  } catch {
    buildState = {};
  }

  const limit = pLimit(process.env.NO_PARALLEL ? 1 : 10);
  const promises = projectGroups.map((project) =>
    limit(() => work(project, buildType, buildDir, buildState, buildStateName)),
  );

  await Promise.all(promises);
}

const args = parseArgs(process.argv.slice(2));
await main(args);
process.exit();
