/**
 * Launch the development build of Vortex against a fixture written by generate.ts.
 *
 * The fixture gets its own user-data directory under the output folder, passed with the
 * `--user-data` switch that `src/main/src/Application.ts` honours: the state database and the
 * log land there, nothing in the regular development profile is touched. On the first launch
 * the fixture's state.json is imported with `--merge` (Application.importBackup); later launches
 * reuse the persisted state, so what the tester did last time is still there. `--reset` wipes
 * the user-data directory and imports again.
 *
 * Usage (from repo root, after `pnpm run build`):
 *   pnpm run fixture:collection:launch -- [--out <dir>] [--debug] [--reset]
 *
 * --debug adds the Node inspector on 9229. The renderer's remote debugging port (9222) is on
 * in every development launch, so the chrome-devtools MCP attaches without it.
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import { DEFAULT_OUT_DIR, parseArgs } from "./generate";
import type { IFixturePaths } from "./types";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const MAIN_DIR = path.join(REPO_ROOT, "src", "main");

const HELP = `Launch Vortex against a generated collection fixture.

Options:
  --out <dir>   the fixture directory generate.ts wrote (default: ${DEFAULT_OUT_DIR})
  --debug       start with the Node inspector on port 9229
  --reset       delete the fixture's user-data and import state.json again
  --print-config  print the launch command and environment as JSON instead of launching
  --help        this text
`;

const REQUIRED_PATHS = ["userDataDir", "stateFile", "gameDir", "stagingDir"] as const;

function hasFixturePaths(value: unknown): value is { paths: IFixturePaths } {
  if (typeof value !== "object" || value === null || !("paths" in value)) {
    return false;
  }
  const { paths } = value;
  return (
    typeof paths === "object" &&
    paths !== null &&
    REQUIRED_PATHS.every((key) => typeof Reflect.get(paths, key) === "string")
  );
}

function readPaths(outDir: string): IFixturePaths {
  const fixtureFile = path.join(outDir, "fixture.json");
  if (!fs.existsSync(fixtureFile)) {
    throw new Error(`${fixtureFile} not found; run "pnpm run fixture:collection" first`);
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
  if (!hasFixturePaths(parsed)) {
    throw new Error(`${fixtureFile} is not a fixture description; regenerate the fixture`);
  }
  return parsed.paths;
}

/** the electron package's main export is the path of its binary */
function electronBinary(): string {
  const binary: unknown = createRequire(path.join(MAIN_DIR, "package.json"))("electron");
  if (typeof binary !== "string") {
    throw new Error("could not resolve the electron binary from src/main");
  }
  return binary;
}

export interface ILaunchConfig {
  /** the electron binary */
  command: string;
  args: string[];
  cwd: string;
  /** variables to set on top of the caller's environment */
  env: Record<string, string>;
  /** variables to remove from the caller's environment */
  unsetEnv: string[];
  paths: IFixturePaths;
  /** true when this launch imports state.json (no user-data yet) */
  firstRun: boolean;
}

/**
 * Everything needed to start Vortex against a fixture. Creates the settings folders and, with
 * `reset`, deletes the user-data so the next launch imports the fixture again. Shared with the
 * benchmark (packages/e2e/src/benchmark), which reads it through `--print-config`.
 */
export function launchConfig(
  outDir: string,
  opts: { reset: boolean; debug: boolean },
): ILaunchConfig {
  const paths = readPaths(outDir);
  if (!fs.existsSync(path.join(MAIN_DIR, "build", "main.cjs"))) {
    throw new Error('src/main/build/main.cjs is missing; run "pnpm run build" first');
  }
  if (opts.reset && fs.existsSync(paths.userDataDir)) {
    fs.rmSync(paths.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  const firstRun = !fs.existsSync(paths.userDataDir);

  // keep game settings inside the fixture: Bethesda games keep plugins.txt under LOCALAPPDATA and
  // their ini files under Documents\My Games, both of which deployment writes. The documents
  // override is read by src/main/src/main.ts. Fixtures generated before these paths were recorded
  // fall back to the same locations.
  const localAppData = paths.localAppDataDir ?? path.join(outDir, "local-app-data");
  const documents = paths.documentsDir ?? path.join(outDir, "documents");
  fs.mkdirSync(localAppData, { recursive: true });
  fs.mkdirSync(documents, { recursive: true });

  return {
    command: electronBinary(),
    args: [
      ...(opts.debug ? ["--inspect=9229"] : []),
      MAIN_DIR,
      "--user-data",
      paths.userDataDir,
      ...(firstRun ? ["--merge", paths.stateFile] : []),
    ],
    cwd: MAIN_DIR,
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "development",
      LOCALAPPDATA: localAppData,
      VORTEX_DOCUMENTS_PATH: documents,
    },
    // a VS Code terminal can leak this into child processes, which turns electron into plain node
    unsetEnv: ["ELECTRON_RUN_AS_NODE"],
    paths: { ...paths, localAppDataDir: localAppData, documentsDir: documents },
    firstRun,
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help")) {
    process.stdout.write(HELP);
    return;
  }
  const outFlag = args.flags.get("out");
  const outDir = path.resolve(
    outFlag === undefined || outFlag === true ? DEFAULT_OUT_DIR : outFlag,
  );
  const config = launchConfig(outDir, {
    reset: args.flags.get("reset") === true,
    debug: args.flags.get("debug") === true,
  });

  if (args.flags.get("print-config") === true) {
    process.stdout.write(JSON.stringify(config));
    return;
  }

  const env: NodeJS.ProcessEnv = { ...process.env, ...config.env };
  for (const name of config.unsetEnv) {
    delete env[name];
  }
  const { paths } = config;
  process.stdout.write(
    [
      `Launching Vortex (${config.firstRun ? "first run: importing state.json" : "reusing user-data"})`,
      `  user-data: ${paths.userDataDir}`,
      `  game:      ${paths.gameDir}`,
      `  staging:   ${paths.stagingDir}`,
      `  settings:  ${paths.documentsDir} and ${paths.localAppDataDir}`,
      "",
    ].join("\n"),
  );

  const child = spawn(config.command, config.args, { env, cwd: config.cwd, stdio: "inherit" });
  const forward = (signal: NodeJS.Signals) => () => {
    child.kill(signal);
  };
  process.on("SIGINT", forward("SIGINT"));
  process.on("SIGTERM", forward("SIGTERM"));
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
