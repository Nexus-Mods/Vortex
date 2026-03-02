import type { IParameters, ISetItem } from "@vortex/shared/cli";

import program from "commander";
import { app } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import getVortexPath from "./getVortexPath";
import { log } from "./logging";

const ARG_COUNTS = {
  "-d": 1,
  "-i": 1,
  "-g": 1,
  "-s": 1,
  "--download": 1,
  "--install": 1,
  "--install-archive": 1,
  "--install-extension": 1,
  "--start-minimized": 1,
  "--game": 1,
  "--profile": 1,
  "--get": 1,
  "--set": 1,
  "--del": 1,
  "--run": 1,
  "--report": 1,
  "--restore": 1,
  "--merge": 1,
  "--max-memory": 1,
  "--user-data": 1,
};

const electronExecutable =
  process.platform === "win32" ? "electron.exe" : "electron";

// Chrome rearranges the command line parameters it passes to processes it spawns internally
// by putting switches (--foo) first, arguments (bar) after.
// Which is fine in chrome because it's internal processes.
// The <insert insult here>s developing electron make this internal chrome behaviour part of
// their api, basically breaking all sensible user-facing clis:
// https://github.com/electron/electron/issues/20322
//
// Fortunately, looking at the code, at least chrome seems to keep the order of switches and
// arguments so since we don't have positional arguments and as long as we know which
// switches expect an argument and as long as the
// command line passed in is valid, we should be able to reconstruct it.
function electronIsShitArgumentSort(argv: string[]): string[] {
  const firstArgumentIdx = argv.findIndex(
    (arg, idx) => idx > 1 && !arg.startsWith("-"),
  );
  const switches = argv.slice(1, firstArgumentIdx - 1);
  const args = argv.slice(firstArgumentIdx);
  let nextArg = 0;

  const res = [argv[0]];
  if (argv[0].includes(electronExecutable)) {
    // did I say we have no positional arguments? Well, electron does...
    res.push(args[nextArg]);
    nextArg++;
  }

  switches.forEach((sw) => {
    res.push(sw);
    const argCount = ARG_COUNTS[sw] || 0;
    res.push(...args.slice(nextArg, nextArg + argCount));
    nextArg += argCount;
  });

  // append all remaining arguments. This way if we do have positional arguments
  // after all, as long as they're at the end they will still work
  res.push(...args.slice(nextArg));

  return res;
}

/**
 * I think we are going to need this to transform what epic sends us which we can't help into
 * something that our commander.js library is going to parse successfully without going crazy
 * and replacing the parsing library.
 *
 * I think we are hitting walls atm with having only a single hyphen but with a word and a =
 */
function transformEpicArguments(argv: string[]): string[] {
  const epicParameterSwaps = {
    "-AUTH_LOGIN": "--epic-auth-login",
    "-AUTH_PASSWORD": "--epic-auth-password",
    "-AUTH_TYPE": "--epic-auth-type",
    "-epicapp": "--epic-app",
    "-epicenv": "--epic-env",
    "-EpicPortal": "--epic-portal",
    "-epicusername": "--epic-username",
    "-epicuserid": "--epic-userid",
    "-epiclocale": "--epic-locale",
    "-epicsandboxid": "--epic-sandboxid",
  };

  const resultArr = argv.map((element) => {
    for (const key in epicParameterSwaps) {
      if (element.indexOf(key) !== -1) {
        return element.replace(key, epicParameterSwaps[key]);
      }
    }
    return element;
  });

  return resultArr;
}

// arguments that should be dropped when restarting the application
const SKIP_ARGS = {
  "-d": 1,
  "--download": 1,
  "-i": 1,
  "--start-minimized": 1,
  "--game": 1,
  "--profile": 1,
  "--install": 1,
  "--install-archive": 1,
  "--install-extension": 1,
  "--restore": 1,
  "--merge": 1,
};

export function filterArgs(input: string[]): string[] {
  let skipCount = 0;
  const result = Array<string>();

  input.forEach((arg, idx) => {
    if (skipCount > 0) {
      skipCount--;
    } else if (idx === 0) {
      // skip
    } else if (SKIP_ARGS[arg] !== undefined) {
      skipCount = SKIP_ARGS[arg];
    } else {
      result.push(arg);
    }
  });

  return result;
}

