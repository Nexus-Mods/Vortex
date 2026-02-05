// IPC handler for forked child processes requesting Electron app info
if (process.send) {
  process.on("message", (msg: unknown) => {
    if (
      typeof msg === "object" &&
      "type" in msg &&
      msg.type === "get-app-info"
    ) {
      // You can expand this object with more info as needed
      process.send({
        type: "app-info",
        appPath: app.getAppPath(),
        userData: app.getPath("userData"),
        temp: app.getPath("temp"),
        appData: app.getPath("appData"),
        exe: app.getPath("exe"),
        home: app.getPath("home"),
        documents: app.getPath("documents"),
        desktop: app.getPath("desktop"),
      });
    }
  });
}

/**
 * entry point for the main process
 */
import os from "os";

import { VORTEX_VERSION } from "./shared/constants";
process.env["UV_THREADPOOL_SIZE"] = (os.cpus().length * 2).toString();
process.env["VORTEX_VERSION"] = VORTEX_VERSION;
import "./util/application.electron";

import { app, dialog } from "electron";
import * as path from "path";

import getVortexPath from "./main/getVortexPath";

const earlyErrHandler = (error: Error) => {
  if (error.stack.includes("[as dlopen]")) {
    dialog.showErrorBox(
      "Vortex failed to start up",
      `An unexpected error occurred while Vortex was initialising:\n\n${error.message}\n\n` +
        "This is often caused by a bad installation of the app, " +
        "a security app interfering with Vortex " +
        "or a problem with the Microsoft Visual C++ Redistributable installed on your PC. " +
        "To solve this issue please try the following:\n\n" +
        "- Wait a moment and try starting Vortex again\n" +
        "- Reinstall Vortex from the Nexus Mods website\n" +
        "- Install the latest Microsoft Visual C++ Redistributable (find it using a search engine)\n" +
        "- Disable anti-virus or other security apps that might interfere and install Vortex again\n\n" +
        "If the issue persists, please create a thread in our support forum for further assistance.",
    );
  } else {
    dialog.showErrorBox(
      "Unhandled error",
      "Vortex failed to start up. This is usually caused by foreign software (e.g. Anti Virus) " +
        "interfering.\n\n" +
        error.stack,
    );
  }
  app.exit(1);
};

process.on("uncaughtException", earlyErrHandler);
process.on("unhandledRejection", earlyErrHandler);

// ensure the cwd is always set to the path containing the exe, otherwise dynamically loaded
// dlls will not be able to load vc-runtime files shipped with Vortex.
process.chdir(getVortexPath("application"));

/* the below would completely restart Vortex to ensure everything is loaded with the cwd
   reset but that doesn't seem to be necessary
// if this is the primary instance, verify we run from the right cwd, otherwise
// vc runtime files might not load correctly
if (!process.argv.includes('--relaunched')
  && (path.normalize(process.cwd()).toLowerCase()
    !== path.normalize(getVortexPath('application')).toLowerCase())) {
  // tslint:disable-next-line:no-var-requires
  const cp: typeof child_processT = require('child_process');
  const args = [].concat(['--relaunched'], process.argv.slice(1));
  const proc = cp.spawn(process.execPath, args, {
    cwd: getVortexPath('application'),
    detached: true,
  });
  app.quit();
}
*/

import * as sourceMapSupport from "source-map-support";

import { DEBUG_PORT, HTTP_HEADER_SIZE } from "./shared/constants";
sourceMapSupport.install();

import requireRemap from "./util/requireRemap";
requireRemap();

function setEnv(key: string, value: string, force?: boolean) {
  if (process.env[key] === undefined || force) {
    process.env[key] = value;
  }
}

if (process.env.NODE_ENV !== "development") {
  setEnv("NODE_ENV", "production", true);
} else {
  const rebuildRequire = require("./util/requireRebuild").default;
  rebuildRequire();
}

if (process.platform === "win32" && process.env.NODE_ENV !== "development") {
  // On windows dlls may be loaded from directories in the path variable
  // (which I don't know why you'd ever want that) so I filter path quite aggressively here
  // to prevent dynamically loaded dlls to be loaded from unexpected locations.
  // The most common problem this should prevent is the edge dll being loaded from
  // "Browser Assistant" instead of our own.

  const userPath =
    (process.env.HOMEDRIVE || "c:") + (process.env.HOMEPATH || "\\Users");
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const programData = process.env.ProgramData || "C:\\ProgramData";

  const pathFilter = (envPath: string): boolean => {
    return (
      !envPath.startsWith(userPath) &&
      !envPath.startsWith(programData) &&
      !envPath.startsWith(programFiles) &&
      !envPath.startsWith(programFilesX86)
    );
  };

  process.env["PATH_ORIG"] = process.env["PATH"].slice(0);
  process.env["PATH"] = process.env["PATH"]
    .split(";")
    .filter(pathFilter)
    .join(";");
}

// Produce english error messages (windows only atm), otherwise they don't get
// grouped correctly when reported through our feedback system
import type * as winapiT from "winapi-bindings";

try {
  const winapi: typeof winapiT = require("winapi-bindings");
  winapi?.SetProcessPreferredUILanguages?.(["en-US"]);
} catch (err) {
  // nop
}

