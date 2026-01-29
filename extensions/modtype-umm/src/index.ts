import * as path from "path";
import { selectors, types, util } from "vortex-api";

import { validateIUMMGameConfig } from "./validationCode/validation";

import { addGameSupport, getSupportMap, UMM_EXE, UMM_ID } from "./common";
import { IUMMGameConfig } from "./types";
import { ensureUMM } from "./ummDownloader";

import { InvalidAPICallError, NotPremiumError } from "./Errors";

import { isUMMExecPred, setUMMPath, toBlue } from "./util";

import AttribDashlet from "./views/AttribDashlet";

// List of games which are supported by this modtype.
// TODO: Have this populated automatically using UMM's configuration files.
// const gameSupport = ['dawnofman', 'gardenpaws', 'pathfinderkingmaker', 'oxygennotincluded'];

function showAttrib(state: types.IState) {
  const gameMode = selectors.activeGameId(state);
  return getSupportMap()[gameMode] !== undefined;
}

function isSupported(gameId: string): boolean {
  const gameConf: IUMMGameConfig = getSupportMap()[gameId];
  return gameConf !== undefined;
}

function isUMMApp(files) {
  return files.find((file) => isUMMExecPred(file)) !== undefined;
}

function testUmmApp(files, gameId) {
  const supported = isSupported(gameId) && isUMMApp(files);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installUMM(
  api: types.IExtensionApi,
  files: string[],
  destinationPath: string,
  gameId: string,
): Promise<types.IInstallResult> {
  const execFile = files.find((file) => isUMMExecPred(file));
  const idx = execFile.indexOf(UMM_EXE);
  const installDir = selectors.installPathForGame(api.store.getState(), gameId);
  const expectedDestination = path.join(
    installDir,
    path.basename(destinationPath, ".installing"),
  );
  const fileInstructions: types.IInstruction[] = files.map((file) => {
    return {
      type: "copy",
      source: file,
      destination: file.substr(idx),
    };
  });

  const modTypeInstruction: types.IInstruction = {
    type: "setmodtype",
    value: "umm",
  };
  const attribInstr: types.IInstruction = {
    type: "attribute",
    key: "customFileName",
    value: "Unity Mod Manager",
  };

  const instructions = [].concat(
    fileInstructions,
    modTypeInstruction,
    attribInstr,
  );
  setUMMPath(api, expectedDestination, gameId);
  return Promise.resolve({ instructions });
}

async function genOnGameModeActivated(
  api: types.IExtensionApi,
  gameId: string,
) {
  if (!isSupported(gameId)) {
    return;
  }
  try {
    await ensureUMM(api, gameId);
  } catch (err) {
    if (!(err instanceof NotPremiumError)) {
      api.showErrorNotification("Failed to ensure UMM installation", err);
    }
  }
}

async function genOnCheckUpdate(
  api: types.IExtensionApi,
  gameId: string,
  mods: { [modId: string]: types.IMod },
) {
  if (!isSupported(gameId)) {
    return;
  }
  try {
    await ensureUMM(api, gameId);
  } catch (err) {
    if (!(err instanceof NotPremiumError)) {
      api.showErrorNotification("Failed to ensure UMM installation", err);
    }
  }
}

const modTypeTest = toBlue(() => Promise.resolve(false));

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame): string => {
    const state: types.IState = context.api.getState();
    const gameConf: IUMMGameConfig = getSupportMap()[game.id];
    const discovery = state.settings.gameMode.discovered[game.id];
    if (gameConf !== undefined && discovery?.path !== undefined) {
      return path.join(discovery.path, UMM_ID);
    } else {
      return undefined;
    }
  };
  context.registerInstaller(
    "umm-installer",
    15,
    toBlue((files, gameId) => testUmmApp(files, gameId)),
    toBlue((files, dest, gameId) =>
      installUMM(context.api, files, dest, gameId),
    ),
  );

  context.registerModType(
    "umm",
    15,
    isSupported,
    () => undefined,
    modTypeTest,
    {
      mergeMods: true,
      name: "Unity Mod Manager",
      deploymentEssential: false,
    },
  );

  context.registerAPI(
    "ummAddGame",
    (gameConf: IUMMGameConfig, callback?: (err: Error) => void) => {
      const validationErrors = validateIUMMGameConfig(gameConf);
      if (validationErrors.length === 0) {
        addGameSupport(gameConf);
      } else {
        const error: InvalidAPICallError = new InvalidAPICallError(
          validationErrors,
        );
        if (callback !== undefined) {
          callback(error);
        } else {
          context.api.showErrorNotification(
            "Failed to register UMM game",
            error,
            { allowReport: false },
          );
        }
      }
    },
    { minArguments: 1 },
  );

  context.registerDashlet(
    "UMM Support",
    1,
    2,
    250,
    AttribDashlet,
    showAttrib,
    () => ({}),
    undefined,
  );

  context.once(() => {
    context.api.events.on("gamemode-activated", (gameMode: string) =>
      genOnGameModeActivated(context.api, gameMode),
    );

    context.api.events.on(
      "check-mods-version",
      (gameId: string, mods: { [modId: string]: types.IMod }) =>
        genOnCheckUpdate(context.api, gameId, mods),
    );
  });

  return true;
}

export default init;
