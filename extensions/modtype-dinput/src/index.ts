import Promise from "bluebird";
import * as path from "path";
import { selectors, types, util } from "vortex-api";

function testSupported(files: string[]): Promise<types.ISupportedResult> {
  const supported =
    files.find(
      (filePath) => path.basename(filePath).toLowerCase() === "dinput8.dll",
    ) !== undefined;
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function makeCopy(
  basePath: string,
  filePath: string,
  executablePath: string,
): types.IInstruction {
  return {
    type: "copy",
    source: filePath,
    destination: path.join(
      path.dirname(executablePath),
      path.relative(basePath, filePath),
    ),
  };
}

function install(
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate: types.ProgressDelegate,
  api: types.IExtensionApi,
): Promise<types.IInstallResult> {
  const refFile = files.find(
    (filePath) => path.basename(filePath).toLowerCase() === "dinput8.dll",
  );
  const state = api.getState();
  const game: types.IGameStored = selectors.gameById(state, gameId);
  const basePath = path.dirname(refFile);

  const instructions: types.IInstruction[] = files
    .filter(
      (filePath) =>
        !filePath.endsWith(path.sep) &&
        (basePath === "." || filePath.startsWith(basePath + path.sep)),
    )
    .map((filePath) => makeCopy(basePath, filePath, game.executable));

  return Promise.resolve({ instructions });
}

function gameSupported(gameId: string) {
  const game = util.getGame(gameId);
  if (
    game.compatible?.deployToGameDirectory === false ||
    game.compatible?.dinput === false
  ) {
    return false;
  }
  return !["factorio", "microsoftflightsimulator"].includes(gameId);
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame): string => {
    const state: types.IState = context.api.store.getState();
    const discovery = state.settings.gameMode.discovered[game.id];
    if (discovery !== undefined) {
      return discovery.path;
    } else {
      return undefined;
    }
  };

  const testDinput = (instructions: types.IInstruction[]) => {
    if (
      instructions.find((inst) => inst.destination === "dinput8.dll") !==
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
      return Promise.resolve(false);
    }
  };

  context.registerModType("dinput", 100, gameSupported, getPath, testDinput, {
    mergeMods: true,
    name: "Engine Injector",
  });
  context.registerInstaller(
    "dinput",
    50,
    testSupported,
    (files, destinationPath, gameId, progressDelegate) =>
      install(files, destinationPath, gameId, progressDelegate, context.api),
  );

  return true;
}

export default init;