function assign(input: string, prev: ISetItem[]): ISetItem[] {
  const [key, value] = input.split("=");
  return (prev ?? []).concat([{ key, value }]);
}

function collect(value: string, prev: string[]): string[] {
  return (prev ?? []).concat([value]);
}

function getStartupSettingsPath(): string {
  return path.join(getVortexPath("appData"), app.name, "startup.json");
}

export function getStartupSettings(): IParameters {
  const filePath = getStartupSettingsPath();

  try {
    const contents = readFileSync(filePath, "utf-8");
    return JSON.parse(contents) as IParameters;
  } catch (err) {
    log("warn", "failed to parse startup.json file", {
      path: filePath,
      error: err,
    });
    return {};
  }
}

export function updateStartupSettings(
  updater: (current: IParameters) => IParameters,
): void {
  const filePath = getStartupSettingsPath();
  const current = getStartupSettings();
  const updated = updater(current);
  const json = JSON.stringify(updated);
  writeFileSync(filePath, json);
}

export function parseCommandline(
  argv: string[],
  electronIsShitHack: boolean,
): IParameters {
  // lets look and replace epic stuff?!
  argv = transformEpicArguments(argv);

  if (!argv[0].includes(electronExecutable)) {
    argv = ["dummy"].concat(argv);
  }

  if (electronIsShitHack) {
    argv = electronIsShitArgumentSort(argv);
  }

  let version: string = "1.0.0";
  try {
    // won't happen in regular operation but lets us test this function outside vortex
    version = app.getVersion();
  } catch {
    // nop
  }

  const commandLine = program
    .command("Vortex")
    .version(version)
    .option(
      "-d, --download <url>",
      "Start downloading the specified url " +
        "(any supported protocol like nxm:, https:, ...).",
    )
    .option(
      "-i, --install <url>",
      "Start downloading & installing the specified url " +
        "(any supported protocol like nxm:, https:, ...).",
    )
    .option(
      "--install-archive <path>",
      "Start installing the specified archive. Use absolute path.",
    )
    .option(
      "--install-extension <id>",
      "Start downloading & installing the specified " +
        'vortex extension. id can be "modId:<number>".',
    )
    .option(
      "-g, --get <path>",
      "Print the state variable at the specified path and quit. " +
        "This can be used repeatedly to print multiple items",
      collect,
    )
    .option(
      "-s, --set <path=value>",
      "Change a value in the state. Please be very careful " +
        "with this, incorrect use will break Vortex and you may " +
        "lose data",
      assign,
    )
    .option("--del <path>", "Remove a value in state", collect)
    .option(
      "--user-data <path>",
      "Starts Vortex with a custom directory for the user data. " +
        "Only use if you know what you're doing.",
    )
    .option("--start-minimized", "Starts Vortex in the task bar")
    .option("--game <game id>", "Starts Vortex with a different game enabled")
    .option("--run <path>", "Execute the js program instead of Vortex itself.")
    .option("--report <path>", "Send an error report. For internal use")
    .option("--restore <path>", "Restore a state backup")
    .option(
      "--merge <path>",
      "Merge a state backup. Unlike restore, the content of the specified " +
        "state file will be merged into the existing state.",
    )
    .option(
      "--shared",
      "Used in conjunction with set, get or del, this will access the database" +
        "in the shared location instead of the per-user one",
    )
    .option(
      "--max-memory <size in MB>",
      "Maximum amount of memory Vortex may use in MB " + "(defaults to 4096)",
    )
    .option("--inspector", "Start Vortex with the chrome inspector opened")
    .option(
      "--profile <profile id>",
      "Start Vortex with a specific profile active",
    )
    .option("--epic-auth-login <login>")
    .option("--epic-auth-password <password>")
    .option("--epic-auth-type <type>")
    .option("--epic-app <app>")
    .option("--epic-env <env>")
    .option("--epic-portal")
    .option("--epic-username <username>")
    .option("--epic-userid <userid>")
    .option("--epic-locale <locale>")
    .option("--epic-sandboxid <sandboxid>")
    // allow unknown options since they may be interpreted by electron/node
    .allowUnknownOption(true)
    .parse(argv || [])
    .opts() as IParameters;

  return {
    ...getStartupSettings(),
    ...commandLine,
  };
}

export function relaunch(args?: string[]) {
  app.relaunch({ args: [...filterArgs(process.argv), ...(args || [])] });
  app.quit();
}
