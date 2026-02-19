import Bluebird from "bluebird";
import { execFile, spawn } from "child_process";
import path from "path";
import { promisify } from "util";

import type {
  ITestResult,
  IExtensionApi,
  IExtensionContext,
} from "../../types/api";

import { getVortexPath, UserCanceled } from "../../util/api";
import { log } from "../../util/log";
import { delayed, toPromise } from "../../util/util";
import { downloadPathForGame } from "../download_management/selectors";
import { SITE_ID } from "../gamemode_management/constants";
import { NET_CORE_DOWNLOAD } from "./constants";

const spawnAsync = (command: string, args: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      spawn(command, args)
        .on("close", () => resolve())
        .on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
};

const spawnRetry = async (
  api: IExtensionApi,
  command: string,
  args: string[],
  tries = 3,
): Promise<void> => {
  try {
    return await spawnAsync(command, args);
  } catch (err: any) {
    if (err.code === "EBUSY") {
      if (tries > 0) {
        return delayed(100).then(() =>
          spawnRetry(api, command, args, tries - 1),
        );
      } else {
        return api
          .showDialog?.(
            "error",
            "File locked",
            {
              text: 'The file "{{fileName}}" is locked, probably because it\'s being accessed by another process.',
              parameters: {
                fileName: command,
              },
            },
            [{ label: "Cancel" }, { label: "Retry" }],
          )
          .then((result) => {
            if (result.action === "Cancel") {
              return Promise.reject(new UserCanceled());
            } else {
              return spawnRetry(api, command, args);
            }
          });
      }
    }
  }
};

let dotNetResolve: ((value: void) => void) | undefined;
let dotNetReject: ((reason: any) => void) | undefined;
const dotNetAssert = new Promise<void>((resolve, reject) => {
  dotNetResolve = resolve;
  dotNetReject = reject;
});

const onDotNetSuccess = () => {
  dotNetResolve?.();
  dotNetResolve = undefined;
  dotNetReject = undefined;
};

const onDotNetFailure = (error: any) => {
  dotNetReject?.(error);
  dotNetResolve = undefined;
  dotNetReject = undefined;
};

const installDotNet = async (
  api: IExtensionApi,
  repair: boolean,
  dotnetVersion: number,
): Promise<void> => {
  if (process.platform !== "win32") {
    const error = new Error(
      `Failed to download .NET Desktop Runtime ${dotnetVersion}`,
    );
    throw "Automatic installation of .NET is only supported on Windows";
  }

  try {
    const dlId: string = await toPromise((cb) =>
      api.events.emit(
        "start-download",
        [NET_CORE_DOWNLOAD],
        { game: SITE_ID },
        undefined,
        cb,
        "replace",
        { allowInstall: false },
      ),
    );

    if (dlId === undefined) {
      const error = new Error(
        `Failed to download .NET Desktop Runtime ${dotnetVersion}`,
      );
      log("warn", "failed to download .NET");
      onDotNetFailure(error);
      throw error;
    }

    const state = api.getState();
    const download = state.persistent.downloads.files[dlId];

    if (download?.state !== "finished") {
      const error = new Error(".NET download not finished");
      log("warn", ".NET download not finished");
      onDotNetFailure(error);
      throw error;
    }

    const downloadsPath = downloadPathForGame(state, SITE_ID);
    if (!download?.localPath) {
      const error = new Error("No downloads path for game");
      log("error", "No downloads path for game", { gameId: SITE_ID });
      onDotNetFailure(error);
      throw error;
    }

    const fullPath = path.join(downloadsPath, download.localPath);

    api.showDialog?.(
      "info",
      `Microsoft .NET Desktop Runtime ${dotnetVersion} is being installed`,
      {
        bbcode:
          "Please follow the instructions in the .NET installer. If you can't see the installer window, please check if it's hidden behind another window." +
          "[br][/br][br][/br]" +
          "Please note: In rare cases you will need to restart windows before .NET works properly.",
      },
      [{ label: "Ok" }],
    );

    const args = ["/passive", "/norestart"];
    if (repair) {
      args.push("/repair");
    }

    log("info", "spawning dotnet installer", { fullPath, args });
    await spawnRetry(api, fullPath, args);

    // Installation completed successfully
    log("info", `.NET Desktop Runtime ${dotnetVersion} installed successfully`);
    onDotNetSuccess();
  } catch (err) {
    log(
      "error",
      `Failed to install .NET Desktop Runtime ${dotnetVersion}`,
      err,
    );
    onDotNetFailure(err);
    throw err;
  }
};

