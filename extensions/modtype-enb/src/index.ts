import Promise from "bluebird";
import * as path from "path";
import { types, util } from "vortex-api";

function testSupported(files: string[]): Promise<types.ISupportedResult> {
  const supported =
    files.find(
      (filePath) => path.basename(filePath).toLowerCase() === "enbseries.ini",
    ) !== undefined;
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function makeCopy(basePath: string, filePath: string): types.IInstruction {
  const len = basePath !== "." ? basePath.length + 1 : 0;
  return {
    type: "copy",
    source: filePath,
    destination: filePath.substring(0),
  };
}

function install(
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate: types.ProgressDelegate,
): Promise<types.IInstallResult> {
  const baseDirs = files
    .filter(
      (filePath) => path.basename(filePath).toLowerCase() === "enbseries.ini",
    )
    .map(path.dirname);

  const refFile = files.find(
    (filePath) => path.basename(filePath).toLowerCase() === "enbseries.ini",
  );
  const basePath = path.dirname(refFile);

  const instructions: types.IInstruction[] = files
    .filter(
      (filePath) =>
        !filePath.endsWith(path.sep) &&
        !path.relative(basePath, path.dirname(filePath)).startsWith(".."),
    )
    .map((filePath) => makeCopy(basePath, filePath));

  return Promise.resolve({ instructions });
}

function gameSupported(gameId: string) {
  const game = util.getGame(gameId);
  if (
    game.compatible?.deployToGameDirectory === false ||
    game.compatible?.enb === false
  ) {
    return false;
  }
  return !["factorio", "microsoftflightsimulator"].includes(gameId);
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame): string => {
    const state: types.IState = context.api.store.getState();
    const discovery = state.settings.gameMode.discovered[game.id];
    return discovery.path;
  };

  const testEnb = (instructions: types.IInstruction[]) => {
    if (
      instructions.find((inst) => inst.destination === "enbseries.ini") !==
      undefined
    ) {
      if (
        instructions.find((inst) => inst.destination === "d3d11.dll") !==
        undefined
      ) {
        return context.api
          .showDialog(
            "question",
            "Confirm mod installation",
            {
              text:
                "The mod you're about to install contains dll files that will run with the " +
                "game, have the same access to your system and can thus cause considerable " +
                "damage or infect your system with a virus if it's malicious.\n" +
                "Please install this mod only if you received it from a trustworthy source " +
                "and if you have a virus scanner active right now.",
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) =>
            result.action === "Continue"
              ? Promise.resolve(true)
              : Promise.reject(new util.UserCanceled()),
          );
      } else {
        return Promise.resolve(true);
      }
    } else {
      return Promise.resolve(false);
    }
  };

  context.registerModType(
    "enb",
    100,
    gameSupported,
    getPath,
    () => Promise.resolve(false),
    {
      mergeMods: true,
      name: "ENB",
    },
  );
  // context.registerInstaller('enb', 50, testSupported, install);

  return true;
}

export default init;