import Application from "./main/Application";
import commandLine from "./util/commandLine";
import { sendReportFile, terminate, toError } from "./util/errorHandling";
// ensures tsc includes this dependency
// Activate vortex-api polyfill for all extension requires as early as possible
import extensionRequire from "./util/extensionRequire";
import {} from "./util/requireRebuild";
extensionRequire(() => []); // Use an empty array or replace with a global accessor if needed
import type * as child_processT from "child_process";

// required for the side-effect!
import "./util/exeIcon";
import "./util/monkeyPatching";
import "./main/webview";
import { getErrorMessage } from "./shared/errors";
import {} from "./util/extensionRequire";
import * as fs from "./util/fs";

process.env.Path = process.env.Path + path.delimiter + __dirname;

let application: Application;

const handleError = (error: Error) => {
  if (Application.shouldIgnoreError(error)) {
    return;
  }

  terminate(toError(error), {});
};

async function firstTimeInit() {
  // use this to do first time setup, that is: code to be run
  // only the very first time vortex starts up.
  // This functionality was introduced but then we ended up solving
  // the problem in a different way that's why this is unused currently
}

async function main(): Promise<void> {
  // important: The following has to be synchronous!
  const mainArgs = commandLine(process.argv, false);
  if (mainArgs.report) {
    return sendReportFile(mainArgs.report).then(() => {
      app.quit();
    });
  }

  const NODE_OPTIONS = process.env.NODE_OPTIONS || "";
  process.env.NODE_OPTIONS =
    NODE_OPTIONS +
    ` --max-http-header-size=${HTTP_HEADER_SIZE}` +
    " --no-force-async-hooks-checks";

  if (mainArgs.disableGPU) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch("--disable-software-rasterizer");
    app.commandLine.appendSwitch("--disable-gpu");
  }

  app.commandLine.appendSwitch("disable-features", "WidgetLayering");
  app.commandLine.appendSwitch(
    "disable-features",
    "UseEcoQoSForBackgroundProcess",
  );

  // --run has to be evaluated *before* we request the single instance lock!
  if (mainArgs.run !== undefined) {
    // Vortex here acts only as a trampoline (probably elevated) to start
    // some other process
    const cp: typeof child_processT = require("child_process");
    cp.spawn(process.execPath, [mainArgs.run], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        ELECTRON_USERDATA: app.getPath("userData"),
        ELECTRON_TEMP: app.getPath("temp"),
        ELECTRON_APPDATA: app.getPath("appData"),
        ELECTRON_HOME: app.getPath("home"),
        ELECTRON_DOCUMENTS: app.getPath("documents"),
        ELECTRON_EXE: app.getPath("exe"),
        ELECTRON_DESKTOP: app.getPath("desktop"),
        ELECTRON_APP_PATH: app.getAppPath(),
        ELECTRON_ASSETS: path.join(app.getAppPath(), "assets"),
        ELECTRON_ASSETS_UNPACKED: path.join(
          app.getAppPath() + ".unpacked",
          "assets",
        ),
        ELECTRON_MODULES: path.join(app.getAppPath(), "node_modules"),
        ELECTRON_MODULES_UNPACKED: path.join(
          app.getAppPath() + ".unpacked",
          "node_modules",
        ),
        ELECTRON_BUNDLEDPLUGINS: path.join(
          app.getAppPath() + ".unpacked",
          "bundledPlugins",
        ),
        ELECTRON_LOCALES: path.resolve(app.getAppPath(), "..", "locales"),
        ELECTRON_BASE: app.getAppPath(),
        ELECTRON_APPLICATION: path.resolve(app.getAppPath(), ".."),
        ELECTRON_PACKAGE: app.getAppPath(),
        ELECTRON_PACKAGE_UNPACKED: path.join(
          path.dirname(app.getAppPath()),
          "app.asar.unpacked",
        ),
      },
      stdio: "inherit",
      detached: true,
    }).on("error", (err) => {
      // TODO: In practice we have practically no information about what we're running
      //       at this point
      dialog.showErrorBox("Failed to run script", err.message);
    });
    // quit this process, the new one is detached
    app.quit();
    return;
  }

  if (!app.requestSingleInstanceLock()) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch("--in-process-gpu");
    app.commandLine.appendSwitch("--disable-software-rasterizer");
    app.quit();
    return;
  }

  // async code only allowed from here on out

  try {
    await fs.statAsync(getVortexPath("userData"));
  } catch {
    await firstTimeInit();
  }

  process.on("uncaughtException", handleError);
  process.on("unhandledRejection", handleError);

  if (
    process.env.NODE_ENV === "development" &&
    !app.commandLine.hasSwitch("remote-debugging-port")
  ) {
    app.commandLine.appendSwitch("remote-debugging-port", DEBUG_PORT);
  }

  let fixedT = require("i18next").getFixedT("en");
  try {
    fixedT("dummy");
  } catch {
    fixedT = (input) => input;
  }

  /* allow application controlled scaling
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  */
  application = new Application(mainArgs);
}

main().catch((err: unknown) => console.error("failed to start", err));