function execFileWrapper(
  file: string,
  args: string[] = [],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (exitCode) => {
      resolve({
        stdout: stdout,
        stderr: stderr,
        exitCode: exitCode ?? 0,
      });
    });
  });
}

async function checkNetInstall(
  api: IExtensionApi,
  dotnetVersion: number,
): Promise<ITestResult> {
  let probeExecutable: string | null = null;

  if (process.platform === "win32") {
    probeExecutable = path.join(
      getVortexPath("assets_unpacked"),
      "dotnetprobe.exe",
    );
  } else if (process.platform === "linux") {
    probeExecutable = path.join(
      getVortexPath("assets_unpacked"),
      "dotnetprobe",
    );
  } else {
    const error = new Error(
      `.NET installation check is not supported on this platform ${process.platform}`,
    );
    onDotNetFailure(error);
    return undefined!;
  }

  let stderr: string;
  let exitCode: number;

  try {
    const result = await execFileWrapper(probeExecutable, [
      dotnetVersion.toString(),
    ]);
    stderr = result.stderr;
    exitCode = result.exitCode;
  } catch (e) {
    onDotNetFailure(e);
    return undefined!;
  }

  if (exitCode === 0) {
    // .NET is already installed
    onDotNetSuccess();
    return undefined!;
  }

  if (process.platform === "linux") {
    return {
      description: {
        short: `Microsoft .NET Desktop Runtime ${dotnetVersion} required`,
        long:
          `Vortex requires .NET Desktop Runtime ${dotnetVersion} to be installed to run FOMOD mod installers.` +
          "[br][/br][br][/br]" +
          `If you already have .NET Desktop Runtime ${dotnetVersion} installed then there may be a problem with your installation and a reinstall might be needed.` +
          "[br][/br][br][/br]" +
          '[spoiler label="Show detailed error"]{{stderr}}[/spoiler]',
        replace: { stderr: stderr.replace(/\n/g, "[br][/br]") },
      },
      severity: "fatal",
    };
  }

  const result: ITestResult = {
    description: {
      short: `Microsoft .NET Desktop Runtime ${dotnetVersion} required`,
      long:
        `Vortex requires .NET Desktop Runtime ${dotnetVersion} to be installed to run FOMOD mod installers.` +
        "[br][/br][br][/br]" +
        `If you already have .NET Desktop Runtime ${dotnetVersion} installed then there may be a problem with your installation and a reinstall might be needed.` +
        "[br][/br][br][/br]" +
        'Click "Fix" below to install the required version.' +
        "[br][/br][br][/br]" +
        '[spoiler label="Show detailed error"]{{stderr}}[/spoiler]',
      replace: { stderr: stderr.replace(/\n/g, "[br][/br]") },
    },
    automaticFix: () =>
      Bluebird.resolve(installDotNet(api, false, dotnetVersion)),
    severity: "fatal",
  };

  return result;
}

/**
 * Extension initialization
 */
const main = (context: IExtensionContext): boolean => {
  const dotnetVersion = 9;

  // Register .NET Desktop Runtime check
  context.registerTest("dotnet-installed", "startup", () =>
    Bluebird.resolve(checkNetInstall(context.api, dotnetVersion)),
  );

  // Set up API extension once initialization is complete
  context.once(() => {
    context.api.ext["awaitDotnetAssert"] = () => dotNetAssert;
  });

  return true;
};

export default main;
